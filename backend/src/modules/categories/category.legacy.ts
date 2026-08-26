import type { Category } from "@prisma/client";

export const RELEASED_CATEGORY_LEGACY_ALIASES = Object.freeze({
  plumbing: ["Santexnik", "plumbing"],
  electric: ["Elektrik", "electric"],
  welding: ["Payvandchi", "welding"],
  repair: ["Usta", "repair"],
  ac: ["Konditsioner", "ac"],
  renovation: ["Ta'mirlash", "renovation"],
  cleaning: ["Tozalash", "cleaning"]
} as const);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

const releasedSlugByAlias = new Map<string, string>();
for (const [slug, aliases] of Object.entries(RELEASED_CATEGORY_LEGACY_ALIASES)) {
  releasedSlugByAlias.set(normalize(slug), slug);
  aliases.forEach((alias) => releasedSlugByAlias.set(normalize(alias), slug));
}

export function releasedCategorySlugForLegacyValue(value: string) {
  return releasedSlugByAlias.get(normalize(value));
}

export function immutableLegacyNameForCategory(category: Pick<Category, "slug" | "nameUz">) {
  return RELEASED_CATEGORY_LEGACY_ALIASES[category.slug as keyof typeof RELEASED_CATEGORY_LEGACY_ALIASES]?.[0]
    || category.nameUz;
}
