import { z } from "zod";
import { ADMIN_PERMISSIONS } from "../auth/permissions.js";

const adminRoleSchema = z.enum(["ADMIN", "SUPER_ADMIN"]);
const adminStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
const permissionsSchema = z.array(z.enum(ADMIN_PERMISSIONS));

export const createAdminSchema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().min(1).max(256),
  name: z.string().trim().min(2).max(120).optional(),
  role: adminRoleSchema.optional(),
  permissions: permissionsSchema.optional(),
  mustChangePassword: z.boolean().optional()
});

export const updateAdminSchema = z.object({
  name: z.string().trim().min(2).max(120).nullable().optional(),
  role: adminRoleSchema.optional(),
  status: adminStatusSchema.optional(),
  mustChangePassword: z.boolean().optional()
});

export const resetAdminPasswordSchema = z.object({
  password: z.string().min(1).max(256),
  mustChangePassword: z.boolean().optional()
});

export const replaceAdminPermissionsSchema = z.object({
  permissions: permissionsSchema
});

export const adminPermissionSchema = z.object({
  permission: z.enum(ADMIN_PERMISSIONS)
});
