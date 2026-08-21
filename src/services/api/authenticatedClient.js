import { env } from "../../constants/env";
import { useAuthStore } from "../../store/authStore";
import { ApiError, httpRequest, isApiEnabled } from "./client";

const refreshableCodes = new Set(["ACCESS_TOKEN_EXPIRED", "ACCESS_TOKEN_INVALID"]);
const terminalCodes = new Set(["REFRESH_SESSION_INVALID", "SESSION_INVALID", "SESSION_VERSION_MISMATCH", "USER_BLOCKED"]);
const staleResponseCode = "STALE_AUTH_RESPONSE";
const defaultDependencies = {
  getAuthState: () => useAuthStore.getState(),
  httpRequest,
  fetch: (...args) => fetch(...args)
};
let dependencies = { ...defaultDependencies };

export function configureAuthenticatedClientForTests(overrides = {}) {
  dependencies = { ...dependencies, ...overrides };
  return () => { dependencies = { ...defaultDependencies }; };
}

function staleResponseError() {
  return new ApiError("Stale authenticated response", 0, staleResponseCode);
}

function authState() {
  return dependencies.getAuthState();
}

function assertCurrent(identity) {
  if (!identity || !authState().isAuthRequestCurrent(identity)) throw staleResponseError();
}

async function getFreshAccessToken(error, identity) {
  assertCurrent(identity);
  if (terminalCodes.has(error?.code)) {
    authState().handleTerminalSession(error.code, error.message, identity);
    return null;
  }
  if (error?.status !== 401 || !refreshableCodes.has(error?.code)) return null;

  const result = await authState().refreshSession();
  assertCurrent(identity);
  if (!result.ok) return null;

  return authState().session?.token || result.token || null;
}

export async function httpAuthRequest(path, options = {}) {
  const sessionToken = authState().session?.token;
  const token = options.token || sessionToken;
  const identity = authState().captureAuthRequest(token);
  if (!identity) throw staleResponseError();

  try {
    const payload = await dependencies.httpRequest(path, { ...options, token });
    assertCurrent(identity);
    return payload;
  } catch (error) {
    if (!authState().isAuthRequestCurrent(identity)) throw staleResponseError();
    const freshToken = await getFreshAccessToken(error, identity);
    if (!freshToken) throw error;

    try {
      const payload = await dependencies.httpRequest(path, { ...options, token: freshToken });
      assertCurrent(identity);
      return payload;
    } catch (retryError) {
      if (!authState().isAuthRequestCurrent(identity)) throw staleResponseError();
      if (terminalCodes.has(retryError?.code)) {
        authState().handleTerminalSession(retryError.code, retryError.message, identity);
      }
      throw retryError;
    }
  }
}

export async function fetchAuthRequest(path, options = {}) {
  if (!isApiEnabled()) {
    throw new ApiError("API is configured for mock mode", 0, "MOCK_MODE");
  }

  const { token: optionToken, ...fetchOptions } = options;
  const sessionToken = authState().session?.token;
  const token = optionToken || sessionToken;
  const identity = authState().captureAuthRequest(token);
  if (!identity) throw staleResponseError();

  async function performRequest(accessToken) {
    const response = await dependencies.fetch(`${env.apiBaseUrl}${path}`, {
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
    const payload = await performRequest(token);
    assertCurrent(identity);
    return payload;
  } catch (error) {
    if (!authState().isAuthRequestCurrent(identity)) throw staleResponseError();
    const freshToken = await getFreshAccessToken(error, identity);
    if (!freshToken) throw error;

    try {
      const payload = await performRequest(freshToken);
      assertCurrent(identity);
      return payload;
    } catch (retryError) {
      if (!authState().isAuthRequestCurrent(identity)) throw staleResponseError();
      if (terminalCodes.has(retryError?.code)) {
        authState().handleTerminalSession(retryError.code, retryError.message, identity);
      }
      throw retryError;
    }
  }
}
