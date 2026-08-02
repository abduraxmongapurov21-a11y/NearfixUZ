import {
  OrderEventActorType,
  OrderEventType,
  OrderStatus,
  ChatParticipantRole,
  ChatRoomType,
  type Prisma,
  UserRole,
  WorkerAvailabilityStatus,
  WorkerProfileStatus
} from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../auth/auth-context.js";
import { createNotification } from "../notifications/notification.service.js";
import { ensureWorkerAvailableForOrder } from "../workers/worker.service.js";
import { eventByTransition, transitionOrderStatus } from "./order-state.js";

type CreateOrderInput = {
  workerId: string;
  addressId?: string;
  cityId: string;
  serviceType: string;
  problemTitle: string;
  problemDescription?: string;
  urgency: "NORMAL" | "FAST" | "URGENT";
  priceEstimate?: number;
};

const orderInclude = {
  worker: { include: { user: true, availability: true } },
  client: true,
  address: true,
  events: { orderBy: { createdAt: "asc" as const } }
};

function createPublicCode() {
  return `NF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function actorTypeForUser(user: AuthUser) {
  if (user.role === UserRole.ADMIN.toLowerCase()) return OrderEventActorType.ADMIN;
  if (user.role === UserRole.PROVIDER.toLowerCase()) return OrderEventActorType.WORKER;
  return OrderEventActorType.CLIENT;
}

function isAdmin(user: AuthUser) {
  return user.role === UserRole.ADMIN.toLowerCase();
}

function isProvider(user: AuthUser) {
  return user.role === UserRole.PROVIDER.toLowerCase();
}

function assertOrderAssignedToProvider(order: { worker: { userId: string } }, user: AuthUser) {
  if (order.worker.userId !== user.id) {
    throw Object.assign(new Error("Order is not assigned to this provider"), {
      status: 403,
      code: "ORDER_NOT_ASSIGNED"
    });
  }
}

async function releaseWorkerAvailability(tx: Prisma.TransactionClient, workerId: string, orderId: string) {
  const released = await tx.workerAvailability.updateMany({
    where: {
      workerId,
      activeOrderId: orderId
    },
    data: {
      status: WorkerAvailabilityStatus.AVAILABLE,
      activeOrderId: null,
      lockedUntil: null
    }
  });

  if (released.count !== 1) {
    throw Object.assign(new Error("Worker availability release failed"), {
      status: 409,
      code: "WORKER_RELEASE_FAILED"
    });
  }
}

async function notifyOrderCancelled(input: {
  orderId: string;
  publicCode: string;
  serviceType: string;
  clientId: string;
  workerUserId: string;
  actor: OrderEventActorType;
  reason?: string;
}) {
  const recipients =
    input.actor === OrderEventActorType.CLIENT
      ? [input.workerUserId]
      : input.actor === OrderEventActorType.WORKER
        ? [input.clientId]
        : [input.clientId, input.workerUserId];

  const uniqueRecipients = Array.from(new Set(recipients));

  for (const userId of uniqueRecipients) {
    await createNotification({
      userId,
      orderId: input.orderId,
      type: "ORDER_CANCELLED",
      title: "Buyurtma bekor qilindi",
      body: `${input.serviceType} buyurtmasi bekor qilindi.`,
      payload: {
        orderId: input.orderId,
        publicCode: input.publicCode,
        actor: input.actor,
        reason: input.reason
      }
    });
  }
}

const lifecycleNotificationCopy: Partial<Record<OrderStatus, { type: string; title: string; body: string }>> = {
  [OrderStatus.ON_THE_WAY]: {
    type: "ORDER_ON_THE_WAY",
    title: "Usta yo'lga chiqdi",
    body: "Usta sizning buyurtmangiz tomon yo'lga chiqdi."
  },
  [OrderStatus.IN_PROGRESS]: {
    type: "ORDER_IN_PROGRESS",
    title: "Ish boshlandi",
    body: "Usta buyurtma ustida ish boshladi."
  },
  [OrderStatus.COMPLETED]: {
    type: "ORDER_COMPLETED",
    title: "Buyurtma yakunlandi",
    body: "Buyurtma muvaffaqiyatli yakunlandi."
  }
};

export async function createOrder(user: AuthUser, input: CreateOrderInput) {
  if (user.role !== UserRole.CLIENT.toLowerCase()) {
    throw Object.assign(new Error("Only clients can create orders"), {
      status: 403,
      code: "CLIENT_REQUIRED"
    });
  }

  const now = new Date();
  const responseDeadlineAt = addMinutes(now, 60);

  const createdOrder = await prisma.$transaction(async (tx) => {
    const worker = await tx.workerProfile.findUnique({
      where: { id: input.workerId },
      include: { availability: true, user: true }
    });

    if (!worker || worker.status !== WorkerProfileStatus.APPROVED) {
      throw Object.assign(new Error("Worker is not approved or does not exist"), {
        status: 404,
        code: "WORKER_NOT_BOOKABLE"
      });
    }

    if (input.addressId) {
      const address = await tx.address.findUnique({
        where: { id: input.addressId },
        select: { userId: true }
      });

      if (!address) {
        throw Object.assign(new Error("Address not found"), {
          status: 404,
          code: "ADDRESS_NOT_FOUND"
        });
      }

      if (address.userId !== user.id) {
        throw Object.assign(new Error("Address access denied"), {
          status: 403,
          code: "ADDRESS_ACCESS_DENIED"
        });
      }
    }

    const order = await tx.order.create({
      data: {
        publicCode: createPublicCode(),
        clientId: user.id,
        workerId: worker.id,
        addressId: input.addressId,
        cityId: input.cityId,
        serviceType: input.serviceType,
        problemTitle: input.problemTitle,
        problemDescription: input.problemDescription,
        urgency: input.urgency,
        status: OrderStatus.WAITING_RESPONSE,
        priceEstimate: input.priceEstimate,
        responseDeadlineAt
      }
    });

    await ensureWorkerAvailableForOrder(tx, worker.id, order.id, responseDeadlineAt);

    await tx.orderEvent.createMany({
      data: [
        {
          orderId: order.id,
          actorType: OrderEventActorType.CLIENT,
          actorId: user.id,
          eventType: OrderEventType.ORDER_CREATED,
          fromStatus: OrderStatus.CREATED,
          toStatus: OrderStatus.WAITING_RESPONSE,
          message: "Client created order and selected worker"
        },
        {
          orderId: order.id,
          actorType: OrderEventActorType.SYSTEM,
          eventType: OrderEventType.WORKER_NOTIFIED,
          toStatus: OrderStatus.WAITING_RESPONSE,
          message: "Worker notification should be sent"
        }
      ]
    });

    await tx.chatRoom.create({
      data: {
        type: ChatRoomType.ORDER,
        title: `${input.serviceType} buyurtmasi`,
        orderId: order.id,
        cityId: input.cityId,
        serviceType: input.serviceType,
        createdById: user.id,
        participants: {
          create: [
            {
              userId: user.id,
              role: ChatParticipantRole.CLIENT
            },
            {
              userId: worker.userId,
              role: ChatParticipantRole.PROVIDER
            }
          ]
        }
      }
    });

    return {
      ...order,
      workerUserId: worker.userId
    };
  });

  await createNotification({
    userId: createdOrder.workerUserId,
    orderId: createdOrder.id,
    type: "ORDER_CREATED",
    title: "Yangi buyurtma",
    body: `${createdOrder.serviceType} buyurtmasi keldi.`,
    payload: {
      orderId: createdOrder.id,
      publicCode: createdOrder.publicCode,
      status: createdOrder.status
    }
  });

  const { workerUserId: _workerUserId, ...order } = createdOrder;
  return order;
}

export async function getOrderForUser(user: AuthUser, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      ...orderInclude,
      payments: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!order) {
    throw Object.assign(new Error("Order not found"), {
      status: 404,
      code: "ORDER_NOT_FOUND"
    });
  }

  const canView =
    user.role === UserRole.ADMIN.toLowerCase() ||
    order.clientId === user.id ||
    order.worker.userId === user.id;

  if (!canView) {
    throw Object.assign(new Error("Order access denied"), {
      status: 403,
      code: "ORDER_ACCESS_DENIED"
    });
  }

  return order;
}

export async function listOrdersForUser(user: AuthUser) {
  const where =
    user.role === UserRole.ADMIN.toLowerCase()
      ? {}
      : user.role === UserRole.PROVIDER.toLowerCase()
        ? { worker: { userId: user.id } }
        : { clientId: user.id };

  return prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: "desc" }
  });
}

export async function listIncomingOrdersForProvider(user: AuthUser) {
  if (user.role !== UserRole.PROVIDER.toLowerCase()) {
    throw Object.assign(new Error("Only provider can view incoming orders"), {
      status: 403,
      code: "PROVIDER_REQUIRED"
    });
  }

  const now = new Date();
  await autoCancelExpiredWaitingOrders(now);

  return prisma.order.findMany({
    where: {
      status: OrderStatus.WAITING_RESPONSE,
      OR: [
        {
          responseDeadlineAt: null
        },
        {
          responseDeadlineAt: {
            gt: now
          }
        }
      ],
      worker: {
        userId: user.id
      }
    },
    include: {
      client: true,
      address: true,
      worker: { include: { availability: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function acceptOrder(user: AuthUser, orderId: string) {
  if (!isProvider(user) && !isAdmin(user)) {
    throw Object.assign(new Error("Only provider or admin can accept order"), {
      status: 403,
      code: "PROVIDER_OR_ADMIN_REQUIRED"
    });
  }

  const acceptedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { worker: true }
    });

    if (!order) {
      throw Object.assign(new Error("Order not found for provider"), {
        status: 404,
        code: "ORDER_NOT_FOUND"
      });
    }

    if (isProvider(user)) {
      assertOrderAssignedToProvider(order, user);
    }

    if (order.status !== OrderStatus.WAITING_RESPONSE) {
      throw Object.assign(new Error("Order is not waiting for worker response"), {
        status: 409,
        code: "ORDER_ALREADY_ACCEPTED"
      });
    }

    if (order.responseDeadlineAt && order.responseDeadlineAt <= new Date()) {
      throw Object.assign(new Error("Order response window expired"), {
        status: 409,
        code: "ORDER_RESPONSE_EXPIRED"
      });
    }

    await transitionOrderStatus(tx, {
      orderId: order.id,
      fromStatus: OrderStatus.WAITING_RESPONSE,
      toStatus: OrderStatus.ACCEPTED,
      conflictCode: "ORDER_ALREADY_ACCEPTED"
    });

    await tx.workerAvailability.update({
      where: { workerId: order.workerId },
      data: {
        status: WorkerAvailabilityStatus.BUSY,
        activeOrderId: order.id,
        lockedUntil: null
      }
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: actorTypeForUser(user),
        actorId: user.id,
        eventType: OrderEventType.WORKER_ACCEPTED,
        fromStatus: OrderStatus.WAITING_RESPONSE,
        toStatus: OrderStatus.ACCEPTED,
        message: isAdmin(user) ? "Admin accepted order" : "Worker accepted order"
      }
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude
    });
  });

  await createNotification({
    userId: acceptedOrder.clientId,
    orderId: acceptedOrder.id,
    type: "ORDER_ACCEPTED",
    title: "Buyurtma qabul qilindi",
    body: `${acceptedOrder.serviceType} buyurtmangiz usta tomonidan qabul qilindi.`,
    payload: {
      orderId: acceptedOrder.id,
      publicCode: acceptedOrder.publicCode,
      status: acceptedOrder.status
    }
  });

  return acceptedOrder;
}

export async function rejectOrder(user: AuthUser, orderId: string, reason: string) {
  if (user.role !== UserRole.PROVIDER.toLowerCase()) {
    throw Object.assign(new Error("Only provider can reject order"), {
      status: 403,
      code: "PROVIDER_REQUIRED"
    });
  }

  const rejectedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { worker: true }
    });

    if (!order) {
      throw Object.assign(new Error("Order not found"), {
        status: 404,
        code: "ORDER_NOT_FOUND"
      });
    }

    assertOrderAssignedToProvider(order, user);

    if (order.status !== OrderStatus.WAITING_RESPONSE) {
      throw Object.assign(new Error("Worker reject is only allowed while waiting for response"), {
        status: 409,
        code: "WORKER_REJECT_NOT_ALLOWED"
      });
    }

    await transitionOrderStatus(tx, {
      orderId: order.id,
      fromStatus: OrderStatus.WAITING_RESPONSE,
      toStatus: OrderStatus.CANCELLED,
      data: {
        cancelReason: reason
      },
      conflictCode: "WORKER_REJECT_NOT_ALLOWED"
    });

    await releaseWorkerAvailability(tx, order.workerId, order.id);

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: OrderEventActorType.WORKER,
        actorId: user.id,
        eventType: OrderEventType.WORKER_REJECTED,
        fromStatus: OrderStatus.WAITING_RESPONSE,
        toStatus: OrderStatus.CANCELLED,
        message: reason
      }
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id }
    });
  });

  await createNotification({
    userId: rejectedOrder.clientId,
    orderId: rejectedOrder.id,
    type: "ORDER_REJECTED",
    title: "Buyurtma rad etildi",
    body: `${rejectedOrder.serviceType} buyurtmangiz usta tomonidan rad etildi.`,
    payload: {
      orderId: rejectedOrder.id,
      publicCode: rejectedOrder.publicCode,
      status: rejectedOrder.status
    }
  });

  return rejectedOrder;
}

export async function transitionOrder(user: AuthUser, orderId: string, toStatus: OrderStatus) {
  if (!isProvider(user) && !isAdmin(user)) {
    throw Object.assign(new Error("Only provider or admin can update active order status"), {
      status: 403,
      code: "PROVIDER_OR_ADMIN_REQUIRED"
    });
  }

  const transitionedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { worker: true }
    });

    if (!order) {
      throw Object.assign(new Error("Order not found for provider"), {
        status: 404,
        code: "ORDER_NOT_FOUND"
      });
    }

    if (isProvider(user)) {
      assertOrderAssignedToProvider(order, user);
    }

    await transitionOrderStatus(tx, {
      orderId: order.id,
      fromStatus: order.status,
      toStatus,
      data: {
        finalAmount: toStatus === OrderStatus.COMPLETED ? order.finalAmount || order.priceEstimate : order.finalAmount
      }
    });

    if (toStatus === OrderStatus.COMPLETED) {
      await tx.workerAvailability.update({
        where: { workerId: order.workerId },
        data: {
          status: WorkerAvailabilityStatus.AVAILABLE,
          activeOrderId: null,
          lockedUntil: null
        }
      });

      await tx.workerProfile.update({
        where: { id: order.workerId },
        data: {
          completedOrdersCount: {
            increment: 1
          }
        }
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: actorTypeForUser(user),
        actorId: user.id,
        eventType: eventByTransition[toStatus] || OrderEventType.SUPPORT_NOTE_ADDED,
        fromStatus: order.status,
        toStatus,
        message: `${isAdmin(user) ? "Admin" : "Worker"} transitioned order from ${order.status} to ${toStatus}`
      }
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude
    });
  });

  const notificationCopy = lifecycleNotificationCopy[toStatus];
  if (notificationCopy) {
    await createNotification({
      userId: transitionedOrder.clientId,
      orderId: transitionedOrder.id,
      type: notificationCopy.type,
      title: notificationCopy.title,
      body: notificationCopy.body,
      payload: {
        orderId: transitionedOrder.id,
        notificationType: notificationCopy.type,
        publicCode: transitionedOrder.publicCode,
        status: transitionedOrder.status
      }
    });
  }

  return transitionedOrder;
}

export async function cancelOrder(
  user: AuthUser,
  orderId: string,
  reason: string,
  eventType: OrderEventType = OrderEventType.ORDER_CANCELLED
) {
  const cancelledOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { worker: true }
    });

    if (!order) {
      throw Object.assign(new Error("Order not found"), {
        status: 404,
        code: "ORDER_NOT_FOUND"
      });
    }

    const canCancel = isAdmin(user) || order.clientId === user.id || order.worker.userId === user.id;

    if (!canCancel) {
      throw Object.assign(new Error("Order cancellation denied"), {
        status: 403,
        code: "ORDER_NOT_ASSIGNED"
      });
    }

    await transitionOrderStatus(tx, {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: OrderStatus.CANCELLED,
      data: {
        cancelReason: reason
      }
    });

    await releaseWorkerAvailability(tx, order.workerId, order.id);

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: actorTypeForUser(user),
        actorId: user.id,
        eventType,
        fromStatus: order.status,
        toStatus: OrderStatus.CANCELLED,
        message: reason
      }
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        worker: true
      }
    });
  });

  await notifyOrderCancelled({
    orderId: cancelledOrder.id,
    publicCode: cancelledOrder.publicCode,
    serviceType: cancelledOrder.serviceType,
    clientId: cancelledOrder.clientId,
    workerUserId: cancelledOrder.worker.userId,
    actor: actorTypeForUser(user),
    reason
  });

  return cancelledOrder;
}

export async function autoCancelExpiredWaitingOrders(now = new Date()) {
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.WAITING_RESPONSE,
      responseDeadlineAt: {
        lte: now
      }
    }
  });

  for (const order of expiredOrders) {
    const cancelledOrder = await prisma.$transaction(async (tx) => {
      await transitionOrderStatus(tx, {
        orderId: order.id,
        fromStatus: OrderStatus.WAITING_RESPONSE,
        toStatus: OrderStatus.CANCELLED,
        data: {
          cancelReason: "Worker did not respond within 1 hour"
        },
        conflictCode: "ORDER_STATUS_CONFLICT"
      });

      await releaseWorkerAvailability(tx, order.workerId, order.id);

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          actorType: OrderEventActorType.SYSTEM,
          eventType: OrderEventType.ORDER_CANCELLED,
          fromStatus: OrderStatus.WAITING_RESPONSE,
          toStatus: OrderStatus.CANCELLED,
          message: "Auto-cancelled after 1 hour without worker response"
        }
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          worker: true
        }
      });
    });

    await notifyOrderCancelled({
      orderId: cancelledOrder.id,
      publicCode: cancelledOrder.publicCode,
      serviceType: cancelledOrder.serviceType,
      clientId: cancelledOrder.clientId,
      workerUserId: cancelledOrder.worker.userId,
      actor: OrderEventActorType.SYSTEM,
      reason: "Worker did not respond within 1 hour"
    });
  }

  return { cancelledCount: expiredOrders.length };
}
