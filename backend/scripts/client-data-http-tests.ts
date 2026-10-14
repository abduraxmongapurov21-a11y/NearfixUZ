import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { createAccessToken } from "../src/modules/auth/session.js";

const suffix = randomUUID();
const client = await prisma.user.create({ data: { phone: `audit-client-${suffix}`, name: "Audit client" } });
const otherClient = await prisma.user.create({ data: { phone: `audit-other-${suffix}`, name: "Other client" } });
const provider = await prisma.user.create({ data: {
  phone: `audit-worker-${suffix}`, name: "Audit worker", role: "PROVIDER", passwordHash: "fictional-must-never-leak"
} });
const worker = await prisma.workerProfile.create({ data: {
  userId: provider.id, status: "APPROVED", profession: "Santexnik", professions: ["Santexnik"],
  serviceLat: 41.31, serviceLng: 69.24, availability: { create: { status: "AVAILABLE" } }
} });
async function tokenFor(user: typeof client) {
  const session = await prisma.session.create({ data: {
    userId: user.id, refreshToken: `fictional-${randomUUID()}`, expiresAt: new Date(Date.now() + 3600000)
  } });
  return createAccessToken({ userId: user.id, sessionId: session.id, sessionVersion: user.sessionVersion });
}
const clientToken = await tokenFor(client);
const otherToken = await tokenFor(otherClient);
const server = createApp().listen(0, "127.0.0.1");
await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
let checks = 0;
async function request(route: string, method = "GET", body?: unknown, token = clientToken) {
  const response = await fetch(`${base}${route}`, { method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json() as any };
}
function equal(actual: unknown, expected: unknown, description: string) {
  assert.deepEqual(actual, expected, description); checks++;
}
try {
  const addressInput = { title: "Uy", address: "Toshkent markazi" };
  for (const invalid of [true, false, [], [41], {}, "abc"]) {
    const result = await request("/addresses", "POST", { ...addressInput, lat: invalid, lng: invalid });
    equal(result.status, 400, "Malformed coordinate JSON must fail over HTTP");
    equal(result.body.code, "VALIDATION_ERROR", "Invalid coordinates return a validation error");
  }
  equal(await prisma.address.count({ where: { userId: client.id } }), 0, "Invalid coordinates must never reach persistence");
  const textOnly = await request("/addresses", "POST", addressInput);
  equal(textOnly.status, 201, "Text-only address fallback remains available");
  equal([textOnly.body.address.lat, textOnly.body.address.lng], [null, null], "Text-only address has no invented coordinates");
  const located = await request("/addresses", "POST", { ...addressInput, lat: "41.3", lng: "69.2", isDefault: true });
  equal(located.status, 201, "Numeric coordinate strings remain compatible");
  equal([located.body.address.lat, located.body.address.lng], [41.3, 69.2], "Numeric coordinate values persist correctly");
  const addressId = located.body.address.id;
  equal((await request(`/addresses/${addressId}`, "PATCH", { lat: false, lng: [] })).status, 400, "Update rejects malformed coordinates");
  equal((await request(`/addresses/${addressId}`, "PATCH", { title: "Boshqa" }, otherToken)).status, 404, "Foreign address update denied");
  equal((await request(`/addresses/${addressId}`, "DELETE", undefined, otherToken)).status, 404, "Foreign address deletion denied");
  equal((await request("/addresses", "GET", undefined, otherToken)).body.addresses, [], "Other account cannot list addresses");
  const listed = await request("/addresses");
  equal(listed.body.addresses.filter((address: any) => address.isDefault).length, 1, "Sequential default selection retains one default");
  equal((await request("/favorites", "POST", { workerId: worker.id })).status, 201, "Favorite can be saved");
  equal((await request("/favorites", "POST", { workerId: worker.id })).status, 201, "Repeated favorite save remains idempotent");
  const favorites = (await request("/favorites")).body.favorites;
  equal(favorites.length, 1, "Favorite rows deduplicate");
  equal(favorites[0].workerId, worker.id, "Favorite retains selected worker identity");
  equal(favorites[0].worker.user.name, provider.name, "Favorite retains display name");
  const forbidden = new Set(["passwordHash", "passwordSetAt", "passwordChangedAt", "phone", "sessionVersion", "deletedAt", "serviceLat", "serviceLng", "serviceLocationUpdatedAt", "activeOrderId", "moderationReason", "userId"]);
  function assertSafe(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      equal(forbidden.has(key), false, `Favorite worker must omit ${key}`); assertSafe(nested);
    }
  }
  assertSafe(favorites[0].worker);
  equal((await request("/favorites", "GET", undefined, otherToken)).body.favorites, [], "Favorites stay account-specific");
  equal((await request(`/favorites/${worker.id}`, "DELETE")).status, 200, "Favorite removed");
  equal((await request("/favorites")).body.favorites, [], "Favorite list reflects removal");
  equal((await request(`/addresses/${addressId}`, "DELETE")).status, 200, "Owned address removed");
  equal((await request(`/workers/${worker.id}`)).body.worker.id, worker.id, "Active profile keeps requested identity");
  for (const status of ["BLOCKED", "DELETED"] as const) {
    await prisma.user.update({ where: { id: provider.id }, data: { status } });
    equal((await request("/workers/catalog")).body.workers.some((item: any) => item.id === worker.id), false, "Inactive worker account is hidden in catalog");
    for (const route of [`/workers/${worker.id}`, `/workers/${worker.id}/reviews`, `/workers/${worker.id}/rating`]) {
      equal((await request(route)).status, 404, "Inactive worker profile surface is unavailable");
    }
    equal((await request(`/chats/rooms/worker/${worker.id}`, "POST")).status, 404, "New direct chat with inactive account is denied");
    const booking = await request("/orders", "POST", {
      workerId: worker.id, addressId: textOnly.body.address.id, cityId: "tashkent",
      serviceType: "Santexnik", problemTitle: "Yordam kerak"
    });
    equal(booking.status, 404, "Inactive worker cannot receive a new booking");
    equal(booking.body.code, "WORKER_NOT_BOOKABLE", "Booking fails with the existing worker eligibility code");
  }
  equal(await prisma.order.count({ where: { workerId: worker.id } }), 0, "Inactive-account bookings create no orders");
  console.log(`[F4] Client data HTTP: ${checks} checks PASS; address validation/ownership/default, favorite privacy/dedupe/account isolation, inactive-worker catalog/profile/reviews/chat/booking suppression.`);
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
}
