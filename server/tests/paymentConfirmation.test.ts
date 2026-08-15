/**
 * Integration tests for online payment confirmation.
 *
 * The money-critical properties here are:
 *   1. a parent is credited and emailed exactly once, no matter whether the
 *      webhook, the browser callback, or both arrive;
 *   2. a receipt number is only spent on a payment that actually completed.
 *
 * Prisma is mocked as a tiny one-row store so state carries across calls the way
 * it would in the database — an idempotency test is meaningless against mocks
 * that forget the first write.
 */
import request from "supertest";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

interface PaymentRow {
  id: string;
  receiptNo: string | null;
  studentId: string;
  termId: string;
  amount: number;
  method: string;
  status: string;
  reference: string;
  gateway: string | null;
  paidAt: Date;
}

let store: PaymentRow;
let issuedReceiptNos: Set<string>;

const mockPrisma = {
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
  },
  student: { findUnique: jest.fn() },
  studentFeeItem: { findMany: jest.fn() },
  feeStructure: { findMany: jest.fn() },
  feeWaiver: { aggregate: jest.fn() },
  user: { findUnique: jest.fn() },
  school: { findFirst: jest.fn() },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
};

const mockSendEmail = jest.fn().mockResolvedValue(undefined);

jest.mock("../src/lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("../src/services/notify", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  sendSms: jest.fn(),
}));

import { createApp } from "../src/app";
import { signAccessToken } from "../src/utils/jwt";
import { Role } from "@prisma/client";

const app = createApp();
const PAYSTACK_SECRET = "sk_test_dummy_key_for_tests";
const REFERENCE = "CPS-PSK-1700000000000-abcd1234";
const AMOUNT = 50000; // ₦50,000 → 5,000,000 kobo

const parentToken = signAccessToken({ sub: "parent-user-1", role: Role.PARENT, schoolId: "school-1" });
const otherParentToken = signAccessToken({ sub: "parent-user-2", role: Role.PARENT, schoolId: "school-1" });

function duplicateReceiptError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`receiptNo`)", {
    code: "P2002",
    clientVersion: "5.22.0",
  });
}

/** Signs a webhook body the way Paystack does, so the real HMAC check runs. */
function paystackWebhook(body: unknown, secret = PAYSTACK_SECRET) {
  const raw = JSON.stringify(body);
  const signature = crypto.createHmac("sha512", secret).update(Buffer.from(raw)).digest("hex");
  return request(app)
    .post("/api/v1/payments/webhooks/paystack")
    .set("Content-Type", "application/json")
    .set("x-paystack-signature", signature)
    .send(raw);
}

function mockPaystackVerify(status: string, amountKobo = AMOUNT * 100) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ status: true, data: { status, amount: amountKobo } }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  store = {
    id: "pay-1",
    receiptNo: null,
    studentId: "student-1",
    termId: "term-1",
    amount: AMOUNT,
    method: "ONLINE",
    status: "PENDING",
    reference: REFERENCE,
    gateway: "paystack",
    paidAt: new Date("2026-08-15T09:00:00Z"),
  };
  issuedReceiptNos = new Set(["CPS-RCP-2026-00007"]);

  global.fetch = jest.fn() as unknown as typeof fetch;

  // Reads: match on id or reference; the `include` form is what the receipt and
  // the parent-notification email use.
  mockPrisma.payment.findUnique.mockImplementation(async (args: any) => {
    const matches = args.where.id ? store.id === args.where.id : store.reference === args.where.reference;
    if (!matches) return null;
    if (!args.include) return { ...store };
    return {
      ...store,
      student: {
        firstName: "Ada",
        lastName: "Okafor",
        admissionNo: "CPS/2026/0001",
        classRoom: { name: "JSS 1A" },
        parent: { user: { email: "parent@carlspat.sch.ng" } },
      },
      term: { name: "First Term", session: { name: "2026/2027" } },
      recordedBy: null,
    };
  });

  // nextReceiptNo() reads the highest issued number and adds one.
  mockPrisma.payment.findFirst.mockImplementation(async () => {
    const highest = [...issuedReceiptNos].sort().pop();
    return highest ? { receiptNo: highest } : null;
  });

  // Writes: honour the `status: PENDING` guard and the unique index on receiptNo.
  mockPrisma.payment.updateMany.mockImplementation(async (args: any) => {
    if (args.where.id !== store.id) return { count: 0 };
    if (args.where.status && store.status !== args.where.status) return { count: 0 };
    if (args.data.receiptNo) {
      if (issuedReceiptNos.has(args.data.receiptNo)) throw duplicateReceiptError();
      issuedReceiptNos.add(args.data.receiptNo);
    }
    Object.assign(store, args.data);
    return { count: 1 };
  });

  mockPrisma.payment.create.mockImplementation(async (args: any) => ({ id: "pay-new", ...args.data }));
  mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  mockPrisma.student.findUnique.mockResolvedValue({
    id: "student-1",
    userId: null,
    classRoomId: "class-1",
    parent: { userId: "parent-user-1" },
  });
  mockPrisma.studentFeeItem.findMany.mockResolvedValue([]);
  mockPrisma.feeStructure.findMany.mockResolvedValue([{ amount: AMOUNT, category: { name: "Tuition Fee" }, dueDate: null }]);
  mockPrisma.feeWaiver.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  mockPrisma.user.findUnique.mockResolvedValue({
    id: "parent-user-1",
    email: "parent@carlspat.sch.ng",
    firstName: "Ngozi",
    lastName: "Okafor",
  });
});

describe("Paystack webhook confirmation", () => {
  it("confirms a pending payment and issues the next receipt number", async () => {
    const res = await paystackWebhook({ event: "charge.success", data: { reference: REFERENCE } });

    expect(res.status).toBe(200);
    expect(store.status).toBe("SUCCESS");
    expect(store.receiptNo).toBe("CPS-RCP-2026-00008");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("rejects a body whose signature does not match", async () => {
    const res = await paystackWebhook({ event: "charge.success", data: { reference: REFERENCE } }, "wrong-secret");

    expect(res.status).toBe(401);
    expect(store.status).toBe("PENDING");
    expect(store.receiptNo).toBeNull();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("ignores a reference that does not exist rather than erroring", async () => {
    const res = await paystackWebhook({ event: "charge.success", data: { reference: "CPS-PSK-unknown" } });

    expect(res.status).toBe(200);
    expect(store.status).toBe("PENDING");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("credits and emails only once when the same webhook is delivered twice", async () => {
    await paystackWebhook({ event: "charge.success", data: { reference: REFERENCE } });
    const receiptAfterFirst = store.receiptNo;
    await paystackWebhook({ event: "charge.success", data: { reference: REFERENCE } });

    expect(store.receiptNo).toBe(receiptAfterFirst);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("retries when a concurrent confirmation takes the same receipt number", async () => {
    const realUpdateMany = mockPrisma.payment.updateMany.getMockImplementation()!;
    let attempts = 0;
    mockPrisma.payment.updateMany.mockImplementation(async (args: any) => {
      attempts += 1;
      if (attempts === 1) throw duplicateReceiptError(); // the other path won the race
      return realUpdateMany(args);
    });

    const res = await paystackWebhook({ event: "charge.success", data: { reference: REFERENCE } });

    expect(res.status).toBe(200);
    expect(attempts).toBe(2);
    expect(store.status).toBe("SUCCESS");
    expect(store.receiptNo).toBe("CPS-RCP-2026-00008");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("GET /payments/paystack/verify", () => {
  function verify(token = parentToken, reference = REFERENCE) {
    return request(app)
      .get(`/api/v1/payments/paystack/verify?reference=${encodeURIComponent(reference)}`)
      .set("Authorization", `Bearer ${token}`);
  }

  it("confirms a payment the webhook never delivered", async () => {
    mockPaystackVerify("success");

    const res = await verify();

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("SUCCESS");
    expect(res.body.data.receiptNo).toBe("CPS-RCP-2026-00008");
    expect(store.status).toBe("SUCCESS");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not credit or email twice when the webhook already confirmed it", async () => {
    await paystackWebhook({ event: "charge.success", data: { reference: REFERENCE } });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const res = await verify();

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("SUCCESS");
    expect(res.body.data.receiptNo).toBe("CPS-RCP-2026-00008");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled(); // short-circuits before calling Paystack
  });

  it("refuses to credit an amount that differs from the one initialized", async () => {
    mockPaystackVerify("success", 100); // ₦1 against an expected ₦50,000

    const res = await verify();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/bursar/i);
    expect(store.status).toBe("PENDING");
    expect(store.receiptNo).toBeNull();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("marks a failed transaction FAILED without spending a receipt number", async () => {
    mockPaystackVerify("failed");

    const res = await verify();

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("FAILED");
    expect(store.status).toBe("FAILED");
    expect(store.receiptNo).toBeNull();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("leaves an abandoned checkout PENDING so it can still be completed", async () => {
    mockPaystackVerify("abandoned");

    const res = await verify();

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PENDING");
    expect(store.status).toBe("PENDING");
    expect(store.receiptNo).toBeNull();
  });

  it("stops a parent verifying another family's payment", async () => {
    mockPaystackVerify("success");

    const res = await verify(otherParentToken);

    expect(res.status).toBe(403);
    expect(store.status).toBe("PENDING");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("404s on an unknown reference", async () => {
    const res = await verify(parentToken, "CPS-PSK-unknown");

    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    const res = await request(app).get(`/api/v1/payments/paystack/verify?reference=${REFERENCE}`);

    expect(res.status).toBe(401);
  });
});

describe("Receipt numbers are not spent before confirmation", () => {
  it("creates the pending payment without a receipt number at init", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { authorization_url: "https://checkout.paystack.com/xyz" } }),
    });

    const res = await request(app)
      .post("/api/v1/payments/paystack/init")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ studentId: "student-1", termId: "term-1", amount: AMOUNT });

    expect(res.status).toBe(200);
    expect(res.body.data.authorizationUrl).toBe("https://checkout.paystack.com/xyz");

    const created = mockPrisma.payment.create.mock.calls[0][0].data;
    expect(created.status).toBe("PENDING");
    expect(created.receiptNo).toBeUndefined();
    // An abandoned checkout must leave the CPS-RCP- sequence untouched.
    expect(issuedReceiptNos.size).toBe(1);
  });

  it("refuses to issue a receipt PDF for a payment that has not been confirmed", async () => {
    const res = await request(app)
      .get("/api/v1/payments/pay-1/receipt")
      .set("Authorization", `Bearer ${parentToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/confirmed/i);
  });
});
