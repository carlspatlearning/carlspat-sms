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

// GET /parents
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
            { user: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      prisma.parent.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } },
          students: { select: { id: true, firstName: true, lastName: true, admissionNo: true, classRoom: { select: { name: true } } } },
        },
        orderBy: { user: { lastName: "asc" } },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.parent.count({ where }),
    ]);
    res.json({ success: true, data: paginated(items, total, pg) });
  })
);

// POST /parents — create parent account
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
        occupation: z.string().optional(),
        address: z.string().optional(),
        studentIds: z.array(z.string()).optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const { firstName, lastName, email, phone, password, studentIds, ...profile } = req.body;

    const parent = await prisma.parent.create({
      data: {
        ...profile,
        user: {
          create: {
            schoolId: school.id,
            email: email.toLowerCase(),
            passwordHash: await hashPassword(password),
            role: Role.PARENT,
            firstName,
            lastName,
            phone,
          },
        },
      },
      include: { user: { select: { id: true, email: true } } },
    });
    if (studentIds?.length) {
      await prisma.student.updateMany({ where: { id: { in: studentIds } }, data: { parentId: parent.id } });
    }
    audit(req, "parent.create", "Parent", parent.id);
    res.status(201).json({ success: true, data: parent });
  })
);

// GET /parents/me/children — the logged-in parent's children with class info
router.get(
  "/me/children",
  authorize(Role.PARENT),
  asyncHandler(async (req, res) => {
    const parent = await prisma.parent.findUnique({
      where: { userId: req.auth!.sub },
      include: {
        students: {
          include: { classRoom: { select: { id: true, name: true, section: true } } },
          orderBy: { firstName: "asc" },
        },
      },
    });
    if (!parent) throw ApiError.notFound("Parent profile not found");
    res.json({ success: true, data: parent.students });
  })
);

// PUT /parents/:id — update profile and account details
router.put(
  "/:id",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        firstName: z.string().min(2).optional(),
        lastName: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        occupation: z.string().optional(),
        address: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, isActive, ...profile } = req.body;
    const userFields = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(email !== undefined ? { email: email.toLowerCase() } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
    const parent = await prisma.parent.update({
      where: { id: req.params.id },
      data: {
        ...profile,
        ...(Object.keys(userFields).length > 0 ? { user: { update: userFields } } : {}),
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } },
      },
    });
    audit(req, "parent.update", "Parent", parent.id);
    res.json({ success: true, data: parent });
  })
);

// DELETE /parents/:id — unlinks children, then removes the account
router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const parent = await prisma.parent.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true } }, students: { select: { id: true } } },
    });
    if (!parent) throw ApiError.notFound("Parent not found");
    await prisma.$transaction([
      prisma.student.updateMany({ where: { parentId: parent.id }, data: { parentId: null } }),
      prisma.user.delete({ where: { id: parent.user.id } }),
    ]);
    audit(req, "parent.delete", "Parent", req.params.id, { unlinkedChildren: parent.students.length });
    res.json({
      success: true,
      message:
        parent.students.length > 0
          ? `Parent deleted. ${parent.students.length} student(s) are no longer linked to a parent.`
          : "Parent deleted",
    });
  })
);

// POST /parents/:id/link — attach students to a parent
router.post(
  "/:id/link",
  authorize(...ADMINS),
  validate(z.object({ body: z.object({ studentIds: z.array(z.string()).min(1) }) })),
  asyncHandler(async (req, res) => {
    const parent = await prisma.parent.findUnique({ where: { id: req.params.id } });
    if (!parent) throw ApiError.notFound("Parent not found");
    await prisma.student.updateMany({
      where: { id: { in: (req.body as { studentIds: string[] }).studentIds } },
      data: { parentId: parent.id },
    });
    audit(req, "parent.link_students", "Parent", parent.id);
    res.json({ success: true, message: "Students linked to parent" });
  })
);

export default router;
