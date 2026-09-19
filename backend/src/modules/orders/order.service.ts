import {
  OrderEventActorType,
  OrderEventType,
  OrderSource,
  OrderStatus,
  ChatParticipantRole,
  ChatRoomType,
  type Prisma,
  UserRole,
  UserStatus,
  WorkerAvailabilityStatus,
  WorkerProfileStatus
} from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../auth/auth-context.js";
import { createNotificationSafely } from "../notifications/notification.service.js";
import { getActiveCategoriesByIds, matchCategoriesByLegacyValues } from "../categories/category.service.js";
import { ensureWorkerAvailableForOrder } from "../workers/worker.service.js";
import { normalizePhone } from "../../utils/phone.js";
import {
  assertApprovedProviderOwnership,
  canAccessOrder,
  isMarketplaceUser,
  ownsOrderAsApprovedProvider,
  ownsOrderAsClient,
  resolveOrderExperienceMode
} from "./order-access.js";
import type { CreateOrderInput, CreateWorkerOrderInput } from "./order.contracts.js";
import { orderInclude } from "./order.dto.js";
import { eventByTransition, transitionOrderStatus } from "./order-state.js";
import { orderResponseDeadline } from "./order-timeout.js";

function createPublicCode() {
  return `NF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
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

function invalidLocation(message: string, code = "ORDER_LOCATION_SOURCE_INVALID") {
  return Object.assign(new Error(message), { status: 400, code });
}

function validateDirectLocationInput(input: CreateOrderInput) {
  const sourceCount = Number(Boolean(input.addressId)) + Number(Boolean(input.location));
  if (sourceCount !== 1) {
    throw invalidLocation("Exactly one of addressId or location is required");
  }

  if (!input.location) return;
  const { latitude, longitude, addressText } = input.location;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw invalidLocation("Latitude is invalid", "ORDER_LOCATION_COORDINATES_INVALID");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw invalidLocation("Longitude is invalid", "ORDER_LOCATION_COORDINATES_INVALID");
  }
  if (addressText !== undefined && (typeof addressText !== "string" || addressText.trim().length > 240)) {
    throw invalidLocation("Address text is invalid", "ORDER_LOCATION_ADDRESS_INVALID");
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

async function markWorkerBusyForAcceptedOrder(
  tx: Prisma.TransactionClient,
  input: {
    workerId: string;
    orderId: string;
    reservedOrder: boolean;
    conflictCode: string;
  }
) {
  const updated = await tx.workerAvailability.updateMany({
    where: {
      workerId: input.workerId,
      activeOrderId: input.reservedOrder ? input.orderId : null,
      status: input.reservedOrder
        ? WorkerAvailabilityStatus.AVAILABLE
        : { in: [WorkerAvailabilityStatus.AVAILABLE, WorkerAvailabilityStatus.OFFLINE] }
    },
    data: {
      status: WorkerAvailabilityStatus.BUSY,
      activeOrderId: input.orderId,
      lockedUntil: null
    }
  });

  if (updated.count !== 1) {
    throw Object.assign(new Error("Worker already has an active order"), {
      status: 409,
      code: input.conflictCode
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
  clientIsProvisional?: boolean;
}) {
  const clientRecipients = input.clientIsProvisional ? [] : [input.clientId];
  const recipients =
    input.actor === OrderEventActorType.CLIENT
      ? [input.workerUserId]
      : input.actor === OrderEventActorType.WORKER
        ? clientRecipients
        : [...clientRecipients, input.workerUserId];

  const uniqueRecipients = Array.from(new Set(recipients));
  const cancellationBody =
    input.actor === OrderEventActorType.WORKER && input.reason
      ? `${input.serviceType} buyurtmasi usta tomonidan bekor qilindi. Sabab: ${input.reason}`
      : `${input.serviceType} buyurtmasi bekor qilindi.`;

  for (const userId of uniqueRecipients) {
    await createNotificationSafely({
      userId,
      orderId: input.orderId,
      dedupeKey: `order:${input.orderId}:ORDER_CANCELLED:${userId}`,
      type: "ORDER_CANCELLED",
      title: "Buyurtma bekor qilindi",
      body: cancellationBody,
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
  if (!isMarketplaceUser(user)) {
    throw Object.assign(new Error("Only clients can create orders"), {
      status: 403,
      code: "CLIENT_REQUIRED"
    });
  }

  validateDirectLocationInput(input);

  const now = new Date();
  const responseDeadlineAt = orderResponseDeadline(now);

  const createdOrder = await prisma.$transaction(async (tx) => {
    const worker = await tx.workerProfile.findUnique({
      where: { id: input.workerId },
      include: { availability: true, user: true, categories: true }
    });

    if (!worker || worker.status !== WorkerProfileStatus.APPROVED) {
      throw Object.assign(new Error("Worker is not approved or does not exist"), {
        status: 404,
        code: "WORKER_NOT_BOOKABLE"
      });
    }

    if (worker.userId === user.id) {
      throw Object.assign(new Error("Providers cannot create client orders for their own worker profile"), {
        status: 409,
        code: "SELF_BOOKING_NOT_ALLOWED"
      });
    }

    const category = input.categoryId
      ? (await getActiveCategoriesByIds([input.categoryId], tx))[0]
      : (await matchCategoriesByLegacyValues([input.serviceType || ""], tx))[0] || null;
    if (input.categoryId && category && !worker.categories.some((item) => item.categoryId === category.id)) {
      throw Object.assign(new Error("Worker does not offer the selected category"), {
        status: 400,
        code: "WORKER_CATEGORY_NOT_OFFERED"
      });
    }
    const serviceType = input.categoryId ? category!.nameUz : input.serviceType!;

    let savedAddress: {
      id: string;
      userId: string;
      label: string;
      cityId: string;
      district: string | null;
      addressText: string;
      lat: Prisma.Decimal | null;
      lng: Prisma.Decimal | null;
    } | null = null;
    if (input.addressId) {
      savedAddress = await tx.address.findUnique({
        where: { id: input.addressId },
        select: {
          id: true,
          userId: true,
          label: true,
          cityId: true,
          district: true,
          addressText: true,
          lat: true,
          lng: true
        }
      });

      if (!savedAddress) {
        throw Object.assign(new Error("Address not found"), {
          status: 404,
          code: "ADDRESS_NOT_FOUND"
        });
      }

      if (savedAddress.userId !== user.id) {
        throw Object.assign(new Error("Address access denied"), {
          status: 403,
          code: "ADDRESS_ACCESS_DENIED"
        });
      }
    }

    const savedLatitude = savedAddress?.lat === null || savedAddress?.lat === undefined ? null : Number(savedAddress.lat);
    const savedLongitude = savedAddress?.lng === null || savedAddress?.lng === undefined ? null : Number(savedAddress.lng);
    const savedCoordinatesAreValid =
      savedLatitude !== null &&
      savedLongitude !== null &&
      Number.isFinite(savedLatitude) &&
      Number.isFinite(savedLongitude) &&
      savedLatitude >= -90 &&
      savedLatitude <= 90 &&
      savedLongitude >= -180 &&
      savedLongitude <= 180;

    const order = await tx.order.create({
      data: {
        publicCode: createPublicCode(),
        clientId: user.id,
        workerId: worker.id,
        addressId: savedAddress?.id,
        locationLabel: savedAddress?.label || input.location?.label,
        locationAddressText: savedAddress?.addressText || input.location?.addressText?.trim() || null,
        locationDistrict: savedAddress?.district || input.location?.district,
        locationLat: savedCoordinatesAreValid ? savedAddress?.lat : input.location?.latitude,
        locationLng: savedCoordinatesAreValid ? savedAddress?.lng : input.location?.longitude,
        cityId: savedAddress?.cityId || input.cityId,
        serviceType,
        categoryId: category?.id,
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
        title: `${serviceType} buyurtmasi`,
        orderId: order.id,
        cityId: input.cityId,
        serviceType,
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

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude
    });
  });

  await createNotificationSafely({
    userId: createdOrder.worker.userId,
    orderId: createdOrder.id,
    dedupeKey: `order:${createdOrder.id}:ORDER_CREATED:${createdOrder.worker.userId}`,
    type: "ORDER_CREATED",
    title: "Yangi buyurtma",
    body: `${createdOrder.serviceType} buyurtmasi keldi.`,
    payload: {
      orderId: createdOrder.id,
      publicCode: createdOrder.publicCode,
      status: createdOrder.status
    }
  });

  return createdOrder;
}

export async function createWorkerOrder(user: AuthUser, input: CreateWorkerOrderInput) {
  if (!isProvider(user)) {
    throw Object.assign(new Error("Only providers can create worker phone orders"), {
      status: 403,
      code: "PROVIDER_REQUIRED"
    });
  }

  const clientPhone = normalizePhone(input.clientPhone);
  const result = await prisma.$transaction(async (tx) => {
    const worker = await tx.workerProfile.findUnique({
      where: { userId: user.id },
      include: {
        availability: true,
        user: true,
        categories: { include: { category: true } }
      }
    });

    if (!worker || worker.status !== WorkerProfileStatus.APPROVED) {
      throw Object.assign(new Error("Only approved providers can create worker phone orders"), {
        status: 403,
        code: "WORKER_NOT_APPROVED"
      });
    }

    if (worker.user.phone === clientPhone) {
      throw Object.assign(new Error("Worker cannot create an order for their own phone"), {
        status: 409,
        code: "SELF_BOOKING_NOT_ALLOWED"
      });
    }

    const workerCategory = worker.categories.find(
      (item) => item.categoryId === input.categoryId && item.category.isActive
    );
    if (!workerCategory) {
      throw Object.assign(new Error("Worker does not offer the selected active category"), {
        status: 400,
        code: "WORKER_CATEGORY_NOT_OFFERED"
      });
    }

    const existingClient = await tx.user.findUnique({ where: { phone: clientPhone } });
    if (
      existingClient &&
      (existingClient.status !== UserStatus.ACTIVE ||
        existingClient.deletedAt ||
        (existingClient.role !== UserRole.CLIENT && existingClient.role !== UserRole.PROVIDER))
    ) {
      throw Object.assign(new Error("Client phone cannot be used for an order"), {
        status: 400,
        code: "CLIENT_NOT_ELIGIBLE"
      });
    }

    const client = existingClient || await tx.user.create({
      data: {
        phone: clientPhone,
        name: input.clientName?.trim() || null,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
        isProvisional: true,
        cityId: worker.user.cityId
      }
    });
    const cityId = worker.user.cityId || client.cityId || "tashkent";
    const serviceType = workerCategory.category.nameUz;

    const order = await tx.order.create({
      data: {
        publicCode: createPublicCode(),
        clientId: client.id,
        workerId: worker.id,
        locationLabel: input.location.label,
        locationAddressText: input.location.addressText.trim(),
        locationDistrict: input.location.district,
        locationLat: input.location.latitude,
        locationLng: input.location.longitude,
        cityId,
        serviceType,
        categoryId: workerCategory.categoryId,
        problemTitle: `${serviceType} buyurtmasi`,
        problemDescription: input.description.trim(),
        urgency: "NORMAL",
        status: OrderStatus.ACCEPTED,
        source: OrderSource.WORKER_PHONE,
        priceEstimate: input.priceEstimate,
        responseDeadlineAt: null
      }
    });

    await markWorkerBusyForAcceptedOrder(tx, {
      workerId: worker.id,
      orderId: order.id,
      reservedOrder: false,
      conflictCode: "WORKER_BUSY"
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: OrderEventActorType.WORKER,
        actorId: user.id,
        eventType: OrderEventType.ORDER_CREATED,
        fromStatus: OrderStatus.CREATED,
        toStatus: OrderStatus.ACCEPTED,
        message: "Worker created and accepted a phone-originated order",
        metadata: { source: OrderSource.WORKER_PHONE }
      }
    });

    await tx.chatRoom.create({
      data: {
        type: ChatRoomType.ORDER,
        title: `${serviceType} buyurtmasi`,
        orderId: order.id,
        cityId,
        serviceType,
        createdById: user.id,
        participants: {
          create: [
            { userId: client.id, role: ChatParticipantRole.CLIENT },
            { userId: worker.userId, role: ChatParticipantRole.PROVIDER }
          ]
        }
      }
    });

    const createdOrder = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude
    });

    return { createdOrder, notifyExistingClient: Boolean(existingClient && !existingClient.isProvisional) };
  });

  if (result.notifyExistingClient) {
    await createNotificationSafely({
      userId: result.createdOrder.clientId,
      orderId: result.createdOrder.id,
      dedupeKey: `order:${result.createdOrder.id}:WORKER_PHONE_CREATED:${result.createdOrder.clientId}`,
      type: "ORDER_ACCEPTED",
      title: "Buyurtma yaratildi va qabul qilindi",
      body: `${result.createdOrder.worker.user.name || "Usta"} telefon orqali kelishilgan buyurtmani yaratdi.`,
      payload: {
        orderId: result.createdOrder.id,
        publicCode: result.createdOrder.publicCode,
        status: result.createdOrder.status,
        source: result.createdOrder.source
      }
    });
  }

  return result.createdOrder;
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

  if (!canAccessOrder(user, order)) {
    throw Object.assign(new Error("Order access denied"), {
      status: 403,
      code: "ORDER_ACCESS_DENIED"
    });
  }

  return order;
}

export async function listOrdersForUser(user: AuthUser, requestedMode?: string) {
  const mode = resolveOrderExperienceMode(user, requestedMode);
  const where = mode === "admin"
    ? {}
    : mode === "worker"
      ? { worker: { userId: user.id, status: WorkerProfileStatus.APPROVED } }
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
        userId: user.id,
        status: WorkerProfileStatus.APPROVED
      }
    },
    include: orderInclude,
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
    // Evaluate the server clock after acquiring the row lock, not before a
    // potentially long wait behind a concurrent cancel/expiry transaction.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
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
      assertApprovedProviderOwnership(user, order);
    }

    if (order.status !== OrderStatus.WAITING_RESPONSE) {
      throw Object.assign(new Error("Order is not waiting for worker response"), {
        status: 409,
        code: "ORDER_ALREADY_ACCEPTED"
      });
    }

    const acceptedAt = new Date();
    if (order.responseDeadlineAt && order.responseDeadlineAt <= acceptedAt) {
      throw Object.assign(new Error("Order response window expired"), {
        status: 409,
        code: "ORDER_RESPONSE_EXPIRED"
      });
    }

    await transitionOrderStatus(tx, {
      orderId: order.id,
      fromStatus: OrderStatus.WAITING_RESPONSE,
      toStatus: OrderStatus.ACCEPTED,
      where: { OR: [{ responseDeadlineAt: null }, { responseDeadlineAt: { gt: acceptedAt } }] },
      conflictCode: "ORDER_ALREADY_ACCEPTED"
    });

    await markWorkerBusyForAcceptedOrder(tx, {
      workerId: order.workerId,
      orderId: order.id,
      reservedOrder: true,
      conflictCode: "WORKER_NOT_AVAILABLE"
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

  await createNotificationSafely({
    userId: acceptedOrder.clientId,
    orderId: acceptedOrder.id,
    dedupeKey: `order:${acceptedOrder.id}:ORDER_ACCEPTED:${acceptedOrder.clientId}`,
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

    assertApprovedProviderOwnership(user, order);

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
      where: { id: order.id },
      include: orderInclude
    });
  });

  await createNotificationSafely({
    userId: rejectedOrder.clientId,
    orderId: rejectedOrder.id,
    dedupeKey: `order:${rejectedOrder.id}:ORDER_REJECTED:${rejectedOrder.clientId}`,
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
      assertApprovedProviderOwnership(user, order);
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
  if (notificationCopy && !transitionedOrder.client.isProvisional) {
    await createNotificationSafely({
      userId: transitionedOrder.clientId,
      orderId: transitionedOrder.id,
      dedupeKey: `order:${transitionedOrder.id}:${notificationCopy.type}:${transitionedOrder.clientId}`,
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

    const canCancel = isAdmin(user) || ownsOrderAsClient(user, order) || ownsOrderAsApprovedProvider(user, order);

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
        actorType: ownsOrderAsClient(user, order) ? OrderEventActorType.CLIENT : actorTypeForUser(user),
        actorId: user.id,
        eventType,
        fromStatus: order.status,
        toStatus: OrderStatus.CANCELLED,
        message: reason
      }
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude
    });
  });

  await notifyOrderCancelled({
    orderId: cancelledOrder.id,
    publicCode: cancelledOrder.publicCode,
    serviceType: cancelledOrder.serviceType,
    clientId: cancelledOrder.clientId,
    workerUserId: cancelledOrder.worker.userId,
    actor: actorTypeForUser(user),
    reason,
    clientIsProvisional: cancelledOrder.client.isProvisional
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

  let cancelledCount = 0;
  for (const order of expiredOrders) {
    const cancelledOrder = await prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.WAITING_RESPONSE,
          responseDeadlineAt: { lte: now }
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: "Worker did not respond within 1 hour"
        }
      });
      // Another runner/accept/cancel won. No duplicate event or notification.
      if (changed.count !== 1) return null;

      // Old/legacy waiting orders may no longer own the reservation. Expiring
      // them must not release a different active job, or roll back cancellation.
      await tx.workerAvailability.updateMany({
        where: { workerId: order.workerId, activeOrderId: order.id },
        data: { status: WorkerAvailabilityStatus.AVAILABLE, activeOrderId: null, lockedUntil: null }
      });

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

    if (!cancelledOrder) continue;
    cancelledCount += 1;
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

  return { cancelledCount };
}
