import { apiClient, getAdminToken } from "@/services/api-client";
import type { AdminBanner, BannerInput } from "../types/banner";

function getApiBaseUrl() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBaseUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  return apiBaseUrl;
}

export async function getBanners(): Promise<AdminBanner[]> {
  const token = getAdminToken();
  if (!token) return [];

  const payload = await apiClient<{ ok: boolean; banners: AdminBanner[] }>("/admin/banners", { token });
  return payload.banners;
}

export async function createBanner(input: BannerInput): Promise<AdminBanner> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin token is missing");

  const payload = await apiClient<{ ok: boolean; banner: AdminBanner }>("/admin/banners", {
    method: "POST",
    token,
    body: JSON.stringify(input)
  });

  return payload.banner;
}

export async function updateBanner(bannerId: string, input: Partial<BannerInput>): Promise<AdminBanner> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin token is missing");

  const payload = await apiClient<{ ok: boolean; banner: AdminBanner }>(`/admin/banners/${bannerId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input)
  });

  return payload.banner;
}

export async function deleteBanner(bannerId: string) {
  const token = getAdminToken();
  if (!token) throw new Error("Admin token is missing");

  await apiClient<{ ok: boolean }>(`/admin/banners/${bannerId}`, {
    method: "DELETE",
    token
  });
}

export async function reorderBanners(items: { id: string; sortOrder: number }[]) {
  const token = getAdminToken();
  if (!token) throw new Error("Admin token is missing");

  const payload = await apiClient<{ ok: boolean; banners: AdminBanner[] }>("/admin/banners/reorder", {
    method: "PATCH",
    token,
    body: JSON.stringify({ items })
  });

  return payload.banners;
}

export async function uploadBannerImage(file: File): Promise<string> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin token is missing");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiBaseUrl()}/admin/banners/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "Banner image upload failed");
  }

  return payload.imageUrl;
}
