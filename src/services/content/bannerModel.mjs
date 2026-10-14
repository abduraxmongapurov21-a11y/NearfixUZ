import { findCategoryByLegacyValue } from "./categoryModel.mjs";

export function mapApiBanner(banner) {
  return {
    id: banner.id,
    title: banner.title || "NearFIX",
    imageUrl: banner.imageUrl || "",
    placement: banner.placement === "CATEGORY" ? "CATEGORY" : "HOME",
    mediaType: banner.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
    targetType: String(banner.targetType || "NONE").toUpperCase(),
    targetValue: banner.targetValue || "",
    sortOrder: Number.isFinite(Number(banner.sortOrder)) ? Number(banner.sortOrder) : 0,
    isActive: Boolean(banner.isActive)
  };
}

export function resolveBannerTarget(banner, categories) {
  if (banner.targetType === "CATEGORY") {
    const category = findCategoryByLegacyValue(categories, banner.targetValue);
    return category?.isActive ? { kind: "category", categoryId: category.id } : null;
  }
  if (banner.targetType === "URL") {
    try {
      const url = new URL(banner.targetValue);
      if (["http:", "https:"].includes(url.protocol)) return { kind: "url", url: url.href };
    } catch { /* Invalid legacy links are not actionable. */ }
  }
  return null;
}

export function nextBannerIndex(index, count) {
  return count > 0 ? (index + 1) % count : 0;
}

export function bannersForPlacement(banners, placement) {
  return (banners || [])
    .filter((banner) => banner.isActive && (banner.placement || "HOME") === placement)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
