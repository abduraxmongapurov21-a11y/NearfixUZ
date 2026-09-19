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
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../auth/auth-context.js";
import { assertUsersNotBlocked } from "../blocks/block.service.js";
import { createNotifications } from "../notifications/notification.service.js";

// Chat participants/senders are public identities, never authentication records.
// Explicit selection also keeps future User fields out of every chat response.
const chatUserSelect = {
  id: true,
  name: true,
  phone: true
} satisfies Prisma.UserSelect;

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
    select: {
      id: true,
      clientId: true,
      cityId: true,
      serviceType: true,
      worker: { select: { userId: true } }
    }
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
        participants: { include: { user: { select: chatUserSelect } } }
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
        participants: { include: { user: { select: chatUserSelect } } }
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
    select: {
      userId: true,
      status: true,
      profession: true,
      user: { select: { name: true, cityId: true } }
    }
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
        participants: { include: { user: { select: chatUserSelect } } },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { sender: { select: chatUserSelect }, media: true }
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
        participants: { include: { user: { select: chatUserSelect } } }
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
      participants: { include: { user: { select: chatUserSelect } } },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { sender: { select: chatUserSelect }, media: true }
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
      participants: { include: { user: { select: chatUserSelect } } }
    }
  });
}

export async function listMessages(user: AuthUser, roomId: string) {
  await assertRoomAccess(user, roomId);

  const [messages, participants] = await Promise.all([
    prisma.chatMessage.findMany({
    where: { roomId },
    include: {
      sender: { select: chatUserSelect },
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
    // lastReadAt is the existing per-user/room cursor. Serialize writers in this
    // room and assign strictly increasing milliseconds, including transactions
    // that started before another message committed. A read boundary can never
    // consume a later, unseen message with an equal/older timestamp.
    await tx.$queryRaw`SELECT id FROM "ChatRoom" WHERE id = ${roomId} FOR UPDATE`;
    const previous = await tx.chatMessage.findFirst({
      where: { roomId }, orderBy: { createdAt: "desc" }, select: { createdAt: true }
    });
    // Legacy reads can advance the cursor in an empty/quiet room. A writer
    // taking the same room lock must also start beyond that reserved boundary.
    const readCursor = await tx.chatParticipant.aggregate({ where: { roomId }, _max: { lastReadAt: true } });
    const createdAt = new Date(Math.max(Date.now(), (previous?.createdAt.getTime() || 0) + 1,
      (readCursor._max.lastReadAt?.getTime() || 0) + 1));
    const message = await tx.chatMessage.create({
      data: {
        roomId,
        orderId: room.orderId,
        senderId: user.id,
        createdAt,
        type: messageType,
        body: input.body?.trim(),
        mediaId: input.mediaId
      },
      include: {
        sender: { select: chatUserSelect },
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
      dedupeKey: `chat-message:${message.id}:${participant.userId}`,
      type: "CHAT_MESSAGE",
      title: "Yangi xabar",
      body: input.body?.trim() || "Media yuborildi",
      pushBody: "Sizga yangi xabar keldi.",
      payload: {
        roomId,
        orderId: room.orderId,
        messageId: message.id
      }
    }))
  );

  return message;
}

// Compatibility for clients that send PATCH /read without a message boundary.
// This acknowledges the room snapshot at lock acquisition, not UI visibility.
export async function markRoomRead(user: AuthUser, roomId: string) {
  await assertRoomAccess(user, roomId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ChatRoom" WHERE id = ${roomId} FOR UPDATE`;
    const latest = await tx.chatMessage.findFirst({
      where: { roomId }, orderBy: { createdAt: "desc" }, select: { createdAt: true }
    });
    const boundary = new Date(Math.max(Date.now(), latest?.createdAt.getTime() || 0));
    await tx.chatParticipant.updateMany({
      where: { roomId, userId: user.id, OR: [
        { lastReadAt: null }, { lastReadAt: { lt: boundary } }
      ] },
      data: { lastReadAt: boundary }
    });
    return tx.chatParticipant.findUniqueOrThrow({
      where: { roomId_userId: { roomId, userId: user.id } }
    });
  });
}

export async function markRoomReadThrough(user: AuthUser, roomId: string, throughMessageId: string) {
  await assertRoomAccess(user, roomId);
  if (!throughMessageId) {
    throw Object.assign(new Error("A displayed message boundary is required"), {
      status: 400, code: "CHAT_READ_BOUNDARY_REQUIRED"
    });
  }
  const boundary = await prisma.chatMessage.findFirst({
    where: { id: throughMessageId, roomId }, select: { createdAt: true }
  });
  if (!boundary) {
    throw Object.assign(new Error("Message does not belong to this room"), {
      status: 400, code: "CHAT_READ_BOUNDARY_INVALID"
    });
  }
  // Conditional update prevents reordered read requests from moving backwards.
  await prisma.chatParticipant.updateMany({
    where: { roomId, userId: user.id, OR: [
      { lastReadAt: null }, { lastReadAt: { lt: boundary.createdAt } }
    ] },
    data: { lastReadAt: boundary.createdAt }
  });
  return prisma.chatParticipant.findUniqueOrThrow({
    where: { roomId_userId: { roomId, userId: user.id } }
  });
}

export async function userCanAccessRoom(user: AuthUser, roomId: string) {
  await assertRoomAccess(user, roomId);
  return true;
}
