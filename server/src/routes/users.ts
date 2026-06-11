import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { hashPassword } from "../utils/password";
import { getPagination, paginated } from "../utils/pagination";

const router = Router();
router.use(authenticate);

// GET /users — admin user management
router.get(
  "/",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const pg = getPagination(req);
    const { q, role } = req.query as Record<string, string | undefined>;
    const where = {
      ...(role ? { role: role as Role } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, role: true, firstName: true, lastName: true,
          phone: true, isActive: true, lastLoginAt: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ success: true, data: paginated(items, total, pg) });
  })
);

// POST /users — create staff accounts (e.g. accountant, extra admins)
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
        role: z.nativeEnum(Role),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    // Only a super admin may create other admins or super admins
    const { role } = req.body as { role: Role };
    if ((role === Role.ADMIN || role === Role.SUPER_ADMIN) && req.auth!.role !== Role.SUPER_ADMIN) {
      throw ApiError.forbidden("Only the super admin can create admin accounts");
    }
    const school = await prisma.school.findFirst();
    const { password, email, ...rest } = req.body;
    const user = await prisma.user.create({
      data: {
        ...rest,
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        schoolId: school?.id,
      },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });
    audit(req, "user.create", "User", user.id, { role: user.role });
    res.status(201).json({ success: true, data: user });
  })
);

// PATCH /users/:id — activate/deactivate, reset password
router.patch(
  "/:id",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        isActive: z.boolean().optional(),
        newPassword: z.string().min(8).optional(),
        phone: z.string().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw ApiError.notFound("User not found");
    if (target.role === Role.SUPER_ADMIN && req.auth!.role !== Role.SUPER_ADMIN) {
      throw ApiError.forbidden("Only the super admin can modify a super admin account");
    }
    const { isActive, newPassword, phone } = req.body as { isActive?: boolean; newPassword?: string; phone?: string };
    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(newPassword
          ? { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } }
          : {}),
      },
      select: { id: true, email: true, role: true, isActive: true },
    });
    audit(req, "user.update", "User", user.id, { isActive, passwordReset: Boolean(newPassword) });
    res.json({ success: true, data: user });
  })
);

// GET /users/audit-logs — activity tracking (admin)
router.get(
  "/audit-logs",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const pg = getPagination(req, 50);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: { user: { select: { firstName: true, lastName: true, role: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.auditLog.count(),
    ]);
    res.json({ success: true, data: paginated(items, total, pg) });
  })
);

export default router;
