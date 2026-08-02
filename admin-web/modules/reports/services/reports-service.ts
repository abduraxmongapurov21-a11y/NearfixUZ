import { apiClient, getAdminToken } from "@/services/api-client";

export type AdminReport = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details?: string | null;
  status: string;
  adminNote?: string | null;
  createdAt: string;
  reporter: { id: string; name?: string | null; phone: string; role: string; status: string };
  target?: Record<string, unknown> | null;
};

function token() {
  const value = getAdminToken();
  if (!value) throw new Error("Admin authentication required");
  return value;
}

export async function getReports(filters = "") {
  const payload = await apiClient<{ reports: AdminReport[] }>(`/admin/reports${filters}`, { token: token() });
  return payload.reports;
}

export async function getReport(reportId: string) {
  const payload = await apiClient<{ report: AdminReport }>(`/admin/reports/${reportId}`, { token: token() });
  return payload.report;
}

export async function updateReport(reportId: string, status: string, adminNote: string) {
  await apiClient(`/admin/reports/${reportId}/status`, {
    method: "PATCH",
    token: token(),
    body: JSON.stringify({ status, adminNote })
  });
}

export async function suspendUser(userId: string) {
  await apiClient(`/admin/users/${userId}/suspend`, { method: "POST", token: token() });
}

export async function moderateReview(reviewId: string, action: "hide" | "restore") {
  await apiClient(`/admin/reviews/${reviewId}/${action}`, { method: "PATCH", token: token() });
}
