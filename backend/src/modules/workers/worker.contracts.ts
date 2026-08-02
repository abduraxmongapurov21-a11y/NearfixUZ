import { WorkerAvailabilityStatus } from "@prisma/client";
import { z } from "zod";

export const serviceLocationContractShape = {
  serviceLat: z.number().min(-90).max(90).optional(),
  serviceLng: z.number().min(-180).max(180).optional()
};

export function validateServiceLocationPair(
  value: { serviceLat?: number; serviceLng?: number },
  context: z.RefinementCtx
) {
  const hasLatitude = value.serviceLat !== undefined;
  const hasLongitude = value.serviceLng !== undefined;

  if (hasLatitude !== hasLongitude) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "serviceLat and serviceLng must be provided together",
      path: hasLatitude ? ["serviceLng"] : ["serviceLat"]
    });
  }
}

export const updateWorkerProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  cityId: z.string().min(2).max(80).optional(),
  profession: z.string().min(2).max(80).optional(),
  professions: z.array(z.string().min(2).max(80)).min(1).max(5).optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  profileImageUrl: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  basePrice: z.number().int().positive().optional(),
  ...serviceLocationContractShape
}).superRefine(validateServiceLocationPair);

export const updateWorkerServiceLocationSchema = z.object({
  serviceLat: z.number().min(-90).max(90),
  serviceLng: z.number().min(-180).max(180)
}).strict();

export const catalogWorkersQuerySchema = z.object({
  cityId: z.string().min(1).max(80).optional(),
  profession: z.string().min(1).max(80).optional(),
  category: z.string().min(1).max(80).optional(),
  originAddressId: z.string().min(1).max(191).optional(),
  sort: z.enum(["nearest"]).optional()
});

export const updateAvailabilitySchema = z.object({
  status: z.nativeEnum(WorkerAvailabilityStatus)
});
