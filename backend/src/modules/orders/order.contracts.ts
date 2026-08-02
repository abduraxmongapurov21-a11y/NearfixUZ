import { OrderStatus, OrderUrgency } from "@prisma/client";
import { z } from "zod";

export const createOrderSchema = z.object({
  workerId: z.string().min(1),
  addressId: z.string().min(1).optional(),
  cityId: z.string().min(1),
  serviceType: z.string().min(2).max(80),
  problemTitle: z.string().min(3).max(160),
  problemDescription: z.string().max(1200).optional(),
  urgency: z.nativeEnum(OrderUrgency).default(OrderUrgency.FAST),
  priceEstimate: z.number().int().positive().optional()
});

export const transitionOrderSchema = z.object({
  status: z.enum([
    OrderStatus.ON_THE_WAY,
    OrderStatus.IN_PROGRESS,
    OrderStatus.COMPLETED
  ])
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(3).max(240)
});

export const rejectOrderSchema = cancelOrderSchema;
