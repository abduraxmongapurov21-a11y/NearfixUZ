-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "PushToken"
ADD COLUMN "deviceId" TEXT,
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "failureCount" INTEGER NOT NULL DEFAULT 0;

-- deviceId intentionally remains nullable for rollback compatibility with the
-- immediately previous backend, which can still create PushToken rows without it.
-- A future cleanup migration may enforce NOT NULL after that backend is retired.

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE UNIQUE INDEX "PushToken_deviceId_key" ON "PushToken"("deviceId");
CREATE INDEX "PushToken_userId_revokedAt_idx" ON "PushToken"("userId", "revokedAt");
