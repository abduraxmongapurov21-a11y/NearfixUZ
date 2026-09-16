import { apiClient, getAdminToken } from "@/services/api-client";
import type { DashboardSummary } from "@/contracts/admin";

export async function getDashboardSummary() {
  const token = getAdminToken();
  if (!token) throw new Error("Admin sifatida kirish talab qilinadi");

  const payload = await apiClient<{ ok: boolean; summary: DashboardSummary }>("/admin/dashboard", { token });
  return payload.summary;
}
