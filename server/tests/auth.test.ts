/**
 * Auth + RBAC integration tests with a mocked Prisma layer.
 */
import request from "supertest";
import bcrypt from "bcryptjs";

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
  classRoom: { findMany: jest.fn().mockResolvedValue([]) },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
  // Every authenticated school route now loads its school to check the
  // subscription is live before doing anything else.
  school: { findUnique: jest.fn() },
};
jest.mock("../src/lib/prisma", () => ({ prisma: mockPrisma }));

import { createApp } from "../src/app";
import { signAccessToken } from "../src/utils/jwt";
import { Role } from "@prisma/client";

const app = createApp();

const passwordHash = bcrypt.hashSync("Admin#12345", 10);
const adminUser = {
  id: "user-1",
  email: "admin@carlspat.sch.ng",
  passwordHash,
  role: Role.ADMIN,
  firstName: "Adebola",
  lastName: "Ogunleye",
  phone: null,
  avatarUrl: null,
  schoolId: "school-1",
  isActive: true,
  tokenVersion: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.classRoom.findMany.mockResolvedValue([]);
  mockPrisma.auditLog.create.mockResolvedValue({});
  mockPrisma.user.update.mockResolvedValue({});
  mockPrisma.school.findUnique.mockResolvedValue({
    id: "school-1",
    name: "Carlspat Private School",
    isActive: true,
    subscriptionStatus: "ACTIVE",
    subscriptionEndsAt: null,
  });
});

describe("POST /api/v1/auth/login", () => {
  it("logs in with valid credentials and returns tokens", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(adminUser);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@carlspat.sch.ng", password: "Admin#12345" });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.role).toBe("ADMIN");
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it("rejects a wrong password with 401", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(adminUser);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@carlspat.sch.ng", password: "wrong-password1" });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown email with 401 (no user enumeration)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ghost@carlspat.sch.ng", password: "whatever123" });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("rejects a deactivated account with 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...adminUser, isActive: false });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@carlspat.sch.ng", password: "Admin#12345" });
    expect(res.status).toBe(403);
  });

  it("validates the request body", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });
});

describe("RBAC", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app).get("/api/v1/students");
    expect(res.status).toBe(401);
  });

  it("rejects a parent calling a staff-only endpoint", async () => {
    const parentToken = signAccessToken({ sub: "p1", role: Role.PARENT, schoolId: "school-1" });
    const res = await request(app).get("/api/v1/students").set("Authorization", `Bearer ${parentToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects a teacher calling an admin-only endpoint", async () => {
    const teacherToken = signAccessToken({ sub: "t1", role: Role.TEACHER, schoolId: "school-1" });
    const res = await request(app)
      .put("/api/v1/settings/school")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "Hacked School" });
    expect(res.status).toBe(403);
  });

  it("allows any authenticated role to read the class list", async () => {
    const studentToken = signAccessToken({ sub: "s1", role: Role.STUDENT, schoolId: "school-1" });
    const res = await request(app).get("/api/v1/classes").set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
  });
});
