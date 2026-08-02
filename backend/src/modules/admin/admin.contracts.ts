import { z } from "zod";
import { serviceLocationContractShape, validateServiceLocationPair } from "../workers/worker.contracts.js";

export const promoteProviderSchema = z.object({
  profession: z.string().min(2).max(80).optional(),
  basePrice: z.number().int().positive().optional(),
  ...serviceLocationContractShape
}).superRefine(validateServiceLocationPair);

export const approveWorkerSchema = z.object({
  cityId: z.string().min(2).max(80).optional(),
  profession: z.string().min(2).max(80).optional(),
  professions: z.array(z.string().min(2).max(80)).min(1).max(5).optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  profileImageUrl: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  basePrice: z.number().int().positive().optional(),
  ...serviceLocationContractShape
}).superRefine(validateServiceLocationPair);

export const workerModerationSchema = z.object({
  reason: z.string().min(3).max(240)
});
