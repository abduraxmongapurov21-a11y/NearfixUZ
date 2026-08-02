import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

process.env.OTP_PROVIDER = "fake";
process.env.APP_REVIEW_DEMO_ENABLED = "true";
process.env.APP_REVIEW_DEMO_CLIENT_PHONE = "+998991119913";
process.env.APP_REVIEW_DEMO_CLIENT_PASSWORD = "DemoClient-123";
process.env.APP_REVIEW_DEMO_WORKER_PHONE = "+998991119914";
process.env.APP_REVIEW_DEMO_WORKER_PASSWORD = "DemoWorker-123";

const { OtpPurpose, UserRole } = await import("@prisma/client");
const { prisma } = await import("../src/db/prisma.js");
const { env } = await import("../src/config/env.js");
const { createApp } = await import("../src/http/app.js");
const { hashOtpCode } = await import("../src/modules/auth/otp.service.js");

const phone = "+998991119911";
const unknownPhone = "+998991119912";
const demoClientPhone = "+998991119913";
const demoWorkerPhone = "+998991119914";
const otpCode = "5454";

async function cleanup() {
  const phones = [phone, unknownPhone, demoClientPhone, demoWorkerPhone];
  const users = await prisma.user.findMany({
    where: {
      phone: {
        in: phones
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
        in: phones
      }
    }
  });
  await prisma.otpSession.deleteMany({
    where: {
      phone: {
        in: phones
      }
    }
  });
  await prisma.workerProfile.deleteMany({
    where: {
      userId: {
        in: users.map((user) => user.id)
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

async function setOtp(phoneNumber: string, code: string) {
  await prisma.otpChallenge.updateMany({
    where: {
      phone: phoneNumber,
      purpose: OtpPurpose.REGISTER,
      consumedAt: null
    },
    data: {
      codeHash: hashOtpCode(phoneNumber, code)
    }
  });
}

async function main() {
  await cleanup();

  const demoClient = await prisma.user.create({
    data: {
      phone: demoClientPhone,
      role: UserRole.CLIENT,
      name: "App Review Client"
    }
  });
  const demoWorker = await prisma.user.create({
    data: {
      phone: demoWorkerPhone,
      role: UserRole.PROVIDER,
      name: "App Review Worker"
    }
  });
  await prisma.workerProfile.create({
    data: {
      userId: demoWorker.id,
      status: "APPROVED",
      profession: "Demo worker",
      professions: ["Demo worker"]
    }
  });

  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function post(path: string, body: Record<string, string>) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  async function get(path: string, token?: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  async function del(path: string, token?: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  try {
    const normalRequest = await post("/auth/otp/request", { phone });
    assert.equal(normalRequest.response.status, 202);
    assert.equal(normalRequest.payload.nextStep, undefined);

    await setOtp(phone, otpCode);
    const normalVerify = await post("/auth/otp/verify", {
      phone,
      code: otpCode
    });
    assert.equal(normalVerify.response.status, 200);
    assert.ok(normalVerify.payload.accessToken);
    assert.ok(normalVerify.payload.refreshToken);
    assert.equal(normalVerify.payload.otpSessionToken, undefined);
    assert.equal(normalVerify.payload.nextStep, undefined);

    const normalMe = await get("/auth/me", normalVerify.payload.accessToken);
    assert.equal(normalMe.response.status, 200);
    assert.equal(normalMe.payload.user.phone, phone);

    const disabledPasswordLogin = await post("/auth/password/login", {
      otpSessionToken: "unused-token-that-is-long-enough",
      password: "AnyPassword-123"
    });
    assert.equal(disabledPasswordLogin.response.status, 410);
    assert.equal(disabledPasswordLogin.payload.code, "PASSWORD_AUTH_DISABLED");

    const normalUser = await prisma.user.findUniqueOrThrow({
      where: { phone }
    });
    assert.equal(normalUser.passwordHash, null);

    const demoRequest = await post("/auth/otp/request", { phone: demoClientPhone });
    assert.equal(demoRequest.response.status, 202);
    assert.equal(demoRequest.payload.nextStep, "APP_REVIEW_PASSWORD_REQUIRED");
    const demoChallengeCount = await prisma.otpChallenge.count({
      where: {
        phone: demoClientPhone
      }
    });
    assert.equal(demoChallengeCount, 0);

    const workerDemoRequest = await post("/auth/otp/request", { phone: demoWorkerPhone });
    assert.equal(workerDemoRequest.response.status, 202);
    assert.equal(workerDemoRequest.payload.nextStep, "APP_REVIEW_PASSWORD_REQUIRED");
    const workerDemoChallengeCount = await prisma.otpChallenge.count({
      where: {
        phone: demoWorkerPhone
      }
    });
    assert.equal(workerDemoChallengeCount, 0);

    const demoLogin = await post("/auth/app-review/login", {
      phone: demoClientPhone,
      password: "DemoClient-123"
    });
    assert.equal(demoLogin.response.status, 200);
    assert.ok(demoLogin.payload.accessToken);
    assert.ok(demoLogin.payload.refreshToken);
    assert.equal(demoLogin.payload.user.role, "client");

    const demoMe = await get("/auth/me", demoLogin.payload.accessToken);
    assert.equal(demoMe.response.status, 200);
    assert.equal(demoMe.payload.user.phone, demoClientPhone);
    assert.equal(demoMe.payload.user.role, "client");

    const demoDelete = await del("/auth/me", demoLogin.payload.accessToken);
    assert.equal(demoDelete.response.status, 403);
    assert.equal(demoDelete.payload.code, "DEMO_ACCOUNT_PROTECTED");

    const workerDemoLogin = await post("/auth/app-review/login", {
      phone: demoWorkerPhone,
      password: "DemoWorker-123"
    });
    assert.equal(workerDemoLogin.response.status, 200);
    assert.equal(workerDemoLogin.payload.user.role, "provider");

    const workerDemoDelete = await del("/auth/me", workerDemoLogin.payload.accessToken);
    assert.equal(workerDemoDelete.response.status, 403);
    assert.equal(workerDemoDelete.payload.code, "DEMO_ACCOUNT_PROTECTED");

    const wrongDemoPassword = await post("/auth/app-review/login", {
      phone: demoClientPhone,
      password: "WrongPassword-123"
    });
    assert.equal(wrongDemoPassword.response.status, 401);
    assert.equal(wrongDemoPassword.payload.code, "INVALID_CREDENTIALS");

    const nonAllowlistedDemo = await post("/auth/app-review/login", {
      phone: unknownPhone,
      password: "DemoClient-123"
    });
    assert.equal(nonAllowlistedDemo.response.status, 401);
    assert.equal(nonAllowlistedDemo.payload.code, "INVALID_CREDENTIALS");

    env.APP_REVIEW_DEMO_ENABLED = false;
    const disabledDemo = await post("/auth/app-review/login", {
      phone: demoClientPhone,
      password: "DemoClient-123"
    });
    assert.equal(disabledDemo.response.status, 403);
    assert.equal(disabledDemo.payload.code, "APP_REVIEW_DEMO_DISABLED");
    env.APP_REVIEW_DEMO_ENABLED = true;

    await prisma.user.update({
      where: { id: demoClient.id },
      data: { role: UserRole.ADMIN }
    });
    const adminRoleDemo = await post("/auth/app-review/login", {
      phone: demoClientPhone,
      password: "DemoClient-123"
    });
    assert.equal(adminRoleDemo.response.status, 401);
    assert.equal(adminRoleDemo.payload.code, "INVALID_CREDENTIALS");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await cleanup();
    await prisma.$disconnect();
  }

  console.log("Auth API tests passed");
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
