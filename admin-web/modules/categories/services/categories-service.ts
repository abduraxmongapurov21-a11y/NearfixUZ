import { apiClient, getAdminToken } from "@/services/api-client";
import type { AdminCategory, CategoriesPayload, CategoryInput } from "../types/category";

function token() {
  const value = getAdminToken();
  if (!value) throw new Error("Admin token is missing");
  return value;
}

export async function getCategories(): Promise<CategoriesPayload> {
  const value = getAdminToken();
  if (!value) return { categories: [], iconKeys: [] };
  return apiClient<{ ok: boolean } & CategoriesPayload>("/admin/categories", { token: value });
}

export async function createCategory(input: CategoryInput) {
  const payload = await apiClient<{ ok: boolean; category: AdminCategory }>("/admin/categories", {
    method: "POST", token: token(), body: JSON.stringify(input)
  });
  return payload.category;
}

export async function updateCategory(categoryId: string, input: Partial<Omit<CategoryInput, "slug">>) {
  const payload = await apiClient<{ ok: boolean; category: AdminCategory }>(`/admin/categories/${categoryId}`, {
    method: "PATCH", token: token(), body: JSON.stringify(input)
  });
  return payload.category;
}

export async function reorderCategories(items: { id: string; sortOrder: number }[]) {
  const payload = await apiClient<{ ok: boolean; categories: AdminCategory[] }>("/admin/categories/reorder", {
    method: "PATCH", token: token(), body: JSON.stringify({ items })
  });
  return payload.categories;
}

export async function deleteCategory(categoryId: string) {
  await apiClient<{ ok: boolean }>(`/admin/categories/${categoryId}`, { method: "DELETE", token: token() });
}
