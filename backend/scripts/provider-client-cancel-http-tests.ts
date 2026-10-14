import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  AdminAccountRole, AdminAccountStatus, NotificationStatus, OrderEventActorType,
  OrderEventType, OrderStatus, UserRole, WorkerAvailabilityStatus, WorkerProfileStatus
} from "@prisma/client";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";

const target = assertLocalDatabaseTarget();
if (target.nodeEnv !== "test" || target.host !== "127.0.0.1" ||
    target.database !== process.env.F1_DISPOSABLE_DATABASE ||
    !/^nearfix_chat_test_[a-f0-9]{32}$/.test(target.database)) {
  throw new Error("Disposable test database required");
}
// All application/bootstrap imports follow the live parent grant and DB guard.
// The preload rejects external fetch; these fixtures never register push devices.
const { prisma } = await import("../src/db/prisma.js");
const { createApp } = await import("../src/http/app.js");
const { createAccessToken } = await import("../src/modules/auth/session.js");
const { hashPassword } = await import("../src/modules/auth/password.js");
const { env } = await import("../src/config/env.js");
const reproduce = process.argv.includes("--reproduce") || process.env.PROVIDER_CANCEL_REPRODUCE === "1";
const activeStates = [OrderStatus.WAITING_RESPONSE, OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY, OrderStatus.IN_PROGRESS] as const;
const reason = "F4 synthetic cancellation reason";
const serviceType = "F4 cancellation service";
let phase = "owned database identity";
let passed = 0;
let httpRequests = 0;
let confirmedDefects = 0;
let server: Server | undefined;
let baseUrl = "";
type Actor = { id: string; token: string; role: UserRole };
type Fixture = { id: string; publicCode: string; owner: Actor; worker: { id: string; actor: Actor }; status: OrderStatus };
type AdminIdentity = { token: string; actorType: "ENV_ADMIN" | "ADMIN_ACCOUNT"; id: string; username: string };

class CaseFailure extends Error {}
function equal(actual: unknown, expected: unknown, description: string) {
  try { assert.deepEqual(actual, expected); } catch { throw new CaseFailure(description); }
}
function check(value: unknown, description: string): asserts value {
  if (!value) throw new CaseFailure(description);
}
async function test(label: string, action: () => Promise<void>) {
  phase = label;
  await action();
  passed += 1;
  console.log(`[F4] ${reproduce ? "DIAGNOSTIC_PASS" : "PASS"} ${label}`);
}
async function request(method: string, pathname: string, token?: string, body?: unknown) {
  httpRequests += 1;
  const response = await fetch(baseUrl + pathname, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000)
  });
  return { status: response.status, data: await response.json() as any };
}
async function mobile(role: UserRole, label: string): Promise<Actor> {
  const user = await prisma.user.create({ data: {
    phone: `f4-cancel-${randomUUID()}`, name: `F4 ${label}`, role, cityId: "tashkent",
    ...(role === UserRole.ADMIN ? { adminPermissions: { create: [{ permission: "orders.manage" }] } } : {})
  } });
  const session = await prisma.session.create({ data: {
    userId: user.id, refreshToken: randomUUID(), expiresAt: new Date(Date.now() + 3_600_000)
  } });
  return { id: user.id, role, token: createAccessToken({ userId: user.id, sessionId: session.id, sessionVersion: user.sessionVersion }) };
}
async function workerFor(actor: Actor) {
  return prisma.workerProfile.create({ data: {
    userId: actor.id, status: WorkerProfileStatus.APPROVED, profession: serviceType, professions: [serviceType],
    completedOrdersCount: 7, availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } }
  } });
}
async function fixture(owner: Actor, status: OrderStatus): Promise<Fixture> {
  const assigned = await mobile(UserRole.PROVIDER, "assigned worker");
  const worker = await workerFor(assigned);
  const created = await request("POST", "/orders", owner.token, {
    workerId: worker.id, cityId: "tashkent", serviceType, problemTitle: "F4 synthetic cancellation order",
    urgency: "FAST", location: { latitude: 41.31, longitude: 69.24, addressText: "F4 synthetic address" }
  });
  equal(created.status, 201, "Real HTTP client booking must succeed");
  equal(created.data.order.clientId, owner.id, "Booking owner identity");
  equal(created.data.order.status, OrderStatus.WAITING_RESPONSE, "Booking starts waiting");
  const id = created.data.order.id as string;
  if (status !== OrderStatus.WAITING_RESPONSE) {
    equal((await request("POST", `/orders/${id}/accept`, assigned.token)).status, 200, "Assigned worker accepts via HTTP");
  }
  const sequence = [OrderStatus.ON_THE_WAY, OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED] as const;
  const lastStep = sequence.indexOf(status as typeof sequence[number]);
  for (let index = 0; index <= lastStep; index += 1) {
    equal((await request("POST", `/orders/${id}/status`, assigned.token, { status: sequence[index] })).status, 200,
      "Assigned worker drives ordered HTTP lifecycle");
  }
  equal((await prisma.order.findUniqueOrThrow({ where: { id } })).status, status, "Lifecycle target persisted");
  equal(await prisma.pushToken.count(), 0, "No push device exists in isolated fixtures");
  return { id, publicCode: created.data.order.publicCode, owner, worker: { id: worker.id, actor: assigned }, status };
}
async function snapshot(order: Fixture) {
  const [record, events, notifications, availability, counts, audits] = await Promise.all([
    prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
    prisma.orderEvent.findMany({ where: { orderId: order.id }, orderBy: { id: "asc" } }),
    prisma.notification.findMany({ where: { orderId: order.id }, orderBy: { id: "asc" } }),
    prisma.workerAvailability.findUniqueOrThrow({ where: { workerId: order.worker.id } }),
    prisma.workerProfile.findMany({ where: { userId: { in: [order.owner.id, order.worker.actor.id] } },
      select: { id: true, completedOrdersCount: true }, orderBy: { id: "asc" } }),
    prisma.adminAuditLog.findMany({ where: { targetId: order.id }, orderBy: { id: "asc" } })
  ]);
  return { record, events, notifications, availability, counts, audits };
}
const cancel = (order: Fixture, token: string | undefined, inputReason: unknown = reason, prefix = "/orders") =>
  request("POST", `${prefix}/${order.id}/cancel`, token, { reason: inputReason });

async function assertCancellation(
  order: Fixture, before: Awaited<ReturnType<typeof snapshot>>, actor: OrderEventActorType,
  actorId: string | null, admin?: AdminIdentity, wrongProviderRecipient = false,
  notificationActorOverride?: OrderEventActorType
) {
  const after = await snapshot(order);
  equal(after.record.status, OrderStatus.CANCELLED, "Cancellation status persisted");
  equal(after.record.cancelReason, reason, "Cancellation reason persisted exactly");
  equal(after.record.clientId, order.owner.id, "Client ownership unchanged");
  equal(after.record.workerId, order.worker.id, "Assigned worker unchanged");
  equal(after.availability.status, WorkerAvailabilityStatus.AVAILABLE, "Worker becomes available");
  equal(after.availability.activeOrderId, null, "Worker active reservation released");
  equal(after.availability.lockedUntil, null, "Worker deadline lock released");
  equal(after.counts, before.counts, "Cancellation must not increment completion counts for either profile");
  const cancellationEvents = after.events.filter((event) => event.eventType === OrderEventType.ORDER_CANCELLED);
  equal(cancellationEvents.length, 1, "Exactly one persisted cancellation event");
  equal(after.events.filter((event) => event.eventType !== OrderEventType.ORDER_CANCELLED), before.events, "Prior lifecycle events preserved");
  const event = cancellationEvents[0];
  equal(event.actorType, actor, "Persisted event actor uses actual order capability");
  equal(event.actorId, actorId, "Persisted event retains correct User FK identity");
  equal(event.fromStatus, order.status, "Event retains source lifecycle state");
  equal(event.toStatus, OrderStatus.CANCELLED, "Event destination cancelled");
  equal(event.message, reason, "Event reason exact");
  equal(event.metadata, admin ? {
    adminActorType: admin.actorType, adminActorId: admin.id, adminUsername: admin.username
  } : null, "Existing event identity metadata preserved");
  const notificationActor = notificationActorOverride || (wrongProviderRecipient ? OrderEventActorType.WORKER : actor);
  const recipients = notificationActor === OrderEventActorType.CLIENT ? [order.worker.actor.id]
    : notificationActor === OrderEventActorType.WORKER ? [order.owner.id] : [order.owner.id, order.worker.actor.id];
  const notices = after.notifications.filter((notice) => notice.type === "ORDER_CANCELLED");
  equal(notices.map((notice) => notice.userId).sort(), recipients.sort(), "Cancellation recipients exactly match the other order participant(s)");
  equal(after.notifications.filter((notice) => notice.type !== "ORDER_CANCELLED"), before.notifications, "Prior notification records preserved");
  for (const notice of notices) {
    equal(notice.orderId, order.id, "Notification order FK");
    equal(notice.dedupeKey, `order:${order.id}:ORDER_CANCELLED:${notice.userId}`, "Recipient-specific cancellation dedupe key");
    equal(notice.status, NotificationStatus.PENDING, "No-device durable notification remains pending");
    equal(notice.sentAt, null, "No external push send claimed");
    equal(notice.readAt, null, "New notice starts unread");
    equal(notice.payload, {
      orderId: order.id, publicCode: order.publicCode, actor: notificationActor, reason,
      notificationType: "ORDER_CANCELLED", title: "Buyurtma bekor qilindi",
      body: notificationActor === OrderEventActorType.WORKER
        ? `${serviceType} buyurtmasi usta tomonidan bekor qilindi. Sabab: ${reason}`
        : `${serviceType} buyurtmasi bekor qilindi.`
    }, "Exact cancellation payload actor/reason/order/public code/type/copy");
  }
  if (admin) {
    equal(after.audits.length, 1, "Admin endpoint retains one audit");
    equal(after.audits[0].action, "order.cancelled", "Admin audit action");
    equal(after.audits[0].actorType, admin.actorType, "Admin audit actor type");
    equal(after.audits[0].actorAdminId, admin.actorType === "ADMIN_ACCOUNT" ? admin.id : null, "Admin audit FK identity");
  } else equal(after.audits, before.audits, "Mobile cancellation does not introduce admin audits");
  for (const participant of [order.owner, order.worker.actor]) {
    const listed = await request("GET", "/notifications", participant.token);
    equal(listed.status, 200, "Participant notification list accessible");
    const listedCancellations = listed.data.notifications.filter((notice: any) => notice.orderId === order.id && notice.type === "ORDER_CANCELLED");
    equal(listedCancellations.map((notice: any) => notice.id).sort(), notices.filter((notice) => notice.userId === participant.id).map((notice) => notice.id).sort(),
      "Notification API lists only the recipient's persisted cancellation");
  }
  return notices;
}

async function main() {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return tx.$queryRaw<Array<{ database: string; port: number; runId: string }>>`
      SELECT current_database() AS database, current_setting('port')::int AS port, id AS "runId" FROM nearfix_test_isolation.run`;
  });
  equal(rows.length, 1, "One owned isolation marker required");
  equal(rows[0], { database: target.database, port: target.port, runId: process.env.F21_TEST_RUN_ID }, "Live database identity matches granted disposable target");
  console.log("[F4] Owned disposable PostgreSQL identity verified; loopback HTTP only; no push devices/providers");
  const providerClient = await mobile(UserRole.PROVIDER, "provider acting as client");
  await workerFor(providerClient);
  const ordinaryClient = await mobile(UserRole.CLIENT, "ordinary client");
  const outsiderClient = await mobile(UserRole.CLIENT, "outsider client");
  const outsiderProvider = await mobile(UserRole.PROVIDER, "outsider provider");
  await workerFor(outsiderProvider);
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server!.once("listening", resolve); server!.once("error", reject); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  for (const status of activeStates) {
    await test(`provider-as-client cancellation ${status}: real booking/lifecycle, event, recipient and availability`, async () => {
      const order = await fixture(providerClient, status);
      const before = await snapshot(order);
      const result = await cancel(order, providerClient.token);
      equal(result.status, 200, "Provider order owner can cancel over existing mobile HTTP endpoint");
      equal(result.data.order.status, OrderStatus.CANCELLED, "HTTP response reports cancellation");
      await assertCancellation(order, before, OrderEventActorType.CLIENT, providerClient.id, undefined, reproduce);
      if (reproduce) {
        confirmedDefects += 1;
        console.log(`[F4] REPRODUCE ${status}: HTTP=200; contract=FAIL; eventActor=CLIENT; notificationActor=WORKER; assignedWorkerRecipient=false; actingClientSelfRecipient=true; identifiers=suppressed`);
      }
    });
  }
  if (reproduce) {
    equal(confirmedDefects, 4, "All four known wrong-recipient states reproduced");
    return;
  }

  for (const status of activeStates) {
    await test(`ordinary CLIENT cancellation ${status}: assigned worker receives CLIENT payload`, async () => {
      const order = await fixture(ordinaryClient, status);
      const before = await snapshot(order);
      equal((await cancel(order, ordinaryClient.token)).status, 200, "Ordinary owner cancels");
      await assertCancellation(order, before, OrderEventActorType.CLIENT, ordinaryClient.id);
    });
    await test(`assigned WORKER cancellation ${status}: provider client receives WORKER payload`, async () => {
      const order = await fixture(providerClient, status);
      const before = await snapshot(order);
      equal((await cancel(order, order.worker.actor.token)).status, 200, "Assigned approved worker cancels");
      await assertCancellation(order, before, OrderEventActorType.WORKER, order.worker.actor.id);
    });
  }

  for (const [label, actor] of [["outsider CLIENT", outsiderClient], ["outsider PROVIDER", outsiderProvider]] as const) {
    await test(`${label}: 403 without order/event/notification/availability/count/audit mutation`, async () => {
      const order = await fixture(providerClient, OrderStatus.ACCEPTED);
      const before = await snapshot(order);
      const result = await cancel(order, actor.token);
      equal([result.status, result.data.code], [403, "ORDER_NOT_ASSIGNED"], "Outsider denied");
      equal(await snapshot(order), before, "Denied request leaves all relevant persisted state unchanged");
    });
  }
  await test("suspended assigned worker: 403 and no persisted side effects", async () => {
    const order = await fixture(providerClient, OrderStatus.IN_PROGRESS);
    await prisma.workerProfile.update({ where: { id: order.worker.id }, data: { status: WorkerProfileStatus.SUSPENDED } });
    const before = await snapshot(order);
    equal((await cancel(order, order.worker.actor.token)).status, 403, "Suspended worker cannot cancel");
    equal(await snapshot(order), before, "Suspended denial is nonmutating");
  });
  await test("provider owner's suspended own worker profile does not remove CLIENT ownership", async () => {
    const order = await fixture(providerClient, OrderStatus.ACCEPTED);
    await prisma.workerProfile.update({ where: { userId: providerClient.id }, data: { status: WorkerProfileStatus.SUSPENDED } });
    try {
      const before = await snapshot(order);
      equal((await cancel(order, providerClient.token)).status, 200, "Provider owner retains client capability");
      await assertCancellation(order, before, OrderEventActorType.CLIENT, providerClient.id);
    } finally {
      await prisma.workerProfile.update({ where: { userId: providerClient.id }, data: { status: WorkerProfileStatus.APPROVED } });
    }
  });
  await test("anonymous and tampered sessions: 401 without mutations", async () => {
    const order = await fixture(providerClient, OrderStatus.WAITING_RESPONSE);
    const before = await snapshot(order);
    for (const token of [undefined, "fixture-invalid-token"]) equal((await cancel(order, token)).status, 401, "Invalid authentication denied");
    equal(await snapshot(order), before, "Authentication denial is nonmutating");
  });
  await test("seven invalid reasons: 400 and no persisted changes", async () => {
    const order = await fixture(providerClient, OrderStatus.ON_THE_WAY);
    const before = await snapshot(order);
    for (const invalid of [undefined, null, 7, "", "  ", "ab", "x".repeat(241)]) {
      const result = await request("POST", `/orders/${order.id}/cancel`, providerClient.token, { reason: invalid });
      equal([result.status, result.data.code], [400, "VALIDATION_ERROR"], "Invalid reason rejected before service effects");
      equal(await snapshot(order), before, "Invalid reason leaves transaction state untouched");
    }
  });
  await test("missing order: 404 without events, recipients or audits", async () => {
    const missing = randomUUID();
    const result = await request("POST", `/orders/${missing}/cancel`, providerClient.token, { reason });
    equal([result.status, result.data.code], [404, "ORDER_NOT_FOUND"], "Missing order contract");
    equal(await prisma.orderEvent.count({ where: { orderId: missing } }), 0, "No orphan event");
    equal(await prisma.notification.count({ where: { orderId: missing } }), 0, "No orphan notification");
    equal(await prisma.adminAuditLog.count({ where: { targetId: missing } }), 0, "No missing-order audit");
  });
  await test("COMPLETED terminal cancellation: 409 without changes or completion-count rollback", async () => {
    const order = await fixture(providerClient, OrderStatus.COMPLETED);
    const before = await snapshot(order);
    equal(before.counts.find((profile) => profile.id === order.worker.id)?.completedOrdersCount, 8, "HTTP completion increments assigned count once");
    equal((await cancel(order, providerClient.token)).status, 409, "Completed state is terminal");
    equal(await snapshot(order), before, "Terminal cancellation is nonmutating");
  });
  await test("repeated cancellation: 409 without extra events or recipient dedupe records", async () => {
    const order = await fixture(providerClient, OrderStatus.ACCEPTED);
    const initial = await snapshot(order);
    equal((await cancel(order, providerClient.token)).status, 200, "Initial cancellation succeeds");
    await assertCancellation(order, initial, OrderEventActorType.CLIENT, providerClient.id);
    const before = await snapshot(order);
    equal((await cancel(order, providerClient.token)).status, 409, "Cancelled state is terminal");
    equal(await snapshot(order), before, "Repeated cancellation adds no side effects");
  });
  await test("concurrent provider-client cancellations: one success, one conflict, one recipient/event", async () => {
    const order = await fixture(providerClient, OrderStatus.IN_PROGRESS);
    const before = await snapshot(order);
    const outcomes = await Promise.all([cancel(order, providerClient.token), cancel(order, providerClient.token)]);
    equal(outcomes.map((result) => result.status).sort(), [200, 409], "Exactly one concurrent transition wins");
    await assertCancellation(order, before, OrderEventActorType.CLIENT, providerClient.id);
  });
  await test("concurrent owner/worker cancellation: winner alone determines actor and opposite recipient", async () => {
    const order = await fixture(providerClient, OrderStatus.ON_THE_WAY);
    const before = await snapshot(order);
    const outcomes = await Promise.all([cancel(order, providerClient.token), cancel(order, order.worker.actor.token)]);
    equal(outcomes.map((result) => result.status).sort(), [200, 409], "One capability wins cancellation atomically");
    const ownerWon = outcomes[0].status === 200;
    await assertCancellation(order, before, ownerWon ? OrderEventActorType.CLIENT : OrderEventActorType.WORKER,
      ownerWon ? providerClient.id : order.worker.actor.id);
  });
  await test("availability-release failure rolls back order/event and emits no cancellation notification", async () => {
    const order = await fixture(providerClient, OrderStatus.ACCEPTED);
    await prisma.workerAvailability.update({ where: { workerId: order.worker.id }, data: { activeOrderId: null } });
    const before = await snapshot(order);
    const result = await cancel(order, providerClient.token);
    equal([result.status, result.data.code], [409, "WORKER_RELEASE_FAILED"], "Availability failure reported");
    equal(await snapshot(order), before, "Failed transaction leaves order, event, notification and count unchanged");
  });
  await test("cancellation notification read isolation: nonrecipient 404, assigned recipient 200", async () => {
    const order = await fixture(providerClient, OrderStatus.WAITING_RESPONSE);
    const before = await snapshot(order);
    equal((await cancel(order, providerClient.token)).status, 200, "Owner cancellation succeeds");
    const [notice] = await assertCancellation(order, before, OrderEventActorType.CLIENT, providerClient.id);
    equal((await request("PATCH", `/notifications/${notice.id}/read`, providerClient.token)).status, 404, "Acting client cannot read-mark worker's notice");
    equal((await prisma.notification.findUniqueOrThrow({ where: { id: notice.id } })).readAt, null, "Unauthorized read does not mutate notice");
    equal((await request("PATCH", `/notifications/${notice.id}/read`, order.worker.actor.token)).status, 200, "Actual recipient marks notice read");
    const readNotice = await prisma.notification.findUniqueOrThrow({ where: { id: notice.id } });
    check(readNotice.readAt instanceof Date, "Recipient read timestamp persisted");
    equal(readNotice.status, NotificationStatus.PENDING, "Read status does not invent push delivery");
  });

  const legacy = await mobile(UserRole.ADMIN, "legacy admin");
  await test("legacy User ADMIN cancellation retains ADMIN User actor and both recipients", async () => {
    const order = await fixture(providerClient, OrderStatus.ACCEPTED);
    const before = await snapshot(order);
    equal((await cancel(order, legacy.token)).status, 200, "Legacy admin cancellation succeeds");
    await assertCancellation(order, before, OrderEventActorType.ADMIN, legacy.id);
  });
  await test("legacy ADMIN who owns a historical client order retains ADMIN notification semantics", async () => {
    const order = await fixture(ordinaryClient, OrderStatus.ACCEPTED);
    // Historical admin ownership cannot be produced by today's client-only
    // booking endpoint. Only this explicit legacy fixture changes ownership.
    await prisma.order.update({ where: { id: order.id }, data: { clientId: legacy.id } });
    order.owner = legacy;
    const before = await snapshot(order);
    equal((await cancel(order, legacy.token)).status, 200, "Historical admin owner cancels through existing guarded mobile route");
    await assertCancellation(order, before, OrderEventActorType.CLIENT, legacy.id, undefined, false, OrderEventActorType.ADMIN);
  });
  async function loginAdmin(username: string, password: string): Promise<AdminIdentity> {
    const result = await request("POST", "/admin/auth/login", undefined, { username, password });
    equal(result.status, 200, "Admin fixture authenticates via HTTP");
    return { token: result.data.token, actorType: result.data.user.actorType, id: result.data.user.id, username: result.data.user.username };
  }
  const envAdmin = await loginAdmin(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
  const adminPassword = randomUUID();
  const dbAccount = await prisma.adminAccount.create({ data: {
    username: `f4-cancel-admin-${randomUUID()}`, passwordHash: await hashPassword(adminPassword),
    role: AdminAccountRole.SUPER_ADMIN, status: AdminAccountStatus.ACTIVE, mustChangePassword: false
  } });
  const dbAdmin = await loginAdmin(dbAccount.username, adminPassword);
  for (const [label, actor] of [["env admin", envAdmin], ["DB admin", dbAdmin]] as const) {
    await test(`${label} guarded cancellation retains ADMIN metadata/audit and both recipients`, async () => {
      const order = await fixture(providerClient, OrderStatus.IN_PROGRESS);
      const before = await snapshot(order);
      equal((await cancel(order, actor.token, reason, "/admin/orders")).status, 200, "Existing guarded admin cancellation succeeds");
      await assertCancellation(order, before, OrderEventActorType.ADMIN, null, actor);
    });
  }
  equal(await prisma.pushToken.count(), 0, "No devices registered by any case");
}

main().then(() => console.log(`[F4] provider-client cancellation ${reproduce ? "REPRODUCE" : "HTTP regression"}: ${passed} cases; ${httpRequests} HTTP requests; confirmedBeforeContractFailures=${confirmedDefects}; harness=PASS`))
  .catch((error: unknown) => {
    const description = error instanceof CaseFailure ? error.message : "unexpected fixture/HTTP failure; details suppressed";
    console.log(`[F4] FAIL ${phase}: ${description}`);
    process.exitCode = 1;
  }).finally(async () => {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  });
