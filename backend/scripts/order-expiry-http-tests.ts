import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import type { AddressInfo } from "node:net";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";
const target = assertLocalDatabaseTarget();
if (target.nodeEnv !== "test" || target.database !== process.env.F1_DISPOSABLE_DATABASE || !/^nearfix_chat_test_[a-f0-9]{32}$/.test(target.database)) throw new Error("Disposable DB required");
const password = randomUUID();
const phones = ["+998000000911", "+998000000912"];
process.env.APP_REVIEW_DEMO_ENABLED = "true";
process.env.APP_REVIEW_DEMO_CLIENT_PHONE = phones[0];
process.env.APP_REVIEW_DEMO_CLIENT_PASSWORD = password;
process.env.APP_REVIEW_DEMO_WORKER_PHONE = phones[1];
process.env.APP_REVIEW_DEMO_WORKER_PASSWORD = password;
const { prisma } = await import("../src/db/prisma.js");
const { createApp } = await import("../src/http/app.js");
const { startBackend } = await import("../src/server-runtime.js");
const { autoCancelExpiredWaitingOrders: expire } = await import("../src/modules/orders/order.service.js");
const { startOrderExpiryRunner } = await import("../src/modules/orders/order-expiry-runner.js");
const { ORDER_RESPONSE_TTL_MS, ORDER_EXPIRY_INTERVAL_MS } = await import("../src/modules/orders/order-timeout.js");
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
let phase = "setup";
const pass = (name: string) => console.log(`[F2] PASS ${name}`);

async function main() {
  const client = await prisma.user.create({ data: { phone: phones[0], role: "CLIENT" } });
  const provider = await prisma.user.create({ data: { phone: phones[1], role: "PROVIDER" } });
  const worker = await prisma.workerProfile.create({ data: { userId: provider.id, status: "APPROVED", profession: "F2", availability: { create: { status: "AVAILABLE" } } } });
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function http(path: string, token?: string, body?: unknown, method = "POST") {
    const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  const login = async (phone: string) => {
    const result = await http("/auth/app-review/login", undefined, { phone, password });
    assert.equal(result.status, 200);
    return result.data.accessToken as string;
  };
  const clientToken = await login(phones[0]);
  const workerToken = await login(phones[1]);
  async function create() {
    const result = await http("/orders", clientToken, { workerId: worker.id, cityId: "tashkent", serviceType: "F2", problemTitle: "F2 order", location: { latitude: 41.31, longitude: 69.24, addressText: "F2 fixture address" } });
    assert.equal(result.status, 201, "HTTP order creation");
    return result.data.order.id as string;
  }
  const read = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });
  const deadline = (id: string, time: number) => prisma.order.update({ where: { id }, data: { responseDeadlineAt: new Date(time) } });
  const cancel = (id: string) => http(`/orders/${id}/cancel`, clientToken, { reason: "F2 cleanup cancellation" });
  const accept = (id: string) => http(`/orders/${id}/accept`, workerToken);
  const cancellationCount = (id: string) => prisma.orderEvent.count({ where: { orderId: id, toStatus: "CANCELLED" } });
  try {
    phase = "HTTP deadline boundaries";
    const now = Date.now();
    mock.timers.enable({ apis: ["Date"], now });
    for (const offset of [1, 0, -1]) {
      const id = await create();
      assert.equal((await read(id)).responseDeadlineAt!.getTime() - now, ORDER_RESPONSE_TTL_MS);
      await deadline(id, now + offset);
      const result = await accept(id);
      assert.equal(result.status, offset > 0 ? 200 : 409);
      if (offset <= 0) assert.equal(result.data.code, "ORDER_RESPONSE_EXPIRED");
      await cancel(id);
    }
    pass("real HTTP: 1 ms before / exactly at / 1 ms after deadline; TTL remains 3600000 ms");

    phase = "row lock deadline";
    const lockedId = await create();
    await deadline(lockedId, now + 10);
    let unlock!: () => void;
    let acquired!: () => void;
    const locked = new Promise<void>((resolve) => { acquired = resolve; });
    const hold = new Promise<void>((resolve) => { unlock = resolve; });
    const lockTransaction = prisma.$transaction(async (tx) => { await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${lockedId} FOR UPDATE`; acquired(); await hold; });
    await locked;
    const pendingAccept = accept(lockedId);
    await delay(75);
    mock.timers.setTime(now + 10);
    unlock();
    await lockTransaction;
    assert.equal((await pendingAccept).data.code, "ORDER_RESPONSE_EXPIRED");
    await cancel(lockedId);
    pass("accept waiting for DB row lock rechecks time after lock, not request-start time");

    phase = "concurrent expiry";
    const repeated = await create();
    await deadline(repeated, Date.now());
    const sweeps = await Promise.all(Array.from({ length: 4 }, () => expire()));
    assert.equal(sweeps.reduce((n, item) => n + item.cancelledCount, 0), 1);
    assert.equal((await expire()).cancelledCount, 0);
    assert.equal(await cancellationCount(repeated), 1);
    pass("repeated/concurrent sweeps: one transition and one cancellation event");

    phase = "accept expiry/cancel races";
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const expiredId = await create();
      await deadline(expiredId, Date.now());
      const [acceptResult] = await Promise.all([accept(expiredId), expire(), expire()]);
      assert.equal(acceptResult.status, 409);
      assert.equal((await read(expiredId)).status, "CANCELLED");
      assert.equal(await cancellationCount(expiredId), 1);
      const contested = await create();
      const outcomes = await Promise.all([accept(contested), cancel(contested)]);
      assert.ok(outcomes.every((outcome) => [200, 409].includes(outcome.status)));
      const state = (await read(contested)).status;
      assert.ok(["ACCEPTED", "CANCELLED"].includes(state));
      assert.ok(await prisma.orderEvent.count({ where: { orderId: contested, toStatus: "ACCEPTED" } }) <= 1);
      assert.ok(await cancellationCount(contested) <= 1);
      if (state === "ACCEPTED") await cancel(contested);
    }
    pass("5 parallel accept/expire and accept/cancel scenarios; no overwritten terminal state or duplicate event");

    phase = "accepted and other active reservation";
    const accepted = await create();
    const accepts = await Promise.all([accept(accepted), accept(accepted)]);
    assert.deepEqual(accepts.map((r) => r.status).sort(), [200, 409]);
    await deadline(accepted, Date.now() - 1);
    const old = await prisma.order.create({ data: { publicCode: randomUUID(), clientId: client.id, workerId: worker.id, cityId: "tashkent", serviceType: "F2", problemTitle: "legacy waiting", status: "WAITING_RESPONSE", responseDeadlineAt: new Date(Date.now() - 1) } });
    await expire();
    assert.equal((await read(accepted)).status, "ACCEPTED");
    assert.equal((await read(old.id)).status, "CANCELLED");
    const availability = await prisma.workerAvailability.findUniqueOrThrow({ where: { workerId: worker.id } });
    assert.equal(availability.status, "BUSY");
    assert.equal(availability.activeOrderId, accepted);
    await cancel(accepted);
    pass("accepted order protected; expiring legacy waiting order preserves other active BUSY reservation");

    phase = "push failure";
    const pushOrder = await create();
    await deadline(pushOrder, Date.now());
    await prisma.pushToken.create({ data: { userId: client.id, token: `ExponentPushToken[${randomUUID()}]` } });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => { if (String(url).startsWith("https://exp.host/")) throw new Error("fixture push failure"); return originalFetch(url, options); };
    try { await expire(); } finally { globalThis.fetch = originalFetch; }
    assert.equal((await read(pushOrder)).status, "CANCELLED");
    assert.equal(await cancellationCount(pushOrder), 1);
    await prisma.pushToken.deleteMany({ where: { userId: client.id } });
    pass("push outage does not roll back expiry");
    mock.timers.reset();

    phase = "real lifecycle runner";
    const catchUp = await create();
    await deadline(catchUp, Date.now() - 1);
    let runtime = startBackend(0, "127.0.0.1");
    async function waitCancelled(id: string, timeout: number) {
      const end = Date.now() + timeout;
      while (Date.now() < end) { if ((await read(id)).status === "CANCELLED") return; await delay(100); }
      throw new Error("Runner did not cancel in time");
    }
    try {
      await waitCancelled(catchUp, 4000);
      const periodic = await create();
      await deadline(periodic, Date.now() - 1);
      await waitCancelled(periodic, ORDER_EXPIRY_INTERVAL_MS + 4000);
      pass("actual server lifecycle: startup + periodic runner cancels via direct DB observation, no order GET/expire HTTP calls");
      await runtime.close();
      const restart = await create();
      await deadline(restart, Date.now() - 1);
      await delay(150);
      assert.equal((await read(restart)).status, "WAITING_RESPONSE");
      runtime = startBackend(0, "127.0.0.1");
      await waitCancelled(restart, 4000);
      pass("shutdown stops runner; restart catch-up processes missed deadline");
    } finally { await runtime.close(); }

    phase = "runner overlap and shutdown";
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    let calls = 0;
    const runner = startOrderExpiryRunner({ intervalMs: 10, sweep: async () => { calls += 1; await pending; } });
    await delay(45);
    assert.equal(calls, 1);
    let stopped = false;
    const stopping = runner.stop().then(() => { stopped = true; });
    await delay(20);
    assert.equal(stopped, false);
    finish(); await stopping; await delay(20);
    assert.equal(calls, 1);
    pass("no overlapping ticks; stop drains in-flight sweep and removes timer");
  } finally {
    mock.timers.reset();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
main().catch(() => { console.log(`[F2] FAIL ${phase}; values suppressed`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
