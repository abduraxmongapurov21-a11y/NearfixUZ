import { z } from "zod";

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1200).optional(),
  text: z.string().max(1200).optional()
}).transform((payload) => ({
  rating: payload.rating,
  comment: payload.comment ?? payload.text
}));
