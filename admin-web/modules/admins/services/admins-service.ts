import { ApiClientError, apiClient, getAdminToken } from "@/services/api-client";
import type {
  AdminAccountRole,
  AdminAccountStatus,
  CreateAdminInput,
  ManagedAdmin,
  ReplaceAdminPermissionsInput,
  ResetAdminPasswordInput,
  UpdateAdminInput
} from "../types/admin";

type ManagedAdminApi = Omit<ManagedAdmin, "role" | "status"> & {
  role: AdminAccountRole | "admin" | "super_admin";
  status: AdminAccountStatus | "active" | "disabled";
  isActive?: boolean;
};

function requireToken() {
  const token = getAdminToken();
  if (!token) throw new Error("Admin token is missing");
  return token;
}

export function getAdminErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiClientError)) return error instanceof Error ? error.message : fallback;

  switch (error.code) {
    case "ADMIN_UNAUTHORIZED":
      return "Sessiya tugagan. Qayta kiring.";
    case "ADMIN_DISABLED":
      return "Bu admin akkaunt o'chirilgan.";
    case "ADMIN_ACCESS_DENIED":
    case "PERMISSION_REQUIRED":
    case "SUPER_ADMIN_REQUIRED":
      return "Bu amal uchun ruxsat yetarli emas.";
    case "ADMIN_USERNAME_EXISTS":
      return "Bu username bilan admin allaqachon mavjud.";
    case "INVALID_ADMIN_PASSWORD":
    case "ADMIN_PASSWORD_WEAK":
      return "Password kamida 10 belgi bo'lsin, username ichida bo'lmasin va oddiy password bo'lmasin.";
    case "VALIDATION_ERROR":
      return "Username kamida 3 belgi, name bo'lsa kamida 2 belgi, password esa to'g'ri kiritilishi kerak.";
    default:
      if (error.status === 400) return "Kiritilgan ma'lumotlarni tekshiring.";
      return fallback;
  }
}

function normalizeRole(role: ManagedAdminApi["role"]): AdminAccountRole {
  return role === "SUPER_ADMIN" || role === "super_admin" ? "SUPER_ADMIN" : "ADMIN";
}

function normalizeStatus(status: ManagedAdminApi["status"]): AdminAccountStatus {
  return status === "DISABLED" || status === "disabled" ? "DISABLED" : "ACTIVE";
}

function mapAdmin(admin: ManagedAdminApi): ManagedAdmin {
  return {
    ...admin,
    role: normalizeRole(admin.role),
    status: normalizeStatus(admin.status)
  };
}

export async function getAdmins(): Promise<ManagedAdmin[]> {
  const payload = await apiClient<{ ok: boolean; admins: ManagedAdminApi[] }>("/admin/admins", {
    token: requireToken()
  });
  return payload.admins.map(mapAdmin);
}

export async function createAdmin(input: CreateAdminInput): Promise<ManagedAdmin> {
  const payload = await apiClient<{ ok: boolean; admin: ManagedAdminApi }>("/admin/admins", {
    method: "POST",
    token: requireToken(),
    body: JSON.stringify(input)
  });
  return mapAdmin(payload.admin);
}

export async function updateAdmin(adminId: string, input: UpdateAdminInput): Promise<ManagedAdmin> {
  const payload = await apiClient<{ ok: boolean; admin: ManagedAdminApi }>(`/admin/admins/${adminId}`, {
    method: "PATCH",
    token: requireToken(),
    body: JSON.stringify(input)
  });
  return mapAdmin(payload.admin);
}

export async function resetAdminPassword(
  adminId: string,
  input: ResetAdminPasswordInput
): Promise<ManagedAdmin> {
  const payload = await apiClient<{ ok: boolean; admin: ManagedAdminApi }>(`/admin/admins/${adminId}/password`, {
    method: "PATCH",
    token: requireToken(),
    body: JSON.stringify(input)
  });
  return mapAdmin(payload.admin);
}

export async function replaceAdminPermissions(
  adminId: string,
  input: ReplaceAdminPermissionsInput
): Promise<ManagedAdmin> {
  const payload = await apiClient<{ ok: boolean; admin: ManagedAdminApi }>(`/admin/admins/${adminId}/permissions`, {
    method: "PATCH",
    token: requireToken(),
    body: JSON.stringify(input)
  });
  return mapAdmin(payload.admin);
}

export async function setAdminEnabled(adminId: string, enabled: boolean): Promise<ManagedAdmin> {
  const payload = await apiClient<{ ok: boolean; admin: ManagedAdminApi }>(
    `/admin/admins/${adminId}/${enabled ? "enable" : "disable"}`,
    {
      method: "PATCH",
      token: requireToken()
    }
  );
  return mapAdmin(payload.admin);
}
