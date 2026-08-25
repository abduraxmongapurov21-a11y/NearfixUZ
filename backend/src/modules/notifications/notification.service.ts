import { NotificationStatus, Prisma, UserStatus, type Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export type NotificationInput = {
  userId: string;
  orderId?: string | null;
  dedupeKey?: string | null;
  type: string;
  title: string;
  body: string;
  pushBody?: string;
  payload?: PrismaTypes.InputJsonValue;
};

type RegisteredPushDevice = { id: string; token: string };
type ExpoDeliveryResult = {
  sent: boolean;
  invalidDeviceIds: string[];
  failedDeviceIds: string[];
};

function expoErrorCode(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const details = (value as { details?: unknown }).details;
  if (!details || typeof details !== "object") return null;
  const code = (details as { error?: unknown }).error;
  return typeof code === "string" ? code : null;
}

async function sendExpoPush(
  devices: RegisteredPushDevice[],
  title: string,
  body: string,
  data?: PrismaTypes.InputJsonValue
): Promise<ExpoDeliveryResult> {
  if (!devices.length) return { sent: false, invalidDeviceIds: [], failedDeviceIds: [] };

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify(
        devices.map((device) => ({
          to: device.token,
          title,
          body,
          data,
          sound: "default",
          channelId: "orders"
        }))
      )
    });

    if (!response.ok) {
      return { sent: false, invalidDeviceIds: [], failedDeviceIds: devices.map((device) => device.id) };
    }

    const payload = await response.json() as { data?: Array<{ status?: string; id?: string; details?: unknown }> };
    const tickets = Array.isArray(payload.data) ? payload.data : [];
    const invalidDeviceIds: string[] = [];
    const failedDeviceIds: string[] = [];
    const receiptDevices = new Map<string, string>();

    devices.forEach((device, index) => {
      const ticket = tickets[index];
      if (ticket?.status === "ok") {
        if (ticket.id) receiptDevices.set(ticket.id, device.id);
        return;
      }
      failedDeviceIds.push(device.id);
      if (expoErrorCode(ticket) === "DeviceNotRegistered") invalidDeviceIds.push(device.id);
    });

    if (receiptDevices.size) {
      try {
        const receiptResponse = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ ids: Array.from(receiptDevices.keys()) }),
          signal: AbortSignal.timeout(5000)
        });
        if (receiptResponse.ok) {
          const receiptPayload = await receiptResponse.json() as {
            data?: Record<string, { status?: string; details?: unknown }>;
          };
          Object.entries(receiptPayload.data || {}).forEach(([receiptId, receipt]) => {
            const deviceId = receiptDevices.get(receiptId);
            if (!deviceId || receipt.status !== "error") return;
            failedDeviceIds.push(deviceId);
            if (expoErrorCode(receipt) === "DeviceNotRegistered") invalidDeviceIds.push(deviceId);
          });
        }
      } catch {
        // Receipt lookup is best-effort; the durable record remains canonical.
      }
    }

    return {
      sent: tickets.some((ticket) => ticket?.status === "ok"),
      invalidDeviceIds: Array.from(new Set(invalidDeviceIds)),
      failedDeviceIds: Array.from(new Set(failedDeviceIds))
    };
  } catch {
    return { sent: false, invalidDeviceIds: [], failedDeviceIds: devices.map((device) => device.id) };
  }
}

async function findExistingNotification(dedupeKey?: string | null) {
  return dedupeKey ? prisma.notification.findUnique({ where: { dedupeKey } }) : null;
}

export async function createNotification(input: NotificationInput) {
  const activeUser = await prisma.user.findFirst({
    where: { id: input.userId, status: UserStatus.ACTIVE },
    select: { id: true }
  });
  if (!activeUser) return null;

  const existing = await findExistingNotification(input.dedupeKey);
  if (existing) return existing;

  const payload = {
    ...(typeof input.payload === "object" && input.payload ? input.payload : {}),
    notificationType: input.type,
    title: input.title,
    body: input.body
  } as PrismaTypes.InputJsonValue;

  let notification;
  try {
    notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        orderId: input.orderId || undefined,
        dedupeKey: input.dedupeKey || undefined,
        type: input.type,
        payload
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return findExistingNotification(input.dedupeKey);
    }
    throw error;
  }

  const devices = await prisma.pushToken.findMany({
    where: { userId: input.userId, revokedAt: null },
    select: { id: true, token: true }
  });
  const delivery = await sendExpoPush(devices, input.title, input.pushBody || input.body, payload);

  if (delivery.failedDeviceIds.length) {
    await prisma.pushToken.updateMany({
      where: { id: { in: delivery.failedDeviceIds } },
      data: { failureCount: { increment: 1 } }
    });
  }
  if (delivery.invalidDeviceIds.length) {
    await prisma.pushToken.updateMany({
      where: { id: { in: delivery.invalidDeviceIds } },
      data: { revokedAt: new Date() }
    });
  }

  return prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: delivery.sent ? NotificationStatus.SENT : NotificationStatus.PENDING,
      sentAt: delivery.sent ? new Date() : null
    }
  });
}

export async function createNotificationSafely(input: NotificationInput) {
  try {
    return await createNotification(input);
  } catch (error) {
    console.error("Notification delivery failed", {
      type: input.type,
      userId: input.userId,
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export async function createNotifications(inputs: NotificationInput[]) {
  return Promise.all(inputs.map((input) => createNotificationSafely(input)));
}

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() }
  });
  if (result.count !== 1) {
    throw Object.assign(new Error("Notification not found"), {
      status: 404,
      code: "NOTIFICATION_NOT_FOUND"
    });
  }
  return prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
}

export async function savePushToken(userId: string, token: string, platform?: string, deviceId?: string) {
  const stableDeviceId = deviceId || `legacy:${token}`;
  return prisma.$transaction(async (tx) => {
    await tx.pushToken.deleteMany({ where: { token, deviceId: { not: stableDeviceId } } });
    return tx.pushToken.upsert({
      where: { deviceId: stableDeviceId },
      update: {
        userId,
        token,
        platform,
        revokedAt: null,
        failureCount: 0,
        lastSeenAt: new Date()
      },
      create: {
        userId,
        deviceId: stableDeviceId,
        token,
        platform,
        lastSeenAt: new Date()
      }
    });
  });
}

export async function deletePushToken(userId: string, input: { token?: string; deviceId?: string }) {
  return prisma.pushToken.updateMany({
    where: {
      userId,
      ...(input.token ? { token: input.token } : {}),
      ...(input.deviceId ? { deviceId: input.deviceId } : {})
    },
    data: { revokedAt: new Date() }
  });
}
