-- Multi-tenancy: make every school-owned record carry its school, and make
-- per-school numbering (admission numbers, staff numbers, receipts) unique per
-- school rather than across the whole platform.
--
-- Written by hand rather than generated, because the new columns are required
-- and the existing rows must be backfilled before the NOT NULL is applied.
-- Every backfill below derives the school from an existing relationship, and
-- falls back to the one existing school for any row that has no path to one.
--
-- This migration adds and relabels. It deletes no rows and changes no amounts.

-- ── Enums ───────────────────────────────────────────────────────────────────
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PLATFORM_OWNER';

CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- ── School: identity + subscription ─────────────────────────────────────────
ALTER TABLE "School" ADD COLUMN "slug" TEXT;

-- Derive a URL-safe handle from the name: "Carlspat Private School" -> "carlspat-private-school"
UPDATE "School"
   SET "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'));

-- Guard against a school whose name yields an empty handle.
UPDATE "School" SET "slug" = 'school-' || substr(md5("id"), 1, 8) WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "School" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- Admission/receipt number prefix. Existing numbers already read "CPS/…", so the
-- founding school keeps that prefix and its sequence continues uninterrupted.
ALTER TABLE "School" ADD COLUMN "numberPrefix" TEXT NOT NULL DEFAULT 'SCH';
UPDATE "School" SET "numberPrefix" = 'CPS';

ALTER TABLE "School" ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "School" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "School" ADD COLUMN "planAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "School" ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);
ALTER TABLE "School" ADD COLUMN "platformNotes" TEXT;

-- Each school takes fees into its own Paystack account. Left null here: the
-- founding school keeps using the server-wide PAYSTACK_SECRET_KEY until its key
-- is entered in Settings, so online payment does not break at deploy time.
ALTER TABLE "School" ADD COLUMN "paystackSecretKey" TEXT;

-- Schools that already exist are live customers, not trials. Without this the
-- founding school would be gated behind a trial it never signed up for.
UPDATE "School" SET "subscriptionStatus" = 'ACTIVE';

-- The single-school defaults no longer make sense once other schools exist.
ALTER TABLE "School" ALTER COLUMN "name" DROP DEFAULT;
ALTER TABLE "School" ALTER COLUMN "motto" SET DEFAULT '';
ALTER TABLE "School" ALTER COLUMN "address" SET DEFAULT '';
ALTER TABLE "School" ALTER COLUMN "phone" SET DEFAULT '';
ALTER TABLE "School" ALTER COLUMN "email" SET DEFAULT '';

CREATE INDEX "School_subscriptionStatus_idx" ON "School"("subscriptionStatus");

-- ── Users must belong to a school, or tenant isolation cannot resolve them ───
UPDATE "User"
   SET "schoolId" = (SELECT "id" FROM "School" ORDER BY "createdAt" ASC LIMIT 1)
 WHERE "schoolId" IS NULL;

-- ── Teacher ─────────────────────────────────────────────────────────────────
ALTER TABLE "Teacher" ADD COLUMN "schoolId" TEXT;
UPDATE "Teacher" t SET "schoolId" = u."schoolId" FROM "User" u WHERE u."id" = t."userId";
UPDATE "Teacher" SET "schoolId" = (SELECT "id" FROM "School" ORDER BY "createdAt" ASC LIMIT 1) WHERE "schoolId" IS NULL;
ALTER TABLE "Teacher" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Teacher_staffNo_key";
CREATE UNIQUE INDEX "Teacher_schoolId_staffNo_key" ON "Teacher"("schoolId", "staffNo");
CREATE INDEX "Teacher_schoolId_idx" ON "Teacher"("schoolId");

-- ── Parent ──────────────────────────────────────────────────────────────────
ALTER TABLE "Parent" ADD COLUMN "schoolId" TEXT;
UPDATE "Parent" p SET "schoolId" = u."schoolId" FROM "User" u WHERE u."id" = p."userId";
UPDATE "Parent" SET "schoolId" = (SELECT "id" FROM "School" ORDER BY "createdAt" ASC LIMIT 1) WHERE "schoolId" IS NULL;
ALTER TABLE "Parent" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Parent_schoolId_idx" ON "Parent"("schoolId");

-- ── Term (denormalised from its session) ────────────────────────────────────
ALTER TABLE "Term" ADD COLUMN "schoolId" TEXT;
UPDATE "Term" t SET "schoolId" = s."schoolId" FROM "AcademicSession" s WHERE s."id" = t."sessionId";
UPDATE "Term" SET "schoolId" = (SELECT "id" FROM "School" ORDER BY "createdAt" ASC LIMIT 1) WHERE "schoolId" IS NULL;
ALTER TABLE "Term" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Term" ADD CONSTRAINT "Term_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Term_schoolId_isCurrent_idx" ON "Term"("schoolId", "isCurrent");

-- ── Payment ─────────────────────────────────────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN "schoolId" TEXT;
UPDATE "Payment" p SET "schoolId" = s."schoolId" FROM "Student" s WHERE s."id" = p."studentId";
UPDATE "Payment" SET "schoolId" = (SELECT "id" FROM "School" ORDER BY "createdAt" ASC LIMIT 1) WHERE "schoolId" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Payment_receiptNo_key";
CREATE UNIQUE INDEX "Payment_schoolId_receiptNo_key" ON "Payment"("schoolId", "receiptNo");

-- ── Student admission numbers ───────────────────────────────────────────────
DROP INDEX IF EXISTS "Student_admissionNo_key";
CREATE UNIQUE INDEX "Student_schoolId_admissionNo_key" ON "Student"("schoolId", "admissionNo");

-- ── Audit log (nullable: platform-level actions belong to no school) ────────
ALTER TABLE "AuditLog" ADD COLUMN "schoolId" TEXT;
UPDATE "AuditLog" a SET "schoolId" = u."schoolId" FROM "User" u WHERE u."id" = a."userId";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");
