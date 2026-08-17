import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";
import { hashPassword } from "../utils/password";
import { getPagination, paginated } from "../utils/pagination";

const NAVY = "#1e3a5f";
const GOLD = "#b8860b";
const GREY = "#6b7280";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", ADMIN: "School Admin", TEACHER: "Teacher",
  ACCOUNTANT: "Bursar", PARENT: "Parent", STUDENT: "Student",
};

const router = Router();
router.use(authenticate, requireActiveSchool);

// GET /users/export/pdf — super-admin: download all user accounts as PDF
router.get(
  "/export/pdf",
  authorize(Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    // A printable directory of names, emails and phone numbers — the single
    // most damaging thing to leak, so it is scoped like everything else.
    const users = await prisma.user.findMany({
      where: { schoolId },
      select: {
        firstName: true, lastName: true, email: true, phone: true,
        role: true, isActive: true, createdAt: true, lastLoginAt: true,
      },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
    });

    const doc = new PDFDocument({ size: "A4", margin: 36, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    const W = doc.page.width - 72; // usable width
    const now = new Date();

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(16)
      .text((school?.name ?? "School").toUpperCase(), 36, 40, { width: W, align: "center" });
    doc.fillColor(GOLD).font("Helvetica-Oblique").fontSize(9)
      .text(school?.address ?? "", 36, doc.y + 2, { width: W, align: "center" });
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(13)
      .text("USER ACCOUNTS DIRECTORY", 36, doc.y + 10, { width: W, align: "center" });
    doc.fillColor(GREY).font("Helvetica").fontSize(8)
      .text(`Generated: ${now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}  ${now.toLocaleTimeString("en-GB")}   ·   Total users: ${users.length}`, 36, doc.y + 4, { width: W, align: "center" });

    // ── Divider ──────────────────────────────────────────────────────────────
    doc.moveDown(0.6);
    doc.moveTo(36, doc.y).lineTo(36 + W, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
    doc.moveDown(0.4);

    // ── Table header ─────────────────────────────────────────────────────────
    const COL = { sn: 28, name: 130, email: 145, phone: 80, role: 68, status: 48 };
    const ROW_H = 16;
    const startX = 36;

    function drawRow(y: number, sn: string, name: string, email: string, phone: string, role: string, status: string, isHeader = false) {
      const font = isHeader ? "Helvetica-Bold" : "Helvetica";
      const textColor = isHeader ? "#ffffff" : "#111827";
      const fontSize = isHeader ? 7.5 : 7.5;

      if (isHeader) {
        doc.rect(startX, y, W, ROW_H).fill(NAVY);
      }

      let x = startX + 3;
      doc.fillColor(textColor).font(font).fontSize(fontSize);

      doc.text(sn,     x, y + 4, { width: COL.sn - 4,    lineBreak: false }); x += COL.sn;
      doc.text(name,   x, y + 4, { width: COL.name - 4,  lineBreak: false }); x += COL.name;
      doc.text(email,  x, y + 4, { width: COL.email - 4, lineBreak: false }); x += COL.email;
      doc.text(phone,  x, y + 4, { width: COL.phone - 4, lineBreak: false }); x += COL.phone;
      doc.text(role,   x, y + 4, { width: COL.role - 4,  lineBreak: false }); x += COL.role;
      doc.text(status, x, y + 4, { width: COL.status,    lineBreak: false });

      if (!isHeader) {
        doc.moveTo(startX, y + ROW_H).lineTo(startX + W, y + ROW_H).strokeColor("#e5e7eb").lineWidth(0.4).stroke();
      }
    }

    let currentY = doc.y;
    drawRow(currentY, "#", "Full Name", "Email", "Phone", "Role", "Status", true);
    currentY += ROW_H + 1;

    users.forEach((u, i) => {
      // Start new page if near the bottom
      if (currentY + ROW_H > doc.page.height - 60) {
        doc.addPage();
        currentY = 36;
        drawRow(currentY, "#", "Full Name", "Email", "Phone", "Role", "Status", true);
        currentY += ROW_H + 1;
      }

      // Zebra stripe
      if (i % 2 === 1) {
        doc.rect(startX, currentY, W, ROW_H).fill("#f9fafb");
      }

      drawRow(
        currentY,
        String(i + 1),
        `${u.lastName} ${u.firstName}`,
        u.email,
        u.phone ?? "—",
        ROLE_LABELS[u.role] ?? u.role,
        u.isActive ? "Active" : "Disabled",
      );
      currentY += ROW_H;
    });

    // ── Footer on every page ─────────────────────────────────────────────────
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fillColor(GREY).font("Helvetica").fontSize(7)
        .text(`${school?.name ?? "School"} — Confidential`, 36, doc.page.height - 30, { width: W / 2 })
        .text(`Page ${i + 1} of ${pageCount}`, 36, doc.page.height - 30, { width: W, align: "right" });
    }

    doc.end();
    const pdf = await done;

    const filename = `users-${now.toISOString().slice(0, 10)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdf);
  })
);

// GET /users — admin user management
router.get(
  "/",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const pg = getPagination(req);
    const { q, role } = req.query as Record<string, string | undefined>;
    const where = {
      schoolId: currentSchoolId(req),
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
    // A school admin must never be able to mint a platform account for themselves.
    if (role === Role.PLATFORM_OWNER) {
      throw ApiError.forbidden("Platform accounts cannot be created from a school");
    }
    const { password, email, ...rest } = req.body;
    const user = await prisma.user.create({
      data: {
        ...rest,
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        schoolId: currentSchoolId(req),
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
    if (!target || target.schoolId !== currentSchoolId(req)) throw ApiError.notFound("User not found");
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
    const schoolId = currentSchoolId(req);
    if (!target || target.schoolId !== schoolId) throw ApiError.notFound("User not found");
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
      // Counted within this school. Unscoped, another school's super admins
      // would satisfy the check and let this school delete its last one.
      const superAdmins = await prisma.user.count({
        where: { schoolId, role: Role.SUPER_ADMIN, isActive: true },
      });
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
    // The audit trail names who did what and from which IP, across every action
    // in the system — it needs the same fence as the records it describes.
    const where = { schoolId: currentSchoolId(req) };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, role: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ success: true, data: paginated(items, total, pg) });
  })
);

export default router;
