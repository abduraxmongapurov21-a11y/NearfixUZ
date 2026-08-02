import { z } from "zod";
import { SupportTicketStatus } from "@prisma/client";

export const createSupportTicketSchema = z.object({
  orderId: z.string().min(1).optional(),
  reason: z.string().min(3).max(120),
  message: z.string().max(1000).optional()
});

export const updateSupportTicketSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus),
  adminNote: z.string().trim().max(2000).optional()
});
