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
if (target.nodeEnv !== "test" || target.database !== process.env.F1_DISPOSABLE_DATABASE ||
    !/^nearfix_chat_test_[a-f0-9]{32}$/.test(target.database)) throw new Error("Disposable DB required");

const reproduce = process.argv.includes("--reproduce") || process.env.SPRINT2_REPRODUCE === "1";
const { env } = await import("../src/config/env.js");
const { prisma } = await import("../src/db/prisma.js");
const { createApp } = await import("../src/http/app.js");
const { hashPassword } = await import("../src/modules/auth/password.js");
const { createAccessToken } = await import("../src/modules/auth/session.js");

type AdminActor = { token: string; actorType: "ENV_ADMIN" | "ADMIN_ACCOUNT"; id: string; username: string };
const lifecycle = [OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY, OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED] as const;
const eventTypes = {
  ACCEPTED: OrderEventType.WORKER_ACCEPTED,
  ON_THE_WAY: OrderEventType.WORKER_ON_THE_WAY,
  IN_PROGRESS: OrderEventType.WORK_STARTED,
  COMPLETED: OrderEventType.WORK_COMPLETED
};
const noticeTypes = {
  ACCEPTED: "ORDER_ACCEPTED",
  ON_THE_WAY: "ORDER_ON_THE_WAY",
  IN_PROGRESS: "ORDER_IN_PROGRESS",
  COMPLETED: "ORDER_COMPLETED"
};
type LifecycleStatus = typeof lifecycle[number];
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
  const client = await prisma.user.create({ data: { phone: "+998000001501", role: UserRole.CLIENT } });
  const provider = await prisma.user.create({ data: { phone: "+998000001502", role: UserRole.PROVIDER } });
  const outsider = await prisma.user.create({ data: { phone: "+998000001503", role: UserRole.CLIENT } });
  const foreignProvider = await prisma.user.create({ data: { phone: "+998000001504", role: UserRole.PROVIDER } });
  const worker = await prisma.workerProfile.create({ data: {
    userId: provider.id, status: WorkerProfileStatus.APPROVED, profession: "F4 action service",
    availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } }
  } });
  await prisma.workerProfile.create({ data: {
    userId: foreignProvider.id, status: WorkerProfileStatus.APPROVED, profession: "F4 foreign worker"
  } });
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function request(method: string, path: string, token?: string, body?: unknown) {
    const response = await fetch(baseUrl + path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, data: await response.json() };
  }
  async function login(username: string, loginPassword: string): Promise<AdminActor> {
    const result = await request("POST", "/admin/auth/login", undefined, { username, password: loginPassword });
    assert.equal(result.status, 200);
    return { token: result.data.token, actorType: result.data.user.actorType, id: result.data.user.id, username: result.data.user.username };
  }
  async function admin(label: string, permissions: string[], role: AdminAccountRole = AdminAccountRole.ADMIN) {
    const account = await prisma.adminAccount.create({ data: {
      username: `f4-actions-${label}-${runId}`, passwordHash, role, status: AdminAccountStatus.ACTIVE,
      mustChangePassword: false, permissions: { create: permissions.map((permission) => ({ permission })) }
    } });
    return login(account.username, password);
  }
  async function mobile(user: { id: string; sessionVersion: number }) {
    const session = await prisma.session.create({ data: {
      userId: user.id, refreshToken: randomUUID(), expiresAt: new Date(Date.now() + 86_400_000)
    } });
    return createAccessToken({ userId: user.id, sessionId: session.id, sessionVersion: user.sessionVersion });
  }
  async function order(status: OrderStatus = OrderStatus.WAITING_RESPONSE) {
    const record = await prisma.order.create({ data: {
      publicCode: `F4-actions-${randomUUID()}`, clientId: client.id, workerId: worker.id,
      cityId: "tashkent", serviceType: "F4 action service", problemTitle: "F4 isolated action order", status,
      priceEstimate: 120_000, responseDeadlineAt: new Date(Date.now() + 3_600_000),
      locationAddressText: "F4 action synthetic address", locationLat: 41.31, locationLng: 69.24
    } });
    const terminal = status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED;
    await prisma.workerAvailability.update({ where: { workerId: worker.id }, data: {
      status: terminal || status === OrderStatus.WAITING_RESPONSE ? WorkerAvailabilityStatus.AVAILABLE : WorkerAvailabilityStatus.BUSY,
      activeOrderId: terminal ? null : record.id, lockedUntil: null
    } });
    return record.id;
  }
  async function snapshot(id: string) {
    const [record, events, notices, audits, availability, profile] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id } }),
      prisma.orderEvent.findMany({ where: { orderId: id }, orderBy: { id: "asc" } }),
      prisma.notification.findMany({ where: { orderId: id }, orderBy: { id: "asc" } }),
      prisma.adminAuditLog.findMany({ where: { targetId: id }, orderBy: { id: "asc" } }),
      prisma.workerAvailability.findUniqueOrThrow({ where: { workerId: worker.id } }),
      prisma.workerProfile.findUniqueOrThrow({ where: { id: worker.id }, select: { completedOrdersCount: true } })
    ]);
    return { record, events, notices, audits, availability, profile };
  }
  const action = (id: string, token: string | undefined, status: LifecycleStatus, prefix = "/admin/orders") =>
    request("POST", status === OrderStatus.ACCEPTED ? `${prefix}/${id}/accept` : `${prefix}/${id}/status`, token,
      status === OrderStatus.ACCEPTED ? undefined : { status });

  function frontend(actor: AdminActor) {
    // Actual modules and real loopback HTTP; this is not browser/native UI proof.
    const adminRequire = createRequire(new URL("../../admin-web/package.json", import.meta.url));
    const ts = adminRequire("typescript");
    const compile = (path: string) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const calls: Array<{ path: string; method: string }> = [];
    const frontendFetch: typeof fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      assert.equal(url.origin, baseUrl);
      calls.push({ path: url.pathname, method: init?.method || "GET" });
      return fetch(input, init);
    };
    const api = { exports: {} as Record<string, unknown> };
    vm.runInNewContext(compile("../../admin-web/services/api-client.ts"), {
      module: api, exports: api.exports, URL,
      process: { env: { NODE_ENV: "development", NEXT_PUBLIC_API_URL: baseUrl } }, fetch: frontendFetch,
      window: { localStorage: { getItem: (key: string) => { assert.equal(key, "nearfix-admin-token"); return actor.token; } } }
    });
    const orders = { exports: {} as { runOrderAction: (id: string, name: string) => Promise<void> } };
    vm.runInNewContext(compile("../../admin-web/modules/orders/services/orders-service.ts"), {
      module: orders, exports: orders.exports,
      require: (name: string) => { assert.equal(name, "@/services/api-client"); return api.exports; }
    });
    return { calls, run: orders.exports.runOrderAction };
  }
  async function checkStep(id: string, fromStatus: OrderStatus, toStatus: LifecycleStatus, completedBefore: number, actor?: AdminActor, legacyUserId?: string) {
    const current = await snapshot(id);
    assert.equal(current.record.status, toStatus);
    const events = current.events.filter((event) => event.toStatus === toStatus);
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, eventTypes[toStatus]);
    assert.equal(events[0].fromStatus, fromStatus);
    assert.equal(events[0].actorType, actor || legacyUserId ? OrderEventActorType.ADMIN : OrderEventActorType.WORKER);
    assert.equal(events[0].actorId, actor ? null : legacyUserId || provider.id);
    if (actor) {
      assert.deepEqual(events[0].metadata, { adminActorType: actor.actorType, adminActorId: actor.id, adminUsername: actor.username });
      const auditAction = toStatus === OrderStatus.ACCEPTED ? "order.accepted" : "order.status_updated";
      const audits = current.audits.filter((audit) => audit.action === auditAction && (audit.metadata as Record<string, unknown>).status === toStatus);
      assert.equal(audits.length, 1);
      assert.equal(audits[0].actorType, actor.actorType);
      assert.equal(audits[0].actorAdminId, actor.actorType === "ADMIN_ACCOUNT" ? actor.id : null);
      assert.equal(audits[0].targetType, "Order");
      assert.equal((audits[0].metadata as Record<string, unknown>).actorUsername, actor.username);
    } else {
      assert.equal(events[0].metadata, null);
      assert.equal(current.audits.length, 0);
    }
    const notices = current.notices.filter((notice) => notice.type === noticeTypes[toStatus]);
    assert.equal(notices.length, 1);
    assert.equal(notices[0].userId, client.id);
    assert.equal((notices[0].payload as Record<string, unknown>).status, toStatus);
    assert.equal(current.availability.status, toStatus === OrderStatus.COMPLETED ? WorkerAvailabilityStatus.AVAILABLE : WorkerAvailabilityStatus.BUSY);
    assert.equal(current.availability.activeOrderId, toStatus === OrderStatus.COMPLETED ? null : id);
    assert.equal(current.availability.lockedUntil, null);
    assert.equal(current.profile.completedOrdersCount, completedBefore + Number(toStatus === OrderStatus.COMPLETED));
    if (toStatus === OrderStatus.COMPLETED) assert.equal(current.record.finalAmount, current.record.priceEstimate);
  }

  try {
    const envActor = await login(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
    const superActor = await admin("super", [], AdminAccountRole.SUPER_ADMIN);
    const manager = await admin("manager", ["orders.read", "orders.manage"]);
    if (reproduce) {
      for (const [label, actor, expected] of [["env-super", envActor, 403], ["DB-super", superActor, 401], ["DB-manager", manager, 401]] as const) {
        for (const [name, fromStatus] of [["accept", OrderStatus.WAITING_RESPONSE], ["on_the_way", OrderStatus.ACCEPTED]] as const) {
          await test(`REPRODUCE ${label} ${name}: actual frontend old route rejected without DB mutation`, async () => {
            const id = await order(fromStatus);
            const before = await snapshot(id);
            const module = frontend(actor);
            let status = 200;
            let code: string | undefined;
            try { await module.run(id, name); } catch (error) {
              const failure = error as { status?: unknown; code?: unknown };
              assert.equal(typeof failure.status, "number");
              status = failure.status as number;
              code = typeof failure.code === "string" ? failure.code : undefined;
            }
            assert.equal(status, expected);
            assert.deepEqual(module.calls, [{ path: `/orders/${id}/${name === "accept" ? "accept" : "status"}`, method: "POST" }]);
            assert.deepEqual(await snapshot(id), before);
            console.log(`[F4] ${JSON.stringify({ case: `${label} ${name}`, mode: "REPRODUCE", layer: "actual frontend VM + HTTP+DB", expectedHttpStatus: 200, actualHttpStatus: status, code, dbUnchanged: true, incompatibilityConfirmed: true })}`);
          });
        }
      }
      console.log("[F4] REPRODUCE diagnostic PASS: six rejected actions confirmed; application contract FAIL");
      return;
    }

    const manageOnly = await admin("manage-only", ["orders.manage"]);
    const reader = await admin("reader", ["orders.read"]);
    const noPermission = await admin("none", []);
    const disabled = await admin("disabled", ["orders.manage"]);
    const stale = await admin("stale", ["orders.manage"]);
    await prisma.adminAccount.update({ where: { id: disabled.id }, data: { status: AdminAccountStatus.DISABLED } });
    await prisma.adminAccount.update({ where: { id: stale.id }, data: { sessionVersion: { increment: 1 } } });
    const clientToken = await mobile(client);
    const providerToken = await mobile(provider);
    const outsiderToken = await mobile(outsider);
    const foreignProviderToken = await mobile(foreignProvider);

    for (const [label, actor] of [["env-super", envActor], ["DB-super", superActor], ["DB-manager", manager], ["DB-manage-only", manageOnly]] as const) {
      const id = await order();
      let fromStatus: OrderStatus = OrderStatus.WAITING_RESPONSE;
      for (const toStatus of lifecycle) {
        await test(`${label}: ${fromStatus} -> ${toStatus}, FK/audit/availability/notice integrity`, async () => {
          const completedBefore = (await snapshot(id)).profile.completedOrdersCount;
          const result = await action(id, actor.token, toStatus);
          assert.equal(result.status, 200);
          assert.equal(result.data.order.id, id);
          assert.equal(result.data.order.status, toStatus);
          assert.equal(Object.hasOwn(result.data.order.client, "passwordHash"), false);
          assert.equal(Object.hasOwn(result.data.order.worker.user, "passwordHash"), false);
          await checkStep(id, fromStatus, toStatus, completedBefore, actor);
        });
        fromStatus = toStatus;
      }
      const current = await snapshot(id);
      assert.equal(current.events.length, 4);
      assert.equal(current.audits.length, 4);
      assert.equal(current.notices.length, 4);
    }

    await test("AdminAccount/User ID collision: action events keep null User FK and actual admin metadata", async () => {
      const collision = await prisma.user.create({ data: { id: manager.id, phone: "+998000001507", role: UserRole.CLIENT } });
      assert.equal(collision.id, manager.id);
      const id = await order();
      let fromStatus: OrderStatus = OrderStatus.WAITING_RESPONSE;
      for (const toStatus of lifecycle) {
        const completedBefore = (await snapshot(id)).profile.completedOrdersCount;
        assert.equal((await action(id, manager.token, toStatus)).status, 200);
        await checkStep(id, fromStatus, toStatus, completedBefore, manager);
        fromStatus = toStatus;
      }
      assert.ok((await snapshot(id)).events.every((event) => event.actorId === null));
    });

    await test("manage-only actions do not imply orders.read", async () => {
      const id = await order();
      const before = await snapshot(id);
      assert.equal((await request("GET", `/admin/orders/${id}`, manageOnly.token)).status, 403);
      assert.deepEqual(await snapshot(id), before);
    });

    for (const [label, token, expected] of [
      ["read-only", reader.token, 403], ["no-permission", noPermission.token, 403],
      ["anonymous", undefined, 401], ["mobile owner", clientToken, 401], ["mobile assigned provider", providerToken, 401],
      ["mobile outsider", outsiderToken, 401], ["foreign provider", foreignProviderToken, 401],
      ["disabled admin", disabled.token, 403], ["stale admin", stale.token, 401],
      ["tampered admin", `${manager.token.slice(0, -1)}${manager.token.endsWith("a") ? "b" : "a"}`, 401]
    ] as const) {
      await test(`${label}: accept/status denied with full DB snapshot unchanged`, async () => {
        for (const [fromStatus, toStatus] of [[OrderStatus.WAITING_RESPONSE, OrderStatus.ACCEPTED], [OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY]] as const) {
          const id = await order(fromStatus);
          const before = await snapshot(id);
          assert.equal((await action(id, token, toStatus)).status, expected);
          assert.deepEqual(await snapshot(id), before);
        }
      });
    }

    await test("status schema invalid/missing/non-transition values: 400 without mutation", async () => {
      const id = await order(OrderStatus.ACCEPTED);
      const before = await snapshot(id);
      for (const status of [undefined, null, 2, "", "INVALID", "WAITING_RESPONSE", "ACCEPTED", "CANCELLED", []]) {
        const result = await request("POST", `/admin/orders/${id}/status`, manager.token, { status });
        assert.equal(result.status, 400);
        assert.equal(result.data.code, "VALIDATION_ERROR");
        assert.deepEqual(await snapshot(id), before);
      }
    });

    await test("missing order: accept/status 404 without successful audit", async () => {
      const id = `f4-actions-missing-${randomUUID()}`;
      assert.equal((await action(id, manager.token, OrderStatus.ACCEPTED)).status, 404);
      assert.equal((await action(id, manager.token, OrderStatus.ON_THE_WAY)).status, 404);
      assert.equal(await prisma.adminAuditLog.count({ where: { targetId: id } }), 0);
    });

    await test("expired response window: accept 409 preserves reservation and event/count state", async () => {
      const id = await order();
      await prisma.order.update({ where: { id }, data: { responseDeadlineAt: new Date(Date.now() - 1) } });
      const before = await snapshot(id);
      const result = await action(id, manager.token, OrderStatus.ACCEPTED);
      assert.equal(result.status, 409);
      assert.equal(result.data.code, "ORDER_RESPONSE_EXPIRED");
      assert.deepEqual(await snapshot(id), before);
    });

    await test("worker unavailable: acceptance transaction rolls back status/event/audit/notice", async () => {
      const id = await order();
      await prisma.workerAvailability.update({ where: { workerId: worker.id }, data: { status: WorkerAvailabilityStatus.BUSY } });
      const before = await snapshot(id);
      assert.equal((await action(id, manager.token, OrderStatus.ACCEPTED)).status, 409);
      assert.deepEqual(await snapshot(id), before);
    });

    await test("nonwaiting accept and invalid/repeated/terminal transitions: 409 without mutation", async () => {
      for (const fromStatus of [...lifecycle, OrderStatus.CANCELLED]) {
        const id = await order(fromStatus);
        const before = await snapshot(id);
        assert.equal((await action(id, manager.token, OrderStatus.ACCEPTED)).status, 409);
        assert.deepEqual(await snapshot(id), before);
      }
      for (const [fromStatus, toStatus] of [
        [OrderStatus.WAITING_RESPONSE, OrderStatus.ON_THE_WAY], [OrderStatus.ACCEPTED, OrderStatus.IN_PROGRESS],
        [OrderStatus.ACCEPTED, OrderStatus.COMPLETED], [OrderStatus.ON_THE_WAY, OrderStatus.ON_THE_WAY],
        [OrderStatus.ON_THE_WAY, OrderStatus.COMPLETED], [OrderStatus.IN_PROGRESS, OrderStatus.ON_THE_WAY],
        [OrderStatus.COMPLETED, OrderStatus.ON_THE_WAY], [OrderStatus.CANCELLED, OrderStatus.COMPLETED]
      ] as const) {
        const id = await order(fromStatus);
        const before = await snapshot(id);
        assert.equal((await action(id, manager.token, toStatus)).status, 409);
        assert.deepEqual(await snapshot(id), before);
      }
    });

    for (const [fromStatus, toStatus] of [
      [OrderStatus.WAITING_RESPONSE, OrderStatus.ACCEPTED], [OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY],
      [OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED]
    ] as const) {
      await test(`parallel ${toStatus}: exactly one success/event/audit/notice/count increment`, async () => {
        const id = await order(fromStatus);
        const completedBefore = (await snapshot(id)).profile.completedOrdersCount;
        const results = await Promise.all([action(id, manager.token, toStatus), action(id, manager.token, toStatus)]);
        assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
        await checkStep(id, fromStatus, toStatus, completedBefore, manager);
        const current = await snapshot(id);
        assert.equal(current.events.length, 1);
        assert.equal(current.audits.length, 1);
        assert.equal(current.notices.length, 1);
      });
    }

    for (const [label, actor] of [["env-super", envActor], ["DB-manager", manager]] as const) {
      await test(`actual frontend VM + real HTTP ${label}: all accept/status paths; not browser UI`, async () => {
        const id = await order();
        const module = frontend(actor);
        let fromStatus: OrderStatus = OrderStatus.WAITING_RESPONSE;
        for (const [name, toStatus] of [["accept", OrderStatus.ACCEPTED], ["on_the_way", OrderStatus.ON_THE_WAY], ["in_progress", OrderStatus.IN_PROGRESS], ["completed", OrderStatus.COMPLETED]] as const) {
          const completedBefore = (await snapshot(id)).profile.completedOrdersCount;
          await module.run(id, name);
          await checkStep(id, fromStatus, toStatus, completedBefore, actor);
          fromStatus = toStatus;
        }
        assert.deepEqual(module.calls, [
          { path: `/admin/orders/${id}/accept`, method: "POST" },
          ...Array.from({ length: 3 }, () => ({ path: `/admin/orders/${id}/status`, method: "POST" }))
        ]);
      });
    }

    await test("legacy assigned provider: full lifecycle uses User actor, ownership and existing notices", async () => {
      const id = await order();
      let fromStatus: OrderStatus = OrderStatus.WAITING_RESPONSE;
      for (const toStatus of lifecycle) {
        const completedBefore = (await snapshot(id)).profile.completedOrdersCount;
        assert.equal((await action(id, providerToken, toStatus, "/orders")).status, 200);
        await checkStep(id, fromStatus, toStatus, completedBefore);
        fromStatus = toStatus;
      }
    });

    for (const [label, token] of [["owner client", clientToken], ["outsider client", outsiderToken], ["foreign provider", foreignProviderToken]] as const) {
      await test(`legacy ${label}: accept/status remain forbidden and unchanged`, async () => {
        for (const [fromStatus, toStatus] of [[OrderStatus.WAITING_RESPONSE, OrderStatus.ACCEPTED], [OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY]] as const) {
          const id = await order(fromStatus);
          const before = await snapshot(id);
          assert.equal((await action(id, token, toStatus, "/orders")).status, 403);
          assert.deepEqual(await snapshot(id), before);
        }
      });
    }

    await test("legacy suspended assigned provider: no acceptance or status capability", async () => {
      await prisma.workerProfile.update({ where: { id: worker.id }, data: { status: WorkerProfileStatus.SUSPENDED } });
      try {
        for (const [fromStatus, toStatus] of [[OrderStatus.WAITING_RESPONSE, OrderStatus.ACCEPTED], [OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY]] as const) {
          const id = await order(fromStatus);
          const before = await snapshot(id);
          assert.equal((await action(id, providerToken, toStatus, "/orders")).status, 403);
          assert.deepEqual(await snapshot(id), before);
        }
      } finally { await prisma.workerProfile.update({ where: { id: worker.id }, data: { status: WorkerProfileStatus.APPROVED } }); }
    });

    await test("legacy User ADMIN manage lifecycle and read-only denial retain old FK/defaults", async () => {
      const legacy = await prisma.user.create({ data: {
        phone: "+998000001505", role: UserRole.ADMIN, adminPermissions: { create: [{ permission: "orders.manage" }] }
      } });
      const legacyReader = await prisma.user.create({ data: {
        phone: "+998000001506", role: UserRole.ADMIN, adminPermissions: { create: [{ permission: "orders.read" }] }
      } });
      const token = await mobile(legacy);
      const readerToken = await mobile(legacyReader);
      const id = await order();
      let fromStatus: OrderStatus = OrderStatus.WAITING_RESPONSE;
      for (const toStatus of lifecycle) {
        const before = await snapshot(id);
        assert.equal((await action(id, readerToken, toStatus, "/orders")).status, 403);
        assert.deepEqual(await snapshot(id), before);
        assert.equal((await action(id, token, toStatus, "/orders")).status, 200);
        await checkStep(id, fromStatus, toStatus, before.profile.completedOrdersCount, undefined, legacy.id);
        fromStatus = toStatus;
      }
    });

    await test("old mobile boundary still rejects DB admin tokens and env superadmin role", async () => {
      for (const [token, expected] of [[manager.token, 401], [superActor.token, 401], [envActor.token, 403]] as const) {
        for (const [fromStatus, toStatus] of [[OrderStatus.WAITING_RESPONSE, OrderStatus.ACCEPTED], [OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY]] as const) {
          const id = await order(fromStatus);
          const before = await snapshot(id);
          assert.equal((await action(id, token, toStatus, "/orders")).status, expected);
          assert.deepEqual(await snapshot(id), before);
        }
      }
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().then(() => console.log(`[F4] admin-actions ${reproduce ? "REPRODUCE diagnostic" : "HTTP regression"} passed (${passed} cases)`))
  .catch(() => { console.log(`[F4] FAIL ${phase}; values suppressed`); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
