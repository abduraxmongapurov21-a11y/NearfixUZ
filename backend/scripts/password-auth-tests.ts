import assert from "node:assert/strict";

process.env.OTP_PROVIDER = "fake";
process.env.APP_REVIEW_DEMO_ENABLED = "true";
process.env.APP_REVIEW_DEMO_CLIENT_PHONE = "+998991119901";
process.env.APP_REVIEW_DEMO_CLIENT_PASSWORD = "DemoClient-123";

const { OtpPurpose, UserRole } = await import("@prisma/client");
const { prisma } = await import("../src/db/prisma.js");
const {
  loginWithAppReviewDemo,
  requestAuthOtp,
  verifyAuthOtp
} = await import("../src/modules/auth/auth.service.js");
const { hashOtpCode } = await import("../src/modules/auth/otp.service.js");
const { getSessionUser } = await import("../src/modules/auth/auth.service.js");

const normalPhone = "+998991119900";
const demoPhone = "+998991119901";

async function cleanup() {
  const users = await prisma.user.findMany({
    where: {
      phone: {
        in: [normalPhone, demoPhone]
      }
    },
    select: { id: true }
  });

  await prisma.session.deleteMany({
    where: {
      userId: {
        in: users.map((user) => user.id)
      }
    }
  });
  await prisma.otpChallenge.deleteMany({
    where: {
      phone: {
        in: [normalPhone, demoPhone]
      }
    }
  });
  await prisma.otpSession.deleteMany({
    where: {
      phone: {
        in: [normalPhone, demoPhone]
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      phone: {
        in: [normalPhone, demoPhone]
      }
    }
  });
}

function errorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
}

async function assertRejectedCode(promise: Promise<unknown>, expectedCode: string) {
  await assert.rejects(promise, (error) => errorCode(error) === expectedCode);
}

async function main() {
  await cleanup();

  try {
    await prisma.user.create({
      data: {
        phone: demoPhone,
        role: UserRole.CLIENT,
        name: "App Review Client"
      }
    });

    const normalRequest = await requestAuthOtp({ phone: normalPhone });
    assert.equal(normalRequest.ok, true);
    assert.equal("nextStep" in normalRequest, false);

    await prisma.otpChallenge.updateMany({
      where: {
        phone: normalPhone,
        purpose: OtpPurpose.REGISTER,
        consumedAt: null
      },
      data: {
        codeHash: hashOtpCode(normalPhone, "1234")
      }
    });
    const normalLogin = await verifyAuthOtp({
      phone: normalPhone,
      code: "1234"
    });
    assert.ok(normalLogin.accessToken);
    assert.ok(normalLogin.refreshToken);
    assert.equal("otpSessionToken" in normalLogin, false);

    const normalUser = await prisma.user.findUniqueOrThrow({
      where: { phone: normalPhone }
    });
    assert.equal(normalUser.passwordHash, null);

    const sessionUser = await getSessionUser(normalLogin.accessToken);
    assert.equal(sessionUser.phone, normalPhone);

    const demoRequest = await requestAuthOtp({ phone: demoPhone });
    assert.equal(demoRequest.ok, true);
    assert.equal(demoRequest.nextStep, "APP_REVIEW_PASSWORD_REQUIRED");
    const demoOtpChallenges = await prisma.otpChallenge.count({
      where: { phone: demoPhone }
    });
    assert.equal(demoOtpChallenges, 0);

    await assertRejectedCode(
      loginWithAppReviewDemo({ phone: demoPhone, password: "WrongPassword-123" }),
      "INVALID_CREDENTIALS"
    );

    const demoLogin = await loginWithAppReviewDemo({
      phone: demoPhone,
      password: "DemoClient-123"
    });
    assert.ok(demoLogin.accessToken);
    assert.ok(demoLogin.refreshToken);
    assert.equal(demoLogin.user.role, "client");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log("Password authentication tests passed");
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
