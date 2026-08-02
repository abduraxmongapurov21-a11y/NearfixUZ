CREATE TABLE "OtpSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "userId" TEXT,
  "purpose" TEXT NOT NULL,
  "nextStep" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OtpSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OtpSession_tokenHash_key" ON "OtpSession"("tokenHash");
CREATE INDEX "OtpSession_phone_idx" ON "OtpSession"("phone");
CREATE INDEX "OtpSession_userId_idx" ON "OtpSession"("userId");
CREATE INDEX "OtpSession_purpose_idx" ON "OtpSession"("purpose");
CREATE INDEX "OtpSession_expiresAt_idx" ON "OtpSession"("expiresAt");
CREATE INDEX "OtpSession_consumedAt_idx" ON "OtpSession"("consumedAt");
