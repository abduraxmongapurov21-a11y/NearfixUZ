import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import {
  OrderSource,
  OrderStatus,
  UserRole,
  WorkerAvailabilityStatus,
  WorkerProfileStatus
} from "@prisma/client";
import { prisma } from "../src/db/prisma.js";
import type { AuthUser } from "../src/modules/auth/auth-context.js";
import { verifyAuthOtp } from "../src/modules/auth/auth.service.js";
import { createWorkerOrderSchema } from "../src/modules/orders/order.contracts.js";
import {
  acceptOrder,
  cancelOrder,
  createOrder,
  createWorkerOrder,
  getOrderForUser,
  transitionOrder
} from "../src/modules/orders/order.service.js";

const suffix = String(Date.now()).slice(-7);
const phone = (prefix: string) => `+998${prefix}${suffix}`;
const trackedPhones = [
  phone("90"),
  phone("91"),
  phone("92"),
  phone("93"),
  phone("94"),
  phone("95"),
  phone("96"),
  phone("97")
];
const categorySlug = `worker-phone-test-${suffix}`;

function authUser(user: {
  id: string;
  phone: string;
  name: string | null;
  role: UserRole;
  sessionVersion: number;
}): AuthUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role.toLowerCase(),
    sessionId: `worker-phone-order-${user.id}`,
    permissions: [],
    sessionVersion: user.sessionVersion
  };
}

const inputFor = (clientPhone: string, categoryId: string, description = "Telefon orqali kelishilgan ish") => ({
  clientPhone,
  clientName: "Telefon mijoz",
  categoryId,
  description,
  location: {
    addressText: "Toshkent shahri, Amir Temur ko'chasi 10",
    district: "Yunusobod"
  },
  priceEstimate: 175_000
});

async function expectCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: any) => error?.code === code);
}

async function expectAvailable(workerId: string) {
  const availability = await prisma.workerAvailability.findUniqueOrThrow({ where: { workerId } });
  assert.equal(availability.status, WorkerAvailabilityStatus.AVAILABLE);
  assert.equal(availability.activeOrderId, null);
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { phone: { in: trackedPhones } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const workers = userIds.length
    ? await prisma.workerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    : [];
  const workerIds = workers.map((worker) => worker.id);
  if (userIds.length || workerIds.length) {
    await prisma.order.deleteMany({
      where: { OR: [{ clientId: { in: userIds } }, { workerId: { in: workerIds } }] }
    });
    await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.workerProfile.deleteMany({ where: { id: { in: workerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.category.deleteMany({ where: { slug: categorySlug } });
}

async function main() {
  await cleanup();
  try {
    const [provider, existingClient, ordinaryClient, unrelatedProvider, category] = await Promise.all([
      prisma.user.create({ data: { phone: trackedPhones[0], name: "Phone Order Worker", role: UserRole.PROVIDER, cityId: "tashkent" } }),
      prisma.user.create({ data: { phone: trackedPhones[1], name: "Existing Client", role: UserRole.CLIENT, cityId: "tashkent" } }),
      prisma.user.create({ data: { phone: trackedPhones[2], name: "Ordinary Client", role: UserRole.CLIENT, cityId: "tashkent" } }),
      prisma.user.create({ data: { phone: trackedPhones[3], name: "Unrelated Worker", role: UserRole.PROVIDER, cityId: "tashkent" } }),
      prisma.category.create({
        data: { slug: categorySlug, nameUz: "Test xizmati", nameRu: "Тестовая услуга", nameEn: "Test service", iconKey: "wrench" }
      })
    ]);
    const otherCategory = await prisma.category.findFirstOrThrow({ where: { id: { not: category.id }, isActive: true } });
    const worker = await prisma.workerProfile.create({
      data: {
        userId: provider.id,
        status: WorkerProfileStatus.APPROVED,
        profession: "Test xizmati",
        professions: ["Test xizmati"],
        experienceYears: 3,
        bio: "Worker-created order integration test",
        basePrice: 100_000,
        availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } },
        categories: { create: { categoryId: category.id, isPrimary: true } }
      }
    });
    await prisma.workerProfile.create({
      data: {
        userId: unrelatedProvider.id,
        status: WorkerProfileStatus.SUSPENDED,
        profession: "Test xizmati",
        professions: ["Test xizmati"],
        experienceYears: 1,
        bio: "Suspended worker",
        basePrice: 100_000,
        availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } },
        categories: { create: { categoryId: category.id, isPrimary: true } }
      }
    });
    const providerAuth = authUser(provider);
    const clientAuth = authUser(existingClient);
    const ordinaryClientAuth = authUser(ordinaryClient);
    const suspendedAuth = authUser(unrelatedProvider);

    assert.equal(
      createWorkerOrderSchema.safeParse({ ...inputFor(existingClient.phone, category.id), workerId: "injected" }).success,
      false,
      "workerId injection must be rejected by the strict request contract"
    );
    await expectCode(createWorkerOrder(clientAuth, inputFor(existingClient.phone, category.id)), "PROVIDER_REQUIRED");
    await expectCode(createWorkerOrder(suspendedAuth, inputFor(existingClient.phone, category.id)), "WORKER_NOT_APPROVED");
    await expectCode(createWorkerOrder(providerAuth, inputFor(existingClient.phone, otherCategory.id)), "WORKER_CATEGORY_NOT_OFFERED");
    await expectCode(createWorkerOrder(providerAuth, inputFor("not-a-phone", category.id)), "INVALID_PHONE_NUMBER");
    await expectCode(createWorkerOrder(providerAuth, inputFor(provider.phone, category.id)), "SELF_BOOKING_NOT_ALLOWED");

    const existingOrder = await createWorkerOrder(
      providerAuth,
      inputFor(existingClient.phone.replace("+998", "998 "), category.id)
    );
    assert.equal(existingOrder.status, OrderStatus.ACCEPTED);
    assert.equal(existingOrder.source, OrderSource.WORKER_PHONE);
    assert.equal(existingOrder.clientId, existingClient.id);
    assert.equal(existingOrder.categoryId, category.id);
    assert.equal(existingOrder.priceEstimate, 175_000);
    const unchangedClient = await prisma.user.findUniqueOrThrow({ where: { id: existingClient.id } });
    assert.equal(unchangedClient.name, "Existing Client", "optional submitted name must not overwrite an existing user");
    const busy = await prisma.workerAvailability.findUniqueOrThrow({ where: { workerId: worker.id } });
    assert.equal(busy.status, WorkerAvailabilityStatus.BUSY);
    assert.equal(busy.activeOrderId, existingOrder.id);
    assert.equal(
      await prisma.notification.count({ where: { orderId: existingOrder.id, userId: existingClient.id, type: "ORDER_ACCEPTED" } }),
      1,
      "an existing client receives the normal accepted-order notification"
    );
    await expectCode(getOrderForUser(suspendedAuth, existingOrder.id), "ORDER_ACCESS_DENIED");
    assert.equal((await prisma.order.findMany({ where: { id: existingOrder.id } })).length, 1, "admin order query source contains the order");

    await transitionOrder(providerAuth, existingOrder.id, OrderStatus.ON_THE_WAY);
    await transitionOrder(providerAuth, existingOrder.id, OrderStatus.IN_PROGRESS);
    const completed = await transitionOrder(providerAuth, existingOrder.id, OrderStatus.COMPLETED);
    assert.equal(completed.status, OrderStatus.COMPLETED);
    await expectAvailable(worker.id);

    const raceResults = await Promise.allSettled([
      createWorkerOrder(providerAuth, inputFor(trackedPhones[4], category.id, "Parallel order A")),
      createWorkerOrder(providerAuth, inputFor(trackedPhones[5], category.id, "Parallel order B"))
    ]);
    const fulfilled = raceResults.filter((result) => result.status === "fulfilled");
    const rejected = raceResults.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
    assert.equal(fulfilled.length, 1, "only one concurrent worker-created order may win");
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason?.code, "WORKER_BUSY");
    const raceOrder = (fulfilled[0] as PromiseFulfilledResult<any>).value;
    await expectCode(createWorkerOrder(providerAuth, inputFor(trackedPhones[6], category.id)), "WORKER_BUSY");
    await cancelOrder(providerAuth, raceOrder.id, "Parallel test cleanup");
    await expectAvailable(worker.id);

    for (const [index, status] of [OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY, OrderStatus.IN_PROGRESS].entries()) {
      const provisionalPhone = trackedPhones[5 + index];
      const order = await createWorkerOrder(providerAuth, inputFor(provisionalPhone, category.id, `Cancel from ${status}`));
      if (status === OrderStatus.ON_THE_WAY) {
        await transitionOrder(providerAuth, order.id, OrderStatus.ON_THE_WAY);
      } else if (status === OrderStatus.IN_PROGRESS) {
        await transitionOrder(providerAuth, order.id, OrderStatus.ON_THE_WAY);
        await transitionOrder(providerAuth, order.id, OrderStatus.IN_PROGRESS);
      }
      const cancelled = await cancelOrder(providerAuth, order.id, `Bekor qilish ${status}`);
      assert.equal(cancelled.status, OrderStatus.CANCELLED);
      assert.equal(cancelled.cancelReason, `Bekor qilish ${status}`);
      assert.equal(await prisma.notification.count({ where: { orderId: order.id, userId: order.clientId } }), 0);
      await expectAvailable(worker.id);
    }

    const provisional = await prisma.user.findUniqueOrThrow({ where: { phone: trackedPhones[7] } });
    assert.equal(provisional.isProvisional, true);
    assert.equal(provisional.passwordHash, null);
    assert.equal(await prisma.session.count({ where: { userId: provisional.id } }), 0, "unknown phone receives no session");
    const otpResult = await verifyAuthOtp(
      { phone: provisional.phone, code: "123456" },
      { verifyChallenge: async () => ({ ok: true }) } as any
    );
    assert.equal(otpResult.status, "AUTHENTICATED");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: provisional.id } })).isProvisional, false);
    assert.equal(await prisma.session.count({ where: { userId: provisional.id } }), 1, "real OTP verification claims the provisional account");

    const address = await prisma.address.create({
      data: {
        userId: ordinaryClient.id,
        label: "Uy",
        cityId: "tashkent",
        addressText: "Toshkent, oddiy buyurtma manzili",
        lat: 41.31,
        lng: 69.24,
        isDefault: true
      }
    });
    const clientOrder = await createOrder(ordinaryClientAuth, {
      workerId: worker.id,
      addressId: address.id,
      cityId: "tashkent",
      serviceType: category.nameUz,
      categoryId: category.id,
      problemTitle: "Mavjud client oqimi",
      problemDescription: "Client flow regression check",
      urgency: "FAST"
    });
    assert.equal(clientOrder.source, OrderSource.CLIENT_APP);
    assert.equal(clientOrder.status, OrderStatus.WAITING_RESPONSE);
    assert.equal((await acceptOrder(providerAuth, clientOrder.id)).status, OrderStatus.ACCEPTED);
    assert.equal((await cancelOrder(ordinaryClientAuth, clientOrder.id, "Client regression cleanup")).status, OrderStatus.CANCELLED);
    await expectAvailable(worker.id);

    const workerEvents = await prisma.orderEvent.findMany({ where: { orderId: existingOrder.id } });
    assert.equal(workerEvents.some((event) => event.fromStatus === OrderStatus.CREATED && event.toStatus === OrderStatus.ACCEPTED), true);
    assert.equal(workerEvents.some((event) => event.toStatus === OrderStatus.COMPLETED), true);
  } finally {
    await cleanup();
  }

  console.log("Worker-created order authorization, source, identity, race, notification, lifecycle, cancellation, admin visibility, and regression tests passed.");
}

main().finally(() => prisma.$disconnect());
