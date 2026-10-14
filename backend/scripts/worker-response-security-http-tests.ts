import "./test-isolation-preload.js";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { UserRole, WorkerProfileStatus } from "@prisma/client";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";

const identity = assertLocalDatabaseTarget(process.env);
if (identity.nodeEnv !== "test" || identity.host !== "127.0.0.1" ||
    !/^nearfix_chat_test_[a-f0-9]{32}$/.test(identity.database) ||
    process.env.F1_DISPOSABLE_DATABASE !== identity.database) {
  throw new Error("Use with-chat-test-database.ts; a fresh disposable database is required");
}

const { prisma } = await import("../src/db/prisma.js");
const { createApp } = await import("../src/http/app.js");
const { hashPassword, verifyPassword } = await import("../src/modules/auth/password.js");
const { createAccessToken, hashRefreshToken } = await import("../src/modules/auth/session.js");
const reproduce = process.argv.includes("--reproduce") || process.env.SPRINT2_REPRODUCE === "1";
const password = randomUUID();
const passwordHash = await hashPassword(password);
const credentialDate = new Date("2026-01-02T03:04:05.000Z");
const secretValues = new Set([password, passwordHash]);
const privateUserKeys = ["passwordHash", "passwordSetAt", "passwordChangedAt", "isProvisional", "sessionVersion", "deletedAt"];
const ownUserKeys = ["id", "phone", "name", "role", "status", "cityId", "createdAt", "updatedAt"].sort();
const forbiddenKey = /password|secret|token|otp|session|credential|salt|^isProvisional$|^deletedAt$|^permissions$|^adminPermissions$/i;
const plannedCases = 74;
type JsonObject = Record<string, any>;
type HashMode = "non-null" | "null";
type Identity = {
  id: string; phone: string; name: string | null; role: UserRole;
  token: string; refreshToken: string; mode: HashMode;
};
type Worker = { id: string; user: Identity };
type Fixture = { mode: HashMode; client: Identity; worker: Worker; legacy: Worker; other: Worker; orderId: string; reviewId: string };
const identities: Identity[] = [];
const failures: string[] = [];
let cases = 0;
let assertions = 0;
let responsesScanned = 0;
let observedExposures = 0;
let phoneSequence = 0;
let server: Server | undefined;
let baseUrl = "";

class CaseFailure extends Error {}
function expect(condition: unknown, reason: string): asserts condition {
  assertions += 1;
  if (!condition) throw new CaseFailure(reason);
}
async function testCase(label: string, action: () => Promise<void>) {
  cases += 1;
  try {
    await action();
    console.log(`[F4] PASS ${label}`);
  } catch (error) {
    const reason = error instanceof CaseFailure ? error.message : "unexpected fixture/HTTP error (details suppressed)";
    failures.push(`${label}: ${reason}`);
    console.log(`[F4] FAIL ${label}: ${reason}`);
  }
}

function privacy(value: unknown, path = "response", findings: string[] = []) {
  if (typeof value === "string" && secretValues.has(value)) findings.push(`${path}:credential-value`);
  if (Array.isArray(value)) value.forEach((entry, index) => privacy(entry, `${path}[${index}]`, findings));
  else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (forbiddenKey.test(key)) findings.push(`${path}.${key}`);
      privacy(nested, `${path}.${key}`, findings);
    }
  }
  return findings;
}
function safeResponse(payload: JsonObject) {
  responsesScanned += 1;
  expect(privacy(payload).length === 0, "Recursive private keys/credential values absent, including null-valued keys");
}
function ownResponse(payload: JsonObject, worker: Worker, branch: string, categories = true) {
  responsesScanned += 1;
  const findings = privacy(payload);
  if (reproduce) {
    const user = payload.worker?.user;
    expect(Boolean(user) && privateUserKeys.every((key) => Object.hasOwn(user, key)), "Expected raw User private scalar keys reproduced");
    expect(user.passwordHash === (worker.user.mode === "null" ? null : passwordHash), "Exposed hash matches fixture state in memory");
    expect(findings.every((path) => path.startsWith("response.worker.user.")), "Exposure remains within expected own User relation");
    observedExposures += 1;
    console.log(`[F4] REPRO ${branch}; fixtureHash=${worker.user.mode}; privateKeys=${privateUserKeys.join(",")}; values=suppressed`);
  } else {
    expect(findings.length === 0, "Own worker response recursively omits User private keys and credential values");
    expect(Object.keys(payload.worker.user).sort().join(",") === ownUserKeys.join(","), "Own worker User exact safe allowlist preserved");
  }
  checkWorker(payload.worker, worker, categories);
}
function checkWorker(value: JsonObject, worker: Worker, categories = true) {
  expect(Boolean(value) && value.id === worker.id && value.userId === worker.user.id, "Own worker identity/linkage preserved");
  expect(value.user.id === worker.user.id && value.user.phone === worker.user.phone && value.user.name === worker.user.name,
    "Own worker name/phone/user identity preserved");
  expect(value.user.cityId === "tashkent" && value.user.role === "PROVIDER" && value.user.status === "ACTIVE", "Own worker User business state preserved");
  const required = ["profession", "professions", "experienceYears", "profileImageUrl", "bio", "basePrice", "ratingAvg",
    "completedOrdersCount", "submittedAt", "verifiedAt", "moderationReason", "createdAt", "updatedAt", "availability",
    "serviceLat", "serviceLng", "serviceLocationUpdatedAt"];
  expect(required.every((key) => Object.hasOwn(value, key)), "Own worker business/location fields preserved");
  expect(value.experienceYears === 0 && value.basePrice === 125000 && Array.isArray(value.professions), "Zero-year experience, price and professions preserved");
  expect(value.availability?.workerId === worker.id && typeof value.availability.status === "string", "Own worker availability relation preserved");
  if (categories) expect(Array.isArray(value.categories) && value.categories.length === 1, "Own worker categories preserved");
}
async function http(method: string, path: string, actor?: Identity, body?: unknown) {
  const response = await fetch(baseUrl + path, {
    method, headers: { "Content-Type": "application/json", ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000)
  });
  return { status: response.status, payload: await response.json() as JsonObject };
}
function ok(result: { status: number; payload: JsonObject }, status = 200) {
  expect(result.status === status && result.payload.ok === true, "Expected HTTP success/envelope");
}

async function user(role: UserRole, mode: HashMode, label: string): Promise<Identity> {
  const record = await prisma.user.create({ data: {
    phone: `+998000${String(++phoneSequence).padStart(6, "0")}`, name: `F4 ${label}`, role, cityId: "tashkent", sessionVersion: 7,
    passwordHash: mode === "null" ? null : passwordHash,
    passwordSetAt: mode === "null" ? null : credentialDate,
    passwordChangedAt: mode === "null" ? null : credentialDate,
    isProvisional: false, deletedAt: null
  } });
  const refreshToken = randomUUID();
  const session = await prisma.session.create({ data: {
    userId: record.id, refreshToken: hashRefreshToken(refreshToken), expiresAt: new Date(Date.now() + 3600000)
  } });
  const token = createAccessToken({ userId: record.id, sessionId: session.id, sessionVersion: record.sessionVersion });
  secretValues.add(refreshToken); secretValues.add(token);
  const actor = { id: record.id, phone: record.phone, name: record.name, role, token, refreshToken, mode };
  identities.push(actor);
  return actor;
}
async function worker(mode: HashMode, label: string, categoryId: string, status: WorkerProfileStatus = "APPROVED"): Promise<Worker> {
  const actor = await user("PROVIDER", mode, label);
  const profile = await prisma.workerProfile.create({ data: {
    userId: actor.id, status, profession: "F4 security service", professions: ["F4 security service"], experienceYears: 0,
    profileImageUrl: "https://example.invalid/f4-worker.png", bio: "F4 worker profile", basePrice: 125000,
    serviceLat: 41.31, serviceLng: 69.24, serviceLocationUpdatedAt: credentialDate,
    submittedAt: credentialDate, verifiedAt: status === "APPROVED" ? credentialDate : null,
    availability: { create: { status: status === "APPROVED" ? "AVAILABLE" : "OFFLINE" } },
    categories: { create: { categoryId, isPrimary: true, sortOrder: 0 } }
  } });
  return { id: profile.id, user: actor };
}
async function fixture(mode: HashMode, categoryId: string): Promise<Fixture> {
  const client = await user("CLIENT", mode, `${mode} client`);
  const primary = await worker(mode, `${mode} provider`, categoryId);
  const legacy = await worker(mode, `${mode} legacy provider`, categoryId, "DRAFT");
  const other = await worker(mode, `${mode} other provider`, categoryId);
  const order = await prisma.order.create({ data: {
    publicCode: `F4-${randomUUID()}`, clientId: client.id, workerId: primary.id, cityId: "tashkent",
    serviceType: "F4 security service", problemTitle: "F4 completed fixture", status: "COMPLETED", finalAmount: 125000
  } });
  const review = await prisma.review.create({ data: {
    orderId: order.id, clientId: client.id, workerId: primary.id, rating: 5, text: "F4 worker privacy review"
  } });
  return { mode, client, worker: primary, legacy, other, orderId: order.id, reviewId: review.id };
}
async function snapshot() {
  return JSON.stringify(await prisma.$transaction([
    prisma.user.findMany({ orderBy: { id: "asc" } }), prisma.session.findMany({ orderBy: { id: "asc" } }),
    prisma.workerProfile.findMany({ orderBy: { id: "asc" }, omit: { serviceLat: false, serviceLng: false, serviceLocationUpdatedAt: false } }),
    prisma.workerAvailability.findMany({ orderBy: { workerId: "asc" } }),
    prisma.workerCategory.findMany({ orderBy: [{ workerId: "asc" }, { categoryId: "asc" }] }),
    prisma.order.findMany({ orderBy: { id: "asc" } }), prisma.orderEvent.findMany({ orderBy: { id: "asc" } }),
    prisma.review.findMany({ orderBy: { id: "asc" } }), prisma.notification.findMany({ orderBy: { id: "asc" } }),
    prisma.chatRoom.findMany({ orderBy: { id: "asc" } }), prisma.pushToken.findMany({ orderBy: { id: "asc" } })
  ]));
}
async function targetSnapshot(target: Worker) {
  return JSON.stringify(await prisma.user.findUniqueOrThrow({ where: { id: target.user.id }, include: {
    workerProfile: { omit: { serviceLat: false, serviceLng: false, serviceLocationUpdatedAt: false },
      include: { availability: true, categories: true } }, sessions: true
  } }));
}

async function main() {
  console.log(`[F4] Worker response security mode=${reproduce ? "REPRODUCE before fix" : "REGRESSION after fix"}; credential values suppressed`);
  const category = await prisma.category.create({ data: {
    slug: `f4-worker-security-${randomUUID()}`, nameUz: "F4 security service", nameRu: "F4 security service",
    nameEn: "F4 security service", iconKey: "tools", isActive: true
  } });
  const fixtures = [await fixture("non-null", category.id), await fixture("null", category.id)];
  expect(await prisma.pushToken.count() === 0, "No push devices registered");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server!.once("listening", resolve); server!.once("error", reject); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  for (const f of fixtures) {
    const label = f.mode;
    const actor = f.worker.user;
    await testCase(`${label} valid client/provider/legacy/other sessions`, async () => {
      for (const identity of [f.client, actor, f.legacy.user, f.other.user]) {
        const result = await http("GET", "/auth/me", identity);
        ok(result);
        expect(result.payload.user.id === identity.id && result.payload.user.role === identity.role.toLowerCase(), "Live session resolves expected account/role");
      }
    });
    await testCase(`${label} GET /workers/me`, async () => {
      const result = await http("GET", "/workers/me", actor); ok(result);
      ownResponse(result.payload, f.worker, `${label} GET /workers/me`);
      expect(Number(result.payload.worker.serviceLat) === 41.31 && Number(result.payload.worker.serviceLng) === 69.24, "Own service coordinates preserved");
    });
    await testCase(`${label} PATCH profile normal`, async () => {
      const result = await http("PATCH", "/workers/me/profile", actor, { bio: "F4 changed bio" }); ok(result);
      ownResponse(result.payload, f.worker, `${label} normal profile`);
      expect(result.payload.worker.bio === "F4 changed bio" && result.payload.worker.status === "APPROVED", "Profile business update preserved");
      expect((await prisma.workerProfile.findUniqueOrThrow({ where: { id: f.worker.id } })).bio === "F4 changed bio", "Profile change persisted");
    });
    await testCase(`${label} PATCH profile image-only`, async () => {
      const before = await prisma.workerProfile.findUniqueOrThrow({ where: { id: f.worker.id } });
      const result = await http("PATCH", "/workers/me/profile", actor, { profileImageUrl: "https://example.invalid/f4-image-only.png" }); ok(result);
      ownResponse(result.payload, f.worker, `${label} image-only profile`);
      expect(result.payload.worker.profileImageUrl === "https://example.invalid/f4-image-only.png", "Image-only update preserved");
      expect(result.payload.worker.submittedAt === before.submittedAt?.toISOString() && result.payload.worker.bio === before.bio, "Image-only update preserves submission and bio");
    });
    await testCase(`${label} PATCH profile paired coordinates`, async () => {
      const result = await http("PATCH", "/workers/me/profile", actor, { serviceLat: 41.32, serviceLng: 69.25 }); ok(result);
      ownResponse(result.payload, f.worker, `${label} profile coordinate pair`);
      expect(Number(result.payload.worker.serviceLat) === 41.32 && Number(result.payload.worker.serviceLng) === 69.25, "Profile coordinate-pair response preserved");
    });
    await testCase(`${label} PATCH legacy DRAFT profile activation`, async () => {
      const result = await http("PATCH", "/workers/me/profile", f.legacy.user, { bio: "F4 legacy completed profile" }); ok(result);
      ownResponse(result.payload, f.legacy, `${label} legacy DRAFT activation`);
      expect(result.payload.worker.status === "APPROVED", "Legacy draft activates provider profile");
      expect((await prisma.workerProfile.findUniqueOrThrow({ where: { id: f.legacy.id } })).status === "APPROVED", "Legacy activation persisted");
    });
    await testCase(`${label} PATCH service-location set`, async () => {
      const result = await http("PATCH", "/workers/me/service-location", actor, { serviceLat: 41.33, serviceLng: 69.26 }); ok(result);
      ownResponse(result.payload, f.worker, `${label} service-location set`, false);
      expect(Number(result.payload.worker.serviceLat) === 41.33 && Number(result.payload.worker.serviceLng) === 69.26, "Service-location response preserved");
      const stored = await prisma.workerProfile.findUniqueOrThrow({ where: { id: f.worker.id }, omit: { serviceLat: false, serviceLng: false, serviceLocationUpdatedAt: false } });
      expect(Number(stored.serviceLat) === 41.33 && Number(stored.serviceLng) === 69.26 && stored.serviceLocationUpdatedAt !== null, "Service-location persisted");
    });
    for (const invalid of [{ label: "unsupported clear null/null", body: { serviceLat: null, serviceLng: null } },
      { label: "partial coordinate pair", body: { serviceLat: 41.35 } }]) {
      await testCase(`${label} ${invalid.label} rejected without DB change`, async () => {
        const before = await snapshot();
        const result = await http("PATCH", "/workers/me/service-location", actor, invalid.body);
        expect(await snapshot() === before, "Invalid coordinate write leaves DB unchanged");
        expect(result.status === 400 && result.payload.code === "VALIDATION_ERROR", "Existing coordinate contract rejects unsupported input");
        safeResponse(result.payload);
      });
    }

    for (const denied of [{ name: "client", identity: f.client, status: 403 }, { name: "anonymous", identity: undefined, status: 401 }]) {
      for (const request of [
        { method: "GET", path: "/workers/me" }, { method: "GET", path: "/workers/me/earnings" }, { method: "GET", path: "/workers/me/transactions" },
        { method: "PATCH", path: "/workers/me/profile", body: { bio: "F4 denied modification" } },
        { method: "PATCH", path: "/workers/me/service-location", body: { serviceLat: 41.4, serviceLng: 69.4 } },
        { method: "PATCH", path: "/workers/me/availability", body: { status: "OFFLINE" } }
      ]) {
        await testCase(`${label} ${denied.name} ${request.method} ${request.path} denied`, async () => {
          const before = request.method === "PATCH" ? await snapshot() : undefined;
          const result = await http(request.method, request.path, denied.identity, request.body);
          if (before !== undefined) expect(await snapshot() === before, "Denied write leaves DB unchanged");
          expect(result.status === denied.status, "Client/anonymous provider boundary preserved");
          safeResponse(result.payload);
        });
      }
    }
    await testCase(`${label} other provider GET me remains self-scoped`, async () => {
      const result = await http("GET", `/workers/me?userId=${actor.id}`, f.other.user); ok(result);
      ownResponse(result.payload, f.other, `${label} other provider GET self`);
      expect(result.payload.worker.id !== f.worker.id, "Other provider cannot select target using query input");
    });
    await testCase(`${label} other provider profile cannot select target`, async () => {
      const before = await targetSnapshot(f.worker);
      const result = await http("PATCH", "/workers/me/profile", f.other.user, { userId: actor.id, bio: "F4 other own bio" }); ok(result);
      expect(await targetSnapshot(f.worker) === before, "Other provider update leaves target account/profile/sessions unchanged");
      ownResponse(result.payload, f.other, `${label} other provider PATCH self`);
      expect(result.payload.worker.bio === "F4 other own bio", "Other provider updates only own profile");
    });
    await testCase(`${label} other provider location target input rejected`, async () => {
      const before = await snapshot();
      const result = await http("PATCH", "/workers/me/service-location", f.other.user, { userId: actor.id, serviceLat: 41.4, serviceLng: 69.4 });
      expect(await snapshot() === before, "Strict location contract rejects target selector without DB change");
      expect(result.status === 400 && result.payload.code === "VALIDATION_ERROR", "Location target selector rejected"); safeResponse(result.payload);
    });

    await testCase(`${label} own application DTO safe`, async () => {
      const result = await http("GET", "/workers/application", actor); ok(result); safeResponse(result.payload);
      expect(result.payload.application.id === f.worker.id && result.payload.application.state === "APPROVED", "Own application identity/state preserved");
    });
    await testCase(`${label} earnings DTO safe`, async () => {
      const result = await http("GET", "/workers/me/earnings", actor); ok(result); safeResponse(result.payload);
      expect(result.payload.earnings.completedJobs === 1 && typeof result.payload.earnings.todayEarnings === "number", "Earnings business totals preserved");
    });
    await testCase(`${label} transactions DTO safe`, async () => {
      const result = await http("GET", "/workers/me/transactions", actor); ok(result); safeResponse(result.payload);
      const transaction = result.payload.transactions.find((entry: JsonObject) => entry.orderId === f.orderId);
      expect(transaction?.amount === 125000 && transaction.clientName === f.client.name, "Transaction amount/client label preserved");
    });
    await testCase(`${label} availability DTO safe`, async () => {
      const result = await http("PATCH", "/workers/me/availability", actor, { status: "AVAILABLE" }); ok(result); safeResponse(result.payload);
      expect(result.payload.availability.workerId === f.worker.id && result.payload.availability.status === "AVAILABLE", "Own availability update preserved");
    });
    await testCase(`${label} public catalog safe`, async () => {
      const result = await http("GET", `/workers/catalog?categoryId=${category.id}`); ok(result); safeResponse(result.payload);
      const value = result.payload.workers.find((entry: JsonObject) => entry.id === f.worker.id);
      expect(value?.name === actor.name && value.basePrice === 125000 && value.experienceYears === 0, "Public catalog fixture/business fields preserved");
      expect(!Object.hasOwn(value, "user") && !Object.hasOwn(value, "phone"), "Catalog public identity contract preserved");
    });
    await testCase(`${label} public detail safe`, async () => {
      const result = await http("GET", `/workers/${f.worker.id}`); ok(result); safeResponse(result.payload);
      expect(result.payload.worker.phone === actor.phone && result.payload.worker.name === actor.name, "Public contact contract preserved");
      expect(!Object.hasOwn(result.payload.worker, "user"), "Public detail does not return raw User relation");
    });
    await testCase(`${label} public reviews safe`, async () => {
      const result = await http("GET", `/workers/${f.worker.id}/reviews`); ok(result); safeResponse(result.payload);
      const value = result.payload.reviews.find((entry: JsonObject) => entry.id === f.reviewId);
      expect(value?.rating === 5 && value.authorName === f.client.name, "Public review rating/author label preserved");
    });
    await testCase(`${label} public rating safe`, async () => {
      const result = await http("GET", `/workers/${f.worker.id}/rating`); ok(result); safeResponse(result.payload);
      expect(result.payload.rating.workerId === f.worker.id && result.payload.rating.reviewsCount === 1, "Public rating aggregate contract preserved");
    });
    await testCase(`${label} client application read safe`, async () => {
      const result = await http("GET", "/workers/application", f.client); ok(result); safeResponse(result.payload);
      expect(result.payload.application === null, "Client with no draft receives null application");
    });
    const complete = { categoryIds: [category.id], experienceYears: 0, profileImageUrl: "https://example.invalid/f4-new-provider.png",
      bio: "F4 client application", basePrice: 125000 };
    await testCase(`${label} client application save safe`, async () => {
      const result = await http("PUT", "/workers/application", f.client, complete); ok(result); safeResponse(result.payload);
      expect(result.payload.application.state === "DRAFT" && result.payload.application.experienceYears === 0, "Draft application state/zero-year fields preserved");
    });
    await testCase(`${label} client application submit safe and session continuous`, async () => {
      const result = await http("POST", "/workers/application/submit", f.client, {}); ok(result); safeResponse(result.payload);
      expect(result.payload.application.state === "APPROVED", "Application activation preserved");
      const session = await http("GET", "/auth/me", f.client); ok(session);
      expect(session.payload.user.role === "provider" && session.payload.user.sessionVersion === 7, "Original client session remains valid after provider activation");
    });
    await testCase(`${label} worker phone-order response safe`, async () => {
      const result = await http("POST", "/workers/orders", actor, {
        clientPhone: f.client.phone, categoryId: category.id, description: "F4 synthetic provider phone order",
        location: { addressText: "Synthetic disposable QA address", latitude: 41.31, longitude: 69.24 }, priceEstimate: 125000
      }); ok(result, 201); safeResponse(result.payload);
      expect(result.payload.order.workerId === f.worker.id && result.payload.order.clientId === f.client.id && result.payload.order.status === "ACCEPTED", "Worker phone-order identities/status preserved");
      expect(Object.keys(result.payload.order.client).sort().join(",") === "id,name,phone", "Phone-order client identity allowlist preserved");
      expect(Object.keys(result.payload.order.worker.user).sort().join(",") === "id,name,phone", "Phone-order worker identity allowlist preserved");
    });
    await testCase(`${label} stored credentials and refresh authentication preserved`, async () => {
      for (const identity of identities.filter((entry) => entry.mode === f.mode)) {
        const record = await prisma.user.findUniqueOrThrow({ where: { id: identity.id } });
        expect(record.passwordHash === (identity.mode === "null" ? null : passwordHash), "DB password hash state unchanged");
        expect(record.passwordSetAt?.toISOString() === (identity.mode === "null" ? undefined : credentialDate.toISOString()), "DB password-set metadata unchanged");
        expect(record.passwordChangedAt?.toISOString() === (identity.mode === "null" ? undefined : credentialDate.toISOString()), "DB password-change metadata unchanged");
        expect(record.sessionVersion === 7 && record.isProvisional === false && record.deletedAt === null, "DB private session/flag fields unchanged");
      }
      if (f.mode === "non-null") {
        expect(await verifyPassword(password, passwordHash), "Stored password verifier accepts valid password");
        expect(!(await verifyPassword(randomUUID(), passwordHash)), "Stored password verifier rejects wrong password");
      }
      const refreshed = await http("POST", "/auth/refresh", undefined, { refreshToken: actor.refreshToken }); ok(refreshed);
      expect(typeof refreshed.payload.accessToken === "string", "HTTP refresh returns access token");
      secretValues.add(refreshed.payload.accessToken);
      const refreshedIdentity = { ...actor, token: refreshed.payload.accessToken };
      const me = await http("GET", "/auth/me", refreshedIdentity); ok(me);
      expect(me.payload.user.id === actor.id && me.payload.user.role === "provider", "Refreshed session authenticates original provider");
    });
  }
  if (cases !== plannedCases) failures.push("planned logical case count mismatch");
  if (reproduce && observedExposures !== 16) failures.push("expected reproduced exposure response count mismatch");
  console.log(`[F4] Worker response security ${reproduce ? "reproduction" : "regression"}: ${cases}/${plannedCases} cases; ${responsesScanned} responses scanned; ${observedExposures} reproduced exposure responses; ${assertions} assertions; ${failures.length} failures`);
  console.log(`[F4] RESULT ${failures.length ? "FAIL" : "PASS"}`);
  if (failures.length) process.exitCode = 1;
}

main().catch(() => {
  console.log("[F4] FAIL unexpected fixture/HTTP error (details suppressed; no response values logged)");
  process.exitCode = 1;
}).finally(async () => {
  try {
    if (server?.listening) {
      const closing = new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
      server.closeIdleConnections(); await closing;
    }
  } catch {
    console.log("[F4] FAIL local HTTP server cleanup (details suppressed)"); process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
});
