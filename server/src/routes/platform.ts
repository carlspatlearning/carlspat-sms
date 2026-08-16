/**
 * Platform console — the subscription owner's screens.
 *
 * These routes sit outside every school. They are the only place in the system
 * where more than one school is visible at once, which makes them the one place
 * a tenancy mistake cannot be caught by the school fence. Two rules apply:
 *
 *   1. Only PLATFORM_OWNER reaches any of it (requirePlatformOwner, mounted once
 *      on the router rather than per-route, so a new route cannot forget it).
 *   2. `paystackSecretKey` is a live payment credential and is never selected
 *      into a response. Every select below is explicit for that reason — a
 *      bare findMany would return it.
 */
import { Router } from "express";
import { z } from "zod";
import { Prisma, Role, SubscriptionStatus, PaymentStatus, StudentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { requirePlatformOwner } from "../middleware/tenant";
import { audit } from "../middleware/audit";
import { hashPassword } from "../utils/password";

const router = Router();
router.use(authenticate, requirePlatformOwner);

/** Everything safe to show about a school. Excludes the Paystack secret. */
const schoolCard = {
  id: true,
  slug: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  logoUrl: true,
  headTeacherName: true,
  numberPrefix: true,
  isActive: true,
  subscriptionStatus: true,
  plan: true,
  planAmount: true,
  subscriptionEndsAt: true,
  platformNotes: true,
  createdAt: true,
} satisfies Prisma.SchoolSelect;

/** Turns "St. Mary's Academy" into "st-marys-academy". */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Derives a receipt/admission prefix, e.g. "St. Mary's Academy" → "SMA". */
function derivePrefix(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z]/.test(w))
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (initials || "SCH").slice(0, 5);
}

// ── GET /platform/overview — headline numbers across all schools ─────────────
router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const [schools, byStatus, pupils, activeSubs] = await Promise.all([
      prisma.school.count(),
      prisma.school.groupBy({ by: ["subscriptionStatus"], _count: { _all: true } }),
      prisma.student.count({ where: { status: StudentStatus.ACTIVE } }),
      prisma.school.aggregate({
        where: { subscriptionStatus: SubscriptionStatus.ACTIVE },
        _sum: { planAmount: true },
      }),
    ]);

    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 86400000);
    const expiringSoon = await prisma.school.count({
      where: { subscriptionEndsAt: { gte: now, lte: soon } },
    });
    const expired = await prisma.school.count({
      where: { subscriptionEndsAt: { lt: now } },
    });

    res.json({
      success: true,
      data: {
        schools,
        pupilsAcrossPlatform: pupils,
        // What the platform bills per cycle from schools currently paying.
        recurringRevenue: Number(activeSubs._sum.planAmount ?? 0),
        expiringSoon,
        expired,
        byStatus: Object.fromEntries(byStatus.map((r) => [r.subscriptionStatus, r._count._all])),
      },
    });
  })
);

// ── GET /platform/schools — every subscribing school ─────────────────────────
router.get(
  "/schools",
  asyncHandler(async (req, res) => {
    const { q, status } = req.query as Record<string, string | undefined>;
    const schools = await prisma.school.findMany({
      where: {
        ...(status ? { subscriptionStatus: status as SubscriptionStatus } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
      select: {
        ...schoolCard,
        _count: { select: { students: true, users: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: schools.map((s) => ({
        ...s,
        planAmount: Number(s.planAmount),
        pupils: s._count.students,
        accounts: s._count.users,
        _count: undefined,
      })),
    });
  })
);

// ── GET /platform/schools/:id — one school in detail ─────────────────────────
router.get(
  "/schools/:id",
  asyncHandler(async (req, res) => {
    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: {
        ...schoolCard,
        // Whether online payment is set up, without ever exposing the key.
        paystackSecretKey: true,
        _count: { select: { students: true, users: true, teachers: true } },
      },
    });
    if (!school) throw ApiError.notFound("School not found");

    const [admins, feesCollected] = await Promise.all([
      prisma.user.findMany({
        where: { schoolId: school.id, role: { in: [Role.SUPER_ADMIN, Role.ADMIN] } },
        select: { id: true, firstName: true, lastName: true, email: true, isActive: true, lastLoginAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.payment.aggregate({
        where: { schoolId: school.id, status: PaymentStatus.SUCCESS },
        _sum: { amount: true },
      }),
    ]);

    const { paystackSecretKey, _count, ...rest } = school;
    res.json({
      success: true,
      data: {
        ...rest,
        planAmount: Number(school.planAmount),
        pupils: _count.students,
        accounts: _count.users,
        teachers: _count.teachers,
        // Boolean only. The key itself never leaves the server.
        onlinePaymentConfigured: Boolean(paystackSecretKey),
        feesCollected: Number(feesCollected._sum.amount ?? 0),
        admins,
      },
    });
  })
);

// ── POST /platform/schools — take on a new school ────────────────────────────
router.post(
  "/schools",
  validate(
    z.object({
      body: z.object({
        name: z.string().min(3),
        email: z.string().email(),
        phone: z.string().optional(),
        address: z.string().optional(),
        motto: z.string().optional(),
        plan: z.string().default("standard"),
        planAmount: z.number().nonnegative().default(0),
        subscriptionStatus: z.nativeEnum(SubscriptionStatus).default(SubscriptionStatus.TRIAL),
        subscriptionEndsAt: z.coerce.date().optional(),
        numberPrefix: z.string().min(2).max(5).optional(),
        // The school's first login. Without this the school exists but nobody
        // can get into it, which is the most common way onboarding stalls.
        adminFirstName: z.string().min(2),
        adminLastName: z.string().min(2),
        adminEmail: z.string().email(),
        adminPassword: z.string().min(8),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const b = req.body as {
      name: string; email: string; phone?: string; address?: string; motto?: string;
      plan: string; planAmount: number; subscriptionStatus: SubscriptionStatus;
      subscriptionEndsAt?: Date; numberPrefix?: string;
      adminFirstName: string; adminLastName: string; adminEmail: string; adminPassword: string;
    };

    const adminEmail = b.adminEmail.toLowerCase();
    const taken = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
    if (taken) throw ApiError.conflict("That admin email is already in use on the platform");

    // Slugs must be unique; add a numeric suffix rather than failing on a name
    // clash, which is likely between schools with common names.
    const base = slugify(b.name);
    let slug = base;
    for (let n = 2; await prisma.school.findUnique({ where: { slug }, select: { id: true } }); n++) {
      slug = `${base}-${n}`;
    }

    const passwordHash = await hashPassword(b.adminPassword);

    // School and its first admin are created together: a school with no way in
    // is not a usable school, so the two must succeed or fail as one.
    const school = await prisma.$transaction(async (tx) => {
      const created = await tx.school.create({
        data: {
          slug,
          name: b.name,
          email: b.email,
          phone: b.phone ?? "",
          address: b.address ?? "",
          motto: b.motto ?? "",
          numberPrefix: b.numberPrefix?.toUpperCase() ?? derivePrefix(b.name),
          plan: b.plan,
          planAmount: b.planAmount,
          subscriptionStatus: b.subscriptionStatus,
          subscriptionEndsAt: b.subscriptionEndsAt ?? null,
        },
        select: schoolCard,
      });

      await tx.user.create({
        data: {
          schoolId: created.id,
          email: adminEmail,
          passwordHash,
          role: Role.SUPER_ADMIN,
          firstName: b.adminFirstName,
          lastName: b.adminLastName,
        },
      });

      return created;
    });

    audit(req, "platform.school_create", "School", school.id, { name: school.name, plan: school.plan });
    res.status(201).json({ success: true, data: { ...school, planAmount: Number(school.planAmount) } });
  })
);

// ── PATCH /platform/schools/:id — subscription and billing changes ───────────
router.patch(
  "/schools/:id",
  validate(
    z.object({
      body: z.object({
        name: z.string().min(3).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        plan: z.string().optional(),
        planAmount: z.number().nonnegative().optional(),
        subscriptionStatus: z.nativeEnum(SubscriptionStatus).optional(),
        subscriptionEndsAt: z.coerce.date().nullable().optional(),
        isActive: z.boolean().optional(),
        platformNotes: z.string().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, subscriptionStatus: true },
    });
    if (!existing) throw ApiError.notFound("School not found");

    const updated = await prisma.school.update({
      where: { id: existing.id },
      data: req.body,
      select: schoolCard,
    });

    audit(req, "platform.school_update", "School", existing.id, {
      from: existing.subscriptionStatus,
      to: updated.subscriptionStatus,
      ...req.body,
    });
    res.json({ success: true, data: { ...updated, planAmount: Number(updated.planAmount) } });
  })
);

// ── POST /platform/schools/:id/renew — extend a subscription ─────────────────
router.post(
  "/schools/:id/renew",
  validate(z.object({ body: z.object({ months: z.number().int().min(1).max(36).default(12) }) })),
  asyncHandler(async (req, res) => {
    const { months } = req.body as { months: number };
    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: { id: true, subscriptionEndsAt: true },
    });
    if (!school) throw ApiError.notFound("School not found");

    // Extend from the existing end date when it is still in the future, so a
    // school renewing early keeps the time it already paid for.
    const from =
      school.subscriptionEndsAt && school.subscriptionEndsAt.getTime() > Date.now()
        ? new Date(school.subscriptionEndsAt)
        : new Date();
    from.setMonth(from.getMonth() + months);

    const updated = await prisma.school.update({
      where: { id: school.id },
      data: { subscriptionEndsAt: from, subscriptionStatus: SubscriptionStatus.ACTIVE, isActive: true },
      select: schoolCard,
    });

    audit(req, "platform.school_renew", "School", school.id, { months, until: from.toISOString() });
    res.json({ success: true, data: { ...updated, planAmount: Number(updated.planAmount) } });
  })
);

// ── PUT /platform/schools/:id/paystack — set a school's own gateway key ──────
router.put(
  "/schools/:id/paystack",
  validate(
    z.object({
      // Empty string clears it, which is how a school is switched back off.
      body: z.object({ secretKey: z.string() }),
    })
  ),
  asyncHandler(async (req, res) => {
    const { secretKey } = req.body as { secretKey: string };
    const school = await prisma.school.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!school) throw ApiError.notFound("School not found");

    const trimmed = secretKey.trim();
    if (trimmed && !/^sk_(test|live)_/.test(trimmed)) {
      throw ApiError.badRequest("That does not look like a Paystack secret key (it should start with sk_live_ or sk_test_)");
    }

    await prisma.school.update({
      where: { id: school.id },
      data: { paystackSecretKey: trimmed || null },
    });

    // The key itself is deliberately absent from the audit entry.
    audit(req, "platform.school_paystack_update", "School", school.id, { configured: Boolean(trimmed) });
    res.json({ success: true, data: { onlinePaymentConfigured: Boolean(trimmed) } });
  })
);

export default router;
