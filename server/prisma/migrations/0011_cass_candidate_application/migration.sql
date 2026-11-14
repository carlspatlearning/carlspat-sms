ALTER TYPE "CandidateExam" ADD VALUE IF NOT EXISTS 'CASS';

ALTER TABLE "CandidateRegistration"
  ADD COLUMN "applicationData" JSONB NOT NULL DEFAULT '{}'::jsonb;
