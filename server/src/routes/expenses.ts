import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";
import { getPagination, paginated } from "../utils/pagination";
import { expensesInTerm } from "../utils/expenseScope";

const router = Router();
router.use(authenticate, requireActiveSchool);

const FINANCE: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT];

// ── Categories ───────────────────────────────────────────────────────────────

router.get(
  "/categories",
  authorize(...FINANCE),
  asyncHandler(async (_req, res) => {
    const cats = await prisma.expenseCategory.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, data: cats });
  })
);

router.post(
  "/categories",
  authorize(...ADMINS),
  validate(z.object({ body: z.object({ name: z.string().min(2), description: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const cat = await prisma.expenseCategory.create({ data: { ...req.body, schoolId: school.id } });
    audit(req, "expense.category_create", "ExpenseCategory", cat.id);
    res.status(201).json({ success: true, data: cat });
  })
);

router.put(
  "/categories/:id",
  authorize(...ADMINS),
  validate(z.object({ body: z.object({ name: z.string().min(2).optional(), description: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const cat = await prisma.expenseCategory.update({ where: { id: req.params.id }, data: req.body });
    audit(req, "expense.category_update", "ExpenseCategory", cat.id);
    res.json({ success: true, data: cat });
  })
);

router.delete(
  "/categories/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const count = await prisma.expense.count({ where: { categoryId: req.params.id } });
    if (count > 0) throw ApiError.conflict(`Cannot delete: ${count} expense(s) use this category`);
    await prisma.expenseCategory.delete({ where: { id: req.params.id } });
    audit(req, "expense.category_delete", "ExpenseCategory", req.params.id);
    res.json({ success: true, message: "Category deleted" });
  })
);

// ── Expenses ─────────────────────────────────────────────────────────────────

router.get(
  "/",
  authorize(...FINANCE),
  asyncHandler(async (req, res) => {
    const pg = getPagination(req);
    const { termId, categoryId } = req.query as Record<string, string | undefined>;
    const where = {
      ...(termId ? { termId } : {}),
      ...(categoryId ? { categoryId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: true,
          term: { include: { session: { select: { name: true } } } },
          recordedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: "desc" },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.expense.count({ where }),
    ]);
    res.json({ success: true, data: paginated(items, total, pg) });
  })
);

router.post(
  "/",
  authorize(...FINANCE),
  validate(
    z.object({
      body: z.object({
        categoryId: z.string(),
        termId: z.string().optional(),
        amount: z.number().positive(),
        description: z.string().min(3),
        date: z.coerce.date(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const expense = await prisma.expense.create({
      data: { ...req.body, schoolId: school.id, recordedById: req.auth!.sub },
      include: { category: true, recordedBy: { select: { firstName: true, lastName: true } } },
    });
    audit(req, "expense.create", "Expense", expense.id, { amount: req.body.amount });
    res.status(201).json({ success: true, data: expense });
  })
);

router.put(
  "/:id",
  authorize(...FINANCE),
  validate(
    z.object({
      body: z.object({
        categoryId: z.string().optional(),
        termId: z.string().nullable().optional(),
        amount: z.number().positive().optional(),
        description: z.string().min(3).optional(),
        date: z.coerce.date().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: req.body,
      include: { category: true },
    });
    audit(req, "expense.update", "Expense", expense.id);
    res.json({ success: true, data: expense });
  })
);

router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    await prisma.expense.delete({ where: { id: req.params.id } });
    audit(req, "expense.delete", "Expense", req.params.id);
    res.json({ success: true, message: "Expense deleted" });
  })
);

// GET /expenses/summary?termId= — total by category for a term
router.get(
  "/summary",
  authorize(...FINANCE),
  asyncHandler(async (req, res) => {
    const termId = req.query.termId as string | undefined;
    const term = termId
      ? await prisma.term.findUnique({ where: { id: termId } })
      : await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!term) throw ApiError.badRequest("No current term configured");

    const rows = await prisma.expense.groupBy({
      by: ["categoryId"],
      where: expensesInTerm(term),
      _sum: { amount: true },
      _count: { _all: true },
    });
    const cats = await prisma.expenseCategory.findMany({ where: { id: { in: rows.map((r) => r.categoryId) } } });
    const byId = new Map(cats.map((c) => [c.id, c.name]));
    const total = rows.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
    res.json({
      success: true,
      data: {
        termId: term.id,
        total,
        rows: rows.map((r) => ({
          categoryId: r.categoryId,
          categoryName: byId.get(r.categoryId) ?? r.categoryId,
          total: Number(r._sum.amount ?? 0),
          count: r._count._all,
        })),
      },
    });
  })
);

export default router;
