/**
 * The dashboard's money figures.
 *
 * Both defects these cover were found on the live school dashboard, which showed
 * ₦0 outstanding while eighteen families owed ₦245,500, and ₦0 expenditure
 * against ₦1,332,000 actually spent.
 */
import request from "supertest";

const mockPrisma = {
  term: { findFirst: jest.fn() },
  student: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn() },
  teacher: { count: jest.fn().mockResolvedValue(0) },
  parent: { count: jest.fn().mockResolvedValue(0) },
  classRoom: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
  attendance: { groupBy: jest.fn().mockResolvedValue([]) },
  feeStructure: { groupBy: jest.fn() },
  studentFeeItem: { groupBy: jest.fn() },
  feeWaiver: { groupBy: jest.fn() },
  payment: { groupBy: jest.fn(), aggregate: jest.fn() },
  expense: { aggregate: jest.fn() },
  score: { findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn().mockResolvedValue({ _avg: { score: null }, _count: { _all: 0 } }) },
  assessmentType: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { maxScore: 100 } }),
    count: jest.fn().mockResolvedValue(3),
  },
  termReport: { findMany: jest.fn().mockResolvedValue([]) },
  announcement: { findMany: jest.fn().mockResolvedValue([]) },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
  // Loaded by requireActiveSchool before any school route runs.
  school: { findUnique: jest.fn() },
};

jest.mock("../src/lib/prisma", () => ({ prisma: mockPrisma }));

import { createApp } from "../src/app";
import { signAccessToken } from "../src/utils/jwt";
import { Role } from "@prisma/client";

const app = createApp();
const adminToken = signAccessToken({ sub: "admin-1", role: Role.ADMIN, schoolId: "school-1" });

const TERM = {
  id: "term-3",
  name: "Third Term",
  startDate: new Date("2026-04-27"),
  endDate: new Date("2026-07-24"),
  session: { name: "2025/2026" },
};

/** Three students in one class billed ₦10,000 each. */
function arrange(opts: {
  waivers?: { studentId: string; amount: number }[];
  payments?: { studentId: string; amount: number }[];
  ownItems?: { studentId: string; amount: number }[];
  allTermIncome?: number;
  expenditure?: number;
}) {
  mockPrisma.term.findFirst.mockResolvedValue(TERM);
  mockPrisma.student.findMany.mockResolvedValue([
    { id: "s1", classRoomId: "c1" },
    { id: "s2", classRoomId: "c1" },
    { id: "s3", classRoomId: "c1" },
  ]);
  mockPrisma.feeStructure.groupBy.mockResolvedValue([{ classRoomId: "c1", _sum: { amount: 10000 } }]);
  mockPrisma.studentFeeItem.groupBy.mockResolvedValue(
    (opts.ownItems ?? []).map((i) => ({ studentId: i.studentId, _sum: { amount: i.amount } }))
  );
  mockPrisma.feeWaiver.groupBy.mockResolvedValue(
    (opts.waivers ?? []).map((w) => ({ studentId: w.studentId, _sum: { amount: w.amount } }))
  );
  mockPrisma.payment.groupBy.mockResolvedValue(
    (opts.payments ?? []).map((p) => ({ studentId: p.studentId, _sum: { amount: p.amount } }))
  );
  mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: opts.allTermIncome ?? 0 } });
  mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: opts.expenditure ?? 0 } });
}

const stats = () =>
  request(app).get("/api/v1/dashboard/stats").set("Authorization", `Bearer ${adminToken}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.school.findUnique.mockResolvedValue({
    id: "school-1",
    name: "Carlspat Private School",
    isActive: true,
    subscriptionStatus: "ACTIVE",
    subscriptionEndsAt: null,
  });
});

describe("Outstanding fees", () => {
  it("does not let a family in credit hide a family in debt", async () => {
    // s1 overpaid by ₦8,000; s2 owes the full ₦10,000. Netting reports zero owed.
    arrange({ payments: [{ studentId: "s1", amount: 18000 }] });

    const res = await stats();

    expect(res.status).toBe(200);
    expect(res.body.data.fees.outstanding).toBe(20000); // s2 + s3, not 20000-8000
  });

  it("sums what each family still owes", async () => {
    arrange({
      payments: [
        { studentId: "s1", amount: 10000 }, // settled
        { studentId: "s2", amount: 4000 },  // owes 6,000
      ],
    });

    const res = await stats();

    expect(res.body.data.fees.outstanding).toBe(16000); // 6,000 + 10,000
  });

  it("treats a discount as reducing what is owed, not as money received", async () => {
    arrange({ waivers: [{ studentId: "s1", amount: 10000 }] }); // full scholarship

    const res = await stats();

    expect(res.body.data.fees.waived).toBe(10000);
    expect(res.body.data.fees.collected).toBe(0);
    expect(res.body.data.fees.outstanding).toBe(20000); // s1 owes nothing
  });

  it("bills a student on bespoke fees from their own items, not the class rate", async () => {
    arrange({ ownItems: [{ studentId: "s3", amount: 25000 }] });

    const res = await stats();

    expect(res.body.data.fees.expected).toBe(45000); // 10,000 + 10,000 + 25,000
    expect(res.body.data.fees.outstanding).toBe(45000);
  });

  it("reports nothing outstanding once every family has paid in full", async () => {
    arrange({
      payments: [
        { studentId: "s1", amount: 10000 },
        { studentId: "s2", amount: 10000 },
        { studentId: "s3", amount: 10000 },
      ],
    });

    const res = await stats();

    expect(res.body.data.fees.outstanding).toBe(0);
    expect(res.body.data.fees.collectionRate).toBe(100);
  });

  it("rates collection against what is collectable after discounts", async () => {
    arrange({
      waivers: [{ studentId: "s1", amount: 10000 }],
      payments: [{ studentId: "s2", amount: 10000 }],
    });

    const res = await stats();

    // ₦20,000 collectable after the scholarship, ₦10,000 in.
    expect(res.body.data.fees.collectionRate).toBe(50);
  });
});

describe("Expenditure", () => {
  it("counts spending recorded without a term when it falls inside the term", async () => {
    arrange({ expenditure: 1332000, allTermIncome: 1868700 });

    const res = await stats();

    expect(res.body.data.finance.expenditure).toBe(1332000);
    expect(res.body.data.finance.balance).toBe(536700);

    // The query must not filter on termId alone, or untagged spending vanishes.
    const where = mockPrisma.expense.aggregate.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { termId: "term-3" },
      { termId: null, date: { gte: TERM.startDate, lte: TERM.endDate } },
    ]);
  });

  it("counts income from students who have since left, but not their fees", async () => {
    // ₦2,000 of this term's income came from a graduated student.
    arrange({ payments: [{ studentId: "s1", amount: 10000 }], allTermIncome: 12000 });

    const res = await stats();

    expect(res.body.data.finance.income).toBe(12000); // cash received
    expect(res.body.data.fees.collected).toBe(10000); // against current students
    expect(res.body.data.fees.outstanding).toBe(20000);
  });
});
