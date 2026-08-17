import { Request } from "express";
import { prisma } from "../lib/prisma";

/**
 * Writes an audit-trail entry. Fire-and-forget: auditing must never break the
 * primary operation, so failures are logged and swallowed.
 */
export function audit(
  req: Request,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Record<string, unknown>
): void {
  prisma.auditLog
    .create({
      data: {
        // Stamped from the token so each school's trail stays its own. Null for
        // platform-level actions, which belong to no school.
        schoolId: req.auth?.schoolId ?? null,
        userId: req.auth?.sub ?? null,
        action,
        entity,
        entityId,
        ip: req.ip,
        userAgent: req.headers["user-agent"]?.slice(0, 255),
        meta: meta ? JSON.parse(JSON.stringify(meta)) : undefined,
      },
    })
    .catch((err) => console.error("Audit log failed:", err));
}
