/**
 * Tenant isolation: one school must never reach another school's data.
 *
 * Two failure modes are covered, because they fail differently:
 *
 *   1. A LIST that forgets its school filter. Nothing throws — the caller simply
 *      receives more rows than they should. These tests inspect the `where`
 *      Prisma was actually given, since a missing filter is invisible in the
 *      response shape.
 *
 *   2. A LOOKUP BY ID that trusts the id in the URL or body. Here the record is
 *      returned from another school, so the tests hand the route exactly that
 *      and require a 404 — not a 403, because confirming an id exists elsewhere
 *      is itself a disclosure.
 *
 * Prisma is mocked, so these run without a database.
 */
import request from "supertest";

const SCHOOL_A = "school-a";
const SCHOOL_B = "school-b";

const mockPrisma = {
  school: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  student: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn(), delete: jest.fn() },
  classRoom: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  teacher: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  parent: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  subject: { findMany: jest.fn(), findUnique: jest.fn() },
  term: { findUnique: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
  academicSession: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  user: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
  payment: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
  auditLog: { findMany: jest.fn(), count: jest.fn(), create: jest.fn().mockResolvedValue({}) },
  announcement: { findMany: jest.fn(), findUnique: jest.fn() },
  message: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  feeCategory: { findMany: jest.fn(), findUnique: jest.fn() },
  feeStructure: { findMany: jest.fn() },
  expense: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  expenseCategory: { findMany: jest.fn(), findUnique: jest.fn() },
  resource: { findMany: jest.fn(), findUnique: jest.fn() },
  gradeScale: { findMany: jest.fn() },
  assessmentType: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock("../src/lib/prisma", () => ({ prisma: mockPrisma }));

import { createApp } from "../src/app";
import { signAccessToken } from "../src/utils/jwt";
import { Role } from "@prisma/client";

const app = createApp();

/** An admin at school A — the caller in every test below. */
const adminA = signAccessToken({ sub: "user-a", role: Role.ADMIN, schoolId: SCHOOL_A });
/** A parent at school A, for the routes parents can reach. */
const parentA = signAccessToken({ sub: "parent-a", role: Role.PARENT, schoolId: SCHOOL_A });
/** A token carrying no school at all — must never resolve to "the first school". */
const noSchool = signAccessToken({ sub: "stray", role: Role.ADMIN, schoolId: null });

/** The `where` clause a mocked Prisma call actually received. */
function whereOf(fn: jest.Mock): Record<string, unknown> {
  expect(fn).toHaveBeenCalled();
  return (fn.mock.calls[0][0] ?? {}).where ?? {};
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: every list is empty and every count is zero, so a route that fails
  // to filter still returns cleanly and the assertion is about the `where`.
  for (const model of Object.values(mockPrisma)) {
    if (typeof model === "object" && model !== null) {
      for (const [name, fn] of Object.entries(model)) {
        if (typeof (fn as jest.Mock).mockResolvedValue !== "function") continue;
        if (name === "count") (fn as jest.Mock).mockResolvedValue(0);
        else if (name === "findMany") (fn as jest.Mock).mockResolvedValue([]);
        else if (name === "aggregate") (fn as jest.Mock).mockResolvedValue({ _sum: { amount: 0 }, _count: { _all: 0 } });
        else (fn as jest.Mock).mockResolvedValue(null);
      }
    }
  }
  mockPrisma.auditLog.create.mockResolvedValue({});
  mockPrisma.$transaction.mockResolvedValue([]);

  // requireActiveSchool loads the school on every request. A live, paid-up
  // school is the baseline; the subscription tests below override it.
  mockPrisma.school.findUnique.mockResolvedValue({
    id: SCHOOL_A,
    name: "School A",
    isActive: true,
    subscriptionStatus: "ACTIVE",
    subscriptionEndsAt: null,
  });
});

describe("Lists are fenced to the caller's school", () => {
  it("GET /students filters by school", async () => {
    const res = await request(app).get("/api/v1/students").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.student.findMany).schoolId).toBe(SCHOOL_A);
    // The count must carry the same fence, or the pagination total leaks a
    // headcount of every school on the platform.
    expect(whereOf(mockPrisma.student.count).schoolId).toBe(SCHOOL_A);
  });

  it("GET /classes filters by school", async () => {
    const res = await request(app).get("/api/v1/classes").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.classRoom.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /subjects filters by school", async () => {
    const res = await request(app).get("/api/v1/subjects").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.subject.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /teachers filters by school", async () => {
    const res = await request(app).get("/api/v1/teachers").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.teacher.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /parents filters by school", async () => {
    const res = await request(app).get("/api/v1/parents").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.parent.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /users filters by school", async () => {
    const res = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.user.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /users/audit-logs filters by school", async () => {
    const res = await request(app).get("/api/v1/users/audit-logs").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.auditLog.findMany).schoolId).toBe(SCHOOL_A);
    expect(whereOf(mockPrisma.auditLog.count).schoolId).toBe(SCHOOL_A);
  });

  it("GET /payments filters by school", async () => {
    const res = await request(app).get("/api/v1/payments").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.payment.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /messages/contacts offers only this school's people", async () => {
    const res = await request(app).get("/api/v1/messages/contacts").set("Authorization", `Bearer ${parentA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.user.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /announcements filters by school", async () => {
    const res = await request(app).get("/api/v1/announcements").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.announcement.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /fees/categories filters by school", async () => {
    const res = await request(app).get("/api/v1/fees/categories").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.feeCategory.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /expenses filters by school", async () => {
    const res = await request(app).get("/api/v1/expenses").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.expense.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /resources filters by school", async () => {
    const res = await request(app).get("/api/v1/resources").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.resource.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /settings/grading filters by school", async () => {
    const res = await request(app).get("/api/v1/settings/grading").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.gradeScale.findMany).schoolId).toBe(SCHOOL_A);
  });

  it("GET /settings/sessions filters by school", async () => {
    const res = await request(app).get("/api/v1/settings/sessions").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
    expect(whereOf(mockPrisma.academicSession.findMany).schoolId).toBe(SCHOOL_A);
  });
});

describe("Records belonging to another school are not found", () => {
  it("GET /students/:id refuses a pupil at another school", async () => {
    mockPrisma.student.findUnique.mockResolvedValue({
      id: "s1", schoolId: SCHOOL_B, userId: null, parent: null,
    });
    const res = await request(app).get("/api/v1/students/s1").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(404);
  });

  it("PUT /students/:id refuses a pupil at another school", async () => {
    mockPrisma.student.findUnique.mockResolvedValue({ schoolId: SCHOOL_B });
    const res = await request(app)
      .put("/api/v1/students/s1")
      .set("Authorization", `Bearer ${adminA}`)
      .send({ firstName: "Renamed" });
    expect(res.status).toBe(404);
    expect(mockPrisma.student.update).not.toHaveBeenCalled();
  });

  it("DELETE /students/:id refuses a pupil at another school", async () => {
    mockPrisma.student.findUnique.mockResolvedValue({
      schoolId: SCHOOL_B,
      _count: { scores: 0, payments: 0, attendance: 0 },
    });
    const res = await request(app).delete("/api/v1/students/s1").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(404);
    expect(mockPrisma.student.delete).not.toHaveBeenCalled();
  });

  it("GET /classes/:id refuses a class at another school", async () => {
    mockPrisma.classRoom.findUnique.mockResolvedValue({ id: "c1", schoolId: SCHOOL_B });
    const res = await request(app).get("/api/v1/classes/c1").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(404);
  });

  it("PATCH /payments/:id refuses a payment at another school", async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({ id: "p1", schoolId: SCHOOL_B, gateway: null, amount: 100, method: "CASH" });
    const res = await request(app)
      .patch("/api/v1/payments/p1")
      .set("Authorization", `Bearer ${adminA}`)
      .send({ amount: 999 });
    expect(res.status).toBe(404);
  });

  it("PATCH /settings/terms/:id/current refuses another school's term", async () => {
    mockPrisma.term.findUnique.mockResolvedValue({ id: "t1", schoolId: SCHOOL_B, sessionId: "sess1", name: "First Term", session: { name: "2025/2026" } });
    const res = await request(app)
      .patch("/api/v1/settings/terms/t1/current")
      .set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(404);
    // The dangerous part is the unfiltered updateMany that would clear every
    // school's current term. It must not run at all.
    expect(mockPrisma.term.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.academicSession.updateMany).not.toHaveBeenCalled();
  });

  it("POST /messages refuses a recipient at another school", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-b", schoolId: SCHOOL_B, isActive: true, role: Role.ADMIN,
    });
    const res = await request(app)
      .post("/api/v1/messages")
      .set("Authorization", `Bearer ${parentA}`)
      .send({ recipientId: "u-b", body: "hello" });
    expect(res.status).toBe(404);
    expect(mockPrisma.message.create).not.toHaveBeenCalled();
  });

  it("PATCH /users/:id refuses an account at another school", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-b", schoolId: SCHOOL_B, role: Role.TEACHER, teacher: null, parent: null, student: null,
    });
    const res = await request(app)
      .patch("/api/v1/users/u-b")
      .set("Authorization", `Bearer ${adminA}`)
      .send({ firstName: "Hijacked" });
    expect(res.status).toBe(404);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("DELETE /expenses/:id refuses another school's expense", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ id: "e1", schoolId: SCHOOL_B });
    const res = await request(app).delete("/api/v1/expenses/e1").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(404);
  });

  it("DELETE /announcements/:id refuses another school's announcement", async () => {
    mockPrisma.announcement.findUnique.mockResolvedValue({ id: "a1", schoolId: SCHOOL_B });
    const res = await request(app).delete("/api/v1/announcements/a1").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(404);
  });
});

describe("A token without a school resolves to nothing", () => {
  it("is refused rather than falling back to the first school", async () => {
    const res = await request(app).get("/api/v1/classes").set("Authorization", `Bearer ${noSchool}`);
    expect(res.status).toBe(403);
    expect(mockPrisma.classRoom.findMany).not.toHaveBeenCalled();
  });

  it("cannot list pupils", async () => {
    const res = await request(app).get("/api/v1/students").set("Authorization", `Bearer ${noSchool}`);
    expect(res.status).toBe(403);
    expect(mockPrisma.student.findMany).not.toHaveBeenCalled();
  });
});

describe("A lapsed subscription closes the door but keeps the data", () => {
  function schoolWith(overrides: Record<string, unknown>) {
    mockPrisma.school.findUnique.mockResolvedValue({
      id: SCHOOL_A, name: "School A", isActive: true,
      subscriptionStatus: "ACTIVE", subscriptionEndsAt: null,
      ...overrides,
    });
  }

  it("refuses a suspended school", async () => {
    schoolWith({ subscriptionStatus: "SUSPENDED" });
    const res = await request(app).get("/api/v1/students").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(403);
    // Nothing was read. A suspended school loses access, not its records.
    expect(mockPrisma.student.findMany).not.toHaveBeenCalled();
  });

  it("refuses a cancelled school", async () => {
    schoolWith({ subscriptionStatus: "CANCELLED" });
    const res = await request(app).get("/api/v1/students").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(403);
  });

  it("returns 402 once the subscription end date has passed", async () => {
    schoolWith({ subscriptionEndsAt: new Date(Date.now() - 86400000) });
    const res = await request(app).get("/api/v1/students").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("still allows a school in its grace period", async () => {
    schoolWith({ subscriptionStatus: "PAST_DUE" });
    const res = await request(app).get("/api/v1/students").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
  });

  it("still allows a school on trial", async () => {
    schoolWith({ subscriptionStatus: "TRIAL" });
    const res = await request(app).get("/api/v1/students").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
  });

  it("allows a subscription that runs into the future", async () => {
    schoolWith({ subscriptionEndsAt: new Date(Date.now() + 30 * 86400000) });
    const res = await request(app).get("/api/v1/students").set("Authorization", `Bearer ${adminA}`);
    expect(res.status).toBe(200);
  });
});

describe("The platform console is sealed off from school accounts", () => {
  it("refuses a school super admin", async () => {
    const superA = signAccessToken({ sub: "sa", role: Role.SUPER_ADMIN, schoolId: SCHOOL_A });
    const res = await request(app).get("/api/v1/platform/schools").set("Authorization", `Bearer ${superA}`);
    expect(res.status).toBe(403);
    expect(mockPrisma.school.findMany).not.toHaveBeenCalled();
  });

  it("refuses a parent", async () => {
    const res = await request(app).get("/api/v1/platform/overview").set("Authorization", `Bearer ${parentA}`);
    expect(res.status).toBe(403);
  });

  it("refuses a platform owner from the school screens", async () => {
    const owner = signAccessToken({ sub: "owner", role: Role.PLATFORM_OWNER, schoolId: null });
    const res = await request(app).get("/api/v1/students").set("Authorization", `Bearer ${owner}`);
    expect(res.status).toBe(403);
  });
});

describe("Role escalation to the platform is refused from inside a school", () => {
  it("POST /users cannot create a platform owner", async () => {
    const superA = signAccessToken({ sub: "sa", role: Role.SUPER_ADMIN, schoolId: SCHOOL_A });
    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${superA}`)
      .send({
        firstName: "Self", lastName: "Promoted", email: "x@example.com",
        password: "Password#123", role: Role.PLATFORM_OWNER,
      });
    expect(res.status).toBe(403);
  });
});
