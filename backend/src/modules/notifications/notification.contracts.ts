import { z } from "zod";

export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().min(1).max(1024).optional()
});

export const pushTokenSchema = z.object({
  token: z.string().min(10).max(512),
  platform: z.string().min(2).max(40).optional(),
  deviceId: z.string().min(10).max(160).optional()
});

export const deletePushTokenSchema = z.object({
  token: z.string().min(10).max(512).optional(),
  deviceId: z.string().min(10).max(160).optional()
}).refine((input) => Boolean(input.token || input.deviceId), {
  message: "token or deviceId is required"
});
