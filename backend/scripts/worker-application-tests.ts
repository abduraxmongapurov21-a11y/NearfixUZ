import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { AdminAccountRole, AdminAccountStatus, UserRole, WorkerProfileStatus } from "@prisma/client";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { otpVerifySchema, updateCurrentUserSchema } from "../src/modules/auth/auth.contracts.js";
import { completeOtpRegistration, updateCurrentUserProfile, verifyAuthOtp } from "../src/modules/auth/auth.service.js";
import { approveWorkerProfile, rejectWorkerProfile, saveOwnWorkerApplication, submitOwnWorkerApplication } from "../src/modules/workers/worker.service.js";
import { promoteUserToProvider } from "../src/modules/users/user-role.service.js";
import { workerApplicationDraftSchema, workerApplicationSubmitSchema } from "../src/modules/workers/worker.contracts.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { createOrder, listOrdersForUser } from "../src/modules/orders/order.service.js";
import { createAccessToken } from "../src/modules/auth/session.js";

const suffix = String(Date.now()).slice(-7);
const phones = [`+99890${suffix}`, `+99891${suffix}`, `+99892${suffix}`, `+99893${suffix}`, `+99894${suffix}`];
const otpServiceStub = { verifyChallenge: async () => ({}) } as any;
const adminUsernames = [`p12-limited-${suffix}`, `p12-manager-${suffix}`, `p12-super-${suffix}`];
const bookingLocation = {
  latitude: 41.311081,
  longitude: 69.240562,
  addressText: "Toshkent, provider client-mode test manzili"
};

async function cleanup() {
  const admins = await prisma.adminAccount.findMany({ where: { username: { in: adminUsernames } }, select: { id: true } });
  await prisma.adminAuditLog.deleteMany({ where: { actorAdminId: { in: admins.map((admin) => admin.id) } } });
  await prisma.adminAccount.deleteMany({ where: { id: { in: admins.map((admin) => admin.id) } } });
  const users = await prisma.user.findMany({ where: { phone: { in: phones } }, select: { id: true } });
  await prisma.otpSession.deleteMany({ where: { phone: { in: phones } } });
  await prisma.otpChallenge.deleteMany({ where: { phone: { in: phones } } });
  const userIds = users.map((user) => user.id);
  if (!userIds.length) return;
  const workers = await prisma.workerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const workerIds = workers.map((worker) => worker.id);
  await prisma.workerAvailability.deleteMany({ where: { workerId: { in: workerIds } } });
  await prisma.order.deleteMany({ where: { OR: [{ clientId: { in: userIds } }, { workerId: { in: workerIds } }] } });
  await prisma.workerProfile.deleteMany({ where: { id: { in: workerIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  await cleanup();
  try {
  assert.equal(workerApplicationDraftSchema.safeParse({ profession: "Electrician", role: "PROVIDER" }).success, false);
  assert.equal(workerApplicationSubmitSchema.safeParse({ name: "Applicant", status: "APPROVED" }).success, false);
  const parsed = otpVerifySchema.parse({ phone: phones[0], code: "123456", purpose: "AUTH", role: "PROVIDER" });
  assert.equal("role" in parsed, false, "registration contract must strip malicious role input");
  const verification = await verifyAuthOtp(parsed, otpServiceStub);
  assert.equal(verification.status, "REGISTRATION_REQUIRED");
  const auth = await completeOtpRegistration({
    registrationToken: verification.registrationToken,
    name: "Applicant"
  });
  assert.equal(auth.user.role, "client");
  const clientId = auth.user.id;
  const targetProvider = await prisma.user.create({
    data: { phone: phones[3], name: "Target Provider", role: UserRole.PROVIDER }
  });
  const targetWorker = await prisma.workerProfile.create({
    data: {
      userId: targetProvider.id,
      status: WorkerProfileStatus.APPROVED,
      profession: "Plumber",
      availability: { create: { status: "AVAILABLE" } }
    }
  });
  const priorClientOrder = await createOrder(
    {
      id: clientId,
      sessionId: "pre-approval-session",
      phone: phones[0],
      name: "Applicant",
      role: "client",
      permissions: [],
      sessionVersion: auth.user.sessionVersion
    },
    {
      workerId: targetWorker.id,
      location: bookingLocation,
      cityId: "tashkent",
      serviceType: "Plumber",
      problemTitle: "Pre-approval client order",
      urgency: "NORMAL"
    }
  );
  await prisma.workerAvailability.update({
    where: { workerId: targetWorker.id },
    data: { status: "AVAILABLE", activeOrderId: null, lockedUntil: null }
  });

  const profilePatch = updateCurrentUserSchema.parse({ name: "Applicant", role: "PROVIDER" });
  assert.equal("role" in profilePatch, false, "profile contract must strip role input");
  await updateCurrentUserProfile(clientId, profilePatch);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: clientId } })).role, UserRole.CLIENT);

  const draft = await saveOwnWorkerApplication(clientId, { profession: "Electrician" });
  assert.equal(draft.state, "DRAFT");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: clientId } })).role, UserRole.CLIENT);
  await saveOwnWorkerApplication(clientId, { bio: "Partial draft" });
  assert.equal(await prisma.workerProfile.count({ where: { userId: clientId } }), 1, "application must remain unique");

  await assert.rejects(
    submitOwnWorkerApplication(clientId, {}),
    (error: any) => error?.code === "WORKER_PROFILE_INCOMPLETE"
  );
  const complete = {
    name: "Applicant Name", cityId: "tashkent", profession: "Electrician", professions: ["Electrician", "Plumber"],
    experienceYears: 4, profileImageUrl: "https://example.com/applicant.jpg", bio: "Experienced professional",
    basePrice: 120000
  };
  const submitted = await submitOwnWorkerApplication(clientId, complete);
  assert.equal(submitted.state, "SUBMITTED");
  assert.deepEqual(submitted.professions, ["Electrician", "Plumber"], "application must preserve multiple professions");
  let client = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
  assert.equal(client.role, UserRole.CLIENT);
  const activeBeforeModeration = await prisma.session.count({ where: { userId: clientId, revoked: false } });
  assert.equal(activeBeforeModeration, 1, "submission must preserve the client session");

  await rejectWorkerProfile(submitted.id, "Please update your application");
  assert.equal(
    await prisma.notification.count({ where: { userId: clientId, type: "WORKER_APPLICATION_REJECTED" } }),
    1,
    "rejection must create a durable user notification"
  );
  client = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
  assert.equal(client.role, UserRole.CLIENT, "rejection must keep CLIENT");
  const rejectedVersion = client.sessionVersion;
  const rejectedActiveSessions = await prisma.session.count({ where: { userId: clientId, revoked: false } });
  await assert.rejects(approveWorkerProfile(submitted.id, {}), (error: any) => error?.code === "WORKER_APPROVAL_INVALID_STATE");
  client = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
  assert.equal(client.sessionVersion, rejectedVersion);
  assert.equal(await prisma.session.count({ where: { userId: clientId, revoked: false } }), rejectedActiveSessions);
  const resubmitted = await submitOwnWorkerApplication(clientId, complete);
  assert.equal(resubmitted.state, "SUBMITTED");

  const versionBeforeApproval = client.sessionVersion;
  await approveWorkerProfile(resubmitted.id, {});
  assert.equal(
    await prisma.notification.count({ where: { userId: clientId, type: "WORKER_APPLICATION_APPROVED" } }),
    1,
    "approval must create a durable user notification"
  );
  const provider = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
  assert.equal(provider.role, UserRole.PROVIDER, "approval is the role grant operation");
  assert.equal(provider.sessionVersion, versionBeforeApproval + 1);
  assert.equal(await prisma.session.count({ where: { userId: clientId, revoked: false } }), 0, "approval must revoke sessions");
  const providerAuth = {
    id: clientId,
    sessionId: "post-approval-session",
    phone: phones[0],
    name: "Applicant",
    role: "provider",
    permissions: [],
    sessionVersion: provider.sessionVersion
  };
  await assert.rejects(
    createOrder(providerAuth, {
      workerId: resubmitted.id,
      location: bookingLocation,
      cityId: "tashkent",
      serviceType: "Electrician",
      problemTitle: "Self booking must fail",
      urgency: "NORMAL"
    }),
    (error: any) => error?.code === "SELF_BOOKING_NOT_ALLOWED"
  );
  const clientHistory = await listOrdersForUser(providerAuth, "client");
  assert.equal(
    clientHistory.some((order) => order.id === priorClientOrder.id),
    true,
    "approved provider must retain pre-approval client order history"
  );
  const legacyWorkerHistory = await listOrdersForUser(providerAuth);
  assert.equal(
    legacyWorkerHistory.some((order) => order.id === priorClientOrder.id),
    false,
    "legacy provider order listing must remain worker-scoped"
  );
  const providerClientOrder = await createOrder(providerAuth, {
    workerId: targetWorker.id,
    location: bookingLocation,
    cityId: "tashkent",
    serviceType: "Plumber",
    problemTitle: "Post-approval client-mode order",
    urgency: "NORMAL"
  });
  assert.equal(providerClientOrder.clientId, clientId, "provider must be able to create an order as a client");
  const refreshedClientHistory = await listOrdersForUser(providerAuth, "client");
  assert.deepEqual(
    new Set(refreshedClientHistory.map((order) => order.id)),
    new Set([priorClientOrder.id, providerClientOrder.id]),
    "client mode must show both pre- and post-approval client orders"
  );
  const providerSession = await prisma.session.create({
    data: {
      userId: clientId,
      refreshToken: `p12-provider-mode-${suffix}`,
      expiresAt: new Date(Date.now() + 60_000)
    }
  });
  const providerAccessToken = createAccessToken({
    userId: clientId,
    sessionId: providerSession.id,
    sessionVersion: provider.sessionVersion
  });
  const httpApplicant = await prisma.user.create({
    data: { phone: phones[4], name: "HTTP Applicant", role: UserRole.CLIENT, cityId: "tashkent" }
  });
  const httpApplicantSession = await prisma.session.create({
    data: {
      userId: httpApplicant.id,
      refreshToken: `p12-http-applicant-${suffix}`,
      expiresAt: new Date(Date.now() + 60_000)
    }
  });
  const httpApplicantToken = createAccessToken({
    userId: httpApplicant.id,
    sessionId: httpApplicantSession.id,
    sessionVersion: httpApplicant.sessionVersion
  });
  await assert.rejects(approveWorkerProfile(resubmitted.id, {}), (error: any) => error?.code === "WORKER_APPROVAL_INVALID_STATE");
  const repeated = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
  assert.equal(repeated.sessionVersion, provider.sessionVersion, "repeated approval must not mutate the session version");

  const compatibilityClient = await prisma.user.create({ data: { phone: phones[1], role: UserRole.CLIENT } });
  const prepared = await promoteUserToProvider(compatibilityClient.id, { profession: "Plumber" });
  assert.equal(prepared.role, UserRole.CLIENT, "legacy admin compatibility route must only prepare a draft");
  const preparedProfile = await prisma.workerProfile.findUniqueOrThrow({ where: { userId: compatibilityClient.id } });
  assert.equal(preparedProfile.status, WorkerProfileStatus.DRAFT);
  await assert.rejects(approveWorkerProfile(preparedProfile.id, {}), (error: any) => error?.code === "WORKER_APPROVAL_INVALID_STATE");

  const adminPassword = "P12-Test-Admin-Password-123";
  const adminPasswordHash = await hashPassword(adminPassword);
  await prisma.adminAccount.createMany({ data: [
    { username: adminUsernames[0], passwordHash: adminPasswordHash, role: AdminAccountRole.ADMIN, status: AdminAccountStatus.ACTIVE, mustChangePassword: false },
    { username: adminUsernames[1], passwordHash: adminPasswordHash, role: AdminAccountRole.ADMIN, status: AdminAccountStatus.ACTIVE, mustChangePassword: false },
    { username: adminUsernames[2], passwordHash: adminPasswordHash, role: AdminAccountRole.SUPER_ADMIN, status: AdminAccountStatus.ACTIVE, mustChangePassword: false }
  ] });
  const manager = await prisma.adminAccount.findUniqueOrThrow({ where: { username: adminUsernames[1] } });
  await prisma.adminAccountPermission.create({ data: { adminAccountId: manager.id, permission: "workers.manage" } });
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    async function request(path: string, token?: string, body?: unknown, method = "POST") {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined
      });
      return { response, payload: await response.json().catch(() => ({})) };
    }
    async function login(username: string) {
      const result = await request("/admin/auth/login", undefined, { username, password: adminPassword });
      assert.equal(result.response.status, 200);
      return result.payload.token as string;
    }
    const clientModeOrders = await request("/orders?mode=client", providerAccessToken, undefined, "GET");
    assert.equal(clientModeOrders.response.status, 200);
    assert.deepEqual(
      new Set(clientModeOrders.payload.orders.map((order: { id: string }) => order.id)),
      new Set([priorClientOrder.id, providerClientOrder.id]),
      "provider client mode endpoint must return client-owned history"
    );
    const workerModeOrders = await request("/orders?mode=worker", providerAccessToken, undefined, "GET");
    assert.equal(workerModeOrders.response.status, 200);
    assert.equal(
      workerModeOrders.payload.orders.some((order: { id: string }) => order.id === priorClientOrder.id),
      false,
      "worker mode endpoint must not leak client-owned orders"
    );
    const savedApplication = await request(
      "/workers/application",
      httpApplicantToken,
      { profession: "Electrician", professions: ["Electrician", "Plumber"], basePrice: 200000 },
      "PUT"
    );
    assert.equal(savedApplication.response.status, 200, "authenticated application save endpoint must work");
    assert.deepEqual(savedApplication.payload.application.professions, ["Electrician", "Plumber"]);
    const submittedApplication = await request(
      "/workers/application/submit",
      httpApplicantToken,
      {
        name: "HTTP Applicant",
        cityId: "tashkent",
        profession: "Electrician",
        professions: ["Electrician", "Plumber"],
        experienceYears: 3,
        profileImageUrl: "https://example.com/http-applicant.jpg",
        bio: "Authenticated HTTP application regression",
        basePrice: 200000
      },
      "POST"
    );
    assert.equal(submittedApplication.response.status, 200, "authenticated application submit endpoint must work");
    assert.equal(submittedApplication.payload.application.state, "SUBMITTED");
    assert.equal((await request(`/admin/workers/${preparedProfile.id}/approve`)).response.status, 401);
    const [limitedToken, managerToken, superToken] = await Promise.all(adminUsernames.map(login));
    assert.equal((await request(`/admin/workers/${preparedProfile.id}/approve`, limitedToken, {})).response.status, 403);
    assert.equal((await request(`/admin/workers/${preparedProfile.id}/approve`, managerToken, {})).response.status, 409);
    assert.equal((await request(`/admin/workers/${preparedProfile.id}/approve`, superToken, {})).response.status, 409);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  const existingProvider = await prisma.user.create({ data: { phone: phones[2], role: UserRole.PROVIDER } });
  const providerDraft = await prisma.workerProfile.create({ data: { userId: existingProvider.id, status: WorkerProfileStatus.DRAFT, submittedAt: new Date() } });
  await assert.rejects(approveWorkerProfile(providerDraft.id, {}), (error: any) => error?.code === "WORKER_APPROVAL_INVALID_STATE");
  await prisma.workerProfile.update({ where: { id: providerDraft.id }, data: { status: WorkerProfileStatus.SUSPENDED } });
  await assert.rejects(approveWorkerProfile(providerDraft.id, {}), (error: any) => error?.code === "WORKER_APPROVAL_INVALID_STATE");
  await assert.rejects(saveOwnWorkerApplication(existingProvider.id, {}), (error: any) => error?.code === "CLIENT_REQUIRED");

  console.log("Registration role security and worker application lifecycle tests passed.");
  } finally {
    await cleanup();
  }
}

main().finally(() => prisma.$disconnect());
