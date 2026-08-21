import {
  OrderStatus,
  Prisma,
  UserRole,
  WorkerAvailabilityStatus,
  WorkerProfileStatus
} from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../auth/auth-context.js";
import { haversineDistanceMeters, type Coordinates } from "./distance.js";

type WorkerProfilePatch = {
  name?: string;
  cityId?: string;
  profession?: string;
  professions?: string[];
  experienceYears?: number;
  profileImageUrl?: string;
  bio?: string;
  basePrice?: number;
  serviceLat?: number;
  serviceLng?: number;
};

type WorkerApplicationPatch = Omit<WorkerProfilePatch, "serviceLat" | "serviceLng">;

const platformFeeRate = 0.05;

const publicWorkerSelect = {
  id: true,
  profession: true,
  professions: true,
  experienceYears: true,
  profileImageUrl: true,
  bio: true,
  basePrice: true,
  ratingAvg: true,
  completedOrdersCount: true,
  user: {
    select: {
      name: true,
      cityId: true
    }
  },
  availability: {
    select: {
      status: true
    }
  }
} satisfies Prisma.WorkerProfileSelect;

type PublicWorkerRecord = Prisma.WorkerProfileGetPayload<{ select: typeof publicWorkerSelect }>;

export function toPublicWorkerDto(worker: PublicWorkerRecord, distanceMeters: number | null = null) {
  return {
    id: worker.id,
    name: worker.user.name,
    cityId: worker.user.cityId,
    profession: worker.profession,
    professions: worker.professions,
    experienceYears: worker.experienceYears,
    profileImageUrl: worker.profileImageUrl,
    bio: worker.bio,
    basePrice: worker.basePrice,
    ratingAvg: worker.ratingAvg,
    completedOrdersCount: worker.completedOrdersCount,
    availability: worker.availability ? { status: worker.availability.status } : null,
    distanceMeters
  };
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function orderAmount(order: {
  finalAmount: number | null;
  priceEstimate: number | null;
  payments?: { status: string; amount: number }[];
}) {
  const paidAmount = order.payments
    ?.filter((payment) => payment.status === "PAID")
    .reduce((sum, payment) => sum + payment.amount, 0);

  if (paidAmount && paidAmount > 0) return paidAmount;
  return order.finalAmount || order.priceEstimate || 0;
}

function roundMoney(value: number) {
  return Math.round(value);
}

function activeHoursForOrder(order: { events?: { toStatus: string | null; createdAt: Date }[] }) {
  const events = order.events || [];
  const startedAt =
    events.find((event) => event.toStatus === "ACCEPTED")?.createdAt ||
    events.find((event) => event.toStatus === "ON_THE_WAY")?.createdAt ||
    events.find((event) => event.toStatus === "IN_PROGRESS")?.createdAt;
  const completedAt = events.find((event) => event.toStatus === "COMPLETED")?.createdAt;

  if (!startedAt || !completedAt || completedAt <= startedAt) return 0;
  return (completedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
}

function normalizeWorkerPatch(patch: WorkerProfilePatch) {
  const professions = patch.professions?.map((item) => item.trim()).filter(Boolean);
  const primaryProfession = patch.profession || professions?.[0];
  const hasServiceLocation = patch.serviceLat !== undefined && patch.serviceLng !== undefined;

  return {
    profileData: {
      profession: primaryProfession,
      professions,
      experienceYears: patch.experienceYears,
      profileImageUrl: patch.profileImageUrl,
      bio: patch.bio,
      basePrice: patch.basePrice,
      ...(hasServiceLocation
        ? {
            serviceLat: patch.serviceLat,
            serviceLng: patch.serviceLng,
            serviceLocationUpdatedAt: new Date()
          }
        : {})
    },
    userData: {
      ...(patch.name ? { name: patch.name.trim() } : {}),
      ...(patch.cityId ? { cityId: patch.cityId.trim() } : {})
    }
  };
}

function missingRequiredProfileFields(worker: {
  profession: string | null;
  professions: string[];
  experienceYears: number | null;
  profileImageUrl: string | null;
  bio: string | null;
  basePrice: number | null;
  user: {
    name: string | null;
    cityId: string | null;
  };
}) {
  const missing: string[] = [];

  if (!worker.user.name?.trim()) missing.push("name");
  if (!worker.user.cityId?.trim()) missing.push("cityId");
  if (!worker.profession?.trim() && !worker.professions.length) missing.push("professions");
  if (typeof worker.experienceYears !== "number") missing.push("experienceYears");
  if (!worker.profileImageUrl?.trim()) missing.push("profileImageUrl");
  if (!worker.basePrice) missing.push("basePrice");
  if (!worker.bio?.trim()) missing.push("bio");

  return missing;
}

function assertProfileCompleteForReview(worker: Parameters<typeof missingRequiredProfileFields>[0]) {
  const missing = missingRequiredProfileFields(worker);

  if (missing.length) {
    throw Object.assign(new Error("Worker profile is incomplete"), {
      status: 400,
      code: "WORKER_PROFILE_INCOMPLETE",
      missing
    });
  }
}

function toWorkerApplicationDto(worker: {
  id: string;
  status: WorkerProfileStatus;
  profession: string | null;
  professions: string[];
  experienceYears: number | null;
  profileImageUrl: string | null;
  bio: string | null;
  basePrice: number | null;
  submittedAt: Date | null;
  moderationReason: string | null;
  user: { name: string | null; cityId: string | null };
}) {
  return {
    id: worker.id,
    state: worker.status === WorkerProfileStatus.APPROVED
      ? "APPROVED"
      : worker.submittedAt
        ? "SUBMITTED"
        : worker.moderationReason
          ? "REJECTED"
          : "DRAFT",
    name: worker.user.name,
    cityId: worker.user.cityId,
    profession: worker.profession,
    professions: worker.professions,
    experienceYears: worker.experienceYears,
    profileImageUrl: worker.profileImageUrl,
    bio: worker.bio,
    basePrice: worker.basePrice,
    submittedAt: worker.submittedAt,
    moderationReason: worker.moderationReason
  };
}

const workerApplicationSelect = {
  id: true,
  status: true,
  profession: true,
  professions: true,
  experienceYears: true,
  profileImageUrl: true,
  bio: true,
  basePrice: true,
  submittedAt: true,
  moderationReason: true,
  user: { select: { name: true, cityId: true } }
} satisfies Prisma.WorkerProfileSelect;

async function assertClientApplicant(userId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw Object.assign(new Error("User not found"), { status: 404, code: "USER_NOT_FOUND" });
  if (user.role !== UserRole.CLIENT) {
    throw Object.assign(new Error("Only clients can create worker applications"), {
      status: 403,
      code: "CLIENT_REQUIRED"
    });
  }
}

export async function getOwnWorkerApplication(userId: string) {
  await assertClientApplicant(userId);
  const worker = await prisma.workerProfile.findUnique({ where: { userId }, select: workerApplicationSelect });
  return worker ? toWorkerApplicationDto(worker) : null;
}

export async function saveOwnWorkerApplication(userId: string, patch: WorkerApplicationPatch) {
  const { profileData, userData } = normalizeWorkerPatch(patch);
  return prisma.$transaction(async (tx) => {
    await assertClientApplicant(userId, tx);
    if (Object.keys(userData).length) await tx.user.update({ where: { id: userId }, data: userData });
    const existing = await tx.workerProfile.findUnique({ where: { userId }, select: { status: true, submittedAt: true } });
    if (existing?.status === WorkerProfileStatus.APPROVED || existing?.status === WorkerProfileStatus.SUSPENDED) {
      throw Object.assign(new Error("Worker profile already exists"), { status: 409, code: "WORKER_PROFILE_EXISTS" });
    }
    if (existing?.submittedAt) {
      throw Object.assign(new Error("Submitted applications cannot be edited"), {
        status: 409,
        code: "WORKER_APPLICATION_SUBMITTED"
      });
    }
    const worker = await tx.workerProfile.upsert({
      where: { userId },
      update: profileData,
      create: { userId, status: WorkerProfileStatus.DRAFT, ...profileData },
      select: workerApplicationSelect
    });
    return toWorkerApplicationDto(worker);
  });
}

export async function submitOwnWorkerApplication(userId: string, patch: WorkerApplicationPatch) {
  const { profileData, userData } = normalizeWorkerPatch(patch);
  return prisma.$transaction(async (tx) => {
    await assertClientApplicant(userId, tx);
    if (Object.keys(userData).length) await tx.user.update({ where: { id: userId }, data: userData });
    const existing = await tx.workerProfile.findUnique({ where: { userId }, select: { status: true, submittedAt: true } });
    if (existing?.status === WorkerProfileStatus.APPROVED || existing?.status === WorkerProfileStatus.SUSPENDED) {
      throw Object.assign(new Error("Worker profile already exists"), { status: 409, code: "WORKER_PROFILE_EXISTS" });
    }
    if (existing?.submittedAt) {
      throw Object.assign(new Error("Application is already submitted"), {
        status: 409,
        code: "WORKER_APPLICATION_SUBMITTED"
      });
    }
    const candidate = await tx.workerProfile.upsert({
      where: { userId },
      update: profileData,
      create: { userId, status: WorkerProfileStatus.DRAFT, ...profileData },
      include: { user: { select: { name: true, cityId: true } } }
    });
    assertProfileCompleteForReview(candidate);
    const submitted = await tx.workerProfile.update({
      where: { id: candidate.id },
      data: { submittedAt: new Date(), moderationReason: null },
      select: workerApplicationSelect
    });
    return toWorkerApplicationDto(submitted);
  });
}

type CatalogWorkerOptions = {
  originAddressId?: string;
  requester?: Pick<AuthUser, "id" | "role">;
  sort?: "nearest";
};

async function getCatalogOrigin(options: CatalogWorkerOptions): Promise<Coordinates | null> {
  if (!options.originAddressId) return null;

  if (!options.requester) {
    throw Object.assign(new Error("Authentication is required to use an origin address"), {
      status: 401,
      code: "UNAUTHORIZED"
    });
  }
  if (options.requester.role !== UserRole.CLIENT.toLowerCase()) {
    throw Object.assign(new Error("Only clients can use an origin address"), {
      status: 403,
      code: "CLIENT_REQUIRED"
    });
  }

  const address = await prisma.address.findUnique({
    where: { id: options.originAddressId },
    select: { userId: true, lat: true, lng: true }
  });

  if (!address) {
    throw Object.assign(new Error("Address not found"), {
      status: 404,
      code: "ADDRESS_NOT_FOUND"
    });
  }
  if (address.userId !== options.requester.id) {
    throw Object.assign(new Error("Address access denied"), {
      status: 403,
      code: "ADDRESS_ACCESS_DENIED"
    });
  }
  if (address.lat === null || address.lng === null) {
    throw Object.assign(new Error("Address coordinates are required"), {
      status: 400,
      code: "ADDRESS_COORDINATES_REQUIRED"
    });
  }

  const origin = { lat: Number(address.lat), lng: Number(address.lng) };
  if (!Number.isFinite(origin.lat) || origin.lat < -90 || origin.lat > 90 ||
      !Number.isFinite(origin.lng) || origin.lng < -180 || origin.lng > 180) {
    throw Object.assign(new Error("Address coordinates are invalid"), {
      status: 400,
      code: "ORIGIN_COORDINATES_INVALID"
    });
  }

  return origin;
}

export async function getCatalogWorkers(cityId?: string, profession?: string, options: CatalogWorkerOptions = {}) {
  if (options.sort === "nearest" && !options.originAddressId) {
    throw Object.assign(new Error("An origin address is required for nearest sorting"), {
      status: 400,
      code: "ORIGIN_ADDRESS_REQUIRED_FOR_NEAREST"
    });
  }
  const origin = await getCatalogOrigin(options);
  const workers = await prisma.workerProfile.findMany({
    select: publicWorkerSelect,
    where: {
      status: WorkerProfileStatus.APPROVED,
      availability: {
        is: {
          status: WorkerAvailabilityStatus.AVAILABLE,
          activeOrderId: null
        }
      },
      OR: profession
        ? [
            { profession: { equals: profession, mode: "insensitive" } },
            { professions: { has: profession } }
          ]
        : undefined,
      user: cityId ? { cityId } : undefined
    },
    orderBy: [
      { availability: { status: "asc" } },
      { ratingAvg: "desc" },
      { completedOrdersCount: "desc" }
    ]
  });

  const coordinatesByWorkerId = new Map<string, Coordinates>();
  if (origin && workers.length) {
    const coordinateRows = await prisma.workerProfile.findMany({
      where: { id: { in: workers.map((worker) => worker.id) } },
      select: { id: true, serviceLat: true, serviceLng: true }
    });
    coordinateRows.forEach((worker) => {
      if (worker.serviceLat !== null && worker.serviceLng !== null) {
        coordinatesByWorkerId.set(worker.id, { lat: Number(worker.serviceLat), lng: Number(worker.serviceLng) });
      }
    });
  }

  const publicWorkers = workers.map((worker) => {
    const coordinates = coordinatesByWorkerId.get(worker.id);
    const distanceMeters = origin && coordinates ? haversineDistanceMeters(origin, coordinates) : null;
    return toPublicWorkerDto(worker, distanceMeters);
  });

  if (options.sort !== "nearest") return publicWorkers;

  return publicWorkers.sort((first, second) => {
    if (first.distanceMeters === null) return second.distanceMeters === null ? first.id.localeCompare(second.id) : 1;
    if (second.distanceMeters === null) return -1;
    const distanceDifference = first.distanceMeters - second.distanceMeters;
    if (distanceDifference) return distanceDifference;
    const ratingDifference = Number(second.ratingAvg) - Number(first.ratingAvg);
    if (ratingDifference) return ratingDifference;
    const completedDifference = second.completedOrdersCount - first.completedOrdersCount;
    return completedDifference || first.id.localeCompare(second.id);
  });
}

export async function getPublicWorker(workerId: string) {
  const worker = await prisma.workerProfile.findFirst({
    where: {
      id: workerId,
      status: WorkerProfileStatus.APPROVED
    },
    select: publicWorkerSelect
  });

  if (!worker) {
    throw Object.assign(new Error("Worker not found"), {
      status: 404,
      code: "WORKER_NOT_FOUND"
    });
  }

  return toPublicWorkerDto(worker);
}

export async function getOwnWorkerProfile(userId: string) {
  return prisma.workerProfile.findUnique({
    where: { userId },
    omit: {
      serviceLat: false,
      serviceLng: false,
      serviceLocationUpdatedAt: false
    },
    include: {
      user: true,
      availability: true
    }
  });
}

export async function getOwnWorkerEarnings(userId: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { userId }
  });

  if (!worker) {
    throw Object.assign(new Error("Worker profile not found"), {
      status: 404,
      code: "WORKER_PROFILE_NOT_FOUND"
    });
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const previousWeekStart = addDays(weekStart, -7);
  const monthStart = startOfMonth(now);

  const orders = await prisma.order.findMany({
    where: {
      workerId: worker.id,
      status: OrderStatus.COMPLETED
    },
    include: {
      client: true,
      payments: true,
      events: { orderBy: { createdAt: "asc" } }
    },
    orderBy: { updatedAt: "desc" }
  });

  const totals = orders.reduce(
    (acc, order) => {
      const amount = orderAmount(order);
      const completedAt = order.updatedAt;

      if (completedAt >= todayStart) acc.today += amount;
      if (completedAt >= weekStart) acc.week += amount;
      if (completedAt >= monthStart) acc.month += amount;
      if (completedAt >= previousWeekStart && completedAt < weekStart) acc.previousWeek += amount;
      if (completedAt >= weekStart) acc.activeHours += activeHoursForOrder(order);

      return acc;
    },
    { today: 0, week: 0, month: 0, previousWeek: 0, activeHours: 0 }
  );

  const daysElapsedThisWeek = Math.max(1, Math.min(7, Math.ceil((now.getTime() - weekStart.getTime()) / 86400000)));
  const growthPercentage = totals.previousWeek
    ? ((totals.week - totals.previousWeek) / totals.previousWeek) * 100
    : totals.week > 0
      ? 100
      : 0;

  const revenueTrend = Array.from({ length: 7 }).map((_, index) => {
    const dayStart = addDays(weekStart, index);
    const dayEnd = addDays(dayStart, 1);
    const amount = orders
      .filter((order) => order.updatedAt >= dayStart && order.updatedAt < dayEnd)
      .reduce((sum, order) => sum + orderAmount(order), 0);

    return {
      date: dayStart.toISOString(),
      amount: roundMoney(amount)
    };
  });

  return {
    todayEarnings: roundMoney(totals.today),
    weekEarnings: roundMoney(totals.week),
    monthEarnings: roundMoney(totals.month),
    completedJobs: orders.length,
    activeHours: Number(totals.activeHours.toFixed(1)),
    averagePerDay: roundMoney(totals.week / daysElapsedThisWeek),
    growthPercentage: Number(growthPercentage.toFixed(1)),
    platformFees: roundMoney(totals.week * platformFeeRate),
    revenueTrend
  };
}

export async function getOwnWorkerTransactions(userId: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { userId }
  });

  if (!worker) {
    throw Object.assign(new Error("Worker profile not found"), {
      status: 404,
      code: "WORKER_PROFILE_NOT_FOUND"
    });
  }

  const orders = await prisma.order.findMany({
    where: {
      workerId: worker.id,
      status: OrderStatus.COMPLETED
    },
    include: {
      client: true,
      payments: true
    },
    orderBy: { updatedAt: "desc" },
    take: 100
  });

  return orders.map((order) => {
    const amount = orderAmount(order);
    return {
      id: order.id,
      orderId: order.id,
      publicCode: order.publicCode,
      clientName: order.client.name || order.client.phone,
      service: order.serviceType,
      amount,
      platformFee: roundMoney(amount * platformFeeRate),
      netAmount: roundMoney(amount * (1 - platformFeeRate)),
      status: order.payments.some((payment) => payment.status === "PAID") ? "PAID" : "ORDER_COMPLETED",
      createdAt: order.updatedAt
    };
  });
}

export async function updateOwnWorkerProfile(userId: string, patch: WorkerProfilePatch) {
  const { profileData, userData } = normalizeWorkerPatch(patch);

  return prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length) {
      await tx.user.update({
        where: { id: userId },
        data: userData
      });
    }

    const worker = await tx.workerProfile.update({
      where: { userId },
      omit: {
        serviceLat: false,
        serviceLng: false,
        serviceLocationUpdatedAt: false
      },
      data: {
        ...profileData,
        submittedAt: new Date(),
        moderationReason: null
      },
      include: {
        user: true,
        availability: true
      }
    });

    assertProfileCompleteForReview(worker);

    return worker;
  });
}

export async function updateOwnWorkerServiceLocation(
  userId: string,
  location: { serviceLat: number; serviceLng: number }
) {
  return prisma.workerProfile.update({
    where: { userId },
    omit: {
      serviceLat: false,
      serviceLng: false,
      serviceLocationUpdatedAt: false
    },
    data: {
      serviceLat: location.serviceLat,
      serviceLng: location.serviceLng,
      serviceLocationUpdatedAt: new Date()
    },
    include: {
      user: true,
      availability: true
    }
  });
}

export async function approveWorkerProfile(workerId: string, patch: WorkerProfilePatch) {
  const { profileData } = normalizeWorkerPatch(patch);
  return prisma.$transaction(async (tx) => {
    const current = await tx.workerProfile.findUnique({
      where: { id: workerId },
      include: { user: true }
    });
    const validSubmittedApplication =
      current?.user.role === UserRole.CLIENT &&
      current.status === WorkerProfileStatus.DRAFT &&
      current.submittedAt !== null &&
      current.moderationReason === null;

    if (!validSubmittedApplication) {
      throw Object.assign(new Error("Only a submitted client application can be approved"), {
        status: 409,
        code: "WORKER_APPROVAL_INVALID_STATE"
      });
    }

    const transition = await tx.workerProfile.updateMany({
      where: {
        id: workerId,
        status: WorkerProfileStatus.DRAFT,
        submittedAt: { not: null },
        moderationReason: null,
        user: { role: UserRole.CLIENT }
      },
      data: {
        ...profileData,
        status: WorkerProfileStatus.APPROVED,
        verifiedAt: new Date(),
        moderationReason: null
      }
    });
    if (transition.count !== 1) {
      throw Object.assign(new Error("Worker application state changed during approval"), {
        status: 409,
        code: "WORKER_APPROVAL_INVALID_STATE"
      });
    }

    const worker = await tx.workerProfile.findUniqueOrThrow({
      where: { id: workerId },
      omit: {
        serviceLat: false,
        serviceLng: false,
        serviceLocationUpdatedAt: false
      },
      include: {
        user: true
      }
    });

    await tx.user.update({
      where: { id: worker.userId },
      data: {
        role: UserRole.PROVIDER,
        sessionVersion: {
          increment: 1
        }
      }
    });

    await tx.session.updateMany({
      where: { userId: worker.userId, revoked: false },
      data: { revoked: true }
    });

    assertProfileCompleteForReview(worker);

    await tx.workerAvailability.upsert({
      where: { workerId: worker.id },
      update: {},
      create: {
        workerId: worker.id,
        status: WorkerAvailabilityStatus.OFFLINE
      }
    });

    return tx.workerProfile.findUniqueOrThrow({
      where: { id: worker.id },
      include: {
        availability: true,
        user: true
      }
    });
  });
}

export async function rejectWorkerProfile(workerId: string, reason: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    include: {
      availability: true,
      user: true
    }
  });

  if (!worker) {
    throw Object.assign(new Error("Worker profile not found"), {
      status: 404,
      code: "WORKER_PROFILE_NOT_FOUND"
    });
  }

  if (worker.status !== WorkerProfileStatus.DRAFT) {
    throw Object.assign(new Error("Only draft worker applications can be rejected"), {
      status: 409,
      code: "WORKER_REJECT_INVALID_STATUS"
    });
  }

  return prisma.workerProfile.update({
    where: { id: worker.id },
    data: {
      submittedAt: null,
      verifiedAt: null,
      moderationReason: reason
    },
    include: {
      availability: true,
      user: true
    }
  });
}

export async function suspendWorkerProfile(workerId: string, reason: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    include: {
      availability: true,
      user: true
    }
  });

  if (!worker) {
    throw Object.assign(new Error("Worker profile not found"), {
      status: 404,
      code: "WORKER_PROFILE_NOT_FOUND"
    });
  }

  if (worker.status !== WorkerProfileStatus.APPROVED) {
    throw Object.assign(new Error("Only approved workers can be suspended"), {
      status: 409,
      code: "WORKER_SUSPEND_INVALID_STATUS"
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.workerProfile.update({
      where: { id: worker.id },
      data: {
        status: WorkerProfileStatus.SUSPENDED,
        moderationReason: reason
      }
    });

    await tx.workerAvailability.updateMany({
      where: {
        workerId: worker.id,
        activeOrderId: null
      },
      data: {
        status: WorkerAvailabilityStatus.OFFLINE,
        lockedUntil: null
      }
    });

    return tx.workerProfile.findUniqueOrThrow({
      where: { id: worker.id },
      include: {
        availability: true,
        user: true
      }
    });
  });
}

export async function unsuspendWorkerProfile(workerId: string, reason: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    include: {
      availability: true,
      user: true
    }
  });

  if (!worker) {
    throw Object.assign(new Error("Worker profile not found"), {
      status: 404,
      code: "WORKER_PROFILE_NOT_FOUND"
    });
  }

  if (worker.status !== WorkerProfileStatus.SUSPENDED) {
    throw Object.assign(new Error("Only suspended workers can be unsuspended"), {
      status: 409,
      code: "WORKER_UNSUSPEND_INVALID_STATUS"
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.workerProfile.update({
      where: { id: worker.id },
      data: {
        status: WorkerProfileStatus.APPROVED,
        verifiedAt: new Date(),
        moderationReason: reason
      }
    });

    await tx.workerAvailability.upsert({
      where: { workerId: worker.id },
      update: {},
      create: {
        workerId: worker.id,
        status: WorkerAvailabilityStatus.OFFLINE
      }
    });

    return tx.workerProfile.findUniqueOrThrow({
      where: { id: worker.id },
      include: {
        availability: true,
        user: true
      }
    });
  });
}

export async function setWorkerAvailability(userId: string, status: WorkerAvailabilityStatus) {
  const worker = await prisma.workerProfile.findUnique({
    where: { userId },
    include: { availability: true }
  });

  if (!worker) {
    throw Object.assign(new Error("Worker profile not found"), {
      status: 404,
      code: "WORKER_PROFILE_NOT_FOUND"
    });
  }

  if (worker.status !== WorkerProfileStatus.APPROVED) {
    throw Object.assign(new Error("Worker profile is not approved"), {
      status: 409,
      code: "WORKER_NOT_APPROVED"
    });
  }

  if (worker.availability?.activeOrderId && status !== WorkerAvailabilityStatus.BUSY) {
    throw Object.assign(new Error("Worker has an active order and must remain BUSY"), {
      status: 409,
      code: "WORKER_HAS_ACTIVE_ORDER"
    });
  }

  return prisma.workerAvailability.upsert({
    where: { workerId: worker.id },
    update: { status },
    create: {
      workerId: worker.id,
      status
    }
  });
}

export async function ensureWorkerAvailableForOrder(
  tx: Prisma.TransactionClient,
  workerId: string,
  orderId: string,
  lockedUntil: Date
) {
  const updated = await tx.workerAvailability.updateMany({
    where: {
      workerId,
      status: WorkerAvailabilityStatus.AVAILABLE,
      activeOrderId: null
    },
    data: {
      activeOrderId: orderId,
      lockedUntil
    }
  });

  if (updated.count !== 1) {
    throw Object.assign(new Error("Worker is not available for a new order"), {
      status: 409,
      code: "WORKER_NOT_AVAILABLE"
    });
  }
}
