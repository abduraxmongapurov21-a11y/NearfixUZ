import { OrderStatus, OrderUrgency } from "@prisma/client";
import { z } from "zod";

export const orderLocationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  addressText: z.string().trim().min(4).max(240),
  label: z.string().trim().min(2).max(60).optional(),
  district: z.string().trim().max(80).optional()
});

export const createOrderSchema = z.object({
  workerId: z.string().min(1),
  addressId: z.string().min(1).optional(),
  location: orderLocationSchema.optional(),
  cityId: z.string().min(1),
  serviceType: z.string().min(2).max(80),
  problemTitle: z.string().min(3).max(160),
  problemDescription: z.string().max(1200).optional(),
  urgency: z.nativeEnum(OrderUrgency).default(OrderUrgency.FAST),
  priceEstimate: z.number().int().positive().optional()
}).superRefine((input, context) => {
  const sourceCount = Number(Boolean(input.addressId)) + Number(Boolean(input.location));
  if (sourceCount !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exactly one of addressId or location is required",
      path: ["location"]
    });
  }
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

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
