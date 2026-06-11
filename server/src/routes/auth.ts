import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { hashPassword, verifyPassword, isStrongPassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";

const router = Router();

const publicUser = (u: {
  id: string; email: string; role: string; firstName: string; lastName: string;
  phone: string | null; avatarUrl: string | null; schoolId: string | null;
}) => ({
  id: u.id, email: u.email, role: u.role, firstName: u.firstName, lastName: u.lastName,
  phone: u.phone, avatarUrl: u.avatarUrl, schoolId: u.schoolId,
});

// POST /auth/login
router.post(
  "/login",
  validate(z.object({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw ApiError.unauthorized("Invalid email or password");
    }
    if (!user.isActive) throw ApiError.forbidden("This account has been deactivated. Contact the school admin.");

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    audit(req, "auth.login", "User", user.id);

    res.json({
      success: true,
      data: {
        user: publicUser(user),
        accessToken: signAccessToken({ sub: user.id, role: user.role, schoolId: user.schoolId }),
        refreshToken: signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion }),
      },
    });
  })
);

// POST /auth/refresh — rotate access token
router.post(
  "/refresh",
  validate(z.object({ body: z.object({ refreshToken: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    let payload;
    try {
      payload = verifyRefreshToken((req.body as { refreshToken: string }).refreshToken);
    } catch {
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    // tokenVersion mismatch = tokens were revoked (logout-all / password change)
    if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }
    res.json({
      success: true,
      data: {
        accessToken: signAccessToken({ sub: user.id, role: user.role, schoolId: user.schoolId }),
        refreshToken: signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion }),
      },
    });
  })
);

// GET /auth/me
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.sub },
      include: {
        teacher: true,
        parent: { include: { students: { select: { id: true, firstName: true, lastName: true, admissionNo: true } } } },
        student: { select: { id: true, admissionNo: true, classRoomId: true } },
      },
    });
    if (!user) throw ApiError.unauthorized();
    const { passwordHash, tokenVersion, ...safe } = user;
    res.json({ success: true, data: safe });
  })
);

// POST /auth/change-password
router.post(
  "/change-password",
  authenticate,
  validate(z.object({ body: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }) })),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!isStrongPassword(newPassword)) {
      throw ApiError.badRequest("Password must be at least 8 characters and contain a letter and a number");
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw ApiError.badRequest("Current password is incorrect");
    }
    // Bump tokenVersion to revoke all existing refresh tokens
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
    });
    audit(req, "auth.change_password", "User", user.id);
    res.json({ success: true, message: "Password updated. Please log in again." });
  })
);

// POST /auth/logout-all — revoke refresh tokens on every device
router.post(
  "/logout-all",
  authenticate,
  asyncHandler(async (req, res) => {
    await prisma.user.update({ where: { id: req.auth!.sub }, data: { tokenVersion: { increment: 1 } } });
    audit(req, "auth.logout_all", "User", req.auth!.sub);
    res.json({ success: true, message: "Logged out on all devices" });
  })
);

export default router;
