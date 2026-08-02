import type { RequestHandler } from "express";
import type { AdminPermission } from "../permissions.js";
import { isAdminRole, isSuperAdminRole } from "../permissions.js";

export function requirePermission(permission: AdminPermission): RequestHandler {
  return (request, _response, next) => {
    const admin = request.admin || request.user;

    if (!admin) {
      next(
        Object.assign(new Error("Unauthorized"), {
          status: 401,
          code: "UNAUTHORIZED"
        })
      );
      return;
    }

    if (isSuperAdminRole(admin.role)) {
      next();
      return;
    }

    if (!isAdminRole(admin.role)) {
      next(
        Object.assign(new Error("Forbidden"), {
          status: 403,
          code: "FORBIDDEN"
        })
      );
      return;
    }

    if (!admin.permissions.includes(permission)) {
      next(
        Object.assign(new Error("Permission required"), {
          status: 403,
          code: "PERMISSION_REQUIRED"
        })
      );
      return;
    }

    next();
  };
}

export function requireSuperAdmin(): RequestHandler {
  return (request, _response, next) => {
    const admin = request.admin || request.user;

    if (!admin) {
      next(
        Object.assign(new Error("Unauthorized"), {
          status: 401,
          code: "UNAUTHORIZED"
        })
      );
      return;
    }

    if (!isSuperAdminRole(admin.role)) {
      next(
        Object.assign(new Error("Super admin access required"), {
          status: 403,
          code: "SUPER_ADMIN_REQUIRED"
        })
      );
      return;
    }

    next();
  };
}

export function requireAdminPermissionIfAdmin(permission: AdminPermission): RequestHandler {
  const guard = requirePermission(permission);

  return (request, response, next) => {
    const admin = request.admin || request.user;

    if (admin && isAdminRole(admin.role)) {
      guard(request, response, next);
      return;
    }

    next();
  };
}
