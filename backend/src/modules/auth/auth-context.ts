import type { Request } from "express";
import { UserRole } from "@prisma/client";
import { bearerTokenSchema } from "./auth.contracts.js";
import { getSessionUser } from "./auth.service.js";
import { verifyEnvAdminToken } from "../admin-auth/admin-auth.service.js";
import type { AdminPermission } from "./permissions.js";
import { isAdminRole } from "./permissions.js";

export type AuthUser = {
  id: string;
  sessionId: string;
  phone: string;
  username?: string;
  name: string | null;
  role: string;
  permissions: AdminPermission[];
  sessionVersion: number;
};

export async function requireAuth(request: Request): Promise<AuthUser> {
  const token = bearerTokenSchema.parse(request.headers.authorization || "");
  const envAdmin = verifyEnvAdminToken(token);
  if (envAdmin) return envAdmin;
  return getSessionUser(token);
}

export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireAuth(request);

  if (!isAdminRole(user.role)) {
    throw Object.assign(new Error("Admin access required"), {
      status: 403,
      code: "ADMIN_REQUIRED"
    });
  }

  return user;
}

export async function requireProvider(request: Request): Promise<AuthUser> {
  const user = await requireAuth(request);

  if (user.role !== UserRole.PROVIDER.toLowerCase()) {
    throw Object.assign(new Error("Provider access required"), {
      status: 403,
      code: "PROVIDER_REQUIRED"
    });
  }

  return user;
}
