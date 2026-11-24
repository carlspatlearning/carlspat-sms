/**
 * Integration test for the core business rule:
 * report cards are locked while school fees are outstanding.
 * Prisma is mocked so the test runs without a database.
 */
import request from "supertest";

const mockPrisma = {
  school: { findUnique: jest.fn() },
  student: { findUnique: jest.fn() },
  term: { findUnique: jest.fn(), findFirst: jest.fn() },
  studentFeeItem: { findMany: jest.fn().mockResolvedValue([]) },
  feeStructure: { findMany: jest.fn() },
  feeWaiver: { aggregate: jest.fn() },
  payment: { aggregate: jest.fn() },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
};

jest.mock("../src/lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("../src/services/resultService", () => ({
  computeStudentResult: jest.fn().mockResolvedValue({ subjects: [{ subject: "English" }] }),
}));

import { createApp } from "../src/app";
import { signAccessToken } from "../src/utils/jwt";
import { Role } from "@prisma/client";
import { REPORT_CARD_LOCK_MESSAGE } from "../src/services/feeService";

const app = createApp();
const parentToken = signAccessToken({ sub: "parent-user-1", role: Role.PARENT, schoolId: "school-1" });
const adminToken = signAccessToken({ sub: "admin-user-1", role: Role.ADMIN, schoolId: "school-1" });

function arrange({ paid }: { paid: number }) {
  // Student lookup used both by the access guard and the balance calculator
  mockPrisma.student.findUnique.mockResolvedValue({
    id: "student-1",
    schoolId: "school-1",
    userId: null,
    classRoomId: "class-1",
    parent: { userId: "parent-user-1" },
  });
  mockPrisma.feeStructure.findMany.mockResolvedValue([
    { amount: 45000, category: { name: "Tuition Fee" }, dueDate: null },
    { amount: 5000, category: { name: "Development Levy" }, dueDate: null },
  ]);
  mockPrisma.feeWaiver.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: paid } });
  mockPrisma.term.findFirst.mockResolvedValue({ id: "term-1", schoolId: "school-1" });
  mockPrisma.school.findUnique.mockResolvedValue({ id: "school-1", isActive: true, subscriptionStatus: "ACTIVE", subscriptionEndsAt: null });
}

beforeEach(() => jest.clearAllMocks());

describe("Report card fee lock", () => {
  it("blocks a parent with an outstanding balance (402 + required message)", async () => {
    arrange({ paid: 30000 }); // 20,000 outstanding
    const res = await request(app)
      .get("/api/v1/report-cards/student-1/access?termId=term-1")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.allowed).toBe(false);
    expect(res.body.data.outstanding).toBe(20000);
    expect(res.body.data.message).toBe(REPORT_CARD_LOCK_MESSAGE);
  });

  it("returns 402 when a locked parent requests the report data", async () => {
    arrange({ paid: 0 });
    const res = await request(app)
      .get("/api/v1/report-cards/student-1/data?termId=term-1")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(res.status).toBe(402);
    expect(res.body.message).toBe(REPORT_CARD_LOCK_MESSAGE);
  });

  it("allows the parent once fees are fully paid", async () => {
    arrange({ paid: 50000 });
    const res = await request(app)
      .get("/api/v1/report-cards/student-1/access?termId=term-1")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.allowed).toBe(true);
    expect(res.body.data.outstanding).toBe(0);
  });

  it("lets staff bypass the lock so the school can prepare reports", async () => {
    arrange({ paid: 0 });
    const res = await request(app)
      .get("/api/v1/report-cards/student-1/access?termId=term-1")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.allowed).toBe(true);
  });

  it("blocks a parent who is not linked to the student", async () => {
    arrange({ paid: 50000 });
    mockPrisma.student.findUnique.mockResolvedValue({
      id: "student-1",
      schoolId: "school-1",
      userId: null,
      classRoomId: "class-1",
      parent: { userId: "someone-else" },
    });
    const res = await request(app)
      .get("/api/v1/report-cards/student-1/access?termId=term-1")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(res.status).toBe(403);
  });
});

describe("Student results fee lock", () => {
  it("hides scores from a parent with outstanding fees", async () => {
    arrange({ paid: 30000 });
    const res = await request(app)
      .get("/api/v1/results/student/student-1")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(res.status).toBe(402);
    expect(res.body.message).toBe(REPORT_CARD_LOCK_MESSAGE);
    expect(res.body.data).toBeUndefined();
  });

  it("shows results after payment in full", async () => {
    arrange({ paid: 50000 });
    const res = await request(app)
      .get("/api/v1/results/student/student-1")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.subjects).toHaveLength(1);
  });

  it("keeps staff access to results while fees are outstanding", async () => {
    arrange({ paid: 0 });
    const res = await request(app)
      .get("/api/v1/results/student/student-1")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
