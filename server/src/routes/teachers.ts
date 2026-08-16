import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS, STAFF } from "../middleware/auth";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";
import { nextStaffNo } from "../utils/ids";
import { hashPassword } from "../utils/password";
import { getPagination, paginated } from "../utils/pagination";

const router = Router();
router.use(authenticate, requireActiveSchool);

// GET /teachers
router.get(
  "/",
  authorize(...STAFF),
  asyncHandler(async (req, res) => {
    const pg = getPagination(req);
    const q = req.query.q as string | undefined;
    const where = {
      schoolId: currentSchoolId(req),
      ...(q
        ? {
            OR: [
              { user: { firstName: { contains: q, mode: "insensitive" as const } } },
              { user: { lastName: { contains: q, mode: "insensitive" as const } } },
              { staffNo: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } },
          formClasses: { select: { id: true, name: true } },
          classSubjects: { include: { subject: true, classRoom: { select: { id: true, name: true } } } },
        },
        orderBy: { staffNo: "asc" },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.teacher.count({ where }),
    ]);
    res.json({ success: true, data: paginated(items, total, pg) });
  })
);

// POST /teachers/from-user — promote an existing user account into a teacher profile
router.post(
  "/from-user",
  authorize(...ADMINS),
  validate(z.object({
    body: z.object({
      userId: z.string(),
      qualification: z.string().optional(),
      specialization: z.string().optional(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const { userId, qualification, specialization } = req.body as {
      userId: string; qualification?: string; specialization?: string;
    };
    const schoolId = currentSchoolId(req);
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { teacher: true } });
    if (!user || user.schoolId !== schoolId) throw ApiError.notFound("User not found");
    if (user.teacher) throw ApiError.conflict("This user already has a teacher profile");

    const staffNo = await nextStaffNo(schoolId);
    const teacher = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { role: Role.TEACHER } });
      return tx.teacher.create({
        data: {
          schoolId,
          staffNo,
          userId,
          qualification,
          specialization,
        },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      });
    });
    audit(req, "teacher.create_from_user", "Teacher", teacher.id);
    res.status(201).json({ success: true, data: teacher });
  })
);

// POST /teachers — creates user account + teacher profile
router.post(
  "/",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        firstName: z.string().min(2),
        lastName: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        password: z.string().min(8),
        qualification: z.string().optional(),
        specialization: z.string().optional(),
        dateJoined: z.coerce.date().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const { firstName, lastName, email, phone, password, ...profile } = req.body;

    const teacher = await prisma.teacher.create({
      data: {
        schoolId,
        staffNo: await nextStaffNo(schoolId),
        ...profile,
        user: {
          create: {
            schoolId,
            email: email.toLowerCase(),
            passwordHash: await hashPassword(password),
            role: Role.TEACHER,
            firstName,
            lastName,
            phone,
          },
        },
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    audit(req, "teacher.create", "Teacher", teacher.id);
    res.status(201).json({ success: true, data: teacher });
  })
);

// GET /teachers/me/classes — the logged-in teacher's assignments
router.get(
  "/me/classes",
  authorize(Role.TEACHER),
  asyncHandler(async (req, res) => {
    // Keyed on the caller's own user id, so this is already their own record.
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.auth!.sub },
      include: {
        formClasses: { include: { _count: { select: { students: true } } } },
        classSubjects: {
          include: {
            subject: true,
            classRoom: { include: { _count: { select: { students: true } } } },
          },
        },
      },
    });
    if (!teacher) throw ApiError.notFound("Teacher profile not found");
    res.json({ success: true, data: teacher });
  })
);

// PUT /teachers/:id/subjects — assign/unassign this teacher to class-subjects
router.put(
  "/:id/subjects",
  authorize(...ADMINS),
  validate(z.object({
    body: z.object({
      classRoomId: z.string(),
      subjectIds: z.array(z.string()),
    }),
  })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const { classRoomId, subjectIds } = req.body as { classRoomId: string; subjectIds: string[] };
    const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id } });
    if (!teacher || teacher.schoolId !== schoolId) throw ApiError.notFound("Teacher not found");

    // The class and every subject come from the request body, so each is checked
    // before this teacher is attached to them.
    const cls = await prisma.classRoom.findUnique({ where: { id: classRoomId }, select: { schoolId: true } });
    if (!cls || cls.schoolId !== schoolId) throw ApiError.notFound("Class not found");
    const subjects = await prisma.subject.findMany({
      where: { schoolId, id: { in: subjectIds } },
      select: { id: true },
    });
    if (subjects.length !== new Set(subjectIds).size) throw ApiError.notFound("One or more subjects were not found");

    await prisma.$transaction(async (tx) => {
      // Release subjects in this class that are no longer in the new list
      await tx.classSubject.updateMany({
        where: { classRoomId, teacherId: teacher.id, subjectId: { notIn: subjectIds } },
        data: { teacherId: null },
      });
      // Assign teacher to every selected subject (creates the class-subject if it doesn't exist)
      for (const subjectId of subjectIds) {
        await tx.classSubject.upsert({
          where: { classRoomId_subjectId: { classRoomId, subjectId } },
          update: { teacherId: teacher.id },
          create: { classRoomId, subjectId, teacherId: teacher.id },
        });
      }
    });
    audit(req, "teacher.subjects_update", "Teacher", teacher.id, { classRoomId, count: subjectIds.length });
    res.json({ success: true, message: "Subject assignments updated" });
  })
);

// PUT /teachers/:id — profile and account details
router.put(
  "/:id",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        firstName: z.string().min(2).optional(),
        lastName: z.string().min(2).optional(),
        email: z.string().email().optional(),
        qualification: z.string().optional(),
        specialization: z.string().optional(),
        phone: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.teacher.findUnique({ where: { id: req.params.id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Teacher not found");

    const { firstName, lastName, email, phone, isActive, ...profile } = req.body;
    const userFields = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(email !== undefined ? { email: email.toLowerCase() } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
    const teacher = await prisma.teacher.update({
      where: { id: req.params.id },
      data: {
        ...profile,
        ...(Object.keys(userFields).length > 0 ? { user: { update: userFields } } : {}),
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } } },
    });
    audit(req, "teacher.update", "Teacher", teacher.id);
    res.json({ success: true, data: teacher });
  })
);

// DELETE /teachers/:id — hard delete when they have no academic records,
// otherwise deactivate the account so historical records stay intact
router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, _count: { select: { scoresRecorded: true, attendanceMarked: true } } } },
      },
    });
    if (!teacher || teacher.schoolId !== currentSchoolId(req)) throw ApiError.notFound("Teacher not found");

    const hasRecords =
      teacher.user._count.scoresRecorded + teacher.user._count.attendanceMarked > 0;
    if (hasRecords) {
      await prisma.user.update({ where: { id: teacher.user.id }, data: { isActive: false, tokenVersion: { increment: 1 } } });
      audit(req, "teacher.deactivate", "Teacher", teacher.id);
      return res.json({
        success: true,
        message: "This teacher has recorded scores/attendance, so their account was deactivated instead of deleted.",
      });
    }
    // Release class assignments, then remove the account (cascades the profile)
    await prisma.$transaction([
      prisma.classSubject.updateMany({ where: { teacherId: teacher.id }, data: { teacherId: null } }),
      prisma.classRoom.updateMany({ where: { formTeacherId: teacher.id }, data: { formTeacherId: null } }),
      prisma.user.delete({ where: { id: teacher.user.id } }),
    ]);
    audit(req, "teacher.delete", "Teacher", req.params.id);
    res.json({ success: true, message: "Teacher deleted" });
  })
);

export default router;
