import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";

const router = Router();
router.use(authenticate, requireActiveSchool);

// Who can message whom: staff ↔ anyone; parents/students → staff only.
function canMessage(senderRole: Role, recipientRole: Role): boolean {
  const staff: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER, Role.ACCOUNTANT];
  if (staff.includes(senderRole)) return true;
  return staff.includes(recipientRole);
}

// GET /messages — inbox + sent
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.sub;
    const box = (req.query.box as string) === "sent" ? "sent" : "inbox";
    const messages = await prisma.message.findMany({
      where: box === "inbox" ? { recipientId: userId } : { senderId: userId },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        recipient: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ success: true, data: messages });
  })
);

// GET /messages/contacts — valid recipients for the compose form
router.get(
  "/contacts",
  asyncHandler(async (req, res) => {
    const staff: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER, Role.ACCOUNTANT];
    const isStaff = staff.includes(req.auth!.role);
    // The contact list is a staff and parent directory. Unscoped, it would show
    // every name and role on the platform to anyone with a login.
    const users = await prisma.user.findMany({
      where: {
        schoolId: currentSchoolId(req),
        isActive: true,
        id: { not: req.auth!.sub },
        ...(isStaff ? {} : { role: { in: staff } }),
      },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
      take: 500,
    });
    res.json({ success: true, data: users });
  })
);

// POST /messages
router.post(
  "/",
  validate(
    z.object({
      body: z.object({
        recipientId: z.string(),
        subject: z.string().max(150).optional(),
        body: z.string().min(1).max(5000),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const recipient = await prisma.user.findUnique({ where: { id: req.body.recipientId } });
    if (!recipient || !recipient.isActive || recipient.schoolId !== currentSchoolId(req)) {
      throw ApiError.notFound("Recipient not found");
    }
    if (!canMessage(req.auth!.role, recipient.role)) {
      throw ApiError.forbidden("You can only message school staff");
    }
    const message = await prisma.message.create({
      data: { ...req.body, senderId: req.auth!.sub },
      include: { recipient: { select: { firstName: true, lastName: true } } },
    });
    audit(req, "message.send", "Message", message.id);
    res.status(201).json({ success: true, data: message });
  })
);

// PATCH /messages/:id/read
router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.recipientId !== req.auth!.sub) throw ApiError.notFound("Message not found");
    const updated = await prisma.message.update({ where: { id: message.id }, data: { readAt: new Date() } });
    res.json({ success: true, data: updated });
  })
);

export default router;
