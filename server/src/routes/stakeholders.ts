import { CandidateExam, CandidateRegistrationStatus, Gender, Role, StakeholderStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { asyncHandler } from "../middleware/error";
import { requireActiveSchool, currentSchoolId } from "../middleware/tenant";
import { validate } from "../middleware/validate";
import { ApiError } from "../utils/apiError";
import { hashPassword } from "../utils/password";

const router = Router();
router.use(authenticate, requireActiveSchool);

const candidateBody = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.coerce.date().optional(),
  exam: z.nativeEnum(CandidateExam),
  sessionId: z.string().min(1),
  passportUrl: z.string().url().max(2048).optional(),
  servicePriceIds: z.array(z.string().min(1)).max(30).default([]),
  applicationData: z.object({
    otherNames: z.string().trim().max(120).optional(),
    nationalId: z.string().trim().max(30).optional(),
    nationality: z.string().trim().max(80).optional(),
    stateOfOrigin: z.string().trim().max(80).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    address: z.string().trim().max(300).optional(),
    city: z.string().trim().max(100).optional(),
    residentialState: z.string().trim().max(80).optional(),
    subjects: z.array(z.object({
      subject: z.string().trim().min(1).max(100),
      cass1: z.string().trim().max(20).optional(),
      cass2: z.string().trim().max(20).optional(),
      cass3: z.string().trim().max(20).optional(),
      signature: z.string().trim().max(120).optional(),
    })).max(15).default([]),
  }).default({}),
});
const paymentBody = z.object({ amountPaid: z.coerce.number().min(0).max(1_000_000_000), amountDue: z.coerce.number().min(0).max(1_000_000_000) });
const registrationUpdateBody = candidateBody.omit({ servicePriceIds: true }).partial();

router.get(
  "/service-prices",
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    if (req.auth!.role === Role.STAKEHOLDER) {
      const partner = await prisma.stakeholderSchool.findFirst({ where: { userId: req.auth!.sub, schoolId, status: StakeholderStatus.APPROVED }, select: { id: true } });
      if (!partner) throw ApiError.forbidden("Your stakeholder account is inactive. Contact the host school.");
      const items = await prisma.stakeholderServicePrice.findMany({ where: { schoolId, isActive: true }, orderBy: [{ exam: "asc" }, { name: "asc" }] });
      return res.json({ success: true, data: items });
    }
    if (!ADMINS.includes(req.auth!.role as typeof ADMINS[number])) throw ApiError.forbidden();
    const items = await prisma.stakeholderServicePrice.findMany({ where: { schoolId }, orderBy: [{ exam: "asc" }, { name: "asc" }] });
    res.json({ success: true, data: items });
  })
);

router.post(
  "/service-prices",
  authorize(...ADMINS),
  validate(z.object({ body: z.object({ kind: z.enum(["EXAM", "SERVICE"]), exam: z.nativeEnum(CandidateExam).optional(), name: z.string().trim().min(2).max(120).optional(), amount: z.coerce.number().min(0).max(1_000_000_000) }) })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const { kind, exam, name, amount } = req.body as { kind: "EXAM" | "SERVICE"; exam?: CandidateExam; name?: string; amount: number };
    if (kind === "EXAM" && !exam) throw ApiError.badRequest("Choose an examination to price.");
    if (kind === "SERVICE" && !name) throw ApiError.badRequest("Enter a service name.");
    const key = kind === "EXAM" ? `EXAM:${exam}` : `SERVICE:${randomUUID()}`;
    const price = await prisma.stakeholderServicePrice.create({ data: { schoolId, key, name: kind === "EXAM" ? exam!.replaceAll("_", " & ") : name!, exam: kind === "EXAM" ? exam : null, amount } });
    audit(req, "stakeholder_service_price.create", "StakeholderServicePrice", price.id);
    res.status(201).json({ success: true, data: price });
  })
);

router.patch(
  "/service-prices/:id",
  authorize(...ADMINS),
  validate(z.object({ params: z.object({ id: z.string().min(1) }), body: z.object({ name: z.string().trim().min(2).max(120).optional(), amount: z.coerce.number().min(0).max(1_000_000_000).optional(), isActive: z.boolean().optional() }) })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const current = await prisma.stakeholderServicePrice.findFirst({ where: { id: req.params.id, schoolId }, select: { id: true } });
    if (!current) throw ApiError.notFound("Price entry not found");
    const price = await prisma.stakeholderServicePrice.update({ where: { id: current.id }, data: req.body });
    audit(req, "stakeholder_service_price.update", "StakeholderServicePrice", price.id);
    res.json({ success: true, data: price });
  })
);

// Admin directory and registration count summary.
router.get(
  "/",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const items = await prisma.stakeholderSchool.findMany({
      where: { schoolId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: items });
  })
);

// Host admin creates an approved partner profile and login. Credentials can be
// shared with the stakeholder by the school through its usual secure channel.
router.post(
  "/",
  authorize(...ADMINS),
  validate(z.object({ body: z.object({
    name: z.string().trim().min(2).max(160),
    representativeName: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(40).optional(),
    password: z.string().min(8).max(200),
  }) })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const input = req.body as z.infer<typeof candidateBody> & { name: string; representativeName: string; email: string; phone?: string; password: string };
    const email = input.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw ApiError.conflict("An account with this email already exists.");
    }
    const [firstName, ...surname] = input.representativeName.split(/\s+/);
    if (!firstName || surname.length === 0) throw ApiError.badRequest("Enter the representative's first and last name.");
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          schoolId, email, firstName, lastName: surname.join(" "), phone: input.phone || null,
          role: Role.STAKEHOLDER, isActive: true, passwordHash: await hashPassword(input.password),
        },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true },
      });
      const stakeholder = await tx.stakeholderSchool.create({
        data: { schoolId, userId: user.id, name: input.name, representativeName: input.representativeName },
      });
      return { ...stakeholder, user, _count: { registrations: 0 } };
    });
    audit(req, "stakeholder.create", "StakeholderSchool", result.id);
    res.status(201).json({ success: true, data: result });
  })
);

// Host school's review queue. A status update is restricted to the host tenant.
router.get(
  "/registrations",
  authorize(...ADMINS),
  asyncHandler(async (req, res) => {
    const items = await prisma.candidateRegistration.findMany({
      where: { schoolId: currentSchoolId(req) },
      include: {
        stakeholderSchool: { select: { id: true, name: true } },
        session: { select: { id: true, name: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: items });
  })
);

router.patch(
  "/registrations/:id/review",
  authorize(...ADMINS),
  validate(z.object({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ status: z.enum([CandidateRegistrationStatus.APPROVED, CandidateRegistrationStatus.REJECTED]), decisionNote: z.string().trim().max(1000).optional() }),
  })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const current = await prisma.candidateRegistration.findFirst({ where: { id: req.params.id, schoolId } });
    if (!current) throw ApiError.notFound("Student registration not found");
    if (current.status !== CandidateRegistrationStatus.PENDING) throw ApiError.badRequest("Only pending registrations can be reviewed.");
    const registration = await prisma.candidateRegistration.update({
      where: { id: current.id },
      data: {
        status: req.body.status,
        decisionNote: req.body.decisionNote || null,
        reviewedById: req.auth!.sub,
        reviewedAt: new Date(),
      },
      include: { stakeholderSchool: { select: { id: true, name: true } }, session: { select: { id: true, name: true } } },
    });
    audit(req, "stakeholder_registration.review", "CandidateRegistration", registration.id, { status: registration.status });
    res.json({ success: true, data: registration });
  })
);

router.patch(
  "/registrations/:id",
  authorize(...ADMINS),
  validate(z.object({ params: z.object({ id: z.string().min(1) }), body: registrationUpdateBody })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const current = await prisma.candidateRegistration.findFirst({ where: { id: req.params.id, schoolId }, select: { id: true } });
    if (!current) throw ApiError.notFound("Student registration not found");
    const input = req.body as z.infer<typeof registrationUpdateBody>;
    if (input.sessionId && !await prisma.academicSession.findFirst({ where: { id: input.sessionId, schoolId }, select: { id: true } })) {
      throw ApiError.badRequest("Choose an academic session belonging to this host school.");
    }
    const registration = await prisma.candidateRegistration.update({ where: { id: current.id }, data: input });
    audit(req, "stakeholder_registration.update", "CandidateRegistration", registration.id);
    res.json({ success: true, data: registration });
  })
);

router.patch(
  "/registrations/:id/payment",
  authorize(...ADMINS),
  validate(z.object({ params: z.object({ id: z.string().min(1) }), body: paymentBody })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const current = await prisma.candidateRegistration.findFirst({ where: { id: req.params.id, schoolId }, select: { id: true } });
    if (!current) throw ApiError.notFound("Student registration not found");
    const registration = await prisma.candidateRegistration.update({ where: { id: current.id }, data: req.body });
    audit(req, "stakeholder_registration.payment_update", "CandidateRegistration", registration.id, req.body);
    res.json({ success: true, data: registration });
  })
);

// Stakeholder context and valid academic sessions from the host's shared DB.
router.get(
  "/me/context",
  authorize(Role.STAKEHOLDER),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const stakeholder = await prisma.stakeholderSchool.findFirst({
      where: { userId: req.auth!.sub, schoolId, status: StakeholderStatus.APPROVED },
      select: { id: true, name: true, representativeName: true, school: { select: { name: true } } },
    });
    if (!stakeholder) throw ApiError.forbidden("Your stakeholder account is inactive. Contact the host school.");
    const sessions = await prisma.academicSession.findMany({ where: { schoolId }, select: { id: true, name: true, isCurrent: true }, orderBy: { startDate: "desc" } });
    const servicePrices = await prisma.stakeholderServicePrice.findMany({ where: { schoolId, isActive: true }, orderBy: [{ exam: "asc" }, { name: "asc" }] });
    res.json({ success: true, data: { stakeholder, sessions, servicePrices } });
  })
);

router.get(
  "/me/registrations",
  authorize(Role.STAKEHOLDER),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const stakeholder = await prisma.stakeholderSchool.findFirst({ where: { userId: req.auth!.sub, schoolId, status: StakeholderStatus.APPROVED }, select: { id: true } });
    if (!stakeholder) throw ApiError.forbidden("Your stakeholder account is inactive. Contact the host school.");
    const items = await prisma.candidateRegistration.findMany({
      where: { schoolId, stakeholderSchoolId: stakeholder.id },
      include: { session: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: items });
  })
);

router.post(
  "/me/registrations",
  authorize(Role.STAKEHOLDER),
  validate(z.object({ body: candidateBody })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const stakeholder = await prisma.stakeholderSchool.findFirst({ where: { userId: req.auth!.sub, schoolId, status: StakeholderStatus.APPROVED }, select: { id: true } });
    if (!stakeholder) throw ApiError.forbidden("Your stakeholder account is inactive. Contact the host school.");
    const input = req.body as z.infer<typeof candidateBody>;
    const session = await prisma.academicSession.findFirst({ where: { id: input.sessionId, schoolId }, select: { id: true } });
    if (!session) throw ApiError.badRequest("Choose an academic session belonging to the host school.");
    const prices = await prisma.stakeholderServicePrice.findMany({ where: { schoolId, isActive: true, OR: [{ exam: input.exam }, { id: { in: input.servicePriceIds }, exam: null }] } });
    const examPrice = prices.find((price) => price.exam === input.exam);
    if (!examPrice) throw ApiError.badRequest("The host school has not set a price for this examination yet. Contact the host school.");
    const extras = prices.filter((price) => price.exam === null);
    if (extras.length !== input.servicePriceIds.length) throw ApiError.badRequest("One or more selected services are no longer available.");
    const amountDue = prices.reduce((sum, price) => sum + Number(price.amount), 0);
    const registration = await prisma.candidateRegistration.create({
      data: {
        schoolId, stakeholderSchoolId: stakeholder.id, sessionId: session.id,
        firstName: input.firstName, lastName: input.lastName, gender: input.gender,
        dateOfBirth: input.dateOfBirth, exam: input.exam, passportUrl: input.passportUrl, amountPaid: 0,
        amountDue, services: extras.map((price) => price.name), applicationData: input.applicationData,
      },
      include: { session: { select: { name: true } } },
    });
    audit(req, "stakeholder_registration.create", "CandidateRegistration", registration.id);
    res.status(201).json({ success: true, data: registration });
  })
);

router.patch(
  "/:id/status",
  authorize(...ADMINS),
  validate(z.object({ params: z.object({ id: z.string().min(1) }), body: z.object({ status: z.nativeEnum(StakeholderStatus) }) })),
  asyncHandler(async (req, res) => {
    const schoolId = currentSchoolId(req);
    const stakeholder = await prisma.stakeholderSchool.findFirst({ where: { id: req.params.id, schoolId }, select: { id: true, userId: true } });
    if (!stakeholder) throw ApiError.notFound("Stakeholder school not found");
    const active = req.body.status === StakeholderStatus.APPROVED;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: stakeholder.userId }, data: { isActive: active, tokenVersion: active ? undefined : { increment: 1 } } });
      return tx.stakeholderSchool.update({ where: { id: stakeholder.id }, data: { status: req.body.status } });
    });
    audit(req, "stakeholder.status", "StakeholderSchool", updated.id, { status: updated.status });
    res.json({ success: true, data: updated });
  })
);

export default router;
