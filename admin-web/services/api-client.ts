function resolveApiBaseUrl(configuredUrl: string | undefined) {
  const baseUrl = configuredUrl?.trim().replace(/\/+$/, "");
  const production = process.env.NODE_ENV === "production";
  if (!baseUrl) {
    if (production) {
      throw new Error("Ishlab chiqarish muhiti uchun NEXT_PUBLIC_API_URL ko'rsatilishi shart");
    }
    return undefined;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL to'liq HTTP yoki HTTPS manzili bo'lishi kerak");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol) || (production && parsedUrl.protocol !== "https:")) {
    throw new Error("NEXT_PUBLIC_API_URL HTTP yoki HTTPS, ishlab chiqarish muhitida esa HTTPS manzili bo'lishi kerak");
  }
  // Request paths append to this base; delimiters would swallow the route.
  if (baseUrl.includes("?") || baseUrl.includes("#") || parsedUrl.username || parsedUrl.password) {
    throw new Error("NEXT_PUBLIC_API_URL foydalanuvchi ma'lumotlari, so'rov yoki fragment saqlamasligi kerak");
  }
  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (production && (
    ["localhost", "::1", "::", "0.0.0.0", "10.0.2.2"].includes(hostname) ||
    /^127\./.test(hostname) || /^::ffff:7f[\da-f]{2}:/.test(hostname) || hostname.endsWith(".localhost")
  )) {
    throw new Error("Ishlab chiqarish muhitida NEXT_PUBLIC_API_URL localhost manziliga yo'naltirilmasligi kerak");
  }
  return baseUrl;
}

const API_BASE_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

export function getApiUrl(path: string) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL sozlanmagan");
  }
  return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
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
  const response = await fetch(getApiUrl(path), {
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
        : `So'rov bajarilmadi: ${response.status}`;
    const code =
      payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string"
        ? payload.code
        : undefined;

    if (code === "ADMIN_PASSWORD_CHANGE_REQUIRED" && init?.token && typeof window !== "undefined" &&
        getAdminToken() === init.token && window.location && window.location.pathname !== "/change-password") {
      window.location.assign("/change-password");
    }

    throw new ApiClientError(message, response.status, code, payload);
  }

  return payload as TResponse;
}

export function getAdminToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("nearfix-admin-token");
}
