import {
  ChatMessageType,
  ChatParticipantRole,
  ChatRoomType,
  MediaStatus,
  OrderEventActorType,
  OrderEventType,
  UserRole,
  WorkerProfileStatus
} from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../auth/auth-context.js";
import { assertUsersNotBlocked } from "../blocks/block.service.js";
import { createNotifications } from "../notifications/notification.service.js";

type CreateWorkerGroupRoomInput = {
  title: string;
  cityId?: string;
  serviceType?: string;
  participantUserIds?: string[];
};

type CreateMessageInput = {
  body?: string;
  type: ChatMessageType;
  mediaId?: string;
};

function participantRoleForUser(user: AuthUser): ChatParticipantRole {
  if (user.role === UserRole.ADMIN.toLowerCase()) return ChatParticipantRole.ADMIN;
  if (user.role === UserRole.PROVIDER.toLowerCase()) return ChatParticipantRole.PROVIDER;
  return ChatParticipantRole.CLIENT;
}

function resolveMessageType(inputType: ChatMessageType, mediaMimeType: string | null) {
  if (mediaMimeType?.startsWith("video/")) return ChatMessageType.VIDEO;
  if (mediaMimeType?.startsWith("image/")) return ChatMessageType.IMAGE;
  return inputType;
}

async function assertRoomAccess(user: AuthUser, roomId: string) {
  if (user.role === UserRole.ADMIN.toLowerCase()) {
    const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (room) return room;
  }

  const participant = await prisma.chatParticipant.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId: user.id
      }
    },
    include: { room: true }
  });

  if (!participant) {
    throw Object.assign(new Error("Chat room access denied"), {
      status: 403,
      code: "CHAT_ACCESS_DENIED"
    });
  }

  return participant.room;
}

function assertOrderChatAccess(user: AuthUser, order: { clientId: string; worker: { userId: string } }) {
  const canAccess =
    user.role === UserRole.ADMIN.toLowerCase() ||
    order.clientId === user.id ||
    order.worker.userId === user.id;

  if (!canAccess) {
    throw Object.assign(new Error("Order chat access denied"), {
      status: 403,
      code: "ORDER_CHAT_ACCESS_DENIED"
    });
  }
}

export async function ensureOrderChatRoom(user: AuthUser, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { client: true, worker: { include: { user: true } } }
  });

  if (!order) {
    throw Object.assign(new Error("Order not found"), {
      status: 404,
      code: "ORDER_NOT_FOUND"
    });
  }

  assertOrderChatAccess(user, order);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.chatRoom.findFirst({
      where: {
        type: ChatRoomType.ORDER,
        orderId
      },
      include: {
        participants: { include: { user: true } }
      }
    });

    if (existing) return existing;

    const room = await tx.chatRoom.create({
      data: {
        type: ChatRoomType.ORDER,
        title: `${order.serviceType} buyurtmasi`,
        orderId: order.id,
        cityId: order.cityId,
        serviceType: order.serviceType,
        createdById: order.clientId,
        participants: {
          createMany: {
            data: [
              {
                userId: order.clientId,
                role: ChatParticipantRole.CLIENT
              },
              {
                userId: order.worker.userId,
                role: ChatParticipantRole.PROVIDER
              }
            ],
            skipDuplicates: true
          }
        }
      },
      include: {
        participants: { include: { user: true } }
      }
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: OrderEventActorType.SYSTEM,
        eventType: OrderEventType.SUPPORT_NOTE_ADDED,
        message: "Order chat room created",
        metadata: { chatRoomId: room.id }
      }
    });

    return room;
  });
}

export async function ensureWorkerDirectChatRoom(user: AuthUser, workerId: string) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    include: { user: true }
  });

  if (!worker || worker.status !== WorkerProfileStatus.APPROVED) {
    throw Object.assign(new Error("Worker not found"), {
      status: 404,
      code: "WORKER_NOT_FOUND"
    });
  }

  if (worker.userId === user.id) {
    throw Object.assign(new Error("Cannot create chat with yourself"), {
      status: 409,
      code: "SELF_CHAT_NOT_ALLOWED"
    });
  }

  await assertUsersNotBlocked(user.id, worker.userId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.chatRoom.findFirst({
      where: {
        type: { in: [ChatRoomType.DIRECT, ChatRoomType.ORDER] },
        AND: [
          {
            participants: {
              some: { userId: user.id }
            }
          },
          {
            participants: {
              some: { userId: worker.userId }
            }
          }
        ]
      },
      include: {
        participants: { include: { user: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { sender: true, media: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    if (existing) {
      const lastMessage = existing.messages[0] || null;
      return { ...existing, lastMessage };
    }

    return tx.chatRoom.create({
      data: {
        type: ChatRoomType.DIRECT,
        title: `${worker.user.name || worker.profession || "Usta"} bilan chat`,
        cityId: worker.user.cityId,
        serviceType: worker.profession,
        createdById: user.id,
        participants: {
          createMany: {
            data: [
              {
                userId: user.id,
                role: participantRoleForUser(user)
              },
              {
                userId: worker.userId,
                role: ChatParticipantRole.PROVIDER
              }
            ],
            skipDuplicates: true
          }
        }
      },
      include: {
        participants: { include: { user: true } }
      }
    });
  });
}

export async function listChatRooms(user: AuthUser, type?: ChatRoomType) {
  const where =
    user.role === UserRole.ADMIN.toLowerCase()
      ? { type }
      : {
          type,
          participants: {
            some: {
              userId: user.id
            }
          }
        };

  const rooms = await prisma.chatRoom.findMany({
    where,
    include: {
      order: true,
      participants: { include: { user: true } },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { sender: true, media: true }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return Promise.all(rooms.map(async (room) => {
    const participant = room.participants.find((item) => item.userId === user.id);
    const lastMessage = room.messages[0] || null;
    const unreadCount = await prisma.chatMessage.count({
      where: {
        roomId: room.id,
        senderId: { not: user.id },
        ...(participant?.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {})
      }
    });

    return {
      ...room,
      lastMessage,
      unreadCount
    };
  }));
}

export async function createWorkerGroupRoom(user: AuthUser, input: CreateWorkerGroupRoomInput) {
  if (![UserRole.ADMIN.toLowerCase(), UserRole.PROVIDER.toLowerCase()].includes(user.role)) {
    throw Object.assign(new Error("Only admin or provider can create worker group rooms"), {
      status: 403,
      code: "WORKER_GROUP_ACCESS_DENIED"
    });
  }

  const participantIds = Array.from(new Set([user.id, ...(input.participantUserIds || [])]));

  return prisma.chatRoom.create({
    data: {
      type: ChatRoomType.WORKER_GROUP,
      title: input.title,
      cityId: input.cityId,
      serviceType: input.serviceType,
      createdById: user.id,
      participants: {
        createMany: {
          data: participantIds.map((userId) => ({
            userId,
            role: userId === user.id ? participantRoleForUser(user) : ChatParticipantRole.PROVIDER
          })),
          skipDuplicates: true
        }
      }
    },
    include: {
      participants: { include: { user: true } }
    }
  });
}

export async function listMessages(user: AuthUser, roomId: string) {
  await assertRoomAccess(user, roomId);

  const [messages, participants] = await Promise.all([
    prisma.chatMessage.findMany({
    where: { roomId },
    include: {
      sender: true,
      media: true
    },
    orderBy: { createdAt: "asc" }
    }),
    prisma.chatParticipant.findMany({
      where: { roomId }
    })
  ]);

  return messages.map((message) => ({
    ...message,
    readByOthers: participants.some((participant) =>
      participant.userId !== message.senderId &&
      Boolean(participant.lastReadAt && participant.lastReadAt >= message.createdAt)
    )
  }));
}

export async function createMessage(user: AuthUser, roomId: string, input: CreateMessageInput) {
  const room = await assertRoomAccess(user, roomId);
  let attachedMediaMimeType: string | null = null;

  if (room.type === ChatRoomType.DIRECT) {
    const counterpart = await prisma.chatParticipant.findFirst({
      where: { roomId, userId: { not: user.id } },
      select: { userId: true }
    });
    if (counterpart) await assertUsersNotBlocked(user.id, counterpart.userId);
  }

  if (input.mediaId) {
    const media = await prisma.media.findUnique({ where: { id: input.mediaId } });
    if (!media || media.ownerId !== user.id || (media.roomId && media.roomId !== roomId)) {
      throw Object.assign(new Error("Media is not available for this chat"), {
        status: 403,
        code: "MEDIA_ACCESS_DENIED"
      });
    }
    attachedMediaMimeType = media.mimeType;
  }

  const messageType = input.mediaId ? resolveMessageType(input.type, attachedMediaMimeType) : ChatMessageType.TEXT;

  const message = await prisma.$transaction(async (tx) => {
    const message = await tx.chatMessage.create({
      data: {
        roomId,
        orderId: room.orderId,
        senderId: user.id,
        type: messageType,
        body: input.body?.trim(),
        mediaId: input.mediaId
      },
      include: {
        sender: true,
        media: true
      }
    });

    await tx.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() }
    });

    if (input.mediaId) {
      await tx.media.update({
        where: { id: input.mediaId },
        data: {
          roomId,
          orderId: room.orderId,
          status: MediaStatus.READY
        }
      });
    }

    return message;
  });

  const recipients = await prisma.chatParticipant.findMany({
    where: {
      roomId,
      userId: { not: user.id }
    }
  });

  await createNotifications(
    recipients.map((participant) => ({
      userId: participant.userId,
      orderId: room.orderId,
      type: "CHAT_MESSAGE",
      title: "Yangi xabar",
      body: input.body?.trim() || "Rasm yuborildi",
      payload: {
        roomId,
        orderId: room.orderId,
        messageId: message.id
      }
    }))
  );

  return message;
}

export async function markRoomRead(user: AuthUser, roomId: string) {
  await assertRoomAccess(user, roomId);

  return prisma.chatParticipant.update({
    where: {
      roomId_userId: {
        roomId,
        userId: user.id
      }
    },
    data: {
      lastReadAt: new Date()
    }
  });
}

export async function userCanAccessRoom(user: AuthUser, roomId: string) {
  await assertRoomAccess(user, roomId);
  return true;
}
