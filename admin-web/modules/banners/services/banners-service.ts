import { apiClient, getAdminToken, getApiUrl } from "@/services/api-client";
import type { AdminBanner, BannerInput, BannerMediaType, BannerPlacement } from "../types/banner";

export async function getBanners(placement: BannerPlacement): Promise<AdminBanner[]> {
  const token = getAdminToken();
  if (!token) return [];

  const payload = await apiClient<{ ok: boolean; banners: AdminBanner[] }>(`/admin/banners?placement=${placement}`, { token });
  return payload.banners;
}

export async function createBanner(input: BannerInput): Promise<AdminBanner> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin sessiyasi topilmadi");

  const payload = await apiClient<{ ok: boolean; banner: AdminBanner }>("/admin/banners", {
    method: "POST",
    token,
    body: JSON.stringify(input)
  });

  return payload.banner;
}

export async function updateBanner(bannerId: string, input: Partial<BannerInput>): Promise<AdminBanner> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin sessiyasi topilmadi");

  const payload = await apiClient<{ ok: boolean; banner: AdminBanner }>(`/admin/banners/${bannerId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input)
  });

  return payload.banner;
}

export async function deleteBanner(bannerId: string) {
  const token = getAdminToken();
  if (!token) throw new Error("Admin sessiyasi topilmadi");

  await apiClient<{ ok: boolean }>(`/admin/banners/${bannerId}`, {
    method: "DELETE",
    token
  });
}

export async function reorderBanners(items: { id: string; sortOrder: number }[], placement: BannerPlacement) {
  const token = getAdminToken();
  if (!token) throw new Error("Admin sessiyasi topilmadi");

  const payload = await apiClient<{ ok: boolean; banners: AdminBanner[] }>("/admin/banners/reorder", {
    method: "PATCH",
    token,
    body: JSON.stringify({ items, placement })
  });

  return payload.banners;
}

export async function uploadBannerMedia(file: File): Promise<{ imageUrl: string; mediaType: BannerMediaType }> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin sessiyasi topilmadi");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(getApiUrl("/admin/banners/upload"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "Reklama faylini yuklab bo'lmadi");
  }

  return { imageUrl: payload.imageUrl, mediaType: payload.mediaType || "IMAGE" };
}
