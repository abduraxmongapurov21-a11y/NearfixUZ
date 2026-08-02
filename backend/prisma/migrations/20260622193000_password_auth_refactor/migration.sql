-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "passwordSetAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OtpChallenge"
  ADD COLUMN "purpose" "OtpPurpose";

UPDATE "OtpChallenge"
SET "purpose" = 'REGISTER'
WHERE "purpose" IS NULL;

ALTER TABLE "OtpChallenge"
  ALTER COLUMN "purpose" SET NOT NULL;

-- Replace the phone-only active challenge constraint with a purpose-aware constraint.
DROP INDEX IF EXISTS "OtpChallenge_one_active_per_phone_idx";
DROP INDEX IF EXISTS "OtpChallenge_phone_idx";

CREATE INDEX "OtpChallenge_phone_purpose_idx"
ON "OtpChallenge"("phone", "purpose");

CREATE UNIQUE INDEX "OtpChallenge_one_active_per_phone_purpose_idx"
ON "OtpChallenge"("phone", "purpose")
WHERE "consumedAt" IS NULL;
