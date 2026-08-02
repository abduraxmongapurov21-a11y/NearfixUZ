import type { RequestHandler } from "express";
import { bearerTokenSchema } from "../auth.contracts.js";
import { requireAuth } from "../auth-context.js";

export const authenticate: RequestHandler = async (request, _response, next) => {
  try {
    const accessToken = bearerTokenSchema.parse(request.headers.authorization || "");

    if (request.admin) {
      request.accessToken = accessToken;
      request.user = request.admin;
      next();
      return;
    }

    const user = await requireAuth(request);

    request.accessToken = accessToken;
    request.user = user;

    next();
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && error.status === 401) {
      next(error);
      return;
    }

    next(
      Object.assign(new Error("Unauthorized"), {
        status: 401,
        code: "UNAUTHORIZED"
      })
    );
  }
};
