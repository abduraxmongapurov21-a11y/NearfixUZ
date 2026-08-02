import { apiRequest, httpRequest } from "../api/client";

export function mapApiBanner(banner) {
  return {
    id: banner.id,
    title: banner.title || "NearFIX",
    imageUrl: banner.imageUrl || "",
    targetType: String(banner.targetType || "NONE").toUpperCase(),
    targetValue: banner.targetValue || "",
    sortOrder: Number.isFinite(Number(banner.sortOrder)) ? Number(banner.sortOrder) : 0,
    isActive: Boolean(banner.isActive)
  };
}

export async function fetchBannersApi() {
  return apiRequest(
    async () => {
      const payload = await httpRequest("/content/banners");
      return {
        ok: true,
        banners: (payload.banners || []).map(mapApiBanner)
      };
    },
    () => ({
      ok: true,
      banners: []
    })
  );
}
