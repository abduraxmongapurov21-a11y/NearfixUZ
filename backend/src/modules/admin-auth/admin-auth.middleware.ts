import type { RequestHandler } from "express";
import { bearerTokenSchema } from "../auth/auth.contracts.js";
import { verifyAdminToken } from "./admin-auth.service.js";

export const authenticateEnvAdmin: RequestHandler = async (request, _response, next) => {
  try {
    const token = bearerTokenSchema.parse(request.headers.authorization || "");
    const admin = await verifyAdminToken(token);

    if (!admin) {
      throw Object.assign(new Error("Admin token required"), {
        status: 401,
        code: "ADMIN_UNAUTHORIZED"
      });
    }

    request.accessToken = token;
    request.admin = admin;
    request.user = admin;

    next();
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && (error.status === 401 || error.status === 403)) {
      next(error);
      return;
    }

    next(
      Object.assign(new Error("Unauthorized"), {
        status: 401,
        code: "ADMIN_UNAUTHORIZED"
      })
    );
  }
};
