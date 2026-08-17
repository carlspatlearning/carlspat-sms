import { Router } from "express";
import { z } from "zod";
import { Gender, Prisma, Role, StudentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, assertCanAccessStudent, ADMINS, STAFF } from "../middleware/auth";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";
import { nextAdmissionNo } from "../utils/ids";
import { getPagination, paginated } from "../utils/pagination";
import { hashPassword } from "../utils/password";

const router = Router();
router.use(authenticate, requireActiveSchool);

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
      // First and non-negotiable filter: this school only. Everything below
      // narrows within it; nothing may widen past it.
      schoolId: currentSchoolId(req),
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
    const schoolId = currentSchoolId(req);
    const { createLogin, ...data } = req.body as z.infer<typeof studentBody>;

    // A class or parent named in the body is caller-supplied, so confirm each
    // belongs to this school before attaching a pupil to it.
    if (data.classRoomId) {
      const cls = await prisma.classRoom.findUnique({ where: { id: data.classRoomId } });
      if (!cls || cls.schoolId !== schoolId) throw ApiError.notFound("Class not found");
    }
    if (data.parentId) {
      const parent = await prisma.parent.findUnique({ where: { id: data.parentId } });
      if (!parent || parent.schoolId !== schoolId) throw ApiError.notFound("Parent not found");
    }

    let userId: string | undefined;
    if (createLogin) {
      const user = await prisma.user.create({
        data: {
          schoolId,
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
      data: { ...data, schoolId, admissionNo: await nextAdmissionNo(schoolId), userId },
      include: studentInclude,
    });
    audit(req, "student.create", "Student", student.id, { admissionNo: student.admissionNo });
    res.status(201).json({ success: true, data: student });
  })
);

// GET /students/promotion-review?classRoomId=&termId=
// Returns students in a class with their average % for a term
router.get(
  "/promotion-review",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const { classRoomId, termId } = req.query as Record<string, string | undefined>;
    if (!classRoomId) throw ApiError.badRequest("classRoomId is required");

    const term = termId
      ? await prisma.term.findUnique({ where: { id: termId } })
      : await prisma.term.findFirst({ where: { isCurrent: true, schoolId } });
    if (!term || term.schoolId !== schoolId) throw ApiError.badRequest("No term configured");

    const [students, assessmentTypes, scoreSummary] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId, classRoomId, status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true, admissionNo: true, passportUrl: true },
        orderBy: { lastName: "asc" },
      }),
      prisma.assessmentType.findMany({ where: { schoolId, isActive: true }, select: { maxScore: true } }),
      prisma.score.groupBy({
        by: ["studentId", "subjectId"],
        where: { termId: term.id, student: { schoolId, classRoomId } },
        _sum: { score: true },
      }),
    ]);

    const maxPerSubject = assessmentTypes.reduce((s, a) => s + a.maxScore, 0) || 100;

    const subjectPercents = new Map<string, number[]>();
    for (const row of scoreSummary) {
      const pct = (Number(row._sum.score ?? 0) / maxPerSubject) * 100;
      if (!subjectPercents.has(row.studentId)) subjectPercents.set(row.studentId, []);
      subjectPercents.get(row.studentId)!.push(pct);
    }

    const data = students.map((s) => {
      const pcts = subjectPercents.get(s.id) ?? [];
      const avg = pcts.length
        ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10
        : null;
      return { ...s, averagePercent: avg, subjectsScored: pcts.length };
    });

    res.json({ success: true, data, meta: { termId: term.id, termName: term.name } });
  })
);

// POST /students/promote — per-student promotion decisions
router.post(
  "/promote",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        decisions: z.array(
          z.object({
            studentId: z.string(),
            action: z.enum(["PROMOTE", "REPEAT", "GRADUATE"]),
            toClassRoomId: z.string().optional(),
          })
        ).min(1),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const { decisions } = req.body as {
      decisions: { studentId: string; action: "PROMOTE" | "REPEAT" | "GRADUATE"; toClassRoomId?: string }[];
    };

    const schoolId = currentSchoolId(req);
    const session = await prisma.academicSession.findFirst({ where: { isCurrent: true, schoolId } });
    // Both the pupils and the destination classes come from the request body.
    // Scoping both lookups means an id from another school simply finds nothing
    // and is skipped, rather than promoting a pupil who is not ours.
    const students = await prisma.student.findMany({
      where: { schoolId, id: { in: decisions.map((d) => d.studentId) } },
      include: { classRoom: true },
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const toClassIds = [...new Set(
      decisions.filter((d) => d.action === "PROMOTE" && d.toClassRoomId).map((d) => d.toClassRoomId!)
    )];
    const destClasses = await prisma.classRoom.findMany({ where: { schoolId, id: { in: toClassIds } } });
    const classMap = new Map(destClasses.map((c) => [c.id, c]));

    const ops = decisions.flatMap((d) => {
      const student = studentMap.get(d.studentId);
      if (!student) return [];
      const fromClass = student.classRoom?.name ?? "—";
      const sessionName = session?.name ?? "—";

      if (d.action === "PROMOTE") {
        const toClass = d.toClassRoomId ? classMap.get(d.toClassRoomId) : null;
        if (!toClass) return [];
        return [
          prisma.student.update({ where: { id: d.studentId }, data: { classRoomId: toClass.id } }),
          prisma.promotion.create({ data: { studentId: d.studentId, fromClass, toClass: toClass.name, type: "PROMOTED", sessionName } }),
        ];
      }
      if (d.action === "REPEAT") {
        return [
          prisma.promotion.create({ data: { studentId: d.studentId, fromClass, toClass: fromClass, type: "REPEATED", sessionName } }),
        ];
      }
      if (d.action === "GRADUATE") {
        return [
          prisma.student.update({ where: { id: d.studentId }, data: { classRoomId: null, status: StudentStatus.GRADUATED } }),
          prisma.promotion.create({ data: { studentId: d.studentId, fromClass, toClass: "GRADUATED", type: "GRADUATED", sessionName } }),
        ];
      }
      return [];
    });

    await prisma.$transaction(ops);

    const counts = {
      promoted: decisions.filter((d) => d.action === "PROMOTE").length,
      repeated: decisions.filter((d) => d.action === "REPEAT").length,
      graduated: decisions.filter((d) => d.action === "GRADUATE").length,
    };
    audit(req, "student.promotion_session", "Student", undefined, counts);
    res.json({
      success: true,
      message: `Done: ${counts.promoted} promoted, ${counts.repeated} repeating, ${counts.graduated} graduated.`,
      data: counts,
    });
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
    if (!student || student.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Student not found");
    res.json({ success: true, data: student });
  })
);

// PUT /students/:id
router.put(
  "/:id",
  authorize(...ADMINS),
  validate(z.object({ body: studentBody.omit({ createLogin: true }).partial().extend({ status: z.nativeEnum(StudentStatus).optional() }) })),
  asyncHandler(async (req, res) => {
    // Prisma's update takes a bare id, so the school check has to happen first —
    // otherwise this edits any pupil on the platform whose id is known.
    const existing = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { schoolId: true },
    });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Student not found");

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
      select: { schoolId: true, _count: { select: { scores: true, payments: true, attendance: true } } },
    });
    if (!counts || counts.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Student not found");
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

export default router;
