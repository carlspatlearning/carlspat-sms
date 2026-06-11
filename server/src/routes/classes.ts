import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { audit } from "../middleware/audit";

const router = Router();
router.use(authenticate);

// GET /classes — all roles need the class list (dropdowns etc.)
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const classes = await prisma.classRoom.findMany({
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
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const created = await prisma.classRoom.create({ data: { ...req.body, schoolId: school.id } });
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
    if (!cls) throw ApiError.notFound("Class not found");
    res.json({ success: true, data: cls });
  })
);

router.put(
  "/:id",
  authorize(...ADMINS),
  validate(z.object({ body: classBody.partial() })),
  asyncHandler(async (req, res) => {
    const updated = await prisma.classRoom.update({ where: { id: req.params.id }, data: req.body });
    audit(req, "class.update", "ClassRoom", updated.id);
    res.json({ success: true, data: updated });
  })
);

router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
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
    const classRoomId = req.params.id;
    const { assignments } = req.body as { assignments: { subjectId: string; teacherId?: string | null }[] };
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
