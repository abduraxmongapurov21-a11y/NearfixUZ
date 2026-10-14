import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { Readable } from "node:stream";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { createAccessToken } from "../src/modules/auth/session.js";
import { deleteMediaObject } from "../src/storage/media.storage.js";

const suffix = randomUUID();
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=", "base64");
const server = createApp().listen(0, "127.0.0.1");
await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const uploadedKeys = new Set<string>();
let failures = 0;
let passed = 0;

async function identity(role: "CLIENT" | "PROVIDER" = "CLIENT") {
  const user = await prisma.user.create({ data: { phone: `full-fix-${randomUUID()}`, name: "Fictional regression user", role } });
  const session = await prisma.session.create({ data: { userId: user.id, refreshToken: randomUUID(), expiresAt: new Date(Date.now() + 3600000) } });
  const token = createAccessToken({ userId: user.id, sessionId: session.id, sessionVersion: user.sessionVersion });
  return { user, token };
}

async function request(route: string, token: string, method = "GET", body?: unknown) {
  const response = await fetch(`${base}${route}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as any };
}

async function fixture(status: "CREATED" | "WAITING_RESPONSE" | "ACCEPTED" | "ON_THE_WAY" | "IN_PROGRESS" = "ACCEPTED") {
  const client = await identity();
  const provider = await identity("PROVIDER");
  const worker = await prisma.workerProfile.create({ data: { userId: provider.user.id, status: "APPROVED", profession: "Santexnik", availability: { create: { status: "AVAILABLE" } } } });
  const order = await prisma.order.create({ data: { publicCode: `FIX-${randomUUID()}`, clientId: client.user.id, workerId: worker.id, cityId: "tashkent", serviceType: "Santexnik", problemTitle: "Fictional regression order", status } });
  await prisma.workerAvailability.update({ where: { workerId: worker.id }, data: { status: "BUSY", activeOrderId: order.id } });
  return { client, provider, worker, order };
}

async function test(label: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`[F4] PASS ${label}`); }
  catch (error) { failures++; console.log(`[F4] FAIL ${label}: ${error instanceof assert.AssertionError ? error.message : error instanceof Error ? error.name : "UnknownError"}`); }
}

async function upload(token: string, fields: Record<string, string> = {}, bytes = png, mimeType = "image/png", field = "file") {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  body.append(field, new Blob([new Uint8Array(bytes)], { type: mimeType }), "fictional-fixture.bin");
  const response = await fetch(`${base}/media/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
  const result = await response.json() as any;
  if (result.media?.url) {
    const url = new URL(result.media.url);
    assert.equal(url.origin, base);
    assert.match(url.pathname, /^\/uploads\/media\/(chat|orders|workers)\/\d+-[a-f0-9-]+\.[a-z0-9]+$/);
    uploadedKeys.add(url.pathname.slice("/uploads/".length));
  }
  return { status: response.status, body: result };
}

try {
  await test("F03 missing favorite target returns controlled 404", async () => {
    const client = await identity();
    const response = await request("/favorites", client.token, "POST", { workerId: `missing-${suffix}` });
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "WORKER_NOT_FOUND");
    assert.equal(await prisma.favorite.count({ where: { clientId: client.user.id } }), 0);
  });
  await test("F01 active account deletion is atomic and permits cancellation then retry", async () => {
    for (const role of ["client", "provider"] as const) {
      const item = await fixture();
      const response = await request("/auth/me", item[role].token, "DELETE");
      assert.equal(response.status, 409, `${role} deletion must conflict while an order is active`);
      assert.equal(response.body.code, "ACTIVE_ORDERS_EXIST");
      assert.equal((await request("/auth/me", item[role].token)).status, 200, "Rejected deletion retains its session");
      const availability = await prisma.workerAvailability.findUniqueOrThrow({ where: { workerId: item.worker.id } });
      assert.equal(availability.activeOrderId, item.order.id);
      assert.equal(availability.status, "BUSY");
      assert.equal((await request(`/orders/${item.order.id}/cancel`, item.client.token, "POST", { reason: "Fictional regression cancellation" })).status, 200);
      assert.equal((await request("/auth/me", item[role].token, "DELETE")).status, 200);
      assert.equal((await request("/auth/me", item[role].token)).status, 401);
      if (role === "provider") assert.equal((await prisma.workerAvailability.findUniqueOrThrow({ where: { workerId: item.worker.id } })).status, "OFFLINE");
    }
  });
  await test("F01 every nonterminal order prevents client/provider deletion", async () => {
    for (const status of ["CREATED", "WAITING_RESPONSE", "ON_THE_WAY", "IN_PROGRESS"] as const) {
      const item = await fixture(status);
      for (const role of ["client", "provider"] as const) {
        const response = await request("/auth/me", item[role].token, "DELETE");
        assert.equal(response.status, 409, `${role}/${status}`);
        assert.equal(response.body.code, "ACTIVE_ORDERS_EXIST");
      }
    }
  });
  await test("F01 historical deleted provider order cancels while worker remains offline", async () => {
    const item = await fixture();
    await prisma.user.update({ where: { id: item.provider.user.id }, data: { status: "DELETED", deletedAt: new Date() } });
    await prisma.workerProfile.update({ where: { id: item.worker.id }, data: { status: "SUSPENDED" } });
    await prisma.workerAvailability.update({ where: { workerId: item.worker.id }, data: { status: "OFFLINE", activeOrderId: null } });
    assert.equal((await request(`/orders/${item.order.id}/cancel`, item.client.token, "POST", { reason: "Resolve historical deleted provider" })).status, 200);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: item.order.id } })).status, "CANCELLED");
    const availability = await prisma.workerAvailability.findUniqueOrThrow({ where: { workerId: item.worker.id } });
    assert.equal(availability.status, "OFFLINE");
    assert.equal(availability.activeOrderId, null);
    assert.equal(await prisma.orderEvent.count({ where: { orderId: item.order.id, eventType: "ORDER_CANCELLED" } }), 1);
  });
  await test("F01 release never clears another active reservation", async () => {
    const item = await fixture();
    await prisma.user.update({ where: { id: item.provider.user.id }, data: { status: "DELETED", deletedAt: new Date() } });
    const other = await prisma.order.create({ data: { publicCode: `FIX-${randomUUID()}`, clientId: item.client.user.id, workerId: item.worker.id, cityId: "tashkent", serviceType: "Santexnik", problemTitle: "Other reserved fixture", status: "ACCEPTED" } });
    await prisma.workerAvailability.update({ where: { workerId: item.worker.id }, data: { activeOrderId: other.id } });
    const response = await request(`/orders/${item.order.id}/cancel`, item.client.token, "POST", { reason: "Must not affect another reservation" });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "WORKER_RELEASE_FAILED");
    assert.equal((await prisma.workerAvailability.findUniqueOrThrow({ where: { workerId: item.worker.id } })).activeOrderId, other.id);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: item.order.id } })).status, "ACCEPTED", "Failed release rolls back transition");
  });
  await test("F01 concurrent creation/deletion never commits an active order with a deleted participant", async () => {
    for (const role of ["client", "provider"] as const) {
      for (let round = 0; round < 4; round++) {
        const client = await identity();
        const provider = await identity("PROVIDER");
        const worker = await prisma.workerProfile.create({ data: { userId: provider.user.id, status: "APPROVED", profession: "Santexnik", availability: { create: { status: "AVAILABLE" } } } });
        const [deletion, creation] = await Promise.all([
          request("/auth/me", (role === "client" ? client : provider).token, "DELETE"),
          request("/orders", client.token, "POST", { workerId: worker.id, cityId: "tashkent", serviceType: "Santexnik", problemTitle: "Fictional race order", location: { latitude: 41.31, longitude: 69.24 } })
        ]);
        assert.ok([200, 409].includes(deletion.status), `Deletion race must remain controlled (${deletion.status})`);
        assert.ok([201, 401, 404, 409].includes(creation.status), `Creation race must remain controlled (${creation.status})`);
        const active = await prisma.order.count({ where: { workerId: worker.id, status: { notIn: ["COMPLETED", "CANCELLED"] } } });
        const deleted = await prisma.user.count({ where: { id: { in: [client.user.id, provider.user.id] }, status: "DELETED" } });
        assert.equal(active > 0 && deleted > 0, false);
        if (creation.status === 201) assert.equal(deletion.status, 409);
      }
    }
  });
  await test("F02 paginated old unread and same-timestamp rows remain reachable and isolated", async () => {
    const client = await identity();
    const outsider = await identity();
    const oldest = await prisma.notification.create({ data: { userId: client.user.id, type: "ORDER_CREATED", createdAt: new Date("2026-01-01T00:00:00Z"), payload: {} } });
    await prisma.notification.createMany({ data: Array.from({ length: 103 }, () => ({ userId: client.user.id, type: "ORDER_CREATED", createdAt: new Date("2026-02-01T00:00:00Z"), readAt: new Date(), payload: {} })) });
    const first = await request("/notifications", client.token);
    assert.equal(first.status, 200);
    assert.equal(first.body.notifications.length, 100);
    assert.equal(first.body.unreadCount, 1);
    assert.equal(typeof first.body.nextCursor, "string");
    const second = await request(`/notifications?cursor=${encodeURIComponent(first.body.nextCursor)}`, client.token);
    assert.equal(second.status, 200);
    assert.equal(second.body.notifications.length, 4);
    assert.equal(second.body.nextCursor, null);
    assert.ok(second.body.notifications.some((item: any) => item.id === oldest.id));
    assert.equal(new Set([...first.body.notifications, ...second.body.notifications].map((item: any) => item.id)).size, 104);
    assert.deepEqual((await request(`/notifications?cursor=${encodeURIComponent(first.body.nextCursor)}`, outsider.token)).body.notifications, []);
    assert.equal((await request(`/notifications/${oldest.id}/read`, outsider.token, "PATCH")).status, 404);
    assert.equal((await request(`/notifications/${oldest.id}/read`, client.token, "PATCH")).status, 200);
    assert.equal((await request("/notifications/unread-count", client.token)).body.count, 0);
    await prisma.notification.delete({ where: { id: first.body.notifications.at(-1).id } });
    assert.equal((await request(`/notifications?cursor=${encodeURIComponent(first.body.nextCursor)}`, client.token)).body.notifications.length, 4, "Cursor remains usable when its row is removed");
    for (const query of ["cursor=invalid", "limit=0", "limit=101", "limit=abc"]) assert.equal((await request(`/notifications?${query}`, client.token)).status, 400);
  });
  await test("F06 worker transactions HTTP pagination reaches all215 tied rows with ownership and validation", async () => {
    const item = await fixture();
    await prisma.order.createMany({ data: Array.from({ length: 215 }, (_, index) => ({
      publicCode: `FIX-TRANSACTION-${suffix}-${index}`, clientId: item.client.user.id, workerId: item.worker.id,
      cityId: "tashkent", serviceType: "Santexnik", problemTitle: "Fictional completed transaction", status: "COMPLETED" as const,
      finalAmount: 1000 + index, updatedAt: new Date("2026-10-01T00:00:00Z")
    })) });
    const pageSizes: number[] = [];
    const ids = new Set<string>();
    let cursor: string | null = null;
    let firstCursor = "";
    do {
      const result = await request(`/workers/me/transactions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, item.provider.token);
      assert.equal(result.status, 200);
      pageSizes.push(result.body.transactions.length);
      for (const transaction of result.body.transactions) {
        assert.equal(ids.has(transaction.id), false, "No transaction repeats across tied-timestamp pages");
        ids.add(transaction.id);
        assert.equal(transaction.amount >= 1000, true);
      }
      cursor = result.body.nextCursor;
      if (!firstCursor && cursor) firstCursor = cursor;
      assert.ok(pageSizes.length < 5, "Pagination must terminate");
    } while (cursor);
    assert.deepEqual(pageSizes, [100, 100, 15]);
    assert.equal(ids.size, 215);
    const one = await request("/workers/me/transactions?limit=1", item.provider.token);
    assert.equal(one.status, 200);
    assert.equal(one.body.transactions.length, 1);
    assert.equal(typeof one.body.nextCursor, "string");
    const foreign = await fixture();
    const foreignPage = await request(`/workers/me/transactions?cursor=${encodeURIComponent(firstCursor)}`, foreign.provider.token);
    assert.equal(foreignPage.status, 200);
    assert.deepEqual(foreignPage.body.transactions, []);
    assert.equal((await request("/workers/me/transactions", item.client.token)).status, 403);
    for (const query of ["cursor=invalid", "limit=0", "limit=101", "limit=abc", "limit=1&limit=2"]) {
      assert.equal((await request(`/workers/me/transactions?${query}`, item.provider.token)).status, 400, query);
    }
  });
  await test("F04 forged image content and mismatched types cannot persist media", async () => {
    const client = await identity();
    for (const mimeType of ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "video/mp4", "video/quicktime", "video/webm"]) {
      const result = await upload(client.token, {}, Buffer.from("Fictional text that is not media"), mimeType);
      assert.equal(result.status, 415, mimeType);
      assert.equal(result.body.code, "UNSUPPORTED_MEDIA_TYPE");
    }
    assert.equal((await upload(client.token, {}, png, "image/jpeg")).status, 415);
    assert.equal(await prisma.media.count({ where: { ownerId: client.user.id } }), 0);
  });
  await test("F05 unknown scope is rejected; valid/default scope and exact byte roundtrip remain", async () => {
    const client = await identity();
    for (const scope of ["FICTIONAL_UNKNOWN", "", "constructor", "__proto__"]) {
      const result = await upload(client.token, { scope });
      assert.equal(result.status, 400, scope);
      assert.equal(result.body.code, "INVALID_MEDIA_SCOPE");
    }
    assert.equal(await prisma.media.count({ where: { ownerId: client.user.id } }), 0);
    for (const fields of [{}, { scope: "worker_gallery" }]) {
      const result = await upload(client.token, fields);
      assert.equal(result.status, 200);
      assert.equal(result.body.media.scope, fields.scope ? "WORKER_GALLERY" : "CHAT");
      assert.equal(result.body.media.mimeType, "image/png");
      assert.deepEqual(Buffer.from(await (await fetch(result.body.media.url)).arrayBuffer()), png);
    }
    const unexpected = await upload(client.token, {}, png, "image/png", "unexpected");
    assert.equal(unexpected.status, 400);
    assert.equal(unexpected.body.code, "LIMIT_UNEXPECTED_FILE");
  });
  await test("F04 oversized multipart file returns controlled 413 without persistence", async () => {
    const client = await identity();
    const boundary = `fixture-${randomUUID()}`;
    const chunk = Buffer.alloc(64 * 1024);
    const content = async function* () {
      yield Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.png"\r\nContent-Type: image/png\r\n\r\n`);
      for (let at = 0; at < 100 * 1024 * 1024; at += chunk.length) yield chunk;
      yield Buffer.from(`x\r\n--${boundary}--\r\n`);
    };
    const result = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const uploadRequest = httpRequest(`${base}/media/upload`, { method: "POST", headers: { Authorization: `Bearer ${client.token}`, "Content-Type": `multipart/form-data; boundary=${boundary}` } }, (response) => {
        const buffers: Buffer[] = [];
        response.on("data", (buffer) => buffers.push(buffer));
        response.on("end", () => { try { resolve({ status: response.statusCode!, body: JSON.parse(Buffer.concat(buffers).toString("utf8")) }); } catch (error) { reject(error); } });
        response.on("error", reject);
      });
      uploadRequest.on("error", reject);
      Readable.from(content()).pipe(uploadRequest);
    });
    assert.equal(result.status, 413);
    assert.equal(result.body.code, "LIMIT_FILE_SIZE");
    assert.equal(await prisma.media.count({ where: { ownerId: client.user.id } }), 0);
  });
} finally {
  for (const objectKey of uploadedKeys) await deleteMediaObject({ provider: "local", objectKey });
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
  console.log(`[F4] Full audit regression HTTP tests: ${passed} passed, ${failures} failed`);
  if (failures) process.exitCode = 1;
}
