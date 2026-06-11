import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS, STAFF } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { hashPassword } from "../utils/password";
import { getPagination, paginated } from "../utils/pagination";

const router = Router();
router.use(authenticate);

// GET /teachers
router.get(
  "/",
  authorize(...STAFF),
  asyncHandler(async (req, res) => {
    const pg = getPagination(req);
    const q = req.query.q as string | undefined;
    const where = q
      ? {
          OR: [
            { user: { firstName: { contains: q, mode: "insensitive" as const } } },
            { user: { lastName: { contains: q, mode: "insensitive" as const } } },
            { staffNo: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};
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
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const { firstName, lastName, email, phone, password, ...profile } = req.body;

    const count = await prisma.teacher.count();
    const teacher = await prisma.teacher.create({
      data: {
        staffNo: `CPS/STF/${String(count + 1).padStart(3, "0")}`,
        ...profile,
        user: {
          create: {
            schoolId: school.id,
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

// PUT /teachers/:id
router.put(
  "/:id",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        qualification: z.string().optional(),
        specialization: z.string().optional(),
        phone: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const { phone, isActive, ...profile } = req.body;
    const teacher = await prisma.teacher.update({
      where: { id: req.params.id },
      data: {
        ...profile,
        ...(phone !== undefined || isActive !== undefined
          ? { user: { update: { ...(phone !== undefined ? { phone } : {}), ...(isActive !== undefined ? { isActive } : {}) } } }
          : {}),
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } } },
    });
    audit(req, "teacher.update", "Teacher", teacher.id);
    res.json({ success: true, data: teacher });
  })
);

export default router;
