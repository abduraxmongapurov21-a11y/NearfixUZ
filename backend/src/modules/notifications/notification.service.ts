import { NotificationStatus, UserStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

type NotificationInput = {
  userId: string;
  orderId?: string | null;
  type: string;
  title: string;
  body: string;
  payload?: Prisma.InputJsonValue;
};

async function sendExpoPush(tokens: string[], title: string, body: string, data?: Prisma.InputJsonValue) {
  if (!tokens.length) return false;

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title,
          body,
          data
        }))
      )
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function createNotification(input: NotificationInput) {
  const activeUser = await prisma.user.findFirst({
    where: {
      id: input.userId,
      status: UserStatus.ACTIVE
    },
    select: { id: true }
  });

  if (!activeUser) return null;

  const payload = {
    ...(typeof input.payload === "object" && input.payload ? input.payload : {}),
    title: input.title,
    body: input.body
  } as Prisma.InputJsonValue;

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      orderId: input.orderId || undefined,
      type: input.type,
      payload
    }
  });

  const tokens = await prisma.pushToken.findMany({
    where: { userId: input.userId }
  });
  const sent = await sendExpoPush(tokens.map((item) => item.token), input.title, input.body, payload);

  return prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: sent ? NotificationStatus.SENT : NotificationStatus.PENDING,
      sentAt: sent ? new Date() : null
    }
  });
}

export async function createNotifications(inputs: NotificationInput[]) {
  for (const input of inputs) {
    await createNotification(input);
  }
}

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null
    }
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId, userId },
    data: { readAt: new Date() }
  });
}

export async function savePushToken(userId: string, token: string, platform?: string) {
  return prisma.pushToken.upsert({
    where: { token },
    update: {
      userId,
      platform
    },
    create: {
      userId,
      token,
      platform
    }
  });
}

export async function deletePushToken(userId: string, token: string) {
  return prisma.pushToken.deleteMany({
    where: {
      userId,
      token
    }
  });
}
