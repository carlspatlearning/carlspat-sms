import { Role } from "@prisma/client";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../src/utils/jwt";

describe("JWT utils", () => {
  it("round-trips an access token", () => {
    const token = signAccessToken({ sub: "user-1", role: Role.ADMIN, schoolId: "school-1" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("ADMIN");
    expect(payload.schoolId).toBe("school-1");
    expect(payload.type).toBe("access");
  });

  it("round-trips a refresh token with tokenVersion", () => {
    const token = signRefreshToken({ sub: "user-1", tokenVersion: 3 });
    const payload = verifyRefreshToken(token);
    expect(payload.tokenVersion).toBe(3);
  });

  it("rejects an access token presented as a refresh token (and vice versa)", () => {
    const access = signAccessToken({ sub: "u", role: Role.PARENT, schoolId: null });
    const refresh = signRefreshToken({ sub: "u", tokenVersion: 0 });
    expect(() => verifyRefreshToken(access)).toThrow();
    expect(() => verifyAccessToken(refresh)).toThrow();
  });

  it("rejects tampered tokens", () => {
    const token = signAccessToken({ sub: "u", role: Role.PARENT, schoolId: null });
    expect(() => verifyAccessToken(token.slice(0, -2) + "xx")).toThrow();
  });
});
