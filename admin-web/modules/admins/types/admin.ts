import type { AdminPermission } from "@/shared/auth/permissions";

export type AdminAccountRole = "ADMIN" | "SUPER_ADMIN";
export type AdminAccountStatus = "ACTIVE" | "DISABLED";

export type ManagedAdmin = {
  id: string;
  username: string;
  name: string | null;
  role: AdminAccountRole;
  status: AdminAccountStatus;
  permissions: AdminPermission[];
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  passwordChangedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateAdminInput = {
  username: string;
  password: string;
  name?: string;
  role?: AdminAccountRole;
  permissions?: AdminPermission[];
  mustChangePassword?: boolean;
};

export type UpdateAdminInput = {
  name?: string | null;
  role?: AdminAccountRole;
  status?: AdminAccountStatus;
  mustChangePassword?: boolean;
};

export type ResetAdminPasswordInput = {
  password: string;
  mustChangePassword?: boolean;
};

export type ReplaceAdminPermissionsInput = {
  permissions: AdminPermission[];
};
