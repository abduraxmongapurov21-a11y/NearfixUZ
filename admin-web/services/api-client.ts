const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (process.env.NODE_ENV === "production") {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is required for production builds");
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(API_BASE_URL)) {
    throw new Error("NEXT_PUBLIC_API_URL cannot point to localhost in production");
  }
}

export class ApiClientError extends Error {
  status: number;
  code?: string;
  payload?: unknown;

  constructor(message: string, status: number, code?: string, payload?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export async function apiClient<TResponse>(
  path: string,
  init?: RequestInit & { token?: string }
): Promise<TResponse> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init?.headers
    },
    body: init?.body
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Request failed: ${response.status}`;
    const code =
      payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string"
        ? payload.code
        : undefined;

    throw new ApiClientError(message, response.status, code, payload);
  }

  return payload as TResponse;
}

export function getAdminToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("nearfix-admin-token");
}
