import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import vm from "node:vm";
import {
  AdminAccountRole,
  AdminAccountStatus,
  OrderEventActorType,
  OrderEventType,
  OrderStatus,
  UserRole,
  WorkerAvailabilityStatus,
  WorkerProfileStatus
} from "@prisma/client";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";

const target = assertLocalDatabaseTarget();
if (
  target.nodeEnv !== "test" ||
  target.database !== process.env.F1_DISPOSABLE_DATABASE ||
  !/^nearfix_chat_test_[a-f0-9]{32}$/.test(target.database)
) throw new Error("Disposable DB required");

// Application imports happen only after the preload's parent grant and DB guard.
// The preload also makes fetch loopback-only; no SMS/push/storage transport runs.
const { env } = await import("../src/config/env.js");
const { prisma } = await import("../src/db/prisma.js");
const { createApp } = await import("../src/http/app.js");
const { hashPassword } = await import("../src/modules/auth/password.js");
const { createAccessToken } = await import("../src/modules/auth/session.js");

type AdminActor = {
  token: string;
  actorType: "ENV_ADMIN" | "ADMIN_ACCOUNT";
  id: string;
  username: string;
};

let phase = "fixture setup";
let passed = 0;
async function test(name: string, run: () => Promise<void>) {
  phase = name;
  await run();
  passed += 1;
  console.log(`[F4] PASS ${name}`);
}

async function main() {
  const runId = randomUUID();
  const password = randomUUID();
  const passwordHash = await hashPassword(password);
  const client = await prisma.user.create({ data: { phone: "+998000001401", role: UserRole.CLIENT, name: "F4 client" } });
  const provider = await prisma.user.create({ data: { phone: "+998000001402", role: UserRole.PROVIDER, name: "F4 provider" } });
  const outsider = await prisma.user.create({ data: { phone: "+998000001403", role: UserRole.CLIENT, name: "F4 outsider" } });
  const worker = await prisma.workerProfile.create({
    data: {
      userId: provider.id,
      status: WorkerProfileStatus.APPROVED,
      profession: "F4 service",
      availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } }
    }
  });
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function request(method: string, path: string, token?: string, body?: unknown) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, data: await response.json() };
  }
  const detail = (id: string, token?: string) => request("GET", `/admin/orders/${id}`, token);
  const cancel = (id: string, token?: string, reason: unknown = "F4 admin cancellation") =>
    request("POST", `/admin/orders/${id}/cancel`, token, { reason });

  async function login(username: string, loginPassword: string): Promise<AdminActor> {
    const result = await request("POST", "/admin/auth/login", undefined, { username, password: loginPassword });
    assert.equal(result.status, 200);
    assert.equal(typeof result.data.token, "string");
    return {
      token: result.data.token,
      actorType: result.data.user.actorType,
      id: result.data.user.id,
      username: result.data.user.username
    };
  }
  async function admin(label: string, permissions: string[], role: AdminAccountRole = AdminAccountRole.ADMIN) {
    const account = await prisma.adminAccount.create({
      data: {
        username: `f4-${label}-${runId}`,
        passwordHash,
        role,
        status: AdminAccountStatus.ACTIVE,
        mustChangePassword: false,
        permissions: { create: permissions.map((permission) => ({ permission })) }
      }
    });
    return login(account.username, password);
  }
  async function mobile(user: { id: string; sessionVersion: number }) {
    const session = await prisma.session.create({
      data: { userId: user.id, refreshToken: randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) }
    });
    return createAccessToken({ userId: user.id, sessionId: session.id, sessionVersion: user.sessionVersion });
  }
  async function order(status: OrderStatus = OrderStatus.WAITING_RESPONSE) {
    const fixture = await prisma.order.create({
      data: {
        publicCode: `F4-${randomUUID()}`,
        clientId: client.id,
        workerId: worker.id,
        cityId: "tashkent",
        serviceType: "F4 service",
        problemTitle: "F4 isolated order",
        status,
        priceEstimate: 100_000,
        locationAddressText: "F4 synthetic address",
        locationLat: 41.31,
        locationLng: 69.24,
        responseDeadlineAt: new Date(Date.now() + 3_600_000)
      }
    });
    const terminal = status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED;
    await prisma.workerAvailability.update({
      where: { workerId: worker.id },
      data: {
        status: terminal || status === OrderStatus.WAITING_RESPONSE ? WorkerAvailabilityStatus.AVAILABLE : WorkerAvailabilityStatus.BUSY,
        activeOrderId: terminal ? null : fixture.id,
        lockedUntil: terminal ? null : new Date(Date.now() + 3_600_000)
      }
    });
    return fixture.id;
  }
  async function snapshot(id: string) {
    const [record, events, notifications, audits, availability] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id }, select: { status: true, cancelReason: true, updatedAt: true } }),
      prisma.orderEvent.findMany({ where: { orderId: id }, orderBy: { id: "asc" } }),
      prisma.notification.findMany({ where: { orderId: id }, orderBy: { id: "asc" } }),
      prisma.adminAuditLog.findMany({ where: { targetId: id }, orderBy: { id: "asc" } }),
      prisma.workerAvailability.findUniqueOrThrow({ where: { workerId: worker.id } })
    ]);
    return { record, events, notifications, audits, availability };
  }
  async function denied(id: string, token: string | undefined, detailStatus: number, cancelStatus: number) {
    const before = await snapshot(id);
    assert.equal((await detail(id, token)).status, detailStatus);
    assert.equal((await cancel(id, token)).status, cancelStatus);
    assert.deepEqual(await snapshot(id), before, "Denied requests must not mutate order, event, notification, audit or availability");
  }
  async function assertAdminCancellation(id: string, actor: AdminActor, fromStatus: OrderStatus = OrderStatus.WAITING_RESPONSE, reason = "F4 admin cancellation") {
    const current = await snapshot(id);
    assert.equal(current.record.status, OrderStatus.CANCELLED);
    assert.equal(current.record.cancelReason, reason);
    assert.equal(current.availability.status, WorkerAvailabilityStatus.AVAILABLE);
    assert.equal(current.availability.activeOrderId, null);
    assert.equal(current.availability.lockedUntil, null);
    assert.equal(current.events.length, 1);
    const events = current.events.filter((event) => event.eventType === OrderEventType.ORDER_CANCELLED);
    assert.equal(events.length, 1);
    assert.equal(events[0].actorType, OrderEventActorType.ADMIN);
    assert.equal(events[0].actorId, null, "AdminAccount/env identity must not be written to a User FK");
    assert.equal(events[0].fromStatus, fromStatus);
    assert.equal(events[0].toStatus, OrderStatus.CANCELLED);
    assert.equal(events[0].message, reason);
    assert.deepEqual(events[0].metadata, {
      adminActorType: actor.actorType,
      adminActorId: actor.id,
      adminUsername: actor.username
    });
    const audits = current.audits.filter((audit) => audit.action === "order.cancelled");
    assert.equal(audits.length, 1);
    assert.equal(audits[0].actorType, actor.actorType);
    assert.equal(audits[0].actorAdminId, actor.actorType === "ADMIN_ACCOUNT" ? actor.id : null);
    assert.equal(audits[0].targetType, "Order");
    assert.equal(audits[0].targetId, id);
    assert.equal((audits[0].metadata as Record<string, unknown>).actorUsername, actor.username);
    const notices = current.notifications.filter((notification) => notification.type === "ORDER_CANCELLED");
    assert.equal(notices.length, 2);
    assert.deepEqual(notices.map((notification) => notification.userId).sort(), [client.id, provider.id].sort());
    for (const notice of notices) {
      assert.equal(notice.orderId, id);
      const payload = notice.payload as Record<string, unknown>;
      assert.equal(payload.actor, OrderEventActorType.ADMIN);
      assert.equal(payload.reason, reason);
    }
  }

  try {
    const envActor = await login(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
    const superActor = await admin("super", [], AdminAccountRole.SUPER_ADMIN);
    const manager = await admin("manager", ["orders.read", "orders.manage"]);
    const reader = await admin("reader", ["orders.read"]);
    const manageOnly = await admin("manage-only", ["orders.manage"]);
    const noPermission = await admin("no-permission", []);
    const disabled = await admin("disabled", ["orders.read", "orders.manage"]);
    const stale = await admin("stale", ["orders.read", "orders.manage"]);
    await prisma.adminAccount.update({ where: { id: disabled.id }, data: { status: AdminAccountStatus.DISABLED } });
    await prisma.adminAccount.update({ where: { id: stale.id }, data: { sessionVersion: { increment: 1 } } });
    const clientToken = await mobile(client);
    const providerToken = await mobile(provider);
    const outsiderToken = await mobile(outsider);

    for (const [label, actor, status] of [
      ["env superadmin waiting", envActor, OrderStatus.WAITING_RESPONSE],
      ["DB superadmin accepted", superActor, OrderStatus.ACCEPTED],
      ["DB manager on-the-way", manager, OrderStatus.ON_THE_WAY],
      ["DB manager in-progress", manager, OrderStatus.IN_PROGRESS]
    ] as const) {
      await test(`${label}: detail + cancel; event/audit identity, recipients and availability`, async () => {
        const id = await order(status);
        const read = await detail(id, actor.token);
        assert.equal(read.status, 200);
        assert.equal(read.data.order.id, id);
        assert.equal(read.data.order.status, status);
        assert.equal(read.data.order.client.id, client.id);
        assert.equal(read.data.order.worker.user.id, provider.id);
        assert.equal(read.data.order.location.addressText, "F4 synthetic address");
        assert.ok(Array.isArray(read.data.order.events));
        assert.ok(Array.isArray(read.data.order.payments));
        assert.equal(Object.hasOwn(read.data.order.client, "passwordHash"), false);
        assert.equal(Object.hasOwn(read.data.order.worker.user, "passwordHash"), false);
        const result = await cancel(id, actor.token);
        assert.equal(result.status, 200);
        assert.equal(result.data.order.status, OrderStatus.CANCELLED);
        await assertAdminCancellation(id, actor, status);
      });
    }

    const protectedId = await order();
    for (const [label, token, readStatus, cancelStatus] of [
      ["DB read-only", reader.token, 200, 403],
      ["DB no permission", noPermission.token, 403, 403],
      ["anonymous", undefined, 401, 401],
      ["mobile client owner", clientToken, 401, 401],
      ["mobile assigned provider", providerToken, 401, 401],
      ["mobile outsider", outsiderToken, 401, 401],
      ["disabled DB account", disabled.token, 403, 403],
      ["stale DB session", stale.token, 401, 401],
      ["tampered DB token", `${manager.token.slice(0, -1)}${manager.token.endsWith("a") ? "b" : "a"}`, 401, 401]
    ] as const) {
      await test(`${label}: authorization and no mutation`, () => denied(protectedId, token, readStatus, cancelStatus));
    }

    await test("DB manage-only: read forbidden, cancellation permitted independently", async () => {
      const id = await order();
      const before = await snapshot(id);
      assert.equal((await detail(id, manageOnly.token)).status, 403);
      assert.deepEqual(await snapshot(id), before);
      assert.equal((await cancel(id, manageOnly.token)).status, 200);
      await assertAdminCancellation(id, manageOnly);
    });

    await test("invalid cancellation reasons: 400 and no side effects", async () => {
      const id = await order();
      const before = await snapshot(id);
      for (const reason of [undefined, null, 7, "", "  ", "ab", "x".repeat(241)]) {
        const result = await request("POST", `/admin/orders/${id}/cancel`, manager.token, { reason });
        assert.equal(result.status, 400);
        assert.equal(result.data.code, "VALIDATION_ERROR");
        assert.deepEqual(await snapshot(id), before);
      }
    });

    await test("missing order: detail and cancellation return 404", async () => {
      const missing = `f4-missing-${randomUUID()}`;
      assert.equal((await detail(missing, manager.token)).status, 404);
      assert.equal((await cancel(missing, manager.token)).status, 404);
      assert.equal(await prisma.adminAuditLog.count({ where: { targetId: missing } }), 0);
    });

    for (const status of [OrderStatus.COMPLETED, OrderStatus.CANCELLED]) {
      await test(`terminal ${status}: cancellation 409 and no mutation`, async () => {
        const id = await order(status);
        const before = await snapshot(id);
        assert.equal((await detail(id, manager.token)).status, 200);
        assert.equal((await cancel(id, manager.token)).status, 409);
        assert.deepEqual(await snapshot(id), before);
      });
    }

    await test("concurrent admin cancellation: one 200, one 409, one event and audit", async () => {
      const id = await order(OrderStatus.ACCEPTED);
      const results = await Promise.all([cancel(id, manager.token), cancel(id, manager.token)]);
      assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
      await assertAdminCancellation(id, manager, OrderStatus.ACCEPTED);
    });

    await test("actual frontend modules in VM: detail and cancel use real admin HTTP; not browser UI", async () => {
      const adminRequire = createRequire(new URL("../../admin-web/package.json", import.meta.url));
      const ts = adminRequire("typescript");
      function compile(relativePath: string) {
        return ts.transpileModule(readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
        }).outputText;
      }
      const calls: Array<{ path: string; method: string }> = [];
      const frontendFetch: typeof fetch = async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        assert.equal(url.origin, baseUrl, "Frontend harness must stay on the owned loopback HTTP server");
        calls.push({ path: url.pathname, method: init?.method || "GET" });
        return fetch(input, init);
      };
      const apiModule = { exports: {} as Record<string, unknown> };
      vm.runInNewContext(compile("../../admin-web/services/api-client.ts"), {
        module: apiModule,
        exports: apiModule.exports,
        URL,
        process: { env: { NODE_ENV: "development", NEXT_PUBLIC_API_URL: baseUrl } },
        fetch: frontendFetch,
        window: { localStorage: { getItem: (key: string) => {
          assert.equal(key, "nearfix-admin-token");
          return manager.token;
        } } }
      });
      const ordersModule = { exports: {} as {
        getOrderDetail: (id: string) => Promise<{ id: string; status: string }>;
        runOrderAction: (id: string, action: string) => Promise<void>;
      } };
      vm.runInNewContext(compile("../../admin-web/modules/orders/services/orders-service.ts"), {
        module: ordersModule,
        exports: ordersModule.exports,
        require: (name: string) => {
          assert.equal(name, "@/services/api-client");
          return apiModule.exports;
        }
      });
      const id = await order();
      const read = await ordersModule.exports.getOrderDetail(id);
      assert.equal(read.id, id);
      assert.equal(read.status, OrderStatus.WAITING_RESPONSE);
      await ordersModule.exports.runOrderAction(id, "cancel");
      assert.deepEqual(calls, [
        { path: `/admin/orders/${id}`, method: "GET" },
        { path: `/admin/orders/${id}/cancel`, method: "POST" }
      ]);
      await assertAdminCancellation(id, manager, OrderStatus.WAITING_RESPONSE, "Admin tomonidan bekor qilindi");
    });

    await test("legacy mobile order detail: owner and assigned worker allowed, outsider denied", async () => {
      const id = await order();
      const before = await snapshot(id);
      for (const token of [clientToken, providerToken]) {
        assert.equal((await request("GET", `/orders/${id}`, token)).status, 200);
      }
      assert.equal((await request("GET", `/orders/${id}`, outsiderToken)).status, 403);
      assert.equal((await request("POST", `/orders/${id}/cancel`, outsiderToken, { reason: "F4 outsider attempt" })).status, 403);
      assert.deepEqual(await snapshot(id), before);
    });

    for (const [label, token, actorType, actorId, recipientId] of [
      ["client", clientToken, OrderEventActorType.CLIENT, client.id, provider.id],
      ["assigned provider", providerToken, OrderEventActorType.WORKER, provider.id, client.id]
    ] as const) {
      await test(`legacy mobile ${label}: cancellation keeps User actor and counterparty recipient`, async () => {
        const id = await order(OrderStatus.ACCEPTED);
        assert.equal((await request("POST", `/orders/${id}/cancel`, token, { reason: "F4 mobile cancellation" })).status, 200);
        const current = await snapshot(id);
        assert.equal(current.record.status, OrderStatus.CANCELLED);
        assert.equal(current.events.length, 1);
        assert.equal(current.events[0].actorType, actorType);
        assert.equal(current.events[0].actorId, actorId);
        assert.equal(current.events[0].metadata, null);
        assert.equal(current.audits.length, 0);
        assert.equal(current.notifications.length, 1);
        assert.equal(current.notifications[0].userId, recipientId);
        assert.equal(current.availability.activeOrderId, null);
      });
    }

    await test("legacy mobile admin permissions and User FK identity remain intact", async () => {
      const legacyAdmin = await prisma.user.create({
        data: { phone: "+998000001404", role: UserRole.ADMIN, adminPermissions: { create: [{ permission: "orders.read" }, { permission: "orders.manage" }] } }
      });
      const legacyReader = await prisma.user.create({
        data: { phone: "+998000001405", role: UserRole.ADMIN, adminPermissions: { create: [{ permission: "orders.read" }] } }
      });
      const legacyToken = await mobile(legacyAdmin);
      const legacyReaderToken = await mobile(legacyReader);
      const id = await order();
      const before = await snapshot(id);
      assert.equal((await request("GET", `/orders/${id}`, legacyReaderToken)).status, 200);
      assert.equal((await request("POST", `/orders/${id}/cancel`, legacyReaderToken, { reason: "F4 legacy denied" })).status, 403);
      assert.deepEqual(await snapshot(id), before);
      assert.equal((await request("POST", `/orders/${id}/cancel`, legacyToken, { reason: "F4 legacy admin cancellation" })).status, 200);
      const current = await snapshot(id);
      assert.equal(current.events.length, 1);
      assert.equal(current.events[0].actorType, OrderEventActorType.ADMIN);
      assert.equal(current.events[0].actorId, legacyAdmin.id);
      assert.equal(current.events[0].metadata, null);
      assert.equal(current.audits.length, 0);
    });

    await test("old mobile path keeps DB admin token 401 and env superadmin ownership 403", async () => {
      const id = await order();
      const before = await snapshot(id);
      for (const [token, expected] of [[manager.token, 401], [superActor.token, 401], [envActor.token, 403]] as const) {
        assert.equal((await request("GET", `/orders/${id}`, token)).status, expected);
        assert.equal((await request("POST", `/orders/${id}/cancel`, token, { reason: "F4 old route attempt" })).status, expected);
        assert.deepEqual(await snapshot(id), before);
      }
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main()
  .then(() => console.log(`[F4] admin-order HTTP tests passed (${passed} cases)`))
  .catch(() => { console.log(`[F4] FAIL ${phase}; values suppressed`); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
