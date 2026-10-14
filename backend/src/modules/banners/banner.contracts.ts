import { BannerMediaType, BannerPlacement, BannerTargetType } from "@prisma/client";
import { z } from "zod";

export const httpUrlSchema = z.string().url().refine((value) => /^https?:\/\//i.test(value), "HTTP(S) URL required");
const bannerPayloadSchema = z.object({
  title: z.string().trim().min(2).max(120),
  // Kept for compatibility: imageUrl holds the selected image or video URL.
  imageUrl: httpUrlSchema,
  placement: z.nativeEnum(BannerPlacement),
  mediaType: z.nativeEnum(BannerMediaType),
  targetType: z.nativeEnum(BannerTargetType),
  targetValue: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean()
});

function validateBannerTarget(payload: { targetType: BannerTargetType; targetValue?: string | null }, context: z.RefinementCtx) {
  const value = payload.targetValue?.trim();
  if (payload.targetType === BannerTargetType.NONE ? Boolean(value) : !value) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetValue"], message: "Target value must match target type" });
  }
  if (payload.targetType === BannerTargetType.URL && value && !httpUrlSchema.safeParse(value).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetValue"], message: "HTTP(S) target URL required" });
  }
}

export const createBannerSchema = bannerPayloadSchema.extend({
  placement: z.nativeEnum(BannerPlacement).default(BannerPlacement.HOME),
  mediaType: z.nativeEnum(BannerMediaType).default(BannerMediaType.IMAGE),
  targetType: z.nativeEnum(BannerTargetType).default(BannerTargetType.NONE),
  isActive: z.boolean().default(true)
}).superRefine(validateBannerTarget);

// Validate PATCH against the stored target so toggles and target-value-only edits work.
export const updateBannerSchema = bannerPayloadSchema.partial();
export const bannerTargetSchema = bannerPayloadSchema.pick({ targetType: true, targetValue: true }).superRefine(validateBannerTarget);
export const publicBannersQuerySchema = z.object({ placement: z.nativeEnum(BannerPlacement).default(BannerPlacement.HOME) });
export const adminBannersQuerySchema = z.object({ placement: z.nativeEnum(BannerPlacement).optional() });
export const reorderBannersSchema = z.object({
  placement: z.nativeEnum(BannerPlacement).optional(),
  items: z.array(z.object({ id: z.string().min(1), sortOrder: z.number().int().min(0) })).min(1)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Duplicate banner IDs")
});
