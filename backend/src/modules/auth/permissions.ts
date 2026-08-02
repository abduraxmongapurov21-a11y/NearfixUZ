import { UserRole } from "@prisma/client";

export const ADMIN_PERMISSIONS = [
  "analytics.read",
  "users.read",
  "users.manage",
  "workers.read",
  "workers.manage",
  "orders.read",
  "orders.manage",
  "reviews.read",
  "reviews.manage",
  "reports.read",
  "reports.manage",
  "support.read",
  "support.manage",
  "content.read",
  "content.manage",
  "notifications.read",
  "notifications.manage",
  "audit.read",
  "admins.read",
  "admins.manage",
  "super_admin.manage"
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

export function isAdminPermission(value: string): value is AdminPermission {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

export function isAdminRole(role: string) {
  const value = role.toUpperCase();
  return value === UserRole.ADMIN || value === UserRole.SUPER_ADMIN;
}

export function isSuperAdminRole(role: string) {
  return role.toUpperCase() === UserRole.SUPER_ADMIN;
}
