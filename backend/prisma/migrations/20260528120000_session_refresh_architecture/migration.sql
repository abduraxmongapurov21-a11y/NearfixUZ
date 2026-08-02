-- DropIndex
DROP INDEX IF EXISTS "Session_tokenHash_idx";

-- DropIndex
DROP INDEX IF EXISTS "Session_tokenHash_key";

-- AlterTable
ALTER TABLE "Session"
  ADD COLUMN IF NOT EXISTS "refreshToken" TEXT,
  ADD COLUMN IF NOT EXISTS "revoked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Session"
SET "refreshToken" = md5("id" || random()::text || clock_timestamp()::text)
WHERE "refreshToken" IS NULL;

ALTER TABLE "Session"
  ALTER COLUMN "refreshToken" SET NOT NULL,
  DROP COLUMN IF EXISTS "revokedAt",
  DROP COLUMN IF EXISTS "sessionVersion",
  DROP COLUMN IF EXISTS "tokenHash";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_refreshToken_idx" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_revoked_idx" ON "Session"("revoked");
