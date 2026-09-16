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
  categoryId: z.string().min(1).max(191).optional(),
  serviceType: z.string().min(2).max(80).optional(),
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
  if (!input.categoryId && !input.serviceType) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either categoryId or serviceType is required",
      path: ["categoryId"]
    });
  }
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

const workerOrderLocationSchema = z.object({
  addressText: z.string().trim().min(4).max(240),
  label: z.string().trim().min(2).max(60).optional(),
  district: z.string().trim().max(80).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional()
}).superRefine((location, context) => {
  if (Boolean(location.latitude === undefined) !== Boolean(location.longitude === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Latitude and longitude must be provided together",
      path: ["latitude"]
    });
  }
});

export const createWorkerOrderSchema = z.object({
  clientPhone: z.string().min(7).max(32),
  clientName: z.string().trim().min(2).max(80).optional(),
  categoryId: z.string().min(1).max(191),
  description: z.string().trim().min(3).max(1200),
  location: workerOrderLocationSchema,
  priceEstimate: z.number().int().positive().max(2_000_000_000).optional()
}).strict();

export type CreateWorkerOrderInput = z.infer<typeof createWorkerOrderSchema>;

export const transitionOrderSchema = z.object({
  status: z.enum([
    OrderStatus.ON_THE_WAY,
    OrderStatus.IN_PROGRESS,
    OrderStatus.COMPLETED
  ])
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3).max(240)
});

export const rejectOrderSchema = cancelOrderSchema;
