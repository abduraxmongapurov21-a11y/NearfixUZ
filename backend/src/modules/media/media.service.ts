import { MediaScope, MediaStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../auth/auth-context.js";
import { userCanAccessRoom } from "../chats/chat.service.js";
import { getOrderForUser } from "../orders/order.service.js";

type CreateUploadedMediaInput = {
  roomId?: string;
  orderId?: string;
  scope?: MediaScope;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
};

function scopeFromMimeType(mimeType: string, requestedScope?: MediaScope) {
  if (requestedScope) return requestedScope;
  if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) return MediaScope.CHAT;
  return MediaScope.CHAT;
}

export async function createUploadedMedia(user: AuthUser, input: CreateUploadedMediaInput) {
  if (input.roomId) {
    await userCanAccessRoom(user, input.roomId);
  }

  if (input.orderId) {
    await getOrderForUser(user, input.orderId);
  }

  return prisma.media.create({
    data: {
      ownerId: user.id,
      roomId: input.roomId,
      orderId: input.orderId,
      scope: scopeFromMimeType(input.mimeType, input.scope),
      url: input.url,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.size,
      status: MediaStatus.READY
    }
  });
}
