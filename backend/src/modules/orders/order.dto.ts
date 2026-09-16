import { Prisma } from "@prisma/client";

export const orderInclude = Prisma.validator<Prisma.OrderInclude>()({
  category: { select: { id: true, slug: true, nameUz: true, nameRu: true, nameEn: true, iconKey: true, sortOrder: true, isActive: true } },
  worker: {
    select: {
      id: true,
      userId: true,
      status: true,
      profession: true,
      professions: true,
      categories: { orderBy: { sortOrder: "asc" }, select: { categoryId: true, category: { select: { id: true, slug: true, nameUz: true, nameRu: true, nameEn: true, iconKey: true, sortOrder: true, isActive: true } } } },
      experienceYears: true,
      profileImageUrl: true,
      bio: true,
      basePrice: true,
      ratingAvg: true,
      completedOrdersCount: true,
      user: { select: { id: true, name: true, phone: true } },
      availability: { select: { status: true, activeOrderId: true, lockedUntil: true } }
    }
  },
  client: { select: { id: true, name: true, phone: true, isProvisional: true } },
  address: {
    select: {
      id: true,
      label: true,
      district: true,
      addressText: true,
      lat: true,
      lng: true
    }
  },
  events: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      actorType: true,
      actorId: true,
      eventType: true,
      fromStatus: true,
      toStatus: true,
      message: true,
      metadata: true,
      createdAt: true
    }
  },
  reviews: {
    take: 1,
    select: {
      id: true,
      rating: true,
      text: true,
      status: true,
      createdAt: true
    }
  }
});

type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }> & {
  payments?: Array<{
    id: string;
    provider: string;
    status: string;
    amount: number;
    externalId: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

function locationForOrder(order: OrderRecord) {
  const hasSnapshot = Boolean(order.locationAddressText?.trim());
  const source = hasSnapshot
    ? {
        label: order.locationLabel,
        addressText: order.locationAddressText,
        district: order.locationDistrict,
        latitude: decimalToNumber(order.locationLat),
        longitude: decimalToNumber(order.locationLng)
      }
    : order.address
      ? {
          label: order.address.label,
          addressText: order.address.addressText,
          district: order.address.district,
          latitude: decimalToNumber(order.address.lat),
          longitude: decimalToNumber(order.address.lng)
        }
      : null;

  if (!source?.addressText) return null;
  return source;
}

export function toOrderDto(order: OrderRecord) {
  return {
    id: order.id,
    publicCode: order.publicCode,
    clientId: order.clientId,
    workerId: order.workerId,
    addressId: order.addressId,
    cityId: order.cityId,
    serviceType: order.serviceType,
    categoryId: order.categoryId,
    category: order.category,
    problemTitle: order.problemTitle,
    problemDescription: order.problemDescription,
    urgency: order.urgency,
    status: order.status,
    source: order.source,
    priceEstimate: order.priceEstimate,
    finalAmount: order.finalAmount,
    responseDeadlineAt: order.responseDeadlineAt,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    location: locationForOrder(order),
    client: {
      id: order.client.id,
      name: order.client.name,
      phone: order.client.phone
    },
    worker: {
      id: order.worker.id,
      profession: order.worker.profession,
      professions: order.worker.professions,
      categoryIds: order.worker.categories.map((item) => item.categoryId),
      categories: order.worker.categories.map((item) => item.category),
      experienceYears: order.worker.experienceYears,
      profileImageUrl: order.worker.profileImageUrl,
      bio: order.worker.bio,
      basePrice: order.worker.basePrice,
      ratingAvg: decimalToNumber(order.worker.ratingAvg),
      completedOrdersCount: order.worker.completedOrdersCount,
      user: {
        id: order.worker.user.id,
        name: order.worker.user.name,
        phone: order.worker.user.phone
      },
      availability: order.worker.availability
        ? {
            status: order.worker.availability.status,
            activeOrderId: order.worker.availability.activeOrderId,
            lockedUntil: order.worker.availability.lockedUntil
          }
        : null
    },
    events: order.events.map((event) => ({
      id: event.id,
      actorType: event.actorType,
      actorId: event.actorId,
      eventType: event.eventType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      message: event.message,
      metadata: event.metadata,
      createdAt: event.createdAt
    })),
    review: order.reviews[0]
      ? {
          id: order.reviews[0].id,
          rating: order.reviews[0].rating,
          text: order.reviews[0].text,
          status: order.reviews[0].status,
          createdAt: order.reviews[0].createdAt
        }
      : null,
    payments: (order.payments || []).map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      externalId: payment.externalId,
      metadata: payment.metadata,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }))
  };
}
