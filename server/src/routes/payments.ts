import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { PaymentMethod, PaymentStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../middleware/error";
import { validate } from "../middleware/validate";
import { authenticate, authorize, assertCanAccessStudent } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { nextReceiptNo } from "../utils/ids";
import { getFeeBalance } from "../services/feeService";
import { renderReceipt } from "../services/pdfService";
import { sendEmail } from "../services/notify";
import { env } from "../config/env";
import { getPagination, paginated } from "../utils/pagination";

const router = Router();

const FEE_MANAGERS: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT];

async function notifyParentOfPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      student: { include: { parent: { include: { user: true } } } },
      term: { include: { session: true } },
    },
  });
  const parentEmail = payment?.student.parent?.user.email;
  if (payment && parentEmail) {
    const balance = await getFeeBalance(payment.studentId, payment.termId);
    await sendEmail(
      parentEmail,
      `Fee payment receipt — ${payment.receiptNo}`,
      `<p>Dear Parent,</p>
       <p>We received <b>NGN ${Number(payment.amount).toLocaleString()}</b> for
       ${payment.student.firstName} ${payment.student.lastName} (${payment.student.admissionNo})
       — ${payment.term.name}, ${payment.term.session.name}.</p>
       <p>Outstanding balance: <b>NGN ${balance.outstanding.toLocaleString()}</b></p>
       <p>Thank you.<br/>Carlspat Private School</p>`
    ).catch((e) => console.error("Payment email failed:", e));
  }
}

// ── Webhooks (mounted with express.raw — see app.ts) ────────────────────────

// POST /payments/webhooks/paystack
router.post(
  "/webhooks/paystack",
  asyncHandler(async (req, res) => {
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    const raw = req.body as Buffer;
    const expected = crypto.createHmac("sha512", env.paystackSecret).update(raw).digest("hex");
    if (!signature || !env.paystackSecret || signature !== expected) {
      throw ApiError.unauthorized("Invalid webhook signature");
    }
    const event = JSON.parse(raw.toString("utf8"));
    if (event.event === "charge.success") {
      const ref = event.data.reference as string;
      const payment = await prisma.payment.findUnique({ where: { reference: ref } });
      if (payment && payment.status === PaymentStatus.PENDING) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.SUCCESS, paidAt: new Date() },
        });
        await notifyParentOfPayment(payment.id);
      }
    }
    res.json({ received: true });
  })
);

// POST /payments/webhooks/flutterwave
router.post(
  "/webhooks/flutterwave",
  asyncHandler(async (req, res) => {
    const signature = req.headers["verif-hash"] as string | undefined;
    if (!signature || !env.flutterwave.webhookHash || signature !== env.flutterwave.webhookHash) {
      throw ApiError.unauthorized("Invalid webhook signature");
    }
    const event = JSON.parse((req.body as Buffer).toString("utf8"));
    if (event.event === "charge.completed" && event.data?.status === "successful") {
      const ref = event.data.tx_ref as string;
      const payment = await prisma.payment.findUnique({ where: { reference: ref } });
      if (payment && payment.status === PaymentStatus.PENDING) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.SUCCESS, paidAt: new Date() },
        });
        await notifyParentOfPayment(payment.id);
      }
    }
    res.json({ received: true });
  })
);

// ── Authenticated routes ─────────────────────────────────────────────────────
router.use(authenticate);

// GET /payments?studentId=&termId=&q= — payment history
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { studentId, termId, q } = req.query as Record<string, string | undefined>;
    // Parents/students may only list their own payments
    if (studentId) {
      await assertCanAccessStudent(req, studentId);
    } else if (!(FEE_MANAGERS as string[]).includes(req.auth!.role)) {
      throw ApiError.forbidden();
    }
    const pg = getPagination(req);
    const where = {
      ...(studentId ? { studentId } : {}),
      ...(termId ? { termId } : {}),
      ...(q
        ? {
            OR: [
              { receiptNo: { contains: q, mode: "insensitive" as const } },
              { student: { firstName: { contains: q, mode: "insensitive" as const } } },
              { student: { lastName: { contains: q, mode: "insensitive" as const } } },
              { student: { admissionNo: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, classRoom: { select: { name: true } } } },
          term: { include: { session: { select: { name: true } } } },
          recordedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { paidAt: "desc" },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.payment.count({ where }),
    ]);
    res.json({ success: true, data: paginated(items, total, pg) });
  })
);

// POST /payments — bursar records an offline payment (cash/transfer/POS/cheque)
router.post(
  "/",
  authorize(...FEE_MANAGERS),
  validate(
    z.object({
      body: z.object({
        studentId: z.string(),
        termId: z.string(),
        amount: z.number().positive(),
        method: z.nativeEnum(PaymentMethod),
        reference: z.string().optional(),
        notes: z.string().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.create({
      data: {
        ...req.body,
        receiptNo: await nextReceiptNo(),
        status: PaymentStatus.SUCCESS,
        recordedById: req.auth!.sub,
      },
      include: { student: true },
    });
    audit(req, "payment.record", "Payment", payment.id, { amount: req.body.amount, method: req.body.method });
    await notifyParentOfPayment(payment.id);
    res.status(201).json({ success: true, data: payment });
  })
);

// PATCH /payments/:id — correct a recorded payment (offline payments only;
// gateway-confirmed online payments must not be altered)
router.patch(
  "/:id",
  authorize(...FEE_MANAGERS),
  validate(
    z.object({
      body: z.object({
        amount: z.number().positive().optional(),
        method: z.nativeEnum(PaymentMethod).optional(),
        reference: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        paidAt: z.coerce.date().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) throw ApiError.notFound("Payment not found");
    if (payment.gateway) {
      throw ApiError.badRequest(
        "Online payments confirmed by the payment gateway cannot be edited. Record a correcting entry instead."
      );
    }
    const before = { amount: Number(payment.amount), method: payment.method };
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: req.body,
      include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
    });
    audit(req, "payment.update", "Payment", payment.id, {
      before,
      after: { amount: Number(updated.amount), method: updated.method },
    });
    res.json({ success: true, data: updated });
  })
);

// GET /payments/:id/receipt — PDF receipt
router.get(
  "/:id/receipt",
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        student: { include: { classRoom: true } },
        term: { include: { session: true } },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!payment) throw ApiError.notFound("Payment not found");
    await assertCanAccessStudent(req, payment.studentId);

    const [school, balance] = await Promise.all([
      prisma.school.findFirst(),
      getFeeBalance(payment.studentId, payment.termId),
    ]);
    if (!school) throw ApiError.notFound("School not configured");

    const pdf = await renderReceipt({
      school,
      receiptNo: payment.receiptNo,
      studentName: `${payment.student.firstName} ${payment.student.lastName}`,
      admissionNo: payment.student.admissionNo,
      className: payment.student.classRoom?.name ?? "—",
      term: payment.term.name,
      session: payment.term.session.name,
      amount: Number(payment.amount),
      method: payment.method,
      reference: payment.reference,
      paidAt: payment.paidAt,
      recordedBy: payment.recordedBy ? `${payment.recordedBy.firstName} ${payment.recordedBy.lastName}` : null,
      balanceAfter: balance.outstanding,
    });
    audit(req, "payment.receipt_download", "Payment", payment.id);
    res
      .setHeader("Content-Type", "application/pdf")
      .setHeader("Content-Disposition", `attachment; filename="receipt-${payment.receiptNo}.pdf"`)
      .send(pdf);
  })
);

// POST /payments/paystack/init — parent starts an online card payment
router.post(
  "/paystack/init",
  validate(z.object({ body: z.object({ studentId: z.string(), termId: z.string(), amount: z.number().positive() }) })),
  asyncHandler(async (req, res) => {
    if (!env.paystackSecret) throw ApiError.badRequest("Online payment (Paystack) is not configured");
    const { studentId, termId, amount } = req.body;
    await assertCanAccessStudent(req, studentId);

    const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
    const reference = `CPS-PSK-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.paystackSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user!.email,
        amount: Math.round(amount * 100), // kobo
        reference,
        callback_url: env.paymentCallbackUrl,
        metadata: { studentId, termId },
      }),
    });
    const initData = (await initRes.json()) as { status: boolean; data?: { authorization_url: string }; message?: string };
    if (!initRes.ok || !initData.status || !initData.data) {
      throw ApiError.badRequest(`Paystack: ${initData.message ?? "could not initialize payment"}`);
    }

    await prisma.payment.create({
      data: {
        receiptNo: await nextReceiptNo(),
        studentId,
        termId,
        amount,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING,
        reference,
        gateway: "paystack",
      },
    });
    audit(req, "payment.paystack_init", "Payment", reference, { amount });
    res.json({ success: true, data: { authorizationUrl: initData.data.authorization_url, reference } });
  })
);

// POST /payments/flutterwave/init
router.post(
  "/flutterwave/init",
  validate(z.object({ body: z.object({ studentId: z.string(), termId: z.string(), amount: z.number().positive() }) })),
  asyncHandler(async (req, res) => {
    if (!env.flutterwave.secret) throw ApiError.badRequest("Online payment (Flutterwave) is not configured");
    const { studentId, termId, amount } = req.body;
    await assertCanAccessStudent(req, studentId);

    const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
    const txRef = `CPS-FLW-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const initRes = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.flutterwave.secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount,
        currency: "NGN",
        redirect_url: env.paymentCallbackUrl,
        customer: { email: user!.email, name: `${user!.firstName} ${user!.lastName}` },
        meta: { studentId, termId },
        customizations: { title: "Carlspat Private School — School Fees" },
      }),
    });
    const initData = (await initRes.json()) as { status: string; data?: { link: string }; message?: string };
    if (!initRes.ok || initData.status !== "success" || !initData.data) {
      throw ApiError.badRequest(`Flutterwave: ${initData.message ?? "could not initialize payment"}`);
    }

    await prisma.payment.create({
      data: {
        receiptNo: await nextReceiptNo(),
        studentId,
        termId,
        amount,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING,
        reference: txRef,
        gateway: "flutterwave",
      },
    });
    audit(req, "payment.flutterwave_init", "Payment", txRef, { amount });
    res.json({ success: true, data: { authorizationUrl: initData.data.link, reference: txRef } });
  })
);

// GET /payments/reports/summary?termId= — financial report for bursar/admin
router.get(
  "/reports/summary",
  authorize(...FEE_MANAGERS),
  asyncHandler(async (req, res) => {
    const termId = req.query.termId as string | undefined;
    const term = termId
      ? await prisma.term.findUnique({ where: { id: termId } })
      : await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!term) throw ApiError.badRequest("No current term configured");

    const [byMethod, total, recent] = await Promise.all([
      prisma.payment.groupBy({
        by: ["method"],
        where: { termId: term.id, status: PaymentStatus.SUCCESS },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { termId: term.id, status: PaymentStatus.SUCCESS },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.findMany({
        where: { termId: term.id, status: PaymentStatus.SUCCESS },
        include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
        orderBy: { paidAt: "desc" },
        take: 10,
      }),
    ]);
    res.json({
      success: true,
      data: {
        termId: term.id,
        totalCollected: Number(total._sum.amount ?? 0),
        paymentCount: total._count._all,
        byMethod: byMethod.map((m) => ({ method: m.method, total: Number(m._sum.amount ?? 0), count: m._count._all })),
        recent,
      },
    });
  })
);

export default router;
