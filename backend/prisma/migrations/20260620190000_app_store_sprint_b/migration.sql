CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'WORKER', 'MESSAGE', 'REVIEW', 'ORDER', 'SUPPORT_TICKET');
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'ABUSE', 'HARASSMENT', 'FRAUD', 'INAPPROPRIATE_CONTENT', 'SAFETY_RISK', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED', 'ACTION_TAKEN');

ALTER TABLE "SupportTicket"
  ADD COLUMN "adminNote" TEXT,
  ADD COLUMN "resolvedByAdminId" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetType" "ReportTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "reason" "ReportReason" NOT NULL,
  "details" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
  "adminNote" TEXT,
  "resolvedByAdminId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBlock" (
  "blockerId" TEXT NOT NULL,
  "blockedUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId", "blockedUserId")
);

CREATE INDEX "SupportTicket_resolvedByAdminId_idx" ON "SupportTicket"("resolvedByAdminId");
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_reason_idx" ON "Report"("reason");
CREATE INDEX "Report_resolvedByAdminId_idx" ON "Report"("resolvedByAdminId");
CREATE INDEX "UserBlock_blockedUserId_idx" ON "UserBlock"("blockedUserId");

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_resolvedByAdminId_fkey"
  FOREIGN KEY ("resolvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_resolvedByAdminId_fkey"
  FOREIGN KEY ("resolvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
  ADD CONSTRAINT "UserBlock_blockerId_fkey"
  FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
  ADD CONSTRAINT "UserBlock_blockedUserId_fkey"
  FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
