ALTER TYPE "CandidateExam" ADD VALUE IF NOT EXISTS 'BECE';
ALTER TYPE "CandidateExam" ADD VALUE IF NOT EXISTS 'COMMON_ENTRANCE';

ALTER TABLE "CandidateRegistration"
  ADD COLUMN "amountDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "StakeholderServicePrice" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "exam" "CandidateExam",
  "amount" DECIMAL(12,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StakeholderServicePrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StakeholderServicePrice_schoolId_key_key"
  ON "StakeholderServicePrice"("schoolId", "key");
CREATE INDEX "StakeholderServicePrice_schoolId_isActive_idx"
  ON "StakeholderServicePrice"("schoolId", "isActive");
ALTER TABLE "StakeholderServicePrice" ADD CONSTRAINT "StakeholderServicePrice_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
