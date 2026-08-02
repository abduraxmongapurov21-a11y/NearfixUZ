import type { AuthProvider, OtpDeliveryResult } from "./auth-provider.interface.js";

const DEFAULT_ESKIZ_SENDER = "4546";
const FALLBACK_TOKEN_TTL_MS = 23 * 60 * 60 * 1000;
const TOKEN_REFRESH_LEEWAY_MS = 60 * 1000;
const MAX_LOG_BODY_LENGTH = 1000;

type EskizAuthProviderOptions = {
  email: string;
  password: string;
  baseUrl: string;
  timeoutMs: number;
  sender?: string;
  fetchFn?: typeof fetch;
  nowFn?: () => number;
};

type EskizLoginResponse = {
  data?: {
    token?: string;
    expires_in?: number | string;
    expiresIn?: number | string;
    expires_at?: string;
    expiresAt?: string;
  };
  expires_in?: number | string;
  expiresIn?: number | string;
  expires_at?: string;
  expiresAt?: string;
};

type EskizSendResponse = {
  id?: string;
};

type CachedToken = {
  value: string;
  expiresAt: number;
};

type SendAttemptResult = {
  response: Response;
  bodyText: string;
};

function safeNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
}

function expiryFromPayload(payload: EskizLoginResponse, now: number) {
  const expiresIn =
    safeNumber(payload.data?.expires_in) ??
    safeNumber(payload.data?.expiresIn) ??
    safeNumber(payload.expires_in) ??
    safeNumber(payload.expiresIn);

  if (expiresIn && expiresIn > 0) {
    return Math.min(now + expiresIn * 1000, now + FALLBACK_TOKEN_TTL_MS);
  }

  const expiresAtText = payload.data?.expires_at ?? payload.data?.expiresAt ?? payload.expires_at ?? payload.expiresAt;
  if (expiresAtText) {
    const expiresAt = Date.parse(expiresAtText);
    if (Number.isFinite(expiresAt) && expiresAt > now) {
      return Math.min(expiresAt, now + FALLBACK_TOKEN_TTL_MS);
    }
  }

  return now + FALLBACK_TOKEN_TTL_MS;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => {
        const normalizedKey = key.toLowerCase();
        if (
          normalizedKey.includes("token") ||
          normalizedKey.includes("password") ||
          normalizedKey.includes("secret") ||
          normalizedKey.includes("authorization")
        ) {
          return [key, "[redacted]"];
        }

        return [key, sanitizeValue(nestedValue)];
      })
    );
  }

  return value;
}

function sanitizeResponseBody(bodyText: string) {
  if (!bodyText.trim()) return "";

  try {
    return JSON.stringify(sanitizeValue(JSON.parse(bodyText))).slice(0, MAX_LOG_BODY_LENGTH);
  } catch {
    return bodyText.slice(0, MAX_LOG_BODY_LENGTH);
  }
}

function errorForLog(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${sanitizeResponseBody(error.message)}`;
  }

  return sanitizeResponseBody(String(error));
}

function isAuthFailure(status: number) {
  return status === 401 || status === 403;
}

function isTokenExpiredResponse(bodyText: string) {
  if (!bodyText.trim()) return false;

  try {
    const payload = sanitizeValue(JSON.parse(bodyText));
    return JSON.stringify(payload).toLowerCase().includes("token has expired");
  } catch {
    return bodyText.toLowerCase().includes("token has expired");
  }
}

function shouldRefreshTokenAfterSend(status: number, bodyText: string) {
  return isAuthFailure(status) || isTokenExpiredResponse(bodyText);
}

export class EskizAuthProvider implements AuthProvider {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly nowFn: () => number;
  private readonly sender: string;
  private token?: CachedToken;
  private tokenRequest?: Promise<CachedToken>;

  constructor(private readonly options: EskizAuthProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchFn = options.fetchFn ?? fetch;
    this.nowFn = options.nowFn ?? Date.now;
    this.sender = options.sender || DEFAULT_ESKIZ_SENDER;
  }

  private async login() {
    const body = new FormData();
    body.set("email", this.options.email);
    body.set("password", this.options.password);

    const response = await this.fetchFn(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(this.options.timeoutMs)
    }).catch((error) => {
      console.error(`[eskiz] login request failed error=${errorForLog(error)}`);
      throw error;
    });

    const bodyText = await response.text().catch(() => "");

    if (!response.ok) {
      console.error(
        `[eskiz] login failed status=${response.status} body=${sanitizeResponseBody(bodyText)}`
      );
      throw new Error(`Eskiz login failed with status ${response.status}`);
    }

    let payload: EskizLoginResponse;
    try {
      payload = JSON.parse(bodyText) as EskizLoginResponse;
    } catch (error) {
      console.error(`[eskiz] login response parse failed body=${sanitizeResponseBody(bodyText)} error=${errorForLog(error)}`);
      throw error;
    }

    const token = payload.data?.token;

    if (!token) {
      console.error(`[eskiz] login response missing token body=${sanitizeResponseBody(bodyText)}`);
      throw new Error("Eskiz login response does not contain a token");
    }

    const cachedToken = {
      value: token,
      expiresAt: expiryFromPayload(payload, this.nowFn())
    };

    this.token = cachedToken;
    return cachedToken;
  }

  private isTokenValid(token: CachedToken) {
    return token.expiresAt - TOKEN_REFRESH_LEEWAY_MS > this.nowFn();
  }

  private clearToken() {
    this.token = undefined;
  }

  private async getToken(forceRefresh = false) {
    if (!forceRefresh && this.token && this.isTokenValid(this.token)) {
      return this.token;
    }

    if (forceRefresh) {
      this.clearToken();
    }

    if (!this.tokenRequest) {
      this.tokenRequest = this.login().finally(() => {
        this.tokenRequest = undefined;
      });
    }

    return this.tokenRequest;
  }

  private async sendSms(phone: string, code: string, token: CachedToken): Promise<SendAttemptResult> {
    const body = new FormData();
    body.set("mobile_phone", phone.replace(/\D/g, ""));
    body.set("message", `NearFIX ilovasiga kirish uchun tasdiqlash kodi: ${code}. Kodni hech kimga bermang.`);
    body.set("from", this.sender);
    body.set("callback_url", "");

    const response = await this.fetchFn(`${this.baseUrl}/api/message/sms/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.value}`
      },
      body,
      signal: AbortSignal.timeout(this.options.timeoutMs)
    }).catch((error) => {
      console.error(`[eskiz] send request failed error=${errorForLog(error)}`);
      throw error;
    });

    return {
      response,
      bodyText: await response.text().catch(() => "")
    };
  }

  private logSendFailure(status: number, bodyText: string) {
    const message =
      status === 429
        ? "send rate-limited"
        : shouldRefreshTokenAfterSend(status, bodyText)
          ? "send auth failed"
          : "send failed";

    console.error(`[eskiz] ${message} status=${status} body=${sanitizeResponseBody(bodyText)}`);
  }

  private parseSendPayload(bodyText: string): EskizSendResponse {
    if (!bodyText.trim()) return {};

    return JSON.parse(bodyText) as EskizSendResponse;
  }

  async sendOtp(phone: string, code?: string): Promise<OtpDeliveryResult> {
    if (!code) {
      throw new Error("OTP code is required for Eskiz SMS delivery");
    }

    let token = await this.getToken();
    let attempt = await this.sendSms(phone, code, token);

    if (!attempt.response.ok && shouldRefreshTokenAfterSend(attempt.response.status, attempt.bodyText)) {
      this.logSendFailure(attempt.response.status, attempt.bodyText);
      this.clearToken();
      token = await this.getToken(true);
      attempt = await this.sendSms(phone, code, token);
    }

    if (!attempt.response.ok) {
      this.logSendFailure(attempt.response.status, attempt.bodyText);
      throw new Error(`Eskiz SMS send failed with status ${attempt.response.status}`);
    }

    const payload = this.parseSendPayload(attempt.bodyText);

    return {
      providerMessageId: payload.id
    };
  }
}
