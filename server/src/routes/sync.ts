import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, ADMINS } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { currentSchoolId, requireActiveSchool } from "../middleware/tenant";
import { validate } from "../middleware/validate";
import { ApiError } from "../utils/apiError";

const router = Router();
router.use(authenticate, requireActiveSchool, authorize(...ADMINS));

const desktopTables = new Set([
  "roles", "permissions", "role_permissions", "users", "user_roles", "schools", "academic_sessions", "terms",
  "classes", "class_arms", "students", "parents", "student_parents", "staff", "teacher_assignments", "subjects",
  "student_portal_link", "parent_portal_link", "stakeholder_schools", "stakeholder_registrations", "fee_categories",
  "fee_assignments", "discounts", "payments", "payment_allocations", "assessment_components", "grading_scales", "results",
  "report_cards", "promotion_records", "attendance", "resources", "announcements", "messages", "notifications",
  "timetable_entries", "school_events", "expense_categories", "expenses", "audit_logs", "app_settings",
  "backup_history", "audit_events", "student_status_history", "class_subjects", "backup_schedule",
]);

const recordSchema = z.object({
  eventId: z.string().min(16).max(80),
  revision: z.number().int().positive(),
  tableName: z.string().min(1).max(80),
  localId: z.string().min(1).max(500),
  operation: z.enum(["upsert", "delete"]),
  payload: z.record(z.unknown()).nullable(),
});

router.get("/status", asyncHandler(async (req, res) => {
  const schoolId = currentSchoolId(req);
  const deviceId = String(req.query.deviceId || "");
  if (!deviceId || deviceId.length > 80) throw ApiError.badRequest("A valid desktop device id is required.");
  const [records, latest] = await Promise.all([
    prisma.desktopSyncRecord.count({ where: { schoolId, deviceId } }),
    prisma.desktopSyncRecord.findFirst({ where: { schoolId, deviceId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  res.json({ success: true, data: { records, lastReceivedAt: latest?.updatedAt ?? null } });
}));

router.post("/push", validate(z.object({ body: z.object({
  deviceId: z.string().min(8).max(80),
  records: z.array(recordSchema).min(1).max(60),
}) })), asyncHandler(async (req, res) => {
  const schoolId = currentSchoolId(req);
  const { deviceId, records } = req.body as { deviceId: string; records: z.infer<typeof recordSchema>[] };
  for (const record of records) {
    if (!desktopTables.has(record.tableName)) throw ApiError.badRequest(`Unsupported desktop table: ${record.tableName}`);
    if (record.operation === "upsert" && !record.payload) throw ApiError.badRequest("An upsert must include a record payload.");
  }

  const acknowledgedEventIds: string[] = [];
  await prisma.$transaction(async tx => {
    for (const record of records) {
      const where = { schoolId_deviceId_tableName_localId: { schoolId, deviceId, tableName: record.tableName, localId: record.localId } };
      const existing = await tx.desktopSyncRecord.findUnique({ where, select: { id: true, revision: true } });
      // Delayed retries are acknowledged without replacing a newer version.
      if (!existing || record.revision > existing.revision) {
        const payload: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue = record.operation === "delete"
          ? Prisma.JsonNull
          : record.payload as Prisma.InputJsonValue;
        const values = {
          revision: record.revision,
          eventId: record.eventId,
          operation: record.operation,
          payload,
          sourceUpdatedAt: typeof record.payload?.updated_at === "string" ? record.payload.updated_at : null,
        };
        if (existing) await tx.desktopSyncRecord.update({ where: { id: existing.id }, data: values });
        else await tx.desktopSyncRecord.create({ data: { id: randomUUID(), schoolId, deviceId, tableName: record.tableName, localId: record.localId, ...values } });
      }
      acknowledgedEventIds.push(record.eventId);
    }
  }, { timeout: 20000 });

  res.json({ success: true, data: { accepted: acknowledgedEventIds.length, acknowledgedEventIds } });
}));

export default router;
