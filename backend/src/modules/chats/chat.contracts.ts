import { ChatMessageType, ChatRoomType } from "@prisma/client";
import { z } from "zod";

export const createWorkerGroupRoomSchema = z.object({
  title: z.string().min(2).max(120),
  cityId: z.string().min(2).max(80).optional(),
  serviceType: z.string().min(2).max(80).optional(),
  participantUserIds: z.array(z.string().min(1)).max(100).optional()
});

export const createMessageSchema = z.object({
  body: z.string().max(4000).optional(),
  type: z.nativeEnum(ChatMessageType).default(ChatMessageType.TEXT),
  mediaId: z.string().min(1).optional()
}).refine((value) => Boolean(value.body?.trim() || value.mediaId), {
  message: "Message body or mediaId is required"
});

export const chatRoomTypeSchema = z.nativeEnum(ChatRoomType).optional();
