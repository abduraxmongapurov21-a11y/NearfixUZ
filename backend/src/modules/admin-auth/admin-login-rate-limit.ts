import type { RequestHandler } from "express";

const ADMIN_LOGIN_LIMIT = 10;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Parameters<RequestHandler>[0]) {
  const username = typeof request.body?.username === "string" ? request.body.username.trim().toLowerCase() : "";
  return `${request.ip || request.socket.remoteAddress || "unknown"}:${username}`;
}

export const adminLoginRateLimit: RequestHandler = (request, _response, next) => {
  const now = Date.now();
  const key = clientKey(request);
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ADMIN_LOGIN_WINDOW_MS });
    next();
    return;
  }

  if (current.count >= ADMIN_LOGIN_LIMIT) {
    next(
      Object.assign(new Error("Admin login rate limit exceeded"), {
        status: 429,
        code: "ADMIN_LOGIN_RATE_LIMITED"
      })
    );
    return;
  }

  current.count += 1;
  next();
};
