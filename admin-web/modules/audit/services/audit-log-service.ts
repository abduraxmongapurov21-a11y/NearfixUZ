import { apiClient, getAdminToken } from "@/services/api-client";
import type { AdminAuditLogsQuery, AdminAuditLogsResult } from "../types/audit-log";

function requireToken() {
  const token = getAdminToken();
  if (!token) throw new Error("Admin token is missing");
  return token;
}

function buildQueryString(query: AdminAuditLogsQuery) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const value = params.toString();
  return value ? `?${value}` : "";
}

export async function getAdminAuditLogs(query: AdminAuditLogsQuery): Promise<AdminAuditLogsResult> {
  const payload = await apiClient<{ ok: true } & AdminAuditLogsResult>(
    `/admin/audit-logs${buildQueryString(query)}`,
    { token: requireToken() }
  );

  return {
    logs: payload.logs,
    pagination: payload.pagination
  };
}
