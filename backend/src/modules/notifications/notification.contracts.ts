import { z } from "zod";

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
