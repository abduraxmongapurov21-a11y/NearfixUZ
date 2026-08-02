-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OtpChallenge_one_active_per_phone_idx"
ON "OtpChallenge"("phone")
WHERE "consumedAt" IS NULL;
