import assert from "node:assert/strict";
import { WorkerAvailabilityStatus, WorkerProfileStatus } from "@prisma/client";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { createAccessToken } from "../src/modules/auth/session.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const phones = [
  `+99877${suffix.slice(-7)}1`,
  `+99877${suffix.slice(-7)}2`,
  `+99877${suffix.slice(-7)}3`,
  `+99877${suffix.slice(-7)}4`,
  `+99877${suffix.slice(-7)}5`
];
const forbidden = new Set([
  "email", "role", "status", "phone", "passwordHash", "passwordSetAt", "passwordChangedAt", "sessionVersion", "deletedAt",
  "refreshToken", "refreshTokenHash", "blockedUserId",
  "user", "userId", "serviceLat", "serviceLng", "serviceLocationUpdatedAt", "moderationReason",
  "submittedAt", "verifiedAt", "updatedAt", "client", "clientId", "order", "orderId",
  "address", "addressId", "problemDescription", "priceEstimate", "finalAmount", "cancelReason"
]);

function assertNoForbiddenFields(value: unknown, path = "response") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const publicAvailabilityStatus = key === "status" && path.endsWith(".availability");
    assert.equal(forbidden.has(key) && !publicAvailabilityStatus, false, `forbidden field ${path}.${key}`);
    assertNoForbiddenFields(nested, `${path}.${key}`);
  }
}

async function cleanupCreatedRecords() {
  const users = await prisma.user.findMany({ where: { phone: { in: phones } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  if (!userIds.length) return;
  const workers = await prisma.workerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const workerIds = workers.map((worker) => worker.id);
  const orders = await prisma.order.findMany({ where: { OR: [{ clientId: { in: userIds } }, { workerId: { in: workerIds } }] }, select: { id: true } });
  const orderIds = orders.map((order) => order.id);
  await prisma.review.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { clientId: { in: userIds } }, { workerId: { in: workerIds } }] } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: { in: userIds } }, { blockedUserId: { in: userIds } }] } });
  await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.workerAvailability.deleteMany({ where: { workerId: { in: workerIds } } });
  await prisma.workerProfile.deleteMany({ where: { id: { in: workerIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  await cleanupCreatedRecords();
  const [client, provider, draftUser, rejectedUser, suspendedUser] = await Promise.all([
    prisma.user.create({ data: { phone: phones[0], name: "Public Reviewer", role: "CLIENT", cityId: `city-${suffix}` } }),
    prisma.user.create({ data: { phone: phones[1], name: "Public Professional", role: "PROVIDER", cityId: `city-${suffix}`, passwordHash: "must-never-leak" } }),
    prisma.user.create({ data: { phone: phones[2], name: "Private Draft", role: "CLIENT", cityId: `city-${suffix}` } }),
    prisma.user.create({ data: { phone: phones[3], name: "Private Rejected", role: "CLIENT", cityId: `city-${suffix}` } }),
    prisma.user.create({ data: { phone: phones[4], name: "Private Suspended", role: "PROVIDER", cityId: `city-${suffix}` } })
  ]);
  const approved = await prisma.workerProfile.create({
    data: {
      userId: provider.id, status: WorkerProfileStatus.APPROVED, profession: "Electrician",
      professions: ["Electrician"], experienceYears: 5, profileImageUrl: "https://example.com/public.jpg",
      bio: "Public description", basePrice: 100000, serviceLat: 41.3, serviceLng: 69.2,
      moderationReason: "must-never-leak", submittedAt: new Date(), verifiedAt: new Date(),
      availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } }
    }
  });
  const [draft, rejected, suspended] = await Promise.all([
    prisma.workerProfile.create({ data: { userId: draftUser.id, status: WorkerProfileStatus.DRAFT, profession: "Private" } }),
    prisma.workerProfile.create({
      data: {
        userId: rejectedUser.id,
        status: WorkerProfileStatus.DRAFT,
        profession: "Private",
        moderationReason: "Private rejection reason"
      }
    }),
    prisma.workerProfile.create({ data: { userId: suspendedUser.id, status: WorkerProfileStatus.SUSPENDED, profession: "Private" } })
  ]);
  const address = await prisma.address.create({
    data: { userId: client.id, label: "Private home", cityId: `city-${suffix}`, addressText: "Secret address" }
  });
  const order = await prisma.order.create({
    data: {
      publicCode: `P12-${suffix}`, clientId: client.id, workerId: approved.id, addressId: address.id,
      cityId: `city-${suffix}`, serviceType: "Electrician", problemTitle: "Public title",
      problemDescription: "Private problem", status: "COMPLETED", finalAmount: 200000
    }
  });
  await prisma.review.create({ data: { orderId: order.id, clientId: client.id, workerId: approved.id, rating: 5, text: "Great work" } });

  const server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addressInfo = server.address();
  if (!addressInfo || typeof addressInfo === "string") throw new Error("Test server address unavailable");
  async function tokenFor(user: { id: string; sessionVersion: number }, label: string) {
    const session = await prisma.session.create({ data: { userId: user.id, refreshToken: `guest-public-${suffix}-${label}`, expiresAt: new Date(Date.now() + 60_000) } });
    return createAccessToken({ userId: user.id, sessionId: session.id, sessionVersion: user.sessionVersion });
  }
  const clientToken = await tokenFor(client, "client");
  const providerToken = await tokenFor(provider, "provider");
  const request = async (path: string, options: { method?: string; token?: string } = {}) => {
    const response = await fetch(`http://127.0.0.1:${addressInfo.port}${path}`, {
      method: options.method,
      headers: options.token ? { Authorization: `Bearer ${options.token}` } : undefined
    });
    return { response, payload: await response.json() };
  };

  try {
    const catalog = await request(`/workers/catalog?cityId=${encodeURIComponent(`city-${suffix}`)}`);
    assert.equal(catalog.response.status, 200);
    assert.equal(catalog.payload.workers.length, 1);
    assertNoForbiddenFields(catalog.payload.workers);
    assert.equal("createdAt" in catalog.payload.workers[0], false);

    const detail = await request(`/workers/${approved.id}`);
    assert.equal(detail.response.status, 200);
    assertNoForbiddenFields(detail.payload.worker);
    assert.equal("createdAt" in detail.payload.worker, false);
    assert.deepEqual(Object.keys(detail.payload.worker).sort(), Object.keys(catalog.payload.workers[0]).sort());

    const privateDetail = await request(`/workers/${draft.id}`);
    assert.equal(privateDetail.response.status, 404);
    assert.equal((await request(`/workers/${rejected.id}`)).response.status, 404);
    assert.equal((await request(`/workers/${suspended.id}`)).response.status, 404);
    assert.equal((await request(`/workers/${draft.id}/reviews`)).response.status, 404);
    assert.equal((await request(`/workers/${draft.id}/rating`)).response.status, 404);
    const reviews = await request(`/workers/${approved.id}/reviews`);
    assert.equal(reviews.response.status, 200);
    assert.equal(reviews.payload.reviews.length, 1);
    assertNoForbiddenFields(reviews.payload.reviews);

    assert.equal((await request("/addresses")).response.status, 401);
    assert.equal((await request("/favorites")).response.status, 401);
    assert.equal((await request("/orders")).response.status, 401);
    assert.equal((await request("/workers/me")).response.status, 401, "static /me must not be shadowed");
    assert.equal((await request("/workers/application")).response.status, 401);
    assert.equal((await request("/workers/application/submit", { method: "POST" })).response.status, 401);
    assert.equal((await request(`/blocks/worker/${approved.id}`, { method: "POST" })).response.status, 401);

    const blocked = await request(`/blocks/worker/${approved.id}`, { method: "POST", token: clientToken });
    assert.equal(blocked.response.status, 201);
    assert.deepEqual(blocked.payload, { ok: true });
    assertNoForbiddenFields(blocked.payload);
    const duplicate = await request(`/blocks/worker/${approved.id}`, { method: "POST", token: clientToken });
    assert.equal(duplicate.response.status, 201);
    assert.deepEqual(duplicate.payload, { ok: true });
    for (const privateWorkerId of [draft.id, rejected.id, suspended.id, "not-a-worker-id"]) {
      assert.equal((await request(`/blocks/worker/${privateWorkerId}`, { method: "POST", token: clientToken })).response.status, 404);
    }
    const selfBlock = await request(`/blocks/worker/${approved.id}`, { method: "POST", token: providerToken });
    assert.equal(selfBlock.response.status, 400);
    assert.equal(selfBlock.payload.code, "BLOCK_SELF_FORBIDDEN");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.review.deleteMany({ where: { orderId: order.id } });
    await prisma.order.deleteMany({ where: { id: order.id } });
    await prisma.address.deleteMany({ where: { id: address.id } });
    await prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: client.id }, { blockerId: provider.id }, { blockedUserId: client.id }, { blockedUserId: provider.id }] } });
    await prisma.session.deleteMany({ where: { userId: { in: [client.id, provider.id] } } });
    await prisma.workerAvailability.deleteMany({ where: { workerId: approved.id } });
    await prisma.workerProfile.deleteMany({ where: { id: { in: [approved.id, draft.id, rejected.id, suspended.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [client.id, provider.id, draftUser.id, rejectedUser.id, suspendedUser.id] } } });
  }
  console.log("Guest public worker/detail/review DTO and private endpoint tests passed.");
}

main().finally(async () => {
  await cleanupCreatedRecords();
  await prisma.$disconnect();
});
