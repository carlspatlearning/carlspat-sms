import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, assertCanAccessStudent, ADMINS } from "../middleware/auth";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";
import { getFeeBalance } from "../services/feeService";

const router = Router();
router.use(authenticate, requireActiveSchool);

const FEE_MANAGERS: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT];

// GET /fees/debtors/pdf?termId=&classRoomId= — downloadable outstanding-fees report
router.get(
  "/debtors/pdf",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const termId = req.query.termId as string | undefined;
    const classRoomId = req.query.classRoomId as string | undefined;
    const term = termId
      ? await prisma.term.findUnique({ where: { id: termId }, include: { session: { select: { name: true } } } })
      : await prisma.term.findFirst({ where: { isCurrent: true, schoolId }, include: { session: { select: { name: true } } } });
    if (!term || term.schoolId !== schoolId) throw ApiError.badRequest("No current term configured");

    const [school, students] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, address: true } }),
      prisma.student.findMany({
        where: { schoolId, status: "ACTIVE", ...(classRoomId ? { classRoomId } : {}) },
        select: {
          id: true, firstName: true, lastName: true, admissionNo: true,
          classRoom: { select: { name: true } },
        },
      }),
    ]);

    const debtors: Array<{
      student: typeof students[number]; expected: number; paid: number; waived: number; outstanding: number;
    }> = [];
    for (const student of students) {
      const balance = await getFeeBalance(student.id, term.id);
      if (balance.outstanding > 0) debtors.push({ student, ...balance });
    }
    debtors.sort((a, b) => b.outstanding - a.outstanding);
    const totalOutstanding = debtors.reduce((sum, row) => sum + row.outstanding, 0);
    const generatedAt = new Date();
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
    const pageWidth = doc.page.width;
    const left = 32;
    const tableWidth = pageWidth - left * 2;
    const columns = [30, 170, 100, 112, 105, 90, tableWidth - 607];
    const headers = ["#", "Student name", "Admission No.", "Class", "Expected", "Paid", "Outstanding"];
    const money = (amount: number) => `NGN ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const schoolName = school?.name ?? "School";

    function drawPageHeader() {
      doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(16)
        .text(schoolName.toUpperCase(), left, 30, { width: tableWidth, align: "center" });
      if (school?.address) {
        doc.fillColor("#6b7280").font("Helvetica").fontSize(8)
          .text(school.address, left, 50, { width: tableWidth, align: "center" });
      }
      doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(12)
        .text("OUTSTANDING FEES / DEBTORS REPORT", left, 65, { width: tableWidth, align: "center" });
      doc.fillColor("#374151").font("Helvetica").fontSize(9)
        .text(`${term.name} · ${term.session.name} session  |  Debtors: ${debtors.length}  |  Total outstanding: ${money(totalOutstanding)}`, left, 84, { width: tableWidth, align: "center" });
      doc.fillColor("#6b7280").fontSize(8)
        .text(`Generated: ${generatedAt.toLocaleString("en-GB")}`, left, 99, { width: tableWidth, align: "right" });
      doc.moveTo(left, 114).lineTo(left + tableWidth, 114).strokeColor("#1e3a5f").lineWidth(1).stroke();
    }

    function drawTableHeader(y: number) {
      doc.rect(left, y, tableWidth, 22).fill("#1e3a5f");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
      let x = left + 4;
      headers.forEach((header, index) => {
        doc.text(header, x, y + 7, { width: columns[index] - 8, lineBreak: false, align: index >= 4 ? "right" : "left" });
        x += columns[index];
      });
    }

    drawPageHeader();
    let y = 122;
    drawTableHeader(y);
    y += 22;
    debtors.forEach((row, index) => {
      if (y + 20 > doc.page.height - 42) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 32 });
        drawPageHeader();
        y = 122;
        drawTableHeader(y);
        y += 22;
      }
      if (index % 2 === 1) doc.rect(left, y, tableWidth, 20).fill("#f3f4f6");
      doc.fillColor("#111827").font("Helvetica").fontSize(8);
      const values = [
        String(index + 1),
        `${row.student.lastName} ${row.student.firstName}`,
        row.student.admissionNo,
        row.student.classRoom?.name ?? "—",
        money(row.expected),
        money(row.paid),
        money(row.outstanding),
      ];
      let x = left + 4;
      values.forEach((value, col) => {
        doc.text(value, x, y + 6, { width: columns[col] - 8, lineBreak: false, align: col >= 4 ? "right" : "left" });
        x += columns[col];
      });
      doc.moveTo(left, y + 20).lineTo(left + tableWidth, y + 20).strokeColor("#e5e7eb").lineWidth(0.4).stroke();
      y += 20;
    });
    if (debtors.length === 0) {
      doc.fillColor("#374151").font("Helvetica").fontSize(10)
        .text("No outstanding fees for this term.", left, y + 12, { width: tableWidth, align: "center" });
    }

    const pageCount = doc.bufferedPageRange().count;
    for (let page = 0; page < pageCount; page++) {
      doc.switchToPage(page);
      doc.fillColor("#6b7280").font("Helvetica").fontSize(7)
        .text(`${schoolName} — Confidential`, left, doc.page.height - 24, { width: tableWidth / 2 })
        .text(`Page ${page + 1} of ${pageCount}`, left, doc.page.height - 24, { width: tableWidth, align: "right" });
    }
    doc.end();
    const pdf = await finished;
    const filename = `debtors-${term.name.replace(/[^a-z0-9]+/gi, "-")}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdf);
  })
);

// ── Fee categories ───────────────────────────────────────────────────────────

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await prisma.feeCategory.findMany({
      where: { schoolId: currentSchoolId(req) },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: categories });
  })
);

router.post(
  "/categories",
  authorize(...FEE_MANAGERS),
  validate(z.object({ body: z.object({ name: z.string().min(2), description: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const category = await prisma.feeCategory.create({
      data: { ...req.body, schoolId: currentSchoolId(req) },
    });
    audit(req, "fees.category_create", "FeeCategory", category.id);
    res.status(201).json({ success: true, data: category });
  })
);

router.put(
  "/categories/:id",
  authorize(...FEE_MANAGERS),
  validate(z.object({ body: z.object({ name: z.string().min(2), description: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.feeCategory.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Category not found");

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
    const existing = await prisma.feeCategory.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Category not found");

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
      where: {
        schoolId: currentSchoolId(req),
        ...(termId ? { termId } : {}),
        ...(classRoomId ? { classRoomId } : {}),
      },
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
    const schoolId = currentSchoolId(req);
    const { termId, classRoomId, categoryId, amount, dueDate } = req.body;

    // Term, class and category all arrive in the body and all key the upsert.
    // Unchecked, this would write a fee row into another school's books.
    const [term, cls, category] = await Promise.all([
      prisma.term.findUnique({ where: { id: termId }, select: { schoolId: true } }),
      prisma.classRoom.findUnique({ where: { id: classRoomId }, select: { schoolId: true } }),
      prisma.feeCategory.findUnique({ where: { id: categoryId }, select: { schoolId: true } }),
    ]);
    if (!term || term.schoolId !== schoolId) throw ApiError.notFound("Term not found");
    if (!cls || cls.schoolId !== schoolId) throw ApiError.notFound("Class not found");
    if (!category || category.schoolId !== schoolId) throw ApiError.notFound("Category not found");

    const structure = await prisma.feeStructure.upsert({
      where: { termId_classRoomId_categoryId: { termId, classRoomId, categoryId } },
      update: { amount, dueDate },
      create: { schoolId, termId, classRoomId, categoryId, amount, dueDate },
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
    const existing = await prisma.feeStructure.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Fee structure not found");

    await prisma.feeStructure.delete({ where: { id: req.params.id } });
    audit(req, "fees.structure_delete", "FeeStructure", req.params.id);
    res.json({ success: true, message: "Fee structure removed" });
  })
);

// ── Per-student fee items ────────────────────────────────────────────────────

router.get(
  "/student-items",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    const { studentId, termId } = req.query as Record<string, string | undefined>;
    if (!studentId || !termId) throw ApiError.badRequest("studentId and termId are required");
    const items = await prisma.studentFeeItem.findMany({
      where: { schoolId: currentSchoolId(req), studentId, termId },
      include: { category: true },
      orderBy: { category: { name: "asc" } },
    });
    res.json({ success: true, data: items });
  })
);

router.post(
  "/student-items/bulk-assign",
  authorize(...FEE_MANAGERS),
  validate(z.object({ body: z.object({ classRoomId: z.string(), termId: z.string() }) })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const { classRoomId, termId } = req.body;
    const [structures, students] = await Promise.all([
      prisma.feeStructure.findMany({ where: { schoolId, classRoomId, termId } }),
      prisma.student.findMany({ where: { schoolId, classRoomId, status: "ACTIVE" }, select: { id: true } }),
    ]);
    if (structures.length === 0) throw ApiError.badRequest("No fee structures configured for this class and term");
    const ops = students.flatMap((s) =>
      structures.map((fs) =>
        prisma.studentFeeItem.upsert({
          where: { studentId_termId_categoryId: { studentId: s.id, termId, categoryId: fs.categoryId } },
          update: { amount: fs.amount },
          create: { schoolId, studentId: s.id, termId, categoryId: fs.categoryId, amount: fs.amount },
        })
      )
    );
    await prisma.$transaction(ops);
    res.json({ success: true, data: { assigned: ops.length } });
  })
);

router.post(
  "/student-items",
  authorize(...FEE_MANAGERS),
  validate(z.object({
    body: z.object({
      studentId: z.string(),
      termId: z.string(),
      categoryId: z.string(),
      amount: z.number().positive(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const { studentId, termId, categoryId, amount } = req.body;

    const [student, category] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } }),
      prisma.feeCategory.findUnique({ where: { id: categoryId }, select: { schoolId: true } }),
    ]);
    if (!student || student.schoolId !== schoolId) throw ApiError.notFound("Student not found");
    if (!category || category.schoolId !== schoolId) throw ApiError.notFound("Category not found");

    const item = await prisma.studentFeeItem.upsert({
      where: { studentId_termId_categoryId: { studentId, termId, categoryId } },
      update: { amount },
      create: { schoolId, studentId, termId, categoryId, amount },
      include: { category: true },
    });
    audit(req, "fees.student_item_set", "StudentFeeItem", item.id);
    res.status(201).json({ success: true, data: item });
  })
);

router.delete(
  "/student-items/:id",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    const existing = await prisma.studentFeeItem.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Fee item not found");

    await prisma.studentFeeItem.delete({ where: { id: req.params.id } });
    audit(req, "fees.student_item_delete", "StudentFeeItem", req.params.id);
    res.json({ success: true, message: "Fee item removed" });
  })
);

// ── Waivers / discounts ──────────────────────────────────────────────────────

router.get(
  "/waivers",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    const { studentId, termId } = req.query as Record<string, string | undefined>;
    // FeeWaiver has no schoolId of its own, so it is fenced through the pupil
    // it belongs to.
    const waivers = await prisma.feeWaiver.findMany({
      where: {
        student: { schoolId: currentSchoolId(req) },
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
    const schoolId = currentSchoolId(req);
    const { studentId, termId } = req.body as { studentId: string; termId: string };
    const [student, term] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } }),
      prisma.term.findUnique({ where: { id: termId }, select: { schoolId: true } }),
    ]);
    if (!student || student.schoolId !== schoolId) throw ApiError.notFound("Student not found");
    if (!term || term.schoolId !== schoolId) throw ApiError.notFound("Term not found");

    const waiver = await prisma.feeWaiver.create({ data: req.body });
    audit(req, "fees.waiver_create", "FeeWaiver", waiver.id, { amount: req.body.amount });
    res.status(201).json({ success: true, data: waiver });
  })
);

router.delete(
  "/waivers/:id",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    const existing = await prisma.feeWaiver.findUnique({
      where: { id: req.params.id },
      select: { student: { select: { schoolId: true } } },
    });
    if (!existing || existing.student.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Discount not found");

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
    const schoolId = currentSchoolId(req);
    const termId = req.query.termId as string | undefined;
    const term = termId
      ? await prisma.term.findUnique({ where: { id: termId } })
      : await prisma.term.findFirst({ where: { isCurrent: true, schoolId } });
    if (!term || term.schoolId !== schoolId) throw ApiError.badRequest("No term specified and no current term configured");
    const balance = await getFeeBalance(req.params.studentId, term.id);
    res.json({ success: true, data: balance });
  })
);

// GET /fees/debtors?termId=&classRoomId= — outstanding fees report (bursar/admin)
router.get(
  "/debtors",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const termId = req.query.termId as string | undefined;
    const classRoomId = req.query.classRoomId as string | undefined;
    const term = termId
      ? await prisma.term.findUnique({ where: { id: termId } })
      : await prisma.term.findFirst({ where: { isCurrent: true, schoolId } });
    if (!term || term.schoolId !== schoolId) throw ApiError.badRequest("No current term configured");

    // The debtors report names families and what they owe, with parent phone
    // numbers attached — it must never reach beyond this school.
    const students = await prisma.student.findMany({
      where: { schoolId, status: "ACTIVE", ...(classRoomId ? { classRoomId } : {}) },
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
