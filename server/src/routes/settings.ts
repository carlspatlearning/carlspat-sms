import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { audit } from "../middleware/audit";

const router = Router();

// GET /settings/school — public school profile (used by login page, report cards)
router.get(
  "/school",
  asyncHandler(async (_req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    res.json({ success: true, data: school });
  })
);

// PUT /settings/school — admin-editable school information (no code changes needed)
router.put(
  "/school",
  authenticate,
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(2).optional(),
        motto: z.string().min(2).optional(),
        address: z.string().min(5).optional(),
        phone: z.string().min(7).optional(),
        email: z.string().email().optional(),
        logoUrl: z.string().url().or(z.string().startsWith("/uploads/")).nullable().optional(),
        stampUrl: z.string().url().or(z.string().startsWith("/uploads/")).nullable().optional(),
        headTeacherName: z.string().nullable().optional(),
        currency: z.string().length(3).optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const updated = await prisma.school.update({ where: { id: school.id }, data: req.body });
    audit(req, "settings.school_update", "School", school.id, req.body);
    res.json({ success: true, data: updated });
  })
);

// ── Academic sessions & terms ────────────────────────────────────────────────

router.get(
  "/sessions",
  authenticate,
  asyncHandler(async (_req, res) => {
    const sessions = await prisma.academicSession.findMany({
      include: { terms: { orderBy: { startDate: "asc" } } },
      orderBy: { startDate: "desc" },
    });
    res.json({ success: true, data: sessions });
  })
);

const sessionBody = z.object({
  name: z.string().regex(/^\d{4}\/\d{4}$/, "Use the format 2025/2026"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional(),
});

router.post(
  "/sessions",
  authenticate,
  authorize(...ADMINS),
  validate(z.object({ body: sessionBody })),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const { isCurrent, ...data } = req.body;
    if (isCurrent) await prisma.academicSession.updateMany({ data: { isCurrent: false } });
    const session = await prisma.academicSession.create({
      data: { ...data, isCurrent: Boolean(isCurrent), schoolId: school.id },
    });
    audit(req, "settings.session_create", "AcademicSession", session.id);
    res.status(201).json({ success: true, data: session });
  })
);

router.post(
  "/sessions/:id/terms",
  authenticate,
  authorize(...ADMINS),
  validate(
    z.object({
      params: z.object({ id: z.string() }),
      body: z.object({
        name: z.string().min(2),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        isCurrent: z.boolean().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const { isCurrent, ...data } = req.body;
    if (isCurrent) await prisma.term.updateMany({ data: { isCurrent: false } });
    const term = await prisma.term.create({
      data: { ...data, isCurrent: Boolean(isCurrent), sessionId: req.params.id },
    });
    audit(req, "settings.term_create", "Term", term.id);
    res.status(201).json({ success: true, data: term });
  })
);

// PATCH /settings/terms/:id/current — switch the active term
router.patch(
  "/terms/:id/current",
  authenticate,
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const term = await prisma.term.findUnique({ where: { id: req.params.id }, include: { session: true } });
    if (!term) throw ApiError.notFound("Term not found");
    await prisma.$transaction([
      prisma.term.updateMany({ data: { isCurrent: false } }),
      prisma.academicSession.updateMany({ data: { isCurrent: false } }),
      prisma.term.update({ where: { id: term.id }, data: { isCurrent: true } }),
      prisma.academicSession.update({ where: { id: term.sessionId }, data: { isCurrent: true } }),
    ]);
    audit(req, "settings.term_set_current", "Term", term.id);
    res.json({ success: true, message: `${term.name} (${term.session.name}) is now the current term` });
  })
);

// GET /settings/current-term — used everywhere as default context
router.get(
  "/current-term",
  authenticate,
  asyncHandler(async (_req, res) => {
    const term = await prisma.term.findFirst({ where: { isCurrent: true }, include: { session: true } });
    if (!term) throw ApiError.notFound("No current term configured. Ask the admin to set one in Settings.");
    res.json({ success: true, data: term });
  })
);

// ── Grading system (admin-editable) ─────────────────────────────────────────

router.get(
  "/grading",
  authenticate,
  asyncHandler(async (_req, res) => {
    const [scales, assessments] = await Promise.all([
      prisma.gradeScale.findMany({ orderBy: { minScore: "desc" } }),
      prisma.assessmentType.findMany({ orderBy: { order: "asc" } }),
    ]);
    res.json({ success: true, data: { gradeScales: scales, assessmentTypes: assessments } });
  })
);

router.put(
  "/grading/scales",
  authenticate,
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        scales: z
          .array(
            z.object({
              minScore: z.number().int().min(0).max(100),
              maxScore: z.number().int().min(0).max(100),
              grade: z.string().min(1).max(3),
              remark: z.string().min(1),
            })
          )
          .min(1),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const { scales } = req.body as { scales: { minScore: number; maxScore: number; grade: string; remark: string }[] };
    for (const s of scales) {
      if (s.minScore > s.maxScore) throw ApiError.badRequest(`Grade ${s.grade}: minScore is greater than maxScore`);
    }
    await prisma.$transaction([
      prisma.gradeScale.deleteMany({ where: { schoolId: school.id } }),
      prisma.gradeScale.createMany({ data: scales.map((s) => ({ ...s, schoolId: school.id })) }),
    ]);
    audit(req, "settings.grading_update", "GradeScale", school.id);
    res.json({ success: true, data: await prisma.gradeScale.findMany({ orderBy: { minScore: "desc" } }) });
  })
);

router.put(
  "/grading/assessments",
  authenticate,
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        assessments: z
          .array(
            z.object({
              name: z.string().min(1),
              maxScore: z.number().int().min(1).max(100),
              order: z.number().int().min(0),
              isExam: z.boolean().optional(),
            })
          )
          .min(1),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const { assessments } = req.body as {
      assessments: { name: string; maxScore: number; order: number; isExam?: boolean }[];
    };
    const totalMax = assessments.reduce((s, a) => s + a.maxScore, 0);
    if (totalMax !== 100) {
      throw ApiError.badRequest(`Assessment max scores must add up to 100 (currently ${totalMax})`);
    }
    // Upsert by name; deactivate the rest so historical scores stay intact
    const names = assessments.map((a) => a.name);
    await prisma.$transaction(async (tx) => {
      await tx.assessmentType.updateMany({
        where: { schoolId: school.id, name: { notIn: names } },
        data: { isActive: false },
      });
      for (const a of assessments) {
        await tx.assessmentType.upsert({
          where: { schoolId_name: { schoolId: school.id, name: a.name } },
          update: { maxScore: a.maxScore, order: a.order, isExam: Boolean(a.isExam), isActive: true },
          create: { ...a, isExam: Boolean(a.isExam), schoolId: school.id },
        });
      }
    });
    audit(req, "settings.assessments_update", "AssessmentType", school.id);
    res.json({ success: true, data: await prisma.assessmentType.findMany({ orderBy: { order: "asc" } }) });
  })
);

// POST /settings/sessions/:id/promote — bulk promote all active students to next class level
router.post(
  "/sessions/:id/promote",
  authenticate,
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw ApiError.notFound("Session not found");

    const classes = await prisma.classRoom.findMany({
      orderBy: [{ level: "asc" }, { section: "asc" }],
    });
    const byLevel = new Map<number, { id: string; name: string }>();
    for (const c of classes) {
      if (!byLevel.has(c.level)) byLevel.set(c.level, { id: c.id, name: c.name });
    }

    const students = await prisma.student.findMany({
      where: { status: "ACTIVE", classRoomId: { not: null } },
      include: { classRoom: { select: { id: true, name: true, level: true } } },
    });

    let promoted = 0, graduated = 0;

    await prisma.$transaction(async (tx) => {
      for (const student of students) {
        if (!student.classRoom) continue;
        const nextClass = byLevel.get(student.classRoom.level + 1);
        if (nextClass) {
          await tx.student.update({ where: { id: student.id }, data: { classRoomId: nextClass.id } });
          await tx.promotion.create({
            data: { studentId: student.id, fromClass: student.classRoom.name, toClass: nextClass.name, sessionName: session.name },
          });
          promoted++;
        } else {
          await tx.student.update({ where: { id: student.id }, data: { classRoomId: null, status: "GRADUATED" } });
          await tx.promotion.create({
            data: { studentId: student.id, fromClass: student.classRoom.name, toClass: "GRADUATED", sessionName: session.name },
          });
          graduated++;
        }
      }
    });

    audit(req, "session.promote_all", "AcademicSession", session.id, { promoted, graduated });
    res.json({
      success: true,
      data: { promoted, graduated, total: students.length },
      message: `${promoted} student(s) promoted, ${graduated} graduated.`,
    });
  })
);

export default router;
