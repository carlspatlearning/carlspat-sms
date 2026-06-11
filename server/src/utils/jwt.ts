import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";

export interface AccessPayload {
  sub: string; // user id
  role: Role;
  schoolId: string | null;
  type: "access";
}

export interface RefreshPayload {
  sub: string;
  tokenVersion: number;
  type: "refresh";
}

export function signAccessToken(payload: Omit<AccessPayload, "type">): string {
  return jwt.sign({ ...payload, type: "access" }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: Omit<RefreshPayload, "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  const payload = jwt.verify(token, env.jwt.accessSecret) as AccessPayload;
  if (payload.type !== "access") throw new Error("Invalid token type");
  return payload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const payload = jwt.verify(token, env.jwt.refreshSecret) as RefreshPayload;
  if (payload.type !== "refresh") throw new Error("Invalid token type");
  return payload;
}
