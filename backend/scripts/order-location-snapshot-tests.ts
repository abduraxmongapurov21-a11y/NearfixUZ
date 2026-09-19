import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { writeFile } from "node:fs/promises";
import { OrderStatus, UserRole, WorkerAvailabilityStatus, WorkerProfileStatus } from "@prisma/client";
import { prisma } from "../src/db/prisma.js";
import type { AuthUser } from "../src/modules/auth/auth-context.js";
import { createOrderSchema } from "../src/modules/orders/order.contracts.js";
import { toOrderDto } from "../src/modules/orders/order.dto.js";
import {
  acceptOrder,
  cancelOrder,
  createOrder,
  getOrderForUser,
  listIncomingOrdersForProvider,
  transitionOrder
} from "../src/modules/orders/order.service.js";
import { createOrderReview } from "../src/modules/reviews/review.service.js";
import { createApp } from "../src/http/app.js";
import { createAccessToken } from "../src/modules/auth/session.js";

const suffix = String(Date.now()).slice(-7);
const phones = [0, 1, 2, 3].map((index) => `+99888${suffix}${index}`);

function auth(user: { id: string; phone: string; name: string | null; role: UserRole; sessionVersion: number }, permissions: AuthUser["permissions"] = []): AuthUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role.toLowerCase(),
    sessionId: `order-location-${user.id}`,
    permissions,
    sessionVersion: user.sessionVersion
  };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { phone: { in: phones } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  if (!userIds.length) return;
  const workers = await prisma.workerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const workerIds = workers.map((worker) => worker.id);
  await prisma.order.deleteMany({ where: { OR: [{ clientId: { in: userIds } }, { workerId: { in: workerIds } }] } });
  await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.workerAvailability.deleteMany({ where: { workerId: { in: workerIds } } });
  await prisma.workerProfile.deleteMany({ where: { id: { in: workerIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

const baseContract = {
  workerId: "worker-id",
  cityId: "tashkent",
  serviceType: "Santexnik",
  problemTitle: "Test buyurtmasi",
  urgency: "FAST" as const
};
const oneTimeLocation = {
  latitude: 41.311081,
  longitude: 69.240562,
  addressText: "Toshkent, bir martalik test manzili",
  district: "Chilonzor"
};

assert.equal(createOrderSchema.safeParse({ ...baseContract, addressId: "address-id" }).success, true);
assert.equal(createOrderSchema.safeParse({ ...baseContract, location: oneTimeLocation }).success, true);
assert.equal(createOrderSchema.safeParse(baseContract).success, false, "location-less order must be rejected");
assert.equal(
  createOrderSchema.safeParse({ ...baseContract, addressId: "address-id", location: oneTimeLocation }).success,
  false,
  "two location sources must be rejected"
);
for (const location of [
  { ...oneTimeLocation, latitude: 91 },
  { ...oneTimeLocation, longitude: -181 },
  { ...oneTimeLocation, latitude: NaN },
  { ...oneTimeLocation, longitude: Infinity },
  { ...oneTimeLocation, latitude: null },
  { ...oneTimeLocation, addressText: 123 }
]) {
  assert.equal(createOrderSchema.safeParse({ ...baseContract, location }).success, false);
}

async function f4HttpSnapshots() {
  const client = await prisma.user.create({ data: { phone: "+998000000941", name: "F4 client", cityId: "tashkent" } });
  async function token(user: typeof client) {
    const session = await prisma.session.create({ data: {
      userId: user.id, refreshToken: randomUUID(), expiresAt: new Date(Date.now() + 3600000)
    } });
    return createAccessToken({ userId: user.id, sessionId: session.id, sessionVersion: user.sessionVersion });
  }
  const clientToken = await token(client);
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const evidence: unknown[] = [];
  async function http(method: string, route: string, body?: unknown, accessToken = clientToken) {
    const response = await fetch(`${baseUrl}${route}`, { method, headers: {
      "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, ...await response.json() };
  }
  const saved = await prisma.address.create({ data: {
    userId: client.id, label: "Uy", cityId: "tashkent", addressText: "F4 saved address", lat: 41.311081, lng: 69.240562
  } });
  try {
    const scenarios = [
      { name: "address-found", location: oneTimeLocation },
      { name: "address-empty", location: { latitude: 41.311081, longitude: 69.240562, addressText: "" } },
      { name: "address-omitted", location: { latitude: 41.3222222, longitude: 69.2555555 } },
      { name: "address-whitespace", location: { latitude: 41.32, longitude: 69.25, addressText: "  " } },
      { name: "short-real-address", location: { latitude: 41.32, longitude: 69.25, addressText: "A1" } },
      { name: "zero-coordinates", location: { latitude: 0, longitude: 0, addressText: "" } },
      { name: "saved-address", addressId: saved.id }
    ];
    for (const [index, scenario] of scenarios.entries()) {
      const provider = await prisma.user.create({ data: {
        phone: `+99800000095${index}`, role: "PROVIDER", name: "F4 worker", cityId: "tashkent"
      } });
      const worker = await prisma.workerProfile.create({ data: {
        userId: provider.id, status: "APPROVED", profession: "Santexnik", professions: ["Santexnik"],
        availability: { create: { status: "AVAILABLE" } }
      } });
      const body = { ...baseContract, workerId: worker.id, location: scenario.location, addressId: scenario.addressId };
      const created = await http("POST", "/orders", body);
      assert.equal(created.status, 201, scenario.name);
      const expected = scenario.location || { latitude: 41.311081, longitude: 69.240562, addressText: "F4 saved address" };
      const snapshot = await prisma.order.findUniqueOrThrow({ where: { id: created.order.id }, select: {
        locationLat: true, locationLng: true, locationAddressText: true, locationLabel: true, locationDistrict: true
      } });
      assert.equal(Number(snapshot.locationLat), expected.latitude);
      assert.equal(Number(snapshot.locationLng), expected.longitude);
      assert.equal(snapshot.locationAddressText, expected.addressText?.trim() || null);
      if (!expected.addressText?.trim()) {
        assert.equal(snapshot.locationLabel, null);
        assert.equal(snapshot.locationDistrict, null);
      }
      const workerToken = await token(provider);
      for (const accessToken of [clientToken, workerToken]) {
        const detail = await http("GET", `/orders/${created.order.id}`, undefined, accessToken);
        assert.equal(detail.status, 200);
        assert.equal(detail.order.location.latitude, expected.latitude);
        assert.equal(detail.order.location.longitude, expected.longitude);
        assert.equal(detail.order.location.addressText, expected.addressText?.trim() || "");
      }
      const incoming = await http("GET", "/orders/worker/incoming", undefined, workerToken);
      assert.deepEqual(incoming.orders.find((order: any) => order.id === created.order.id).location, created.order.location);
      evidence.push({ scenario: scenario.name, status: created.status, payload: body, snapshot, location: created.order.location });
      if (scenario.addressId) {
        await prisma.address.update({ where: { id: saved.id }, data: { addressText: "Changed later", lat: 40, lng: 68 } });
        await prisma.address.delete({ where: { id: saved.id } });
        assert.deepEqual((await http("GET", `/orders/${created.order.id}`)).order.location, created.order.location);
      }
      const beforeInvalid = await prisma.order.count();
      for (const location of [
        { latitude: 91, longitude: 69.2 }, { latitude: 41.3, longitude: -181 },
        { latitude: null, longitude: 69.2 }, { latitude: "41.3", longitude: 69.2 },
        { latitude: 41.3 }, { latitude: 41.3, longitude: 69.2, addressText: 42 }
      ]) assert.equal((await http("POST", "/orders", { ...baseContract, workerId: worker.id, location })).status, 400);
      assert.equal(await prisma.order.count(), beforeInvalid);
    }
    assert.equal(await prisma.address.count({ where: { userId: client.id } }), 0, "coordinate-only orders must not create saved addresses");
    if (process.env.F4_EVIDENCE_FILE) await writeFile(process.env.F4_EVIDENCE_FILE, JSON.stringify(evidence, null, 2));
    console.log("[F4] PASS: 7 HTTP create scenarios; client/worker detail, incoming DTO and exact DB snapshots; invalid coordinates rejected without writes; saved-address snapshot survives edit/delete");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function main() {
  await cleanup();
  try {
    const [client, otherClient, targetProvider, providerClient] = await Promise.all([
      prisma.user.create({ data: { phone: phones[0], name: "Snapshot Client", role: UserRole.CLIENT, cityId: "tashkent" } }),
      prisma.user.create({ data: { phone: phones[1], name: "Other Client", role: UserRole.CLIENT, cityId: "tashkent" } }),
      prisma.user.create({ data: { phone: phones[2], name: "Target Provider", role: UserRole.PROVIDER, cityId: "tashkent" } }),
      prisma.user.create({ data: { phone: phones[3], name: "Provider Client Mode", role: UserRole.PROVIDER, cityId: "tashkent" } })
    ]);
    const targetWorker = await prisma.workerProfile.create({
      data: {
        userId: targetProvider.id,
        status: WorkerProfileStatus.APPROVED,
        profession: "Santexnik",
        professions: ["Santexnik"],
        availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } }
      }
    });
    await prisma.workerProfile.create({
      data: {
        userId: providerClient.id,
        status: WorkerProfileStatus.APPROVED,
        profession: "Elektrik",
        professions: ["Elektrik"],
        availability: { create: { status: WorkerAvailabilityStatus.OFFLINE } }
      }
    });
    const savedAddress = await prisma.address.create({
      data: {
        userId: client.id,
        label: "Uy",
        cityId: "tashkent",
        district: "Chilonzor",
        addressText: "Toshkent, original uy manzili",
        lat: 41.311081,
        lng: 69.240562,
        isDefault: true
      }
    });
    const otherAddress = await prisma.address.create({
      data: {
        userId: otherClient.id,
        label: "Boshqa uy",
        cityId: "tashkent",
        addressText: "Toshkent, boshqa mijoz manzili",
        lat: 41.32,
        lng: 69.25,
        isDefault: true
      }
    });
    const clientAuth = auth(client);
    const providerAuth = auth(targetProvider);

    const savedOrder = await createOrder(clientAuth, { ...baseContract, workerId: targetWorker.id, addressId: savedAddress.id });
    assert.equal(savedOrder.locationAddressText, "Toshkent, original uy manzili");
    assert.equal(toOrderDto(savedOrder).location?.addressText, "Toshkent, original uy manzili");
    await prisma.address.update({
      where: { id: savedAddress.id },
      data: { label: "O'zgargan", addressText: "Yangi ko'rinadigan manzil", lat: 40.1, lng: 68.1 }
    });
    const afterEdit = toOrderDto(await getOrderForUser(clientAuth, savedOrder.id));
    assert.equal(afterEdit.location?.label, "Uy");
    assert.equal(afterEdit.location?.addressText, "Toshkent, original uy manzili");
    assert.equal(afterEdit.location?.latitude, 41.311081);

    await prisma.address.delete({ where: { id: savedAddress.id } });
    const afterDelete = toOrderDto(await getOrderForUser(clientAuth, savedOrder.id));
    assert.equal(afterDelete.addressId, null);
    assert.equal(afterDelete.location?.addressText, "Toshkent, original uy manzili");
    await cancelOrder(clientAuth, savedOrder.id, "Snapshot test cleanup");

    await assert.rejects(
      createOrder(clientAuth, { ...baseContract, workerId: targetWorker.id, addressId: otherAddress.id }),
      (error: any) => error?.code === "ADDRESS_ACCESS_DENIED"
    );

    const oneTimeOrder = await createOrder(clientAuth, {
      ...baseContract,
      workerId: targetWorker.id,
      location: oneTimeLocation
    });
    assert.equal(oneTimeOrder.addressId, null);
    assert.equal(await prisma.address.count({ where: { userId: client.id } }), 0, "one-time booking must not create an Address");
    assert.equal(toOrderDto(oneTimeOrder).location?.addressText, oneTimeLocation.addressText);
    const incoming = (await listIncomingOrdersForProvider(providerAuth)).find((order) => order.id === oneTimeOrder.id);
    assert.equal(toOrderDto(incoming!).location?.district, "Chilonzor");
    assert.equal((await acceptOrder(providerAuth, oneTimeOrder.id)).status, OrderStatus.ACCEPTED);
    assert.equal((await transitionOrder(providerAuth, oneTimeOrder.id, OrderStatus.ON_THE_WAY)).status, OrderStatus.ON_THE_WAY);
    assert.equal((await transitionOrder(providerAuth, oneTimeOrder.id, OrderStatus.IN_PROGRESS)).status, OrderStatus.IN_PROGRESS);
    assert.equal((await transitionOrder(providerAuth, oneTimeOrder.id, OrderStatus.COMPLETED)).status, OrderStatus.COMPLETED);
    const createdReview = await createOrderReview(clientAuth, oneTimeOrder.id, { rating: 5, comment: "Snapshot review" });
    assert.equal(createdReview.review.rating, 5);
    assert.equal("order" in createdReview.review, false, "review DTO must not expose private order location");
    assert.equal(JSON.stringify(createdReview.review).includes("locationAddressText"), false);
    assert.equal(toOrderDto(await getOrderForUser(clientAuth, oneTimeOrder.id)).location?.addressText, oneTimeLocation.addressText);

    const providerClientOrder = await createOrder(auth(providerClient), {
      ...baseContract,
      workerId: targetWorker.id,
      location: { ...oneTimeLocation, addressText: "Provider client-mode manzili" }
    });
    assert.equal(providerClientOrder.clientId, providerClient.id);
    assert.equal(toOrderDto(await getOrderForUser(auth({ ...providerClient, role: UserRole.PROVIDER }), providerClientOrder.id)).location?.addressText, "Provider client-mode manzili");
    const adminView = toOrderDto(await getOrderForUser({ ...auth(client), id: "admin-id", role: "admin", permissions: ["orders.read"] }, providerClientOrder.id));
    assert.equal(adminView.location?.addressText, "Provider client-mode manzili");
    assert.equal("address" in adminView, false);
    assert.equal("locationLat" in adminView, false);
    await cancelOrder(auth(providerClient), providerClientOrder.id, "Provider client-mode cancellation");
  } finally {
    await cleanup();
  }

  console.log("Order location contract, snapshot integrity, DTO privacy, provider client-mode, lifecycle, cancellation, and review tests passed.");
}

(process.env.F4_LOCATION_ONLY === "1" ? f4HttpSnapshots() : main()).finally(() => prisma.$disconnect());
