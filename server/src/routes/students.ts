import { Router } from "express";
import { z } from "zod";
import { Gender, Prisma, Role, StudentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, assertCanAccessStudent, ADMINS, STAFF } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { nextAdmissionNo } from "../utils/ids";
import { getPagination, paginated } from "../utils/pagination";
import { hashPassword } from "../utils/password";

const router = Router();
router.use(authenticate);

const studentInclude = {
  classRoom: { select: { id: true, name: true, section: true } },
  parent: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } },
  user: { select: { id: true, email: true, isActive: true } },
} satisfies Prisma.StudentInclude;

// GET /students — search + filter + pagination (staff only)
router.get(
  "/",
  authorize(...STAFF),
  asyncHandler(async (req, res) => {
    const pg = getPagination(req);
    const { q, classRoomId, status } = req.query as Record<string, string | undefined>;
    const where: Prisma.StudentWhereInput = {
      ...(classRoomId ? { classRoomId } : {}),
      ...(status ? { status: status as StudentStatus } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { middleName: { contains: q, mode: "insensitive" } },
              { admissionNo: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: studentInclude,
        orderBy: [{ classRoom: { level: "asc" } }, { lastName: "asc" }],
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.student.count({ where }),
    ]);
    res.json({ success: true, data: paginated(items, total, pg) });
  })
);

const studentBody = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  middleName: z.string().optional(),
  gender: z.nativeEnum(Gender),
  dateOfBirth: z.coerce.date(),
  address: z.string().optional(),
  classRoomId: z.string().optional(),
  parentId: z.string().optional(),
  passportUrl: z.string().optional(),
  bloodGroup: z.string().optional(),
  genotype: z.string().optional(),
  allergies: z.string().optional(),
  medicalNotes: z.string().optional(),
  previousSchool: z.string().optional(),
  // Optionally create a login for the student
  createLogin: z.object({ email: z.string().email(), password: z.string().min(8) }).optional(),
});

// POST /students — register a student, auto-generate admission number
router.post(
  "/",
  authorize(...ADMINS),
  validate(z.object({ body: studentBody })),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const { createLogin, ...data } = req.body as z.infer<typeof studentBody>;

    let userId: string | undefined;
    if (createLogin) {
      const user = await prisma.user.create({
        data: {
          schoolId: school.id,
          email: createLogin.email.toLowerCase(),
          passwordHash: await hashPassword(createLogin.password),
          role: Role.STUDENT,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });
      userId = user.id;
    }

    const student = await prisma.student.create({
      data: { ...data, schoolId: school.id, admissionNo: await nextAdmissionNo(), userId },
      include: studentInclude,
    });
    audit(req, "student.create", "Student", student.id, { admissionNo: student.admissionNo });
    res.status(201).json({ success: true, data: student });
  })
);

// GET /students/:id — staff, the student themself, or their parent
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertCanAccessStudent(req, req.params.id);
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { ...studentInclude, promotions: { orderBy: { promotedAt: "desc" } } },
    });
    if (!student) throw ApiError.notFound("Student not found");
    res.json({ success: true, data: student });
  })
);

// PUT /students/:id
router.put(
  "/:id",
  authorize(...ADMINS),
  validate(z.object({ body: studentBody.omit({ createLogin: true }).partial().extend({ status: z.nativeEnum(StudentStatus).optional() }) })),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: req.body,
      include: studentInclude,
    });
    audit(req, "student.update", "Student", student.id);
    res.json({ success: true, data: student });
  })
);

// DELETE /students/:id — soft removal (status), hard delete only when no records
router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const counts = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { _count: { select: { scores: true, payments: true, attendance: true } } },
    });
    if (!counts) throw ApiError.notFound("Student not found");
    const hasRecords = counts._count.scores + counts._count.payments + counts._count.attendance > 0;
    if (hasRecords) {
      await prisma.student.update({ where: { id: req.params.id }, data: { status: StudentStatus.WITHDRAWN } });
      audit(req, "student.withdraw", "Student", req.params.id);
      return res.json({ success: true, message: "Student has academic records, so they were marked as WITHDRAWN instead of deleted." });
    }
    await prisma.student.delete({ where: { id: req.params.id } });
    audit(req, "student.delete", "Student", req.params.id);
    res.json({ success: true, message: "Student deleted" });
  })
);

// POST /students/promote — bulk promotion / graduation at session end
router.post(
  "/promote",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        studentIds: z.array(z.string()).min(1),
        toClassRoomId: z.string().nullable(), // null = graduate
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const { studentIds, toClassRoomId } = req.body as { studentIds: string[]; toClassRoomId: string | null };
    const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
    const toClass = toClassRoomId
      ? await prisma.classRoom.findUnique({ where: { id: toClassRoomId } })
      : null;
    if (toClassRoomId && !toClass) throw ApiError.notFound("Destination class not found");

    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: { classRoom: true },
    });

    await prisma.$transaction(
      students.flatMap((s) => [
        prisma.student.update({
          where: { id: s.id },
          data: toClass
            ? { classRoomId: toClass.id }
            : { classRoomId: null, status: StudentStatus.GRADUATED },
        }),
        prisma.promotion.create({
          data: {
            studentId: s.id,
            fromClass: s.classRoom?.name ?? "—",
            toClass: toClass?.name ?? "GRADUATED",
            sessionName: session?.name ?? "—",
          },
        }),
      ])
    );
    audit(req, "student.promote", "Student", undefined, { count: students.length, to: toClass?.name ?? "GRADUATED" });
    res.json({
      success: true,
      message: toClass
        ? `${students.length} student(s) promoted to ${toClass.name}`
        : `${students.length} student(s) graduated`,
    });
  })
);

export default router;
