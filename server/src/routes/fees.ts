import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, assertCanAccessStudent, ADMINS } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { getFeeBalance } from "../services/feeService";

const router = Router();
router.use(authenticate);

const FEE_MANAGERS: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT];

// ── Fee categories ───────────────────────────────────────────────────────────

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.feeCategory.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, data: categories });
  })
);

router.post(
  "/categories",
  authorize(...FEE_MANAGERS),
  validate(z.object({ body: z.object({ name: z.string().min(2), description: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const category = await prisma.feeCategory.create({ data: { ...req.body, schoolId: school.id } });
    audit(req, "fees.category_create", "FeeCategory", category.id);
    res.status(201).json({ success: true, data: category });
  })
);

router.put(
  "/categories/:id",
  authorize(...FEE_MANAGERS),
  validate(z.object({ body: z.object({ name: z.string().min(2), description: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const category = await prisma.feeCategory.update({
      where: { id: req.params.id },
      data: req.body,
    });
    audit(req, "fees.category_update", "FeeCategory", category.id);
    res.json({ success: true, data: category });
  })
);

router.delete(
  "/categories/:id",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    await prisma.feeCategory.delete({ where: { id: req.params.id } });
    audit(req, "fees.category_delete", "FeeCategory", req.params.id);
    res.json({ success: true, message: "Category deleted" });
  })
);

// ── Fee structures (amount per class × term × category) ─────────────────────

router.get(
  "/structures",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    const { termId, classRoomId } = req.query as Record<string, string | undefined>;
    const structures = await prisma.feeStructure.findMany({
      where: { ...(termId ? { termId } : {}), ...(classRoomId ? { classRoomId } : {}) },
      include: {
        category: true,
        classRoom: { select: { id: true, name: true, level: true } },
        term: { include: { session: { select: { name: true } } } },
      },
      orderBy: [{ classRoom: { level: "asc" } }, { category: { name: "asc" } }],
    });
    res.json({ success: true, data: structures });
  })
);

router.post(
  "/structures",
  authorize(...FEE_MANAGERS),
  validate(
    z.object({
      body: z.object({
        termId: z.string(),
        classRoomId: z.string(),
        categoryId: z.string(),
        amount: z.number().positive(),
        dueDate: z.coerce.date().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const { termId, classRoomId, categoryId, amount, dueDate } = req.body;
    const structure = await prisma.feeStructure.upsert({
      where: { termId_classRoomId_categoryId: { termId, classRoomId, categoryId } },
      update: { amount, dueDate },
      create: { schoolId: school.id, termId, classRoomId, categoryId, amount, dueDate },
      include: { category: true, classRoom: { select: { name: true } } },
    });
    audit(req, "fees.structure_upsert", "FeeStructure", structure.id);
    res.status(201).json({ success: true, data: structure });
  })
);

router.delete(
  "/structures/:id",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    await prisma.feeStructure.delete({ where: { id: req.params.id } });
    audit(req, "fees.structure_delete", "FeeStructure", req.params.id);
    res.json({ success: true, message: "Fee structure removed" });
  })
);

// ── Waivers / discounts ──────────────────────────────────────────────────────

router.get(
  "/waivers",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    const { studentId, termId } = req.query as Record<string, string | undefined>;
    const waivers = await prisma.feeWaiver.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(termId ? { termId } : {}),
      },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
        term: { include: { session: { select: { name: true } } } },
      },
      orderBy: { id: "desc" },
    });
    res.json({ success: true, data: waivers });
  })
);

router.post(
  "/waivers",
  authorize(...FEE_MANAGERS),
  validate(
    z.object({
      body: z.object({
        studentId: z.string(),
        termId: z.string(),
        amount: z.number().positive(),
        reason: z.string().min(3),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const waiver = await prisma.feeWaiver.create({ data: req.body });
    audit(req, "fees.waiver_create", "FeeWaiver", waiver.id, { amount: req.body.amount });
    res.status(201).json({ success: true, data: waiver });
  })
);

router.delete(
  "/waivers/:id",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    await prisma.feeWaiver.delete({ where: { id: req.params.id } });
    audit(req, "fees.waiver_delete", "FeeWaiver", req.params.id);
    res.json({ success: true, message: "Discount removed" });
  })
);

// ── Balances ─────────────────────────────────────────────────────────────────

// GET /fees/balance/:studentId?termId= — staff, the student, or their parent
router.get(
  "/balance/:studentId",
  asyncHandler(async (req, res) => {
    await assertCanAccessStudent(req, req.params.studentId);
    const termId = req.query.termId as string | undefined;
    const term = termId
      ? await prisma.term.findUnique({ where: { id: termId } })
      : await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!term) throw ApiError.badRequest("No term specified and no current term configured");
    const balance = await getFeeBalance(req.params.studentId, term.id);
    res.json({ success: true, data: balance });
  })
);

// GET /fees/debtors?termId=&classRoomId= — outstanding fees report (bursar/admin)
router.get(
  "/debtors",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    const termId = req.query.termId as string | undefined;
    const classRoomId = req.query.classRoomId as string | undefined;
    const term = termId
      ? await prisma.term.findUnique({ where: { id: termId } })
      : await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!term) throw ApiError.badRequest("No current term configured");

    const students = await prisma.student.findMany({
      where: { status: "ACTIVE", ...(classRoomId ? { classRoomId } : {}) },
      select: {
        id: true, firstName: true, lastName: true, admissionNo: true,
        classRoom: { select: { name: true } },
        parent: { include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } } },
      },
    });

    const rows = [];
    for (const s of students) {
      const balance = await getFeeBalance(s.id, term.id);
      if (balance.outstanding > 0) {
        rows.push({
          student: s,
          expected: balance.expected,
          paid: balance.paid,
          waived: balance.waived,
          outstanding: balance.outstanding,
        });
      }
    }
    rows.sort((a, b) => b.outstanding - a.outstanding);
    const totalOutstanding = rows.reduce((sum, r) => sum + r.outstanding, 0);
    res.json({ success: true, data: { termId: term.id, debtors: rows, totalOutstanding, count: rows.length } });
  })
);

export default router;
