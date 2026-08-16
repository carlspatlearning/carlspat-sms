/**
 * Tenant isolation.
 *
 * Every school-facing request must be fenced to exactly one school. The school
 * is taken from the signed access token — never from the URL, a query string or
 * the request body, because those are attacker-controlled and a school id sent
 * by the client is not evidence of anything.
 *
 * The rule this file exists to enforce: no query that reads or writes school
 * data may run without a schoolId that came from the token.
 */
import { NextFunction, Request, Response } from "express";
import { Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

export interface TenantSchool {
  id: string;
  name: string;
  isActive: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndsAt: Date | null;
}

declare global {
  namespace Express {
    interface Request {
      school?: TenantSchool;
    }
  }
}

/**
 * The school this request belongs to, from the token.
 *
 * Throws rather than returning null: a route that needs a school and cannot
 * establish one must fail closed, never fall back to "the first school in the
 * table" — that fallback is exactly what made the old single-school code unsafe
 * to run for more than one school.
 */
export function currentSchoolId(req: Request): string {
  const schoolId = req.auth?.schoolId;
  if (!schoolId) {
    throw ApiError.forbidden("This account is not attached to a school.");
  }
  return schoolId;
}

/** Statuses that still permit day-to-day use. PAST_DUE is a grace period. */
const USABLE: SubscriptionStatus[] = [
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
];

/**
 * Loads the school for this request and refuses if its subscription no longer
 * permits access. Mount after `authenticate` on every school-facing router.
 *
 * A lapsed school keeps all of its data; only access stops. Nothing here
 * deletes or alters school records.
 */
export async function requireActiveSchool(req: Request, _res: Response, next: NextFunction) {
  try {
    // The platform owner works through /platform routes and has no school of
    // their own, so they are refused here rather than silently given one.
    if (req.auth?.role === Role.PLATFORM_OWNER) {
      throw ApiError.forbidden("Platform accounts cannot use school screens.");
    }

    const schoolId = currentSchoolId(req);
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        isActive: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });
    if (!school) throw ApiError.forbidden("School not found.");

    if (!school.isActive || !USABLE.includes(school.subscriptionStatus)) {
      throw ApiError.forbidden(
        "This school's access has been suspended. Please contact the system provider."
      );
    }
    if (school.subscriptionEndsAt && school.subscriptionEndsAt.getTime() < Date.now()) {
      throw ApiError.paymentRequired(
        "This school's subscription has expired. Please renew to restore access."
      );
    }

    req.school = school;
    next();
  } catch (e) {
    next(e);
  }
}

/** Restricts a route to the platform owner (the subscription console). */
export function requirePlatformOwner(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(ApiError.unauthorized());
  if (req.auth.role !== Role.PLATFORM_OWNER) return next(ApiError.forbidden());
  next();
}

/**
 * Confirms a record fetched by id actually belongs to the caller's school.
 *
 * Ids are guessable enough to be worth checking: without this, a head teacher
 * at one school who learns a student id at another can read that student by
 * asking for it directly. Use on every lookup that takes an id from the URL.
 */
export function assertSameSchool(req: Request, record: { schoolId: string } | null | undefined, label = "Record") {
  if (!record) throw ApiError.notFound(`${label} not found`);
  if (record.schoolId !== currentSchoolId(req)) {
    // Deliberately "not found" rather than "forbidden": confirming that an id
    // exists at another school is itself a leak.
    throw ApiError.notFound(`${label} not found`);
  }
}
