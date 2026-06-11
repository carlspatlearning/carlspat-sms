import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken, AccessPayload } from "../utils/jwt";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessPayload;
    }
  }
}

/** Verifies the Bearer access token and attaches the payload to req.auth. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(ApiError.unauthorized());
  }
  try {
    req.auth = verifyAccessToken(header.slice(7));
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired token"));
  }
}

/** Role-based access control: allow only the given roles. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(ApiError.unauthorized());
    if (!roles.includes(req.auth.role)) return next(ApiError.forbidden());
    next();
  };
}

export const STAFF: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER, Role.ACCOUNTANT];
export const ADMINS: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

/**
 * Guard for student-scoped resources: admins/teachers/accountants may access any
 * student; a parent only their own children; a student only themselves.
 */
export async function assertCanAccessStudent(req: Request, studentId: string): Promise<void> {
  const auth = req.auth!;
  if ((STAFF as string[]).includes(auth.role)) return;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { userId: true, parent: { select: { userId: true } } },
  });
  if (!student) throw ApiError.notFound("Student not found");

  if (auth.role === Role.STUDENT && student.userId === auth.sub) return;
  if (auth.role === Role.PARENT && student.parent?.userId === auth.sub) return;
  throw ApiError.forbidden();
}
