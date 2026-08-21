import assert from "node:assert/strict";
import {
  OrderStatus,
  UserRole,
  WorkerAvailabilityStatus,
  WorkerProfileStatus
} from "@prisma/client";
import { prisma } from "../src/db/prisma.js";
import type { AuthUser } from "../src/modules/auth/auth-context.js";
import {
  acceptOrder,
  createOrder,
  listOrdersForUser,
  transitionOrder
} from "../src/modules/orders/order.service.js";
import { createOrderReview, listWorkerReviews } from "../src/modules/reviews/review.service.js";

const suffix = String(Date.now()).slice(-7);
const phones = [`+99895${suffix}`, `+99896${suffix}`];

function authUser(user: { id: string; phone: string; name: string | null; role: UserRole; sessionVersion: number }): AuthUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role.toLowerCase(),
    sessionId: `order-lifecycle-${user.id}`,
    permissions: [],
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

async function main() {
  await cleanup();
  try {
    const [client, provider] = await Promise.all([
      prisma.user.create({ data: { phone: phones[0], name: "Lifecycle Client", role: UserRole.CLIENT, cityId: "tashkent" } }),
      prisma.user.create({ data: { phone: phones[1], name: "Lifecycle Provider", role: UserRole.PROVIDER, cityId: "tashkent" } })
    ]);
    const worker = await prisma.workerProfile.create({
      data: {
        userId: provider.id,
        status: WorkerProfileStatus.APPROVED,
        profession: "Santexnik",
        professions: ["Santexnik"],
        experienceYears: 4,
        bio: "Lifecycle test provider",
        basePrice: 120000,
        serviceLat: 41.311081,
        serviceLng: 69.240562,
        availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } }
      }
    });
    const address = await prisma.address.create({
      data: {
        userId: client.id,
        label: "Uy",
        cityId: "tashkent",
        addressText: "Toshkent, lifecycle test manzili",
        lat: 41.311081,
        lng: 69.240562,
        isDefault: true
      }
    });
    const clientAuth = authUser(client);
    const providerAuth = authUser(provider);

    const created = await createOrder(clientAuth, {
      workerId: worker.id,
      addressId: address.id,
      cityId: "tashkent",
      serviceType: "Santexnik",
      problemTitle: "Lifecycle smoke order",
      problemDescription: "Release gate lifecycle test",
      urgency: "FAST",
      priceEstimate: 120000
    });
    assert.equal(created.status, OrderStatus.WAITING_RESPONSE);
    assert.equal((await listOrdersForUser(clientAuth, "client")).some((order) => order.id === created.id), true);
    assert.equal((await listOrdersForUser(providerAuth, "worker")).some((order) => order.id === created.id), true);

    assert.equal((await acceptOrder(providerAuth, created.id)).status, OrderStatus.ACCEPTED);
    assert.equal((await transitionOrder(providerAuth, created.id, OrderStatus.ON_THE_WAY)).status, OrderStatus.ON_THE_WAY);
    assert.equal((await transitionOrder(providerAuth, created.id, OrderStatus.IN_PROGRESS)).status, OrderStatus.IN_PROGRESS);
    assert.equal((await transitionOrder(providerAuth, created.id, OrderStatus.COMPLETED)).status, OrderStatus.COMPLETED);

    const review = await createOrderReview(clientAuth, created.id, { rating: 5, text: "Lifecycle review" });
    assert.equal(review.review.rating, 5);
    assert.equal((await listWorkerReviews(worker.id)).some((item) => item.id === review.review.id), true);

    const finalWorker = await prisma.workerProfile.findUniqueOrThrow({
      where: { id: worker.id },
      include: { availability: true }
    });
    assert.equal(finalWorker.completedOrdersCount, 1);
    assert.equal(Number(finalWorker.ratingAvg), 5);
    assert.equal(finalWorker.availability?.status, WorkerAvailabilityStatus.AVAILABLE);
    assert.equal(finalWorker.availability?.activeOrderId, null);
  } finally {
    await cleanup();
  }

  console.log("Client booking, worker order lifecycle, review, and availability recovery tests passed.");
}

main().finally(() => prisma.$disconnect());
