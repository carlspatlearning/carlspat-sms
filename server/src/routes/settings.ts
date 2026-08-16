import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { currentSchoolId } from "../middleware/tenant";
import { audit } from "../middleware/audit";

const router = Router();

// GET /settings/school?slug=… — public branding for the login page and report cards.
//
// Public, so there is no token to take the school from. The caller names the
// school by slug instead. While only one school exists the slug may be omitted,
// which keeps existing deployments working; once a second school is added the
// slug becomes required, because "the first school in the table" is then a
// coin toss rather than an answer.
router.get(
  "/school",
  asyncHandler(async (req, res) => {
    const slug = typeof req.query.slug === "string" ? req.query.slug : null;

    if (slug) {
      const school = await prisma.school.findUnique({ where: { slug } });
      if (!school) throw ApiError.notFound("School not found");
      return res.json({ success: true, data: school });
    }

    const schools = await prisma.school.findMany({ take: 2, orderBy: { createdAt: "asc" } });
    if (schools.length === 0) throw ApiError.notFound("School not configured");
    if (schools.length > 1) {
      throw ApiError.badRequest("Several schools use this system — specify which with ?slug=");
    }
    res.json({ success: true, data: schools[0] });
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
    const schoolId = currentSchoolId(req);
    const updated = await prisma.school.update({ where: { id: schoolId }, data: req.body });
    audit(req, "settings.school_update", "School", schoolId, req.body);
    res.json({ success: true, data: updated });
  })
);

// ── Academic sessions & terms ────────────────────────────────────────────────

router.get(
  "/sessions",
  authenticate,
  asyncHandler(async (req, res) => {
    const sessions = await prisma.academicSession.findMany({
      where: { schoolId: currentSchoolId(req) },
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
    const schoolId = currentSchoolId(req);
    const { isCurrent, ...data } = req.body;
    // Scoped: clearing "current" must not reach into any other school's sessions.
    if (isCurrent) await prisma.academicSession.updateMany({ where: { schoolId }, data: { isCurrent: false } });
    const session = await prisma.academicSession.create({
      data: { ...data, isCurrent: Boolean(isCurrent), schoolId },
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
    const schoolId = currentSchoolId(req);
    const { isCurrent, ...data } = req.body;

    // The session id comes from the URL, so confirm it is this school's before
    // hanging a term off it.
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session || session.schoolId !== schoolId) throw ApiError.notFound("Session not found");

    if (isCurrent) await prisma.term.updateMany({ where: { schoolId }, data: { isCurrent: false } });
    const term = await prisma.term.create({
      data: { ...data, isCurrent: Boolean(isCurrent), sessionId: session.id, schoolId },
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
    const schoolId = currentSchoolId(req);
    const term = await prisma.term.findUnique({ where: { id: req.params.id }, include: { session: true } });
    if (!term || term.schoolId !== schoolId) throw ApiError.notFound("Term not found");
    await prisma.$transaction([
      prisma.term.updateMany({ where: { schoolId }, data: { isCurrent: false } }),
      prisma.academicSession.updateMany({ where: { schoolId }, data: { isCurrent: false } }),
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
  asyncHandler(async (req, res) => {
    const term = await prisma.term.findFirst({
      where: { isCurrent: true, schoolId: currentSchoolId(req) },
      include: { session: true },
    });
    if (!term) throw ApiError.notFound("No current term configured. Ask the admin to set one in Settings.");
    res.json({ success: true, data: term });
  })
);

// ── Grading system (admin-editable) ─────────────────────────────────────────

router.get(
  "/grading",
  authenticate,
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const [scales, assessments] = await Promise.all([
      prisma.gradeScale.findMany({ where: { schoolId }, orderBy: { minScore: "desc" } }),
      prisma.assessmentType.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
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
    const schoolId = currentSchoolId(req);
    const { scales } = req.body as { scales: { minScore: number; maxScore: number; grade: string; remark: string }[] };
    for (const s of scales) {
      if (s.minScore > s.maxScore) throw ApiError.badRequest(`Grade ${s.grade}: minScore is greater than maxScore`);
    }
    await prisma.$transaction([
      prisma.gradeScale.deleteMany({ where: { schoolId } }),
      prisma.gradeScale.createMany({ data: scales.map((s) => ({ ...s, schoolId })) }),
    ]);
    audit(req, "settings.grading_update", "GradeScale", schoolId);
    res.json({
      success: true,
      data: await prisma.gradeScale.findMany({ where: { schoolId }, orderBy: { minScore: "desc" } }),
    });
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
    const schoolId = currentSchoolId(req);
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
        where: { schoolId, name: { notIn: names } },
        data: { isActive: false },
      });
      for (const a of assessments) {
        await tx.assessmentType.upsert({
          where: { schoolId_name: { schoolId, name: a.name } },
          update: { maxScore: a.maxScore, order: a.order, isExam: Boolean(a.isExam), isActive: true },
          create: { ...a, isExam: Boolean(a.isExam), schoolId },
        });
      }
    });
    audit(req, "settings.assessments_update", "AssessmentType", schoolId);
    res.json({
      success: true,
      data: await prisma.assessmentType.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
    });
  })
);

// POST /settings/sessions/:id/promote — bulk promote all active students to next class level
router.post(
  "/sessions/:id/promote",
  authenticate,
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session || session.schoolId !== schoolId) throw ApiError.notFound("Session not found");

    const classes = await prisma.classRoom.findMany({
      where: { schoolId },
      orderBy: [{ level: "asc" }, { section: "asc" }],
    });
    const byLevel = new Map<number, { id: string; name: string }>();
    for (const c of classes) {
      if (!byLevel.has(c.level)) byLevel.set(c.level, { id: c.id, name: c.name });
    }

    // Scoping matters more here than anywhere: unscoped, one school pressing
    // "promote" would move every pupil in every school up a year and graduate
    // each school's leavers.
    const students = await prisma.student.findMany({
      where: { schoolId, status: "ACTIVE", classRoomId: { not: null } },
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
