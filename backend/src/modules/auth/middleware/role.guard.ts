import type { RequestHandler } from "express";
import { isAdminRole } from "../permissions.js";

export function requireRole(role: string): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(
        Object.assign(new Error("Unauthorized"), {
          status: 401,
          code: "UNAUTHORIZED"
        })
      );
      return;
    }

    if (role.toUpperCase() === "ADMIN" && isAdminRole(request.user.role)) {
      next();
      return;
    }

    if (request.user.role.toUpperCase() !== role.toUpperCase()) {
      next(
        Object.assign(new Error("Forbidden"), {
          status: 403,
          code: "FORBIDDEN"
        })
      );
      return;
    }

    next();
  };
}
