import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) return next(error);

  if (error instanceof ZodError) {
    response.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      issues: error.flatten()
    });
    return;
  }

  const status = typeof error?.status === "number" ? error.status : 500;
  const isUnexpectedError = status >= 500;
  if (status >= 400) {
    // Device coordinates are transient catalog input; keep them out of error logs.
    const loggedUrl = request.originalUrl.split("?", 1)[0] === "/workers/catalog" ? "/workers/catalog" : request.originalUrl;
    const log = status >= 500 ? console.error : console.warn;
    const level = status >= 500 ? "error" : "warning";
    log(
      `[api-${level}] ${request.method} ${loggedUrl} ${status} ${error?.code || "INTERNAL_ERROR"}: ${
        error?.message || "Unexpected server error"
      }`
    );
  }

  response.status(status).json({
    ok: false,
    code: isUnexpectedError ? "INTERNAL_ERROR" : error?.code || "INTERNAL_ERROR",
    message: isUnexpectedError ? "Unexpected server error" : error?.message || "Request failed",
    ...(typeof error?.retryAfter === "number" ? { retryAfter: error.retryAfter } : {})
  });
};
