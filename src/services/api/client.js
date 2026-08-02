import { env } from "../../constants/env";

export const API_MODE = env.apiBaseUrl.startsWith("mock://") ? "mock" : "http";

export class ApiError extends Error {
  constructor(message, status, code, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function isApiEnabled() {
  return API_MODE === "http";
}

export async function httpRequest(path, { method = "GET", body, token } = {}) {
  if (!isApiEnabled()) {
    throw new ApiError("API is configured for mock mode", 0, "MOCK_MODE");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal
  }).catch((error) => {
    if (error?.name === "AbortError") {
      throw new ApiError("Server javob bermayapti. Internet yoki backend manzilini tekshiring.", 0, "REQUEST_TIMEOUT");
    }

    throw error;
  }).finally(() => clearTimeout(timeoutId));

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    throw new ApiError(payload?.message || "API request failed", response.status, payload?.code, payload);
  }

  return payload;
}

export async function apiRequest(handler, fallback) {
  try {
    return await handler();
  } catch (error) {
    if (fallback) return fallback(error);

    return {
      ok: false,
      code: error?.code,
      message: error?.message || "Unexpected service error",
      retryAfter: error?.payload?.retryAfter
    };
  }
}
