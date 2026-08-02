import { env } from "../../constants/env";
import { useAuthStore } from "../../store/authStore";
import { ApiError, httpRequest, isApiEnabled } from "./client";

const refreshableCodes = new Set(["ACCESS_TOKEN_EXPIRED", "ACCESS_TOKEN_INVALID"]);

async function getFreshAccessToken(error) {
  if (error?.status !== 401 || !refreshableCodes.has(error?.code)) return null;

  const result = await useAuthStore.getState().refreshSession();
  if (!result.ok) return null;

  return useAuthStore.getState().session?.token || result.token || null;
}

export async function httpAuthRequest(path, options = {}) {
  const sessionToken = useAuthStore.getState().session?.token;
  const token = options.token || sessionToken;

  try {
    return await httpRequest(path, { ...options, token });
  } catch (error) {
    const freshToken = await getFreshAccessToken(error);
    if (!freshToken) throw error;

    return httpRequest(path, { ...options, token: freshToken });
  }
}

export async function fetchAuthRequest(path, options = {}) {
  if (!isApiEnabled()) {
    throw new ApiError("API is configured for mock mode", 0, "MOCK_MODE");
  }

  const { token: optionToken, ...fetchOptions } = options;
  const sessionToken = useAuthStore.getState().session?.token;
  const token = optionToken || sessionToken;

  async function performRequest(accessToken) {
    const response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...fetchOptions,
      headers: {
        ...(fetchOptions.headers || {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      }
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.ok === false) {
      throw new ApiError(payload?.message || "API request failed", response.status, payload?.code, payload);
    }

    return payload;
  }

  try {
    return await performRequest(token);
  } catch (error) {
    const freshToken = await getFreshAccessToken(error);
    if (!freshToken) throw error;

    return performRequest(freshToken);
  }
}
