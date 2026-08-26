import { z } from "zod";

export const CATEGORY_ICON_KEYS = [
  "wrench",
  "zap",
  "flame",
  "hammer",
  "snowflake",
  "paint",
  "sparkles",
  "brush",
  "grid"
] as const;

export const categoryIconKeySchema = z.enum(CATEGORY_ICON_KEYS);

export const createCategorySchema = z.object({
  slug: z.string().trim().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameUz: z.string().trim().min(2).max(80),
  nameRu: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  iconKey: categoryIconKeySchema,
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
}).strict();

// Slug is deliberately absent: it is immutable after creation.
export const updateCategorySchema = z.object({
  nameUz: z.string().trim().min(2).max(80).optional(),
  nameRu: z.string().trim().min(2).max(80).optional(),
  nameEn: z.string().trim().min(2).max(80).optional(),
  iconKey: categoryIconKeySchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
}).strict();

export const reorderCategoriesSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    sortOrder: z.number().int().min(0)
  }).strict()).min(1)
}).strict().superRefine((input, context) => {
  const ids = input.items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Category IDs must be unique", path: ["items"] });
  }
  const positions = input.items.map((item) => item.sortOrder);
  if (new Set(positions).size !== positions.length || positions.some((value) => value >= positions.length)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "sortOrder must be a contiguous zero-based sequence", path: ["items"] });
  }
});

export const categoryIdsSchema = z.array(z.string().min(1)).min(1).max(5);
