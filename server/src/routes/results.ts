import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, assertCanAccessStudent, ADMINS } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { computeStudentResult, rankClass } from "../services/resultService";

const router = Router();
router.use(authenticate);

/** Teachers may only enter scores for class-subjects assigned to them. */
async function assertTeacherTeaches(userId: string, classRoomId: string, subjectId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: { formClasses: { select: { id: true } }, classSubjects: true },
  });
  if (!teacher) throw ApiError.forbidden("Teacher profile not found");
  const allowed =
    teacher.formClasses.some((c) => c.id === classRoomId) ||
    teacher.classSubjects.some((cs) => cs.classRoomId === classRoomId && cs.subjectId === subjectId);
  if (!allowed) throw ApiError.forbidden("You are not assigned to teach this subject in this class");
}

// POST /results/scores — bulk upsert scores for a class-subject-assessment
router.post(
  "/scores",
  authorize(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN),
  validate(
    z.object({
      body: z.object({
        classRoomId: z.string(),
        subjectId: z.string(),
        termId: z.string(),
        assessmentTypeId: z.string(),
        scores: z.array(z.object({ studentId: z.string(), score: z.number().min(0) })).min(1),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const { classRoomId, subjectId, termId, assessmentTypeId, scores } = req.body as {
      classRoomId: string;
      subjectId: string;
      termId: string;
      assessmentTypeId: string;
      scores: { studentId: string; score: number }[];
    };
    if (req.auth!.role === Role.TEACHER) await assertTeacherTeaches(req.auth!.sub, classRoomId, subjectId);

    const assessment = await prisma.assessmentType.findUnique({ where: { id: assessmentTypeId } });
    if (!assessment) throw ApiError.notFound("Assessment type not found");
    for (const s of scores) {
      if (s.score > assessment.maxScore) {
        throw ApiError.badRequest(`Score ${s.score} exceeds the maximum of ${assessment.maxScore} for ${assessment.name}`);
      }
    }

    await prisma.$transaction(
      scores.map((s) =>
        prisma.score.upsert({
          where: {
            studentId_subjectId_termId_assessmentTypeId: {
              studentId: s.studentId,
              subjectId,
              termId,
              assessmentTypeId,
            },
          },
          update: { score: s.score, recordedById: req.auth!.sub },
          create: { studentId: s.studentId, subjectId, termId, assessmentTypeId, score: s.score, recordedById: req.auth!.sub },
        })
      )
    );
    audit(req, "results.scores_upload", "Subject", subjectId, { classRoomId, termId, assessmentTypeId, count: scores.length });
    res.json({ success: true, message: `${scores.length} score(s) saved` });
  })
);

// GET /results/scores?classRoomId=&subjectId=&termId= — score sheet for entry/editing
router.get(
  "/scores",
  authorize(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { classRoomId, subjectId, termId } = req.query as Record<string, string>;
    if (!classRoomId || !subjectId || !termId) throw ApiError.badRequest("classRoomId, subjectId and termId are required");

    const [students, scores, assessments] = await Promise.all([
      prisma.student.findMany({
        where: { classRoomId, status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true, admissionNo: true },
        orderBy: { lastName: "asc" },
      }),
      prisma.score.findMany({ where: { subjectId, termId, student: { classRoomId } } }),
      prisma.assessmentType.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
    ]);
    const byKey = new Map(scores.map((s) => [`${s.studentId}:${s.assessmentTypeId}`, s.score]));
    res.json({
      success: true,
      data: {
        assessments,
        rows: students.map((st) => ({
          student: st,
          scores: assessments.map((a) => ({
            assessmentTypeId: a.id,
            score: byKey.get(`${st.id}:${a.id}`) ?? null,
          })),
        })),
      },
    });
  })
);

// GET /results/student/:studentId?termId= — full computed result (no fee lock: scores
// are viewable in the portal; the lock applies to the official report card)
router.get(
  "/student/:studentId",
  asyncHandler(async (req, res) => {
    await assertCanAccessStudent(req, req.params.studentId);
    const termId = req.query.termId as string | undefined;
    const term = termId
      ? await prisma.term.findUnique({ where: { id: termId } })
      : await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!term) throw ApiError.badRequest("No term specified and no current term configured");
    const result = await computeStudentResult(req.params.studentId, term.id);
    res.json({ success: true, data: result });
  })
);

// GET /results/class/:classRoomId?termId= — broadsheet + ranking (teacher/admin)
router.get(
  "/class/:classRoomId",
  authorize(Role.TEACHER, ...ADMINS),
  asyncHandler(async (req, res) => {
    const termId = req.query.termId as string | undefined;
    const term = termId
      ? await prisma.term.findUnique({ where: { id: termId } })
      : await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!term) throw ApiError.badRequest("No term specified and no current term configured");

    const ranking = await rankClass(req.params.classRoomId, term.id);
    const students = await prisma.student.findMany({
      where: { id: { in: ranking.map((r) => r.studentId) } },
      select: { id: true, firstName: true, lastName: true, admissionNo: true },
    });
    const byId = new Map(students.map((s) => [s.id, s]));
    res.json({
      success: true,
      data: ranking.map((r) => ({ ...r, student: byId.get(r.studentId) })),
    });
  })
);

// PUT /results/comments — form teacher / head teacher comments on a term report
router.put(
  "/comments",
  authorize(Role.TEACHER, ...ADMINS),
  validate(
    z.object({
      body: z.object({
        studentId: z.string(),
        termId: z.string(),
        teacherComment: z.string().max(500).optional(),
        headTeacherComment: z.string().max(500).optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const { studentId, termId, teacherComment, headTeacherComment } = req.body;
    // Only admins may write the head teacher's comment
    if (headTeacherComment !== undefined && req.auth!.role === Role.TEACHER) {
      throw ApiError.forbidden("Only the school admin can write the head teacher's comment");
    }
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classRoomId: true } });
    if (!student?.classRoomId) throw ApiError.badRequest("Student is not assigned to a class");

    const report = await prisma.termReport.upsert({
      where: { studentId_termId: { studentId, termId } },
      update: {
        ...(teacherComment !== undefined ? { teacherComment } : {}),
        ...(headTeacherComment !== undefined ? { headTeacherComment } : {}),
      },
      create: { studentId, termId, classRoomId: student.classRoomId, teacherComment, headTeacherComment },
    });
    audit(req, "results.comments_update", "TermReport", report.id);
    res.json({ success: true, data: report });
  })
);

export default router;
