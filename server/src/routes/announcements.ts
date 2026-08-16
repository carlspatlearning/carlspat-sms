import { Router } from "express";
import { z } from "zod";
import { Audience, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { requireActiveSchool } from "../middleware/tenant";
import { audit } from "../middleware/audit";
import { sendEmail, sendSms } from "../services/notify";

const router = Router();
router.use(authenticate, requireActiveSchool);

const audienceForRole: Record<Role, Audience[]> = {
  SUPER_ADMIN: [Audience.ALL, Audience.TEACHERS, Audience.PARENTS, Audience.STUDENTS, Audience.STAFF],
  ADMIN: [Audience.ALL, Audience.TEACHERS, Audience.PARENTS, Audience.STUDENTS, Audience.STAFF],
  ACCOUNTANT: [Audience.ALL, Audience.STAFF],
  TEACHER: [Audience.ALL, Audience.TEACHERS, Audience.STAFF],
  PARENT: [Audience.ALL, Audience.PARENTS],
  STUDENT: [Audience.ALL, Audience.STUDENTS],
};

// GET /announcements — filtered to the viewer's audience
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const announcements = await prisma.announcement.findMany({
      where: {
        audience: { in: audienceForRole[req.auth!.role] },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      include: { createdBy: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });
    res.json({ success: true, data: announcements });
  })
);

// POST /announcements — admins publish; optional email/SMS broadcast
router.post(
  "/",
  authorize(...ADMINS),
  validate(
    z.object({
      body: z.object({
        title: z.string().min(3),
        body: z.string().min(3),
        audience: z.nativeEnum(Audience).default(Audience.ALL),
        expiresAt: z.coerce.date().optional(),
        notifyByEmail: z.boolean().optional(),
        notifyBySms: z.boolean().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findFirst();
    if (!school) throw ApiError.notFound("School not configured");
    const { notifyByEmail, notifyBySms, ...data } = req.body;

    const announcement = await prisma.announcement.create({
      data: { ...data, schoolId: school.id, createdById: req.auth!.sub },
    });
    audit(req, "announcement.create", "Announcement", announcement.id);

    // Optional broadcast — fire and forget so the request returns quickly
    if (notifyByEmail || notifyBySms) {
      const roleFilter: Role[] =
        data.audience === Audience.TEACHERS ? [Role.TEACHER]
        : data.audience === Audience.PARENTS ? [Role.PARENT]
        : data.audience === Audience.STUDENTS ? [Role.STUDENT]
        : data.audience === Audience.STAFF ? [Role.TEACHER, Role.ACCOUNTANT, Role.ADMIN]
        : [Role.TEACHER, Role.PARENT, Role.STUDENT, Role.ACCOUNTANT];
      prisma.user
        .findMany({ where: { role: { in: roleFilter }, isActive: true }, select: { email: true, phone: true } })
        .then(async (users) => {
          for (const u of users) {
            if (notifyByEmail) await sendEmail(u.email, `[${school.name}] ${data.title}`, `<p>${data.body}</p>`);
            if (notifyBySms && u.phone) await sendSms(u.phone, `${school.name}: ${data.title} — ${data.body.slice(0, 120)}`);
          }
        })
        .catch((e) => console.error("Announcement broadcast failed:", e));
    }

    res.status(201).json({ success: true, data: announcement });
  })
);

router.delete(
  "/:id",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    audit(req, "announcement.delete", "Announcement", req.params.id);
    res.json({ success: true, message: "Announcement deleted" });
  })
);

export default router;
