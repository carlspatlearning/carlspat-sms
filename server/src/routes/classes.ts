import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";

const router = Router();
router.use(authenticate, requireActiveSchool);

// GET /classes — all roles need the class list (dropdowns etc.)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const classes = await prisma.classRoom.findMany({
      where: { schoolId: currentSchoolId(req) },
      include: {
        formTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { students: true, classSubjects: true } },
      },
      orderBy: { level: "asc" },
    });
    res.json({ success: true, data: classes });
  })
);

const classBody = z.object({
  name: z.string().min(1),
  level: z.number().int().min(1),
  section: z.string().nullable().optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  formTeacherId: z.string().nullable().optional(),
});

router.post(
  "/",
  authorize(...ADMINS),
  validate(z.object({ body: classBody })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const { formTeacherId } = req.body as { formTeacherId?: string | null };
    if (formTeacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: formTeacherId }, select: { schoolId: true } });
      if (!teacher || teacher.schoolId !== schoolId) throw ApiError.notFound("Teacher not found");
    }
    const created = await prisma.classRoom.create({ data: { ...req.body, schoolId } });
    audit(req, "class.create", "ClassRoom", created.id);
    res.status(201).json({ success: true, data: created });
  })
);

// GET /classes/:id — detail with students and subject assignments
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const cls = await prisma.classRoom.findUnique({
      where: { id: req.params.id },
      include: {
        formTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        students: {
          where: { status: "ACTIVE" },
          select: { id: true, firstName: true, lastName: true, admissionNo: true, gender: true, passportUrl: true },
          orderBy: { lastName: "asc" },
        },
        classSubjects: {
          include: {
            subject: true,
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    if (!cls || cls.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Class not found");
    res.json({ success: true, data: cls });
  })
);

router.put(
  "/:id",
  authorize(...ADMINS),
  validate(z.object({ body: classBody.partial() })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.classRoom.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Class not found");

    const updated = await prisma.classRoom.update({ where: { id: req.params.id }, data: req.body });
    audit(req, "class.update", "ClassRoom", updated.id);
    res.json({ success: true, data: updated });
  })
);

router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const existing = await prisma.classRoom.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Class not found");

    const count = await prisma.student.count({ where: { classRoomId: req.params.id } });
    if (count > 0) throw ApiError.conflict(`Cannot delete: ${count} student(s) are assigned to this class`);
    await prisma.classRoom.delete({ where: { id: req.params.id } });
    audit(req, "class.delete", "ClassRoom", req.params.id);
    res.json({ success: true, message: "Class deleted" });
  })
);

// PUT /classes/:id/subjects — assign subjects (and teachers) to a class
router.put(
  "/:id/subjects",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        assignments: z.array(z.object({ subjectId: z.string(), teacherId: z.string().nullable().optional() })),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const classRoomId = req.params.id;
    const { assignments } = req.body as { assignments: { subjectId: string; teacherId?: string | null }[] };

    const cls = await prisma.classRoom.findUnique({ where: { id: classRoomId }, select: { schoolId: true } });
    if (!cls || cls.schoolId !== schoolId) throw ApiError.notFound("Class not found");

    // Subject and teacher ids both arrive in the body. Verifying them here stops
    // another school's subject or teacher being wired into this timetable.
    const subjectIds = [...new Set(assignments.map((a) => a.subjectId))];
    const teacherIds = [...new Set(assignments.map((a) => a.teacherId).filter((t): t is string => Boolean(t)))];
    const [subjects, teachers] = await Promise.all([
      prisma.subject.findMany({ where: { schoolId, id: { in: subjectIds } }, select: { id: true } }),
      prisma.teacher.findMany({ where: { schoolId, id: { in: teacherIds } }, select: { id: true } }),
    ]);
    if (subjects.length !== subjectIds.length) throw ApiError.notFound("One or more subjects were not found");
    if (teachers.length !== teacherIds.length) throw ApiError.notFound("One or more teachers were not found");

    await prisma.$transaction(async (tx) => {
      await tx.classSubject.deleteMany({
        where: { classRoomId, subjectId: { notIn: assignments.map((a) => a.subjectId) } },
      });
      for (const a of assignments) {
        await tx.classSubject.upsert({
          where: { classRoomId_subjectId: { classRoomId, subjectId: a.subjectId } },
          update: { teacherId: a.teacherId ?? null },
          create: { classRoomId, subjectId: a.subjectId, teacherId: a.teacherId ?? null },
        });
      }
    });
    audit(req, "class.subjects_update", "ClassRoom", classRoomId);
    res.json({ success: true, message: "Class subjects updated" });
  })
);

export default router;
