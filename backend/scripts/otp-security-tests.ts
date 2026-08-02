import assert from "node:assert/strict";
import { OtpPurpose } from "@prisma/client";
import { ZodError } from "zod";
import { parseEnv } from "../src/config/env.js";
import { prisma } from "../src/db/prisma.js";
import { otpService, hashOtpCode } from "../src/modules/auth/otp.service.js";
import { normalizePhone } from "../src/utils/phone.js";

const phones = [
  "+998991112230",
  "+998991112231",
  "+998991112232",
  "+998991112233"
];

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

async function cleanup() {
  await prisma.otpChallenge.deleteMany({
    where: {
      phone: {
        in: phones
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      phone: {
        in: phones
      }
    }
  });
}

function getErrorCode(result: PromiseSettledResult<unknown>) {
  if (result.status === "fulfilled") return undefined;
  const reason = result.reason as { code?: string };
  return reason.code;
}

async function testDoubleVerifyRace() {
  const phone = phones[0];
  const { code } = await otpService.createChallenge(phone, OtpPurpose.REGISTER);

  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => otpService.verifyChallenge(phone, OtpPurpose.REGISTER, code))
  );
  const successCount = results.filter((result) => result.status === "fulfilled").length;
  const invalidCount = results.filter((result) => getErrorCode(result) === "OTP_INVALID").length;

  assert.equal(successCount, 1, "double verify race must create exactly one session");
  assert.equal(invalidCount, 9, "double verify race must reject reused challenge attempts");
}

async function testDoubleRequestRaceAndActiveUniqueness() {
  const phone = phones[1];
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => otpService.createChallenge(phone, OtpPurpose.REGISTER))
  );
  const successCount = results.filter((result) => result.status === "fulfilled").length;
  const activeCount = await prisma.otpChallenge.count({
    where: {
      phone,
      purpose: OtpPurpose.REGISTER,
      consumedAt: null
    }
  });

  assert.equal(successCount, 1, "parallel request race must create exactly one challenge");
  assert.equal(activeCount, 1, "only one active challenge may exist per phone");
}

async function testCooldownBypass() {
  const phone = phones[2];
  await otpService.createChallenge(phone, OtpPurpose.REGISTER);

  const result = await Promise.allSettled([otpService.createChallenge(phone, OtpPurpose.REGISTER)]);
  assert.equal(getErrorCode(result[0]), "OTP_COOLDOWN", "second request inside cooldown must be rejected");
}

async function testPhoneRateLimitBypass() {
  const phone = phones[3];
  const normalizedPhone = normalizePhone(phone);
  const now = new Date();

  await prisma.otpChallenge.createMany({
    data: Array.from({ length: 4 }, (_, index) => ({
      phone: normalizedPhone,
      purpose: OtpPurpose.REGISTER,
      codeHash: hashOtpCode(normalizedPhone, String(1000 + index)),
      expiresAt: addMinutes(now, 5),
      attempts: 0,
      maxAttempts: 5,
      consumedAt: now,
      resendAfter: now,
      createdAt: addMinutes(now, -index - 1)
    }))
  });

  await Promise.allSettled(
    Array.from({ length: 10 }, () => otpService.createChallenge(phone, OtpPurpose.REGISTER))
  );
  const recentCount = await prisma.otpChallenge.count({
    where: {
      phone: normalizedPhone,
      createdAt: {
        gt: addMinutes(new Date(), -60)
      }
    }
  });

  assert.equal(recentCount, 5, "parallel requests must not exceed 5 OTP challenges per hour");
}

function testProductionFakeProviderBlock() {
  assert.throws(
    () =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://nearfix:nearfix@localhost:5432/nearfix?schema=public",
        ACCESS_TOKEN_SECRET: "test-secret",
        ADMIN_USERNAME: "test-admin",
        ADMIN_PASSWORD: "test-admin-password",
        SESSION_SECRET: "test-secret",
        CORS_ORIGINS: "https://nearfix.uz",
        OTP_PROVIDER: "fake"
      }),
    (error) =>
      error instanceof ZodError &&
      error.issues.some((issue) => issue.message === "OTP_PROVIDER=fake is not allowed in production"),
    "production startup must reject OTP_PROVIDER=fake"
  );
}

async function main() {
  await cleanup();
  try {
    await testDoubleVerifyRace();
    await cleanup();
    await testDoubleRequestRaceAndActiveUniqueness();
    await cleanup();
    await testCooldownBypass();
    await cleanup();
    await testPhoneRateLimitBypass();
    testProductionFakeProviderBlock();
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log("OTP security hardening tests passed");
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
