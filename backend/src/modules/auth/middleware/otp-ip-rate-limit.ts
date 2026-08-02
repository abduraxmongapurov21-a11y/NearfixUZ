import type { RequestHandler } from "express";

const OTP_IP_RATE_LIMIT = 10;
const OTP_IP_RATE_WINDOW_MS = 15 * 60 * 1000;

type IpBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, IpBucket>();

function getClientIp(request: Parameters<RequestHandler>[0]) {
  return request.ip || request.socket.remoteAddress || "unknown";
}

export const otpRequestIpRateLimit: RequestHandler = (request, _response, next) => {
  const now = Date.now();
  const ip = getClientIp(request);
  const current = buckets.get(ip);

  if (!current || current.resetAt <= now) {
    buckets.set(ip, {
      count: 1,
      resetAt: now + OTP_IP_RATE_WINDOW_MS
    });
    next();
    return;
  }

  if (current.count >= OTP_IP_RATE_LIMIT) {
    next(
      Object.assign(new Error("OTP request rate limit exceeded"), {
        status: 429,
        code: "OTP_RATE_LIMITED",
        retryAfter: Math.ceil((current.resetAt - now) / 1000)
      })
    );
    return;
  }

  current.count += 1;
  next();
};
