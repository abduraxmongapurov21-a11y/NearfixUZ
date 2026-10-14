import "./test-isolation-preload.js";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { UserRole, WorkerProfileStatus } from "@prisma/client";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";

// The preload requires a live IPC grant from the disposable-DB runner before
// application imports. This second guard documents the fixture's DB contract.
const identity = assertLocalDatabaseTarget(process.env);
if (identity.nodeEnv !== "test" || identity.host !== "127.0.0.1" ||
    !/^nearfix_chat_test_[a-f0-9]{32}$/.test(identity.database) ||
    process.env.F1_DISPOSABLE_DATABASE !== identity.database) {
  throw new Error("Use with-chat-test-database.ts; a fresh disposable database is required");
}

const { env } = await import("../src/config/env.js");
const { prisma } = await import("../src/db/prisma.js");
const { createApp } = await import("../src/http/app.js");
const { hashPassword, verifyPassword } = await import("../src/modules/auth/password.js");
const { createAccessToken, hashRefreshToken } = await import("../src/modules/auth/session.js");

type JsonObject = Record<string, any>;
type HashMode = "non-null" | "null";
type Actor = "env-super" | "db-super" | "permission-admin" | "read-only" |
  "no-permission" | "mobile-client" | "mobile-provider" | "anonymous";
type UserFixture = { id: string; name: string | null; phone: string; role: UserRole; sessionVersion: number };
type WorkerFixture = { id: string; userId: string; user: UserFixture };
type Fixture = {
  mode: HashMode;
  suspendedUser: UserFixture;
  applicant: WorkerFixture;
  rejectedApplicant: WorkerFixture;
  approvedWorker: WorkerFixture;
  suspendedWorker: WorkerFixture;
  reviewClient: UserFixture;
  reviewId: string;
  orderId: string;
};
type WriteRoute = "user-suspend" | "worker-approve" | "worker-reject" |
  "worker-suspend" | "worker-unsuspend" | "review-hide" | "review-restore";

const privileged: Actor[] = ["env-super", "db-super", "permission-admin"];
const readers: Actor[] = [...privileged, "read-only"];
const deniedReaders: Actor[] = ["no-permission", "mobile-client", "mobile-provider", "anonymous"];
const deniedWriters: Actor[] = ["read-only", ...deniedReaders];
const modes: HashMode[] = ["non-null", "null"];
const writeRoutes: WriteRoute[] = ["user-suspend", "worker-approve", "worker-reject",
  "worker-suspend", "worker-unsuspend", "review-hide", "review-restore"];
const readPermissions = ["users.read", "workers.read", "reviews.read"];
const managePermissions = ["users.manage", "workers.manage", "reviews.manage"];
const plannedCases = 111; // 5 admin login + 2 mobile auth + 1 fixture + 12 reads + 47 denials + 42 writes + 2 credential checks.
const fixturePassword = randomUUID();
const credentialDate = new Date("2026-01-02T03:04:05.000Z");
const fixtureHash = await hashPassword(fixturePassword);
const secretValues = new Set([fixturePassword, fixtureHash, env.ADMIN_PASSWORD]);
const tokens = new Map<Actor, string>();
const fixtureUsers = new Map<string, HashMode>();
const failures: string[] = [];
const userKeys = ["id", "phone", "name", "role", "status", "cityId", "createdAt", "updatedAt"].sort();
const forbiddenKey = /password|secret|token|otp|session|credential|salt|^isProvisional$|^deletedAt$|^permissions$|^adminPermissions$/i;
const reason = "Synthetic F4 moderation reason";
let phoneSequence = 0;
let cases = 0;
let assertions = 0;
let scannedResponses = 0;
let server: Server | undefined;
let baseUrl = "";

class CaseFailure extends Error {}
function expect(condition: unknown, label: string): asserts condition {
  assertions += 1;
  if (!condition) throw new CaseFailure(label);
}

async function testCase(label: string, action: () => Promise<void>) {
  cases += 1;
  try {
    await action();
    console.log(`[F4] PASS ${label}`);
  } catch (error) {
    // Never stringify responses, assertions' actual values, Prisma errors or tokens.
    const detail = error instanceof CaseFailure ? error.message : "unexpected fixture/HTTP error (details suppressed)";
    failures.push(`${label}: ${detail}`);
    console.log(`[F4] FAIL ${label}: ${detail}`);
  }
}

function scan(value: unknown, path = "response") {
  if (typeof value === "string") expect(!secretValues.has(value), `${path}: credential value absent`);
  if (Array.isArray(value)) { value.forEach((item, index) => scan(item, `${path}[${index}]`)); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    // Presence is forbidden even when null; scanning every nested object covers
    // reviews[*].client and reviews[*].worker.user as well as worker responses.
    expect(!forbiddenKey.test(key), `${path}.${key}: private key absent`);
    scan(nested, `${path}.${key}`);
  }
}

function checkUser(user: JsonObject, expected?: UserFixture) {
  expect(Boolean(user) && Object.keys(user).sort().join(",") === userKeys.join(","), "User exact admin allowlist preserved");
  expect(typeof user.id === "string" && typeof user.phone === "string", "User identity preserved");
  expect(user.name === null || typeof user.name === "string", "User nullable name preserved");
  expect(typeof user.role === "string" && typeof user.status === "string", "User role/status preserved");
  expect(user.cityId === null || typeof user.cityId === "string", "User city preserved");
  expect(typeof user.createdAt === "string" && typeof user.updatedAt === "string", "User timestamps preserved");
  if (expected) {
    expect(user.id === expected.id && user.phone === expected.phone && user.name === expected.name,
      "User fixture identity/name/phone preserved");
    expect(user.cityId === "tashkent", "User fixture city preserved");
  }
}

function checkWorker(worker: JsonObject, expected?: WorkerFixture, availabilityRequired = false) {
  expect(Boolean(worker) && typeof worker.id === "string" && typeof worker.userId === "string", "Worker identity preserved");
  const fields = ["status", "profession", "professions", "experienceYears", "profileImageUrl", "bio", "basePrice",
    "ratingAvg", "completedOrdersCount", "submittedAt", "verifiedAt", "moderationReason", "createdAt", "updatedAt", "user"];
  expect(fields.every((key) => Object.hasOwn(worker, key)), "Worker business fields preserved");
  expect(Array.isArray(worker.professions) && typeof worker.status === "string", "Worker professions/status preserved");
  expect(typeof worker.createdAt === "string" && typeof worker.updatedAt === "string", "Worker timestamps preserved");
  checkUser(worker.user, expected?.user);
  expect(worker.userId === worker.user.id, "Worker user linkage preserved");
  if (availabilityRequired) {
    expect(Object.hasOwn(worker, "availability"), "Worker availability relation preserved");
    if (worker.availability !== null) {
      expect(worker.availability.workerId === worker.id && typeof worker.availability.status === "string",
        "Worker availability identity/status preserved");
      expect(Object.hasOwn(worker.availability, "activeOrderId") && Object.hasOwn(worker.availability, "lockedUntil"),
        "Worker availability state fields preserved");
    }
  }
  if (expected) {
    expect(worker.id === expected.id && worker.userId === expected.userId, "Worker fixture identity preserved");
    expect(worker.profession === "F4 synthetic service" && worker.professions.includes("F4 synthetic service"),
      "Worker fixture service preserved");
    expect(worker.experienceYears === 0 && worker.basePrice === 50000 && worker.bio === "F4 synthetic worker profile",
      "Worker zero-year experience, price and bio preserved");
  }
}

function checkReview(review: JsonObject, fixture?: Fixture) {
  expect(Boolean(review) && typeof review.id === "string", "Review identity preserved");
  const fields = ["orderId", "clientId", "workerId", "rating", "text", "status", "createdAt", "client", "worker"];
  expect(fields.every((key) => Object.hasOwn(review, key)), "Review business fields preserved");
  expect(typeof review.rating === "number" && typeof review.createdAt === "string", "Review rating/timestamp preserved");
  checkUser(review.client, fixture?.reviewClient);
  checkWorker(review.worker, fixture?.approvedWorker);
  expect(review.clientId === review.client.id && review.workerId === review.worker.id, "Review participant linkage preserved");
  if (fixture) {
    expect(review.id === fixture.reviewId && review.orderId === fixture.orderId, "Review fixture/order identity preserved");
    expect(review.rating === 5 && review.text === "F4 synthetic review", "Review fixture rating/text preserved");
  }
}

async function http(method: string, path: string, actor: Actor, body?: unknown) {
  const token = tokens.get(actor);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000)
  });
  const payload = await response.json() as JsonObject;
  return { status: response.status, payload };
}

function successful(result: { status: number; payload: JsonObject }) {
  expect(result.status === 200, "HTTP 200 required");
  expect(result.payload.ok === true, "Success envelope preserved");
  scannedResponses += 1;
  scan(result.payload);
}

async function createUser(role: UserRole, mode: HashMode, label: string): Promise<UserFixture> {
  const user = await prisma.user.create({ data: {
    phone: `+998000${String(++phoneSequence).padStart(6, "0")}`,
    name: `F4 ${label}`, role, cityId: "tashkent", sessionVersion: 7,
    passwordHash: mode === "non-null" ? fixtureHash : null,
    passwordSetAt: mode === "non-null" ? credentialDate : null,
    passwordChangedAt: mode === "non-null" ? credentialDate : null,
    isProvisional: true, deletedAt: null
  } });
  fixtureUsers.set(user.id, mode);
  return user;
}

async function createWorker(mode: HashMode, status: WorkerProfileStatus, label: string): Promise<WorkerFixture> {
  const user = await createUser(status === "DRAFT" ? "CLIENT" : "PROVIDER", mode, label);
  const worker = await prisma.workerProfile.create({ data: {
    userId: user.id, status, profession: "F4 synthetic service", professions: ["F4 synthetic service"],
    experienceYears: 0, profileImageUrl: "https://example.invalid/f4.png", bio: "F4 synthetic worker profile",
    basePrice: 50000, submittedAt: status === "DRAFT" ? credentialDate : null,
    verifiedAt: status === "DRAFT" ? null : credentialDate,
    moderationReason: status === "SUSPENDED" ? "F4 previous reason" : null,
    availability: { create: { status: "OFFLINE" } }
  } });
  // A live session makes authorized user suspension/approval revocation visible.
  await createSession(user);
  return { id: worker.id, userId: user.id, user };
}

async function createSession(user: UserFixture) {
  const refreshToken = randomUUID();
  secretValues.add(refreshToken);
  const session = await prisma.session.create({ data: {
    userId: user.id, refreshToken: hashRefreshToken(refreshToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  } });
  const accessToken = createAccessToken({ userId: user.id, sessionId: session.id, sessionVersion: user.sessionVersion });
  secretValues.add(accessToken);
  return accessToken;
}

async function createFixture(mode: HashMode, label: string): Promise<Fixture> {
  const suspendedUser = await createUser("CLIENT", mode, `${label} user target`);
  await createSession(suspendedUser);
  const applicant = await createWorker(mode, "DRAFT", `${label} approve target`);
  const rejectedApplicant = await createWorker(mode, "DRAFT", `${label} reject target`);
  const approvedWorker = await createWorker(mode, "APPROVED", `${label} suspend target`);
  const suspendedWorker = await createWorker(mode, "SUSPENDED", `${label} unsuspend target`);
  const reviewClient = await createUser("CLIENT", mode, `${label} review client`);
  const order = await prisma.order.create({ data: {
    publicCode: `F4-${randomUUID()}`, clientId: reviewClient.id, workerId: approvedWorker.id,
    cityId: "tashkent", serviceType: "F4 synthetic service", problemTitle: "F4 privacy fixture", status: "COMPLETED"
  } });
  const review = await prisma.review.create({ data: {
    orderId: order.id, clientId: reviewClient.id, workerId: approvedWorker.id,
    rating: 5, text: "F4 synthetic review", status: "PUBLISHED"
  } });
  return { mode, suspendedUser, applicant, rejectedApplicant, approvedWorker, suspendedWorker, reviewClient,
    reviewId: review.id, orderId: order.id };
}

function writeRequest(route: WriteRoute, fixture: Fixture) {
  switch (route) {
    case "user-suspend": return { method: "POST", path: `/admin/users/${fixture.suspendedUser.id}/suspend`, body: {} };
    case "worker-approve": return { method: "POST", path: `/admin/workers/${fixture.applicant.id}/approve`, body: {} };
    case "worker-reject": return { method: "POST", path: `/admin/workers/${fixture.rejectedApplicant.id}/reject`, body: { reason } };
    case "worker-suspend": return { method: "POST", path: `/admin/workers/${fixture.approvedWorker.id}/suspend`, body: { reason } };
    case "worker-unsuspend": return { method: "POST", path: `/admin/workers/${fixture.suspendedWorker.id}/unsuspend`, body: { reason } };
    case "review-hide": return { method: "PATCH", path: `/admin/reviews/${fixture.reviewId}/hide`, body: {} };
    case "review-restore": return { method: "PATCH", path: `/admin/reviews/${fixture.reviewId}/restore`, body: {} };
  }
}

async function databaseSnapshot() {
  // Compare all rows in mutation-relevant tables, including private fields in
  // memory only. Login audit rows already exist before these snapshots.
  return JSON.stringify(await prisma.$transaction([
    prisma.user.findMany({ orderBy: { id: "asc" } }),
    prisma.session.findMany({ orderBy: { id: "asc" } }),
    prisma.workerProfile.findMany({ orderBy: { id: "asc" },
      omit: { serviceLat: false, serviceLng: false, serviceLocationUpdatedAt: false } }),
    prisma.workerAvailability.findMany({ orderBy: { workerId: "asc" } }),
    prisma.workerCategory.findMany({ orderBy: [{ workerId: "asc" }, { categoryId: "asc" }] }),
    prisma.review.findMany({ orderBy: { id: "asc" } }),
    prisma.order.findMany({ orderBy: { id: "asc" } }),
    prisma.orderEvent.findMany({ orderBy: { id: "asc" } }),
    prisma.notification.findMany({ orderBy: { id: "asc" } }),
    prisma.pushToken.findMany({ orderBy: { id: "asc" } }),
    prisma.adminAuditLog.findMany({ orderBy: { id: "asc" } }),
    prisma.adminAccount.findMany({ orderBy: { id: "asc" } }),
    prisma.adminAccountPermission.findMany({ orderBy: { id: "asc" } })
  ]));
}

async function checkWrite(route: WriteRoute, payload: JsonObject, fixture: Fixture) {
  if (route === "user-suspend") {
    checkUser(payload.user, fixture.suspendedUser);
    expect(payload.user.status === "BLOCKED" && payload.user.role === "CLIENT", "User suspension contract preserved");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: fixture.suspendedUser.id } });
    expect(user.status === "BLOCKED" && user.sessionVersion === fixture.suspendedUser.sessionVersion + 1,
      "User suspension persisted and session version advanced");
    expect(await prisma.session.count({ where: { userId: user.id, revoked: false } }) === 0, "User suspension revoked live sessions");
    return;
  }
  if (route === "review-hide" || route === "review-restore") {
    checkReview(payload.review, fixture);
    const status = route === "review-hide" ? "HIDDEN" : "PUBLISHED";
    expect(payload.review.status === status, "Review visibility response preserved");
    const review = await prisma.review.findUniqueOrThrow({ where: { id: fixture.reviewId } });
    expect(review.status === status, "Review visibility persisted");
    const worker = await prisma.workerProfile.findUniqueOrThrow({ where: { id: fixture.approvedWorker.id } });
    expect(Number(worker.ratingAvg) === (status === "HIDDEN" ? 0 : 5), "Review visibility rating aggregate preserved");
    return;
  }
  const target = route === "worker-approve" ? fixture.applicant : route === "worker-reject" ? fixture.rejectedApplicant :
    route === "worker-suspend" ? fixture.approvedWorker : fixture.suspendedWorker;
  checkWorker(payload.worker, target, true);
  expect(typeof payload.actorId === "string", "Worker moderation actor contract preserved");
  const expectedStatus = route === "worker-reject" ? "DRAFT" : route === "worker-suspend" ? "SUSPENDED" : "APPROVED";
  expect(payload.worker.status === expectedStatus, "Worker moderation response status preserved");
  const worker = await prisma.workerProfile.findUniqueOrThrow({ where: { id: target.id }, include: { user: true, availability: true } });
  expect(worker.status === expectedStatus, "Worker moderation status persisted");
  if (route === "worker-approve") {
    expect(payload.worker.user.role === "PROVIDER" && worker.user.role === "PROVIDER", "Approval provider role preserved");
    expect(worker.user.sessionVersion === target.user.sessionVersion + 1, "Approval session version advanced");
    expect(await prisma.session.count({ where: { userId: target.userId, revoked: false } }) === 0, "Approval revoked live sessions");
  }
  if (route === "worker-reject") {
    expect(payload.worker.submittedAt === null && worker.submittedAt === null, "Rejection clears submitted application");
  }
  if (route !== "worker-approve") expect(payload.worker.moderationReason === reason && worker.moderationReason === reason,
    "Moderation reason preserved");
  expect(worker.availability?.status === "OFFLINE" && worker.availability.activeOrderId === null, "Worker availability preserved");
}

async function main() {
  const administrators: Array<{ actor: Actor; username: string; role: "ADMIN" | "SUPER_ADMIN"; permissions: string[] }> = [
    { actor: "db-super", username: `f4-super-${randomUUID()}`, role: "SUPER_ADMIN", permissions: [] },
    { actor: "permission-admin", username: `f4-manager-${randomUUID()}`, role: "ADMIN", permissions: [...readPermissions, ...managePermissions] },
    { actor: "read-only", username: `f4-reader-${randomUUID()}`, role: "ADMIN", permissions: readPermissions },
    { actor: "no-permission", username: `f4-empty-${randomUUID()}`, role: "ADMIN", permissions: [] }
  ];
  for (const admin of administrators) {
    await prisma.adminAccount.create({ data: {
      username: admin.username, passwordHash: fixtureHash, name: `F4 ${admin.actor}`, role: admin.role,
      status: "ACTIVE", mustChangePassword: false,
      permissions: { create: admin.permissions.map((permission) => ({ permission })) }
    } });
  }
  const mobileUsers = {
    "mobile-client": await createUser("CLIENT", "non-null", "mobile client"),
    "mobile-provider": await createUser("PROVIDER", "non-null", "mobile provider")
  };
  for (const actor of ["mobile-client", "mobile-provider"] as const) tokens.set(actor, await createSession(mobileUsers[actor]));
  const initial = [await createFixture("non-null", "initial hashed"), await createFixture("null", "initial nullable")];
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server!.once("listening", resolve);
    server!.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  for (const admin of [
    { actor: "env-super" as Actor, username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD, role: "super_admin", tokenType: "env_admin" },
    ...administrators.map((admin) => ({ ...admin, password: fixturePassword, role: admin.role.toLowerCase(), tokenType: "admin_account" }))
  ]) {
    await testCase(`admin login ${admin.actor}`, async () => {
      const result = await http("POST", "/admin/auth/login", "anonymous", { username: admin.username, password: admin.password });
      expect(result.status === 200 && typeof result.payload.token === "string", "Real admin HTTP login succeeds");
      expect(result.payload.user.role === admin.role && result.payload.user.tokenType === admin.tokenType, "Admin role/token boundary preserved");
      if (admin.actor === "read-only" || admin.actor === "no-permission" || admin.actor === "permission-admin") {
        const expected = administrators.find((candidate) => candidate.actor === admin.actor)!.permissions;
        expect(JSON.stringify([...result.payload.user.permissions].sort()) === JSON.stringify([...expected].sort()),
          "Admin permission fixture matches authenticated context");
      }
      tokens.set(admin.actor, result.payload.token);
      secretValues.add(result.payload.token);
    });
  }
  for (const actor of ["mobile-client", "mobile-provider"] as const) {
    await testCase(`valid mobile session ${actor}`, async () => {
      const result = await http("GET", "/auth/me", actor);
      expect(result.status === 200 && result.payload.user.id === mobileUsers[actor].id, "Mobile token has a live valid session");
      expect(result.payload.user.role === mobileUsers[actor].role.toLowerCase(), "Mobile role fixture preserved");
      // /auth/me deliberately has its own session contract, outside this admin DTO test.
    });
  }
  await testCase("nullable and non-null User credential fixtures", async () => {
    for (const fixture of initial) {
      for (const id of [fixture.suspendedUser.id, fixture.reviewClient.id, fixture.approvedWorker.userId]) {
        const user = await prisma.user.findUniqueOrThrow({ where: { id } });
        expect(user.passwordHash === (fixture.mode === "null" ? null : fixtureHash), "DB fixture hash state confirmed");
        expect(user.sessionVersion === 7 && user.isProvisional === true && user.deletedAt === null, "DB private-field fixture state confirmed");
      }
    }
    expect(await prisma.pushToken.count() === 0, "No push device is registered in disposable fixture");
  });

  for (const actor of readers) {
    for (const resource of ["users", "workers", "reviews"] as const) {
      await testCase(`GET /admin/${resource} ${actor} both hash modes`, async () => {
        const result = await http("GET", `/admin/${resource}`, actor);
        successful(result);
        const records = result.payload[resource];
        expect(Array.isArray(records), "Admin list envelope preserved");
        for (const record of records) {
          if (resource === "users") checkUser(record);
          else if (resource === "workers") checkWorker(record, undefined, true);
          else checkReview(record);
        }
        for (const fixture of initial) {
          if (resource === "users") checkUser(records.find((entry: JsonObject) => entry.id === fixture.suspendedUser.id), fixture.suspendedUser);
          else if (resource === "workers") checkWorker(records.find((entry: JsonObject) => entry.id === fixture.approvedWorker.id), fixture.approvedWorker, true);
          else checkReview(records.find((entry: JsonObject) => entry.id === fixture.reviewId), fixture);
        }
      });
    }
  }

  for (const actor of deniedReaders) {
    for (const resource of ["users", "workers", "reviews"]) {
      await testCase(`GET /admin/${resource} denied ${actor}`, async () => {
        const result = await http("GET", `/admin/${resource}`, actor);
        expect(result.status === (actor === "no-permission" ? 403 : 401), "Admin read boundary rejects actor");
        expect(result.payload.code === (actor === "no-permission" ? "PERMISSION_REQUIRED" : "ADMIN_UNAUTHORIZED"), "Admin denial code preserved");
        scannedResponses += 1;
        scan(result.payload);
        expect(!Object.hasOwn(result.payload, resource), "Denied read contains no collection");
      });
    }
  }
  for (const actor of deniedWriters) {
    for (const route of writeRoutes) {
      await testCase(`${route} denied ${actor}; DB unchanged`, async () => {
        const request = writeRequest(route, initial[0]);
        const before = await databaseSnapshot();
        const result = await http(request.method, request.path, actor, request.body);
        const after = await databaseSnapshot();
        expect(before === after, "Denied write leaves mutation-relevant DB tables unchanged");
        const permissionsDenied = actor === "read-only" || actor === "no-permission";
        expect(result.status === (permissionsDenied ? 403 : 401), "Admin write boundary rejects actor");
        expect(result.payload.code === (permissionsDenied ? "PERMISSION_REQUIRED" : "ADMIN_UNAUTHORIZED"), "Admin denial code preserved");
        scannedResponses += 1;
        scan(result.payload);
        expect(!["user", "worker", "review"].some((key) => Object.hasOwn(result.payload, key)), "Denied write contains no entity");
      });
    }
  }

  for (const actor of privileged) {
    for (const mode of modes) {
      const fixture = await createFixture(mode, `${actor} ${mode}`);
      for (const route of writeRoutes) {
        await testCase(`${route} ${actor} ${mode} hash`, async () => {
          const request = writeRequest(route, fixture);
          const result = await http(request.method, request.path, actor, request.body);
          successful(result);
          await checkWrite(route, result.payload, fixture);
        });
      }
    }
  }
  for (const mode of modes) {
    await testCase(`stored User credentials preserved ${mode}`, async () => {
      const ids = [...fixtureUsers].filter(([, fixtureMode]) => fixtureMode === mode).map(([id]) => id);
      const users = await prisma.user.findMany({ where: { id: { in: ids } } });
      expect(users.length === ids.length && users.length > 0, "All fixture Users remain stored");
      for (const user of users) {
        expect(user.passwordHash === (mode === "null" ? null : fixtureHash), "Stored hash unchanged by DTO serialization");
        expect(user.passwordSetAt?.toISOString() === (mode === "null" ? undefined : credentialDate.toISOString()), "Stored password-set metadata unchanged");
        expect(user.passwordChangedAt?.toISOString() === (mode === "null" ? undefined : credentialDate.toISOString()), "Stored password-change metadata unchanged");
        expect(user.isProvisional === true && user.deletedAt === null, "Stored private flags unchanged");
      }
      if (mode === "non-null") {
        expect(await verifyPassword(fixturePassword, users[0].passwordHash), "Stored hash still verifies valid password");
        expect(!(await verifyPassword(randomUUID(), users[0].passwordHash)), "Stored hash rejects wrong password");
      }
    });
  }
  if (cases !== plannedCases) failures.push("planned logical case count mismatch");
  console.log(`[F4] Admin credential HTTP regression: ${cases}/${plannedCases} cases; ${scannedResponses} responses scanned; ${assertions} assertions; ${failures.length} failures`);
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
      server.closeIdleConnections();
      await closing;
    }
  } catch {
    console.log("[F4] FAIL local HTTP server cleanup (details suppressed)");
    process.exitCode = 1;
  } finally {
    // The guarded runner owns and removes the entire disposable cluster. Avoid
    // broad cleanup queries that could hide a denied-write mutation.
    await prisma.$disconnect();
  }
});
