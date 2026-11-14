CREATE TABLE "DesktopSyncRecord" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "tableName" TEXT NOT NULL,
  "localId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "eventId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "payload" JSONB,
  "sourceUpdatedAt" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DesktopSyncRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DesktopSyncRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DesktopSyncRecord_schoolId_deviceId_tableName_localId_key"
  ON "DesktopSyncRecord"("schoolId", "deviceId", "tableName", "localId");
CREATE UNIQUE INDEX "DesktopSyncRecord_eventId_key" ON "DesktopSyncRecord"("eventId");
CREATE INDEX "DesktopSyncRecord_schoolId_deviceId_tableName_idx"
  ON "DesktopSyncRecord"("schoolId", "deviceId", "tableName");
CREATE INDEX "DesktopSyncRecord_schoolId_updatedAt_idx"
  ON "DesktopSyncRecord"("schoolId", "updatedAt");

-- Prisma connects as a trusted server role. Do not expose these mirrored
-- records directly through Supabase's browser Data API.
ALTER TABLE "DesktopSyncRecord" ENABLE ROW LEVEL SECURITY;
