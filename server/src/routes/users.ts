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

// PATCH /users/:id — edit details, change role, activate/deactivate, reset password
router.patch(
  "/:id",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        firstName: z.string().min(2).optional(),
        lastName: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.nativeEnum(Role).optional(),
        isActive: z.boolean().optional(),
        newPassword: z.string().min(8).optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { teacher: true, parent: true, student: true },
    });
    if (!target) throw ApiError.notFound("User not found");
    if (
      (target.role === Role.SUPER_ADMIN || target.role === Role.ADMIN) &&
      req.auth!.role !== Role.SUPER_ADMIN &&
      target.id !== req.auth!.sub
    ) {
      throw ApiError.forbidden("Only the super admin can modify another admin's account");
    }
    const { firstName, lastName, email, phone, role, isActive, newPassword } = req.body as {
      firstName?: string; lastName?: string; email?: string; phone?: string;
      role?: Role; isActive?: boolean; newPassword?: string;
    };
    if (role !== undefined && role !== target.role) {
      // Promoting to admin levels is a super-admin-only action
      if ((role === Role.ADMIN || role === Role.SUPER_ADMIN) && req.auth!.role !== Role.SUPER_ADMIN) {
        throw ApiError.forbidden("Only the super admin can grant admin roles");
      }
      // Accounts tied to a teacher/parent/student profile keep their role
      if (target.teacher || target.parent || target.student) {
        throw ApiError.badRequest(
          "This account is linked to a teacher/parent/student profile, so its role cannot be changed"
        );
      }
    }
    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(email !== undefined ? { email: email.toLowerCase() } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(newPassword
          ? { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } }
          : {}),
      },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true },
    });
    audit(req, "user.update", "User", user.id, {
      isActive,
      roleChanged: role !== undefined && role !== target.role ? `${target.role} -> ${role}` : undefined,
      passwordReset: Boolean(newPassword),
    });
    res.json({ success: true, data: user });
  })
);

// DELETE /users/:id — remove an account (admins/accountants); guarded so the
// school can never lock itself out
router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        teacher: true,
        parent: true,
        student: true,
        _count: { select: { scoresRecorded: true, attendanceMarked: true, paymentsRecorded: true } },
      },
    });
    if (!target) throw ApiError.notFound("User not found");
    if (target.id === req.auth!.sub) {
      throw ApiError.badRequest("You cannot delete your own account while logged in to it");
    }
    if (
      (target.role === Role.SUPER_ADMIN || target.role === Role.ADMIN) &&
      req.auth!.role !== Role.SUPER_ADMIN
    ) {
      throw ApiError.forbidden("Only the super admin can remove an admin account");
    }
    if (target.role === Role.SUPER_ADMIN) {
      const superAdmins = await prisma.user.count({ where: { role: Role.SUPER_ADMIN, isActive: true } });
      if (superAdmins <= 1) throw ApiError.badRequest("Cannot delete the only super admin account");
    }
    // Profiles have their own removal flows that keep records consistent
    if (target.teacher) {
      throw ApiError.badRequest("This is a teacher account — remove it from the Teachers page instead");
    }
    if (target.parent) {
      throw ApiError.badRequest("This is a parent account — remove it from the Parents page instead");
    }
    if (target.student) {
      throw ApiError.badRequest("This is a student account — remove the student from the Students page instead");
    }
    const hasRecords =
      target._count.scoresRecorded + target._count.attendanceMarked + target._count.paymentsRecorded > 0;
    if (hasRecords) {
      await prisma.user.update({
        where: { id: target.id },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      });
      audit(req, "user.deactivate", "User", target.id);
      return res.json({
        success: true,
        message: "This account has recorded payments/scores/attendance, so it was deactivated instead of deleted.",
      });
    }
    await prisma.user.delete({ where: { id: target.id } });
    audit(req, "user.delete", "User", req.params.id, { role: target.role });
    res.json({ success: true, message: "Account deleted" });
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
