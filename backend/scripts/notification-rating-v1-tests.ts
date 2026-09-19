import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import {
  OrderStatus,
  ChatMessageType,
  UserRole,
  WorkerAvailabilityStatus,
  WorkerProfileStatus
} from "@prisma/client";
import { prisma } from "../src/db/prisma.js";
import type { AuthUser } from "../src/modules/auth/auth-context.js";
import {
  acceptOrder,
  cancelOrder,
  createOrder,
  rejectOrder,
  transitionOrder
} from "../src/modules/orders/order.service.js";
import { createOrderReview } from "../src/modules/reviews/review.service.js";
import { createMessage, ensureOrderChatRoom } from "../src/modules/chats/chat.service.js";
import {
  createNotificationSafely,
  deletePushToken,
  markNotificationRead,
  savePushToken
} from "../src/modules/notifications/notification.service.js";

const suffix = String(Date.now()).slice(-7);
const phones = [
  `+99891${suffix}`,
  `+99892${suffix}`,
  `+99893${suffix}`,
  `+99894${suffix}`
];

function authUser(user: { id: string; phone: string; name: string | null; role: UserRole; sessionVersion: number }): AuthUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role.toLowerCase(),
    sessionId: `notification-v1-${user.id}`,
    permissions: [],
    sessionVersion: user.sessionVersion
  };
}

async function expectCode(action: () => Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => {
    assert.equal((error as { code?: string }).code, code);
    return true;
  });
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
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("simulated Expo provider outage"); };
  await cleanup();

  try {
    const [clientA, clientB, providerA, providerB] = await Promise.all([
      prisma.user.create({ data: { phone: phones[0], name: "Notify Client A", role: UserRole.CLIENT, cityId: "tashkent" } }),
      prisma.user.create({ data: { phone: phones[1], name: "Notify Client B", role: UserRole.CLIENT, cityId: "tashkent" } }),
      prisma.user.create({ data: { phone: phones[2], name: "Notify Worker A", role: UserRole.PROVIDER, cityId: "tashkent" } }),
      prisma.user.create({ data: { phone: phones[3], name: "Notify Worker B", role: UserRole.PROVIDER, cityId: "tashkent" } })
    ]);
    const [workerA, workerB] = await Promise.all([
      prisma.workerProfile.create({
        data: {
          userId: providerA.id,
          status: WorkerProfileStatus.APPROVED,
          profession: "Santexnik",
          professions: ["Santexnik"],
          experienceYears: 4,
          bio: "Notification test worker A",
          basePrice: 100000,
          availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } }
        }
      }),
      prisma.workerProfile.create({
        data: {
          userId: providerB.id,
          status: WorkerProfileStatus.APPROVED,
          profession: "Elektrik",
          professions: ["Elektrik"],
          experienceYears: 3,
          bio: "Notification test worker B",
          basePrice: 90000,
          availability: { create: { status: WorkerAvailabilityStatus.AVAILABLE } }
        }
      })
    ]);
    assert.notEqual(workerA.id, workerB.id);

    const [addressA, addressB] = await Promise.all([
      prisma.address.create({ data: { userId: clientA.id, label: "Uy", cityId: "tashkent", addressText: "Client A test address" } }),
      prisma.address.create({ data: { userId: clientB.id, label: "Uy", cityId: "tashkent", addressText: "Client B test address" } })
    ]);
    const clientAAuth = authUser(clientA);
    const clientBAuth = authUser(clientB);
    const providerAAuth = authUser(providerA);
    const providerBAuth = authUser(providerB);

    await savePushToken(providerA.id, "ExponentPushToken[worker-a-old]", "android", "device-worker-a");
    await savePushToken(providerA.id, "ExponentPushToken[worker-a-new]", "android", "device-worker-a");
    await savePushToken(providerB.id, "ExponentPushToken[worker-b]", "android", "device-worker-b");
    await savePushToken(clientA.id, "ExponentPushToken[client-a]", "ios", "device-client-a");
    const rotatedDevice = await prisma.pushToken.findUniqueOrThrow({ where: { deviceId: "device-worker-a" } });
    assert.equal(rotatedDevice.token, "ExponentPushToken[worker-a-new]");
    assert.equal(await prisma.pushToken.count({ where: { deviceId: "device-worker-a" } }), 1);

    const createInput = {
      workerId: workerA.id,
      addressId: addressA.id,
      cityId: "tashkent",
      serviceType: "Santexnik",
      problemTitle: "Notification lifecycle",
      urgency: "FAST" as const,
      priceEstimate: 100000
    };
    const order = await createOrder(clientAAuth, createInput);
    assert.equal(order.status, OrderStatus.WAITING_RESPONSE, "push failure must not roll back order creation");
    assert.equal(await prisma.notification.count({ where: { orderId: order.id, userId: providerA.id, type: "ORDER_CREATED" } }), 1);
    assert.equal(await prisma.notification.count({ where: { orderId: order.id, userId: providerB.id } }), 0);

    const room = await ensureOrderChatRoom(clientAAuth, order.id);
    await createMessage(clientAAuth, room.id, { type: ChatMessageType.TEXT, body: "Client A message" });
    assert.equal(await prisma.notification.count({ where: { orderId: order.id, userId: providerA.id, type: "CHAT_MESSAGE" } }), 1);
    assert.equal(await prisma.notification.count({ where: { orderId: order.id, userId: providerB.id, type: "CHAT_MESSAGE" } }), 0);
    await createMessage(providerAAuth, room.id, { type: ChatMessageType.TEXT, body: "Worker A message" });
    assert.equal(await prisma.notification.count({ where: { orderId: order.id, userId: clientA.id, type: "CHAT_MESSAGE" } }), 1);
    assert.equal(await prisma.notification.count({ where: { orderId: order.id, userId: clientB.id, type: "CHAT_MESSAGE" } }), 0);

    await acceptOrder(providerAAuth, order.id);
    await transitionOrder(providerAAuth, order.id, OrderStatus.ON_THE_WAY);
    await transitionOrder(providerAAuth, order.id, OrderStatus.IN_PROGRESS);
    await transitionOrder(providerAAuth, order.id, OrderStatus.COMPLETED);
    for (const type of ["ORDER_ACCEPTED", "ORDER_ON_THE_WAY", "ORDER_IN_PROGRESS", "ORDER_COMPLETED"]) {
      assert.equal(await prisma.notification.count({ where: { orderId: order.id, userId: clientA.id, type } }), 1, type);
      assert.equal(await prisma.notification.count({ where: { orderId: order.id, userId: clientB.id, type } }), 0, `${type} isolation`);
    }
    const completedNotification = await prisma.notification.findFirstOrThrow({
      where: { orderId: order.id, userId: clientA.id, type: "ORDER_COMPLETED" }
    });
    assert.equal((completedNotification.payload as { orderId?: string }).orderId, order.id);
    assert.equal((completedNotification.payload as { notificationType?: string }).notificationType, "ORDER_COMPLETED");

    await expectCode(() => createOrderReview(clientBAuth, order.id, { rating: 1 }), "ORDER_REVIEW_ACCESS_DENIED");
    const review = await createOrderReview(clientAAuth, order.id, { rating: 5, comment: "Excellent" });
    assert.equal(review.review.rating, 5);
    await expectCode(() => createOrderReview(clientAAuth, order.id, { rating: 4 }), "ORDER_REVIEW_EXISTS");
    const aggregate = await prisma.workerProfile.findUniqueOrThrow({ where: { id: workerA.id } });
    assert.equal(Number(aggregate.ratingAvg), 5);

    const rejected = await createOrder(clientAAuth, { ...createInput, problemTitle: "Rejected notification" });
    await rejectOrder(providerAAuth, rejected.id, "Bandman");
    assert.equal(await prisma.notification.count({ where: { orderId: rejected.id, userId: clientA.id, type: "ORDER_REJECTED" } }), 1);
    await expectCode(() => createOrderReview(clientAAuth, rejected.id, { rating: 4 }), "ORDER_NOT_COMPLETED");

    const cancelled = await createOrder(clientAAuth, { ...createInput, problemTitle: "Cancelled notification" });
    await cancelOrder(clientAAuth, cancelled.id, "Kerak emas");
    assert.equal(await prisma.notification.count({ where: { orderId: cancelled.id, userId: providerA.id, type: "ORDER_CANCELLED" } }), 1);

    const workerCancelled = await createOrder(clientAAuth, {
      ...createInput,
      problemTitle: "Worker cancelled after acceptance"
    });
    await acceptOrder(providerAAuth, workerCancelled.id);
    await expectCode(() => cancelOrder(providerBAuth, workerCancelled.id, "Begona order"), "ORDER_NOT_ASSIGNED");
    const workerCancellationReason = "Favqulodda oilaviy holat";
    const workerCancelledResult = await cancelOrder(providerAAuth, workerCancelled.id, workerCancellationReason);
    assert.equal(workerCancelledResult.status, OrderStatus.CANCELLED);
    assert.equal(workerCancelledResult.cancelReason, workerCancellationReason);
    const clientCancellationNotification = await prisma.notification.findFirstOrThrow({
      where: { orderId: workerCancelled.id, userId: clientA.id, type: "ORDER_CANCELLED" }
    });
    const cancellationPayload = clientCancellationNotification.payload as { reason?: string; body?: string };
    assert.equal(cancellationPayload.reason, workerCancellationReason);
    assert.match(cancellationPayload.body || "", new RegExp(workerCancellationReason));
    const availableWorker = await prisma.workerAvailability.findUniqueOrThrow({ where: { workerId: workerA.id } });
    assert.equal(availableWorker.status, WorkerAvailabilityStatus.AVAILABLE);
    assert.equal(availableWorker.activeOrderId, null);

    const selfOrder = await prisma.order.create({
      data: {
        publicCode: `NF-SELF-${suffix}`,
        clientId: providerA.id,
        workerId: workerA.id,
        cityId: "tashkent",
        serviceType: "Self",
        problemTitle: "Self review guard",
        urgency: "NORMAL",
        status: OrderStatus.COMPLETED
      }
    });
    await expectCode(() => createOrderReview(providerAAuth, selfOrder.id, { rating: 5 }), "SELF_REVIEW_NOT_ALLOWED");

    const workerNotification = await prisma.notification.findFirstOrThrow({ where: { userId: providerA.id } });
    await expectCode(() => markNotificationRead(providerB.id, workerNotification.id), "NOTIFICATION_NOT_FOUND");
    assert.ok((await markNotificationRead(providerA.id, workerNotification.id)).readAt);

    await createNotificationSafely({
      userId: clientA.id,
      dedupeKey: `test:${suffix}:dedupe`,
      type: "TEST",
      title: "Test",
      body: "Test"
    });
    await createNotificationSafely({
      userId: clientA.id,
      dedupeKey: `test:${suffix}:dedupe`,
      type: "TEST",
      title: "Test",
      body: "Test"
    });
    assert.equal(await prisma.notification.count({ where: { dedupeKey: `test:${suffix}:dedupe` } }), 1);

    await deletePushToken(providerA.id, { deviceId: "device-worker-a" });
    assert.ok((await prisma.pushToken.findUniqueOrThrow({ where: { deviceId: "device-worker-a" } })).revokedAt);
  } finally {
    globalThis.fetch = originalFetch;
    await cleanup();
  }

  console.log("Notification V1 recipients/devices/reliability and completed-order rating tests passed.");
}

main().finally(() => prisma.$disconnect());
