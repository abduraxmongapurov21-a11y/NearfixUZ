export function mapApiCategory(category) {
  return {
    id: String(category.id),
    slug: String(category.slug || ""),
    nameUz: String(category.nameUz || ""),
    nameRu: String(category.nameRu || category.nameUz || ""),
    nameEn: String(category.nameEn || category.nameUz || ""),
    iconKey: String(category.iconKey || "grid"),
    sortOrder: Number.isFinite(Number(category.sortOrder)) ? Number(category.sortOrder) : 0,
    isActive: Boolean(category.isActive)
  };
}

export function categoryName(category, locale) {
  if (!category) return "";
  if (String(locale).startsWith("ru")) return category.nameRu || category.nameUz;
  if (String(locale).startsWith("en")) return category.nameEn || category.nameUz;
  return category.nameUz;
}

export function findCategoryByLegacyValue(categories, value) {
  const normalized = String(value || "").trim().toLowerCase();
  return (categories || []).find((category) =>
    [category.id, category.slug, category.nameUz, category.nameRu, category.nameEn]
      .some((candidate) => String(candidate || "").trim().toLowerCase() === normalized)
  );
}

export function workerCategoryLabel(worker, locale) {
  const category = worker?.categories?.[0];
  return { label: category ? categoryName(category, locale) : worker?.specialty || "Usta", dynamic: Boolean(category) };
}
