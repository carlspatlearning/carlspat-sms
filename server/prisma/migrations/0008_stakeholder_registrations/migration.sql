ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STAKEHOLDER';

CREATE TYPE "StakeholderStatus" AS ENUM ('APPROVED', 'INACTIVE');
CREATE TYPE "CandidateExam" AS ENUM ('WAEC', 'NECO', 'JAMB', 'WAEC_NECO', 'WAEC_NECO_JAMB');
CREATE TYPE "CandidateRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "StakeholderSchool" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    "status" "StakeholderStatus" NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StakeholderSchool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateRegistration" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "stakeholderSchoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" "Gender",
    "dateOfBirth" TIMESTAMP(3),
    "exam" "CandidateExam" NOT NULL,
    "passportUrl" TEXT,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CandidateRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StakeholderSchool_userId_key" ON "StakeholderSchool"("userId");
CREATE UNIQUE INDEX "StakeholderSchool_schoolId_name_key" ON "StakeholderSchool"("schoolId", "name");
CREATE INDEX "StakeholderSchool_schoolId_status_idx" ON "StakeholderSchool"("schoolId", "status");
CREATE INDEX "CandidateRegistration_schoolId_status_createdAt_idx" ON "CandidateRegistration"("schoolId", "status", "createdAt");
CREATE INDEX "CandidateRegistration_stakeholderSchoolId_createdAt_idx" ON "CandidateRegistration"("stakeholderSchoolId", "createdAt");

ALTER TABLE "StakeholderSchool" ADD CONSTRAINT "StakeholderSchool_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StakeholderSchool" ADD CONSTRAINT "StakeholderSchool_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateRegistration" ADD CONSTRAINT "CandidateRegistration_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateRegistration" ADD CONSTRAINT "CandidateRegistration_stakeholderSchoolId_fkey"
  FOREIGN KEY ("stakeholderSchoolId") REFERENCES "StakeholderSchool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateRegistration" ADD CONSTRAINT "CandidateRegistration_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CandidateRegistration" ADD CONSTRAINT "CandidateRegistration_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
