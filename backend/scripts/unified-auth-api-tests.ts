import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

process.env.OTP_PROVIDER = "fake";
process.env.TRUST_PROXY = "true";
process.env.APP_REVIEW_DEMO_ENABLED = "true";
process.env.APP_REVIEW_DEMO_CLIENT_PHONE = "+998991119913";
process.env.APP_REVIEW_DEMO_CLIENT_PASSWORD = "DemoClient-123";
process.env.APP_REVIEW_DEMO_WORKER_PHONE = "+998991119914";
process.env.APP_REVIEW_DEMO_WORKER_PASSWORD = "DemoWorker-123";
process.env.APP_REVIEW_DEMO_EXTRA_ACCOUNTS_JSON = "";

const { OtpPurpose, UserRole, UserStatus } = await import("@prisma/client");
const { prisma } = await import("../src/db/prisma.js");
const { env } = await import("../src/config/env.js");
const { createApp } = await import("../src/http/app.js");
const { loginWithAppReviewDemo, requestAuthOtp } = await import("../src/modules/auth/auth.service.js");
const { hashOtpCode } = await import("../src/modules/auth/otp.service.js");
const { normalizePhone } = await import("../src/utils/phone.js");

const phones = {
  existing: "+998991119910",
  fresh: "+998991119911",
  provider: "+998991119912",
  demoClient: "+998991119913",
  demoWorker: "+998991119914",
  blocked: "+998991119915",
  admin: "+998991119923",
  expired: "+998991119916",
  invalid: "+998991119917",
  cooldown: "+998991119918",
  race: "+998991119919",
  substitution: "+998991119920",
  substituted: "+998991119921",
  smsFailure: "+998991119922"
};
const allPhones = Object.values(phones);
const otpCode = "5454";

async function cleanup() {
  const users = await prisma.user.findMany({ where: { phone: { in: allPhones } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const workers = userIds.length
    ? await prisma.workerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    : [];
  const workerIds = workers.map((worker) => worker.id);
  const media = userIds.length
    ? await prisma.media.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } })
    : [];
  const mediaIds = media.map((item) => item.id);
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.otpChallenge.deleteMany({ where: { phone: { in: allPhones } } });
  await prisma.otpSession.deleteMany({ where: { phone: { in: allPhones } } });
  await prisma.workerAvailability.updateMany({
    where: { workerId: { in: workerIds } },
    data: { activeOrderId: null, lockedUntil: null }
  });
  await prisma.order.deleteMany({
    where: {
      OR: [
        { clientId: { in: userIds } },
        { workerId: { in: workerIds } }
      ]
    }
  });
  await prisma.chatMessage.deleteMany({
    where: {
      OR: [
        { senderId: { in: userIds } },
        { mediaId: { in: mediaIds } }
      ]
    }
  });
  await prisma.media.deleteMany({ where: { id: { in: mediaIds } } });
  await prisma.chatRoom.updateMany({ where: { createdById: { in: userIds } }, data: { createdById: null } });
  await prisma.orderEvent.updateMany({ where: { actorId: { in: userIds } }, data: { actorId: null } });
  await prisma.supportTicket.updateMany({
    where: { resolvedByAdminId: { in: userIds } },
    data: { resolvedByAdminId: null }
  });
  await prisma.report.updateMany({
    where: { resolvedByAdminId: { in: userIds } },
    data: { resolvedByAdminId: null }
  });
  await prisma.workerProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { phone: { in: allPhones } } });
}

async function setOtp(phone: string, code = otpCode) {
  await prisma.otpChallenge.updateMany({
    where: { phone, purpose: OtpPurpose.REGISTER, consumedAt: null },
    data: { codeHash: hashOtpCode(phone, code) }
  });
}

async function main() {
  assert.equal(normalizePhone("+998901234567"), "+998901234567");
  assert.equal(normalizePhone("998901234567"), "+998901234567");
  assert.equal(normalizePhone("90 123 45 67"), "+998901234567");
  await cleanup();
  const existingClient = await prisma.user.create({ data: { phone: phones.existing, role: UserRole.CLIENT, name: "Existing client" } });
  const provider = await prisma.user.create({ data: { phone: phones.provider, role: UserRole.PROVIDER, name: "Approved provider" } });
  await prisma.workerProfile.create({
    data: { userId: provider.id, status: "APPROVED", profession: "Provider", professions: ["Provider"] }
  });
  await prisma.user.create({ data: { phone: phones.blocked, role: UserRole.CLIENT, status: UserStatus.BLOCKED, name: "Blocked" } });
  await prisma.user.create({ data: { phone: phones.admin, role: UserRole.ADMIN, name: "Legacy admin" } });
  const demoClient = await prisma.user.create({ data: { phone: phones.demoClient, role: UserRole.CLIENT, name: "App Review Client" } });
  const demoWorker = await prisma.user.create({ data: { phone: phones.demoWorker, role: UserRole.PROVIDER, name: "App Review Worker" } });
  await prisma.workerProfile.create({
    data: { userId: demoWorker.id, status: "APPROVED", profession: "Demo worker", professions: ["Demo worker"] }
  });

  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let requestNumber = 0;

  async function post(path: string, body: Record<string, unknown>, token?: string) {
    requestNumber += 1;
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": `198.51.100.${requestNumber}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  async function get(path: string, token?: string) {
    const response = await fetch(`${baseUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  async function requestAndSetOtp(phone: string) {
    const requested = await post("/auth/otp/request", { phone });
    assert.equal(requested.response.status, 202);
    assert.equal(requested.payload.nextStep, undefined);
    await setOtp(phone);
    return requested.payload;
  }

  async function registrationTokenFor(phone: string) {
    await requestAndSetOtp(phone);
    const verified = await post("/auth/otp/verify", { phone, code: otpCode });
    assert.equal(verified.response.status, 200);
    assert.equal(verified.payload.status, "REGISTRATION_REQUIRED");
    assert.ok(verified.payload.registrationToken);
    assert.equal(await prisma.user.count({ where: { phone } }), 0);
    return verified.payload.registrationToken as string;
  }

  try {
    const existingRequest = await requestAndSetOtp(phones.existing);
    const existingVerify = await post("/auth/otp/verify", { phone: phones.existing, code: otpCode });
    assert.equal(existingVerify.response.status, 200);
    assert.equal(existingVerify.payload.status, "AUTHENTICATED");
    assert.ok(existingVerify.payload.accessToken);
    assert.ok(existingVerify.payload.refreshToken);
    assert.equal(existingVerify.payload.user.id, existingClient.id);
    assert.equal(existingVerify.payload.user.role, "client");
    const existingMe = await get("/auth/me", existingVerify.payload.accessToken);
    assert.equal(existingMe.response.status, 200);
    assert.equal(existingMe.payload.user.id, existingClient.id);

    const refreshed = await post("/auth/refresh", { refreshToken: existingVerify.payload.refreshToken });
    assert.equal(refreshed.response.status, 200);
    assert.ok(refreshed.payload.accessToken);
    assert.equal(refreshed.payload.user.id, existingClient.id);
    const loggedOut = await post("/auth/logout", {}, existingVerify.payload.accessToken);
    assert.equal(loggedOut.response.status, 200);
    const revokedRefresh = await post("/auth/refresh", { refreshToken: existingVerify.payload.refreshToken });
    assert.equal(revokedRefresh.response.status, 401);
    assert.equal(revokedRefresh.payload.code, "REFRESH_SESSION_INVALID");

    await requestAndSetOtp(phones.provider);
    const providerVerify = await post("/auth/otp/verify", { phone: phones.provider, code: otpCode });
    assert.equal(providerVerify.response.status, 200);
    assert.equal(providerVerify.payload.status, "AUTHENTICATED");
    assert.equal(providerVerify.payload.user.id, provider.id);
    assert.equal(providerVerify.payload.user.role, "provider");

    const blockedRequest = await requestAndSetOtp(phones.blocked);
    assert.deepEqual(blockedRequest, existingRequest, "pre-verification payload must not reveal account state");
    const blockedVerify = await post("/auth/otp/verify", { phone: phones.blocked, code: otpCode });
    assert.equal(blockedVerify.response.status, 403);
    assert.equal(blockedVerify.payload.code, "USER_BLOCKED");

    await requestAndSetOtp(phones.admin);
    const adminOtp = await post("/auth/otp/verify", { phone: phones.admin, code: otpCode });
    assert.equal(adminOtp.response.status, 403);
    assert.equal(adminOtp.payload.code, "OTP_AUTH_FORBIDDEN");

    const freshRequest = await requestAndSetOtp(phones.fresh);
    assert.deepEqual(freshRequest, existingRequest, "existing and new phones must receive the same request response");
    const freshVerify = await post("/auth/otp/verify", { phone: phones.fresh, code: otpCode });
    assert.equal(freshVerify.response.status, 200);
    assert.equal(freshVerify.payload.status, "REGISTRATION_REQUIRED");
    assert.ok(freshVerify.payload.registrationToken);
    assert.equal(freshVerify.payload.accessToken, undefined);
    assert.equal(await prisma.user.count({ where: { phone: phones.fresh } }), 0);
    const replayedOtp = await post("/auth/otp/verify", { phone: phones.fresh, code: otpCode });
    assert.equal(replayedOtp.response.status, 401);
    assert.equal(replayedOtp.payload.code, "OTP_INVALID");

    const completed = await post("/auth/register/complete", {
      registrationToken: freshVerify.payload.registrationToken,
      name: "Fresh client",
      role: "PROVIDER"
    });
    assert.equal(completed.response.status, 201);
    assert.equal(completed.payload.status, "AUTHENTICATED");
    assert.equal(completed.payload.user.role, "client");
    assert.equal(completed.payload.user.name, "Fresh client");
    assert.ok(completed.payload.accessToken);
    assert.ok(completed.payload.refreshToken);
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { phone: phones.fresh } });
    assert.equal(freshUser.role, UserRole.CLIENT);
    assert.equal(freshUser.passwordHash, null);
    const replayedRegistration = await post("/auth/register/complete", {
      registrationToken: freshVerify.payload.registrationToken,
      name: "Duplicate"
    });
    assert.equal(replayedRegistration.response.status, 401);
    assert.equal(await prisma.user.count({ where: { phone: phones.fresh } }), 1);

    const substitutionToken = await registrationTokenFor(phones.substitution);
    const substitution = await post("/auth/register/complete", {
      registrationToken: substitutionToken,
      phone: phones.substituted,
      name: "Bound identity"
    });
    assert.equal(substitution.response.status, 201);
    assert.equal(substitution.payload.user.phone, phones.substitution);
    assert.equal(await prisma.user.count({ where: { phone: phones.substituted } }), 0);

    const raceTokenA = await registrationTokenFor(phones.race);
    const raceTokenB = await registrationTokenFor(phones.race);
    const raceResults = await Promise.all([
      post("/auth/register/complete", { registrationToken: raceTokenA, name: "Race A" }),
      post("/auth/register/complete", { registrationToken: raceTokenB, name: "Race B" })
    ]);
    assert.equal(raceResults.filter((result) => result.response.status === 201).length, 2);
    assert.equal(await prisma.user.count({ where: { phone: phones.race } }), 1);
    assert.equal(raceResults[0].payload.user.id, raceResults[1].payload.user.id);
    assert.equal(await prisma.session.count({ where: { userId: raceResults[0].payload.user.id, revoked: false } }), 2);

    await requestAndSetOtp(phones.expired);
    await prisma.otpChallenge.updateMany({ where: { phone: phones.expired, consumedAt: null }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    const expired = await post("/auth/otp/verify", { phone: phones.expired, code: otpCode });
    assert.equal(expired.response.status, 401);
    assert.equal(expired.payload.code, "OTP_EXPIRED");

    await requestAndSetOtp(phones.invalid);
    for (let attempt = 1; attempt < 5; attempt += 1) {
      const invalid = await post("/auth/otp/verify", { phone: phones.invalid, code: "1111" });
      assert.equal(invalid.response.status, 401);
      assert.equal(invalid.payload.code, "OTP_INVALID");
    }
    const locked = await post("/auth/otp/verify", { phone: phones.invalid, code: "1111" });
    assert.equal(locked.response.status, 423);
    assert.equal(locked.payload.code, "OTP_LOCKED");

    await requestAndSetOtp(phones.cooldown);
    const cooldown = await post("/auth/otp/request", { phone: phones.cooldown });
    assert.equal(cooldown.response.status, 429);
    assert.equal(cooldown.payload.code, "OTP_COOLDOWN");

    await assert.rejects(
      requestAuthOtp(
        { phone: phones.smsFailure },
        { sendOtp: async () => { throw new Error("raw provider failure"); } }
      ),
      (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "SMS_SEND_FAILED")
    );
    const failedChallenge = await prisma.otpChallenge.findFirstOrThrow({ where: { phone: phones.smsFailure } });
    assert.ok(failedChallenge.consumedAt, "failed SMS delivery must invalidate its challenge");
    assert.equal(await prisma.user.count({ where: { phone: phones.smsFailure } }), 0);

    const disabledPasswordLogin = await post("/auth/password/login", {
      otpSessionToken: "unused-token-that-is-long-enough",
      password: "AnyPassword-123"
    });
    assert.equal(disabledPasswordLogin.response.status, 410);
    assert.equal(disabledPasswordLogin.payload.code, "PASSWORD_AUTH_DISABLED");

    const demoRequest = await post("/auth/otp/request", { phone: phones.demoClient });
    assert.equal(demoRequest.response.status, 202);
    assert.equal(demoRequest.payload.nextStep, "APP_REVIEW_PASSWORD_REQUIRED");
    assert.equal(await prisma.otpChallenge.count({ where: { phone: phones.demoClient } }), 0);
    const demoLogin = await post("/auth/app-review/login", { phone: phones.demoClient, password: "DemoClient-123" });
    assert.equal(demoLogin.response.status, 200);
    assert.equal(demoLogin.payload.user.role, "client");
    const workerDemoLogin = await post("/auth/app-review/login", { phone: phones.demoWorker, password: "DemoWorker-123" });
    assert.equal(workerDemoLogin.response.status, 200);
    assert.equal(workerDemoLogin.payload.user.role, "provider");
    const wrongDemoPassword = await post("/auth/app-review/login", { phone: phones.demoClient, password: "WrongPassword-123" });
    assert.equal(wrongDemoPassword.response.status, 401);
    assert.equal(wrongDemoPassword.payload.code, "INVALID_CREDENTIALS");

    await prisma.user.update({ where: { id: demoClient.id }, data: { role: UserRole.PROVIDER } });
    const escalatedProfile = await prisma.workerProfile.create({
      data: { userId: demoClient.id, status: "APPROVED", profession: "Escalated", professions: ["Escalated"] }
    });
    const clientCapabilityDemo = await post("/auth/app-review/login", { phone: phones.demoClient, password: "DemoClient-123" });
    assert.equal(clientCapabilityDemo.response.status, 200);
    assert.equal(clientCapabilityDemo.payload.user.role, "provider");
    await prisma.workerProfile.update({ where: { id: escalatedProfile.id }, data: { status: "SUSPENDED" } });
    await assert.rejects(
      loginWithAppReviewDemo({ phone: phones.demoClient, password: "DemoClient-123" }),
      (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "INVALID_CREDENTIALS")
    );

    env.APP_REVIEW_DEMO_ENABLED = false;
    const disabledDemo = await post("/auth/app-review/login", { phone: phones.demoClient, password: "DemoClient-123" });
    assert.equal(disabledDemo.response.status, 403);
    assert.equal(disabledDemo.payload.code, "APP_REVIEW_DEMO_DISABLED");
    env.APP_REVIEW_DEMO_ENABLED = true;
    await prisma.user.update({ where: { id: demoClient.id }, data: { role: UserRole.ADMIN } });
    const adminRoleDemo = await post("/auth/app-review/login", { phone: phones.demoClient, password: "DemoClient-123" });
    assert.equal(adminRoleDemo.response.status, 401);
    assert.equal(adminRoleDemo.payload.code, "INVALID_CREDENTIALS");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await cleanup();
    await prisma.$disconnect();
  }

  console.log("Unified OTP authentication API tests passed");
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
