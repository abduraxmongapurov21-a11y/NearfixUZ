import { BannerTargetType } from "@prisma/client";
import { z } from "zod";

function normalizeTargetValue(value?: string | null) {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : undefined;
}

const bannerPayloadShape = z
  .object({
    title: z.string().min(2).max(120).optional(),
    imageUrl: z.string().url().optional(),
    targetType: z.nativeEnum(BannerTargetType).optional(),
    targetValue: z.string().max(500).optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional()
  })
  .superRefine((payload, context) => {
    const targetType = payload.targetType || BannerTargetType.NONE;
    const targetValue = normalizeTargetValue(payload.targetValue);

    if (targetType === BannerTargetType.NONE && targetValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetValue"],
        message: "Target value must be empty for NONE target"
      });
    }

    if (targetType !== BannerTargetType.NONE && !targetValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetValue"],
        message: "Target value is required for selected target type"
      });
    }
  });

export const createBannerSchema = bannerPayloadShape
  .refine((payload) => payload.title, {
    message: "Banner title is required",
    path: ["title"]
  })
  .refine((payload) => payload.imageUrl, {
    message: "Banner image URL is required",
    path: ["imageUrl"]
  })
  .transform((payload) => ({
    title: payload.title!,
    imageUrl: payload.imageUrl!,
    targetType: payload.targetType || BannerTargetType.NONE,
    targetValue: payload.targetType === BannerTargetType.NONE ? undefined : normalizeTargetValue(payload.targetValue),
    sortOrder: payload.sortOrder,
    isActive: payload.isActive ?? true
  }));

export const updateBannerSchema = bannerPayloadShape.transform((payload) => ({
  ...(payload.title !== undefined ? { title: payload.title } : {}),
  ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
  ...(payload.targetType !== undefined ? { targetType: payload.targetType } : {}),
  ...(payload.targetValue !== undefined ? { targetValue: normalizeTargetValue(payload.targetValue) } : {}),
  ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
  ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {})
}));

export const reorderBannersSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int().min(0)
    })
  ).min(1)
});
