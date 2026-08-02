import crypto from "node:crypto";
import { env } from "../../config/env.js";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

type AccessTokenPayload = {
  userId: string;
  sessionId: string;
  sessionVersion: number;
  exp: number;
};

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value: unknown) {
  return base64UrlEncode(JSON.stringify(value));
}

function signToken(data: string) {
  return crypto.createHmac("sha256", env.ACCESS_TOKEN_SECRET).update(data).digest("base64url");
}

export function createRawSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function createRefreshToken() {
  return createRawSessionToken();
}

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashRefreshToken(token: string) {
  return hashSessionToken(token);
}

export function createAccessToken(input: Omit<AccessTokenPayload, "exp">) {
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    ...input,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS
  });
  const data = `${header}.${payload}`;

  return `${data}.${signToken(data)}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw Object.assign(new Error("Invalid access token"), {
      status: 401,
      code: "ACCESS_TOKEN_INVALID"
    });
  }

  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expectedSignature = signToken(data);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    throw Object.assign(new Error("Invalid access token signature"), {
      status: 401,
      code: "ACCESS_TOKEN_INVALID"
    });
  }

  let decoded: AccessTokenPayload;

  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccessTokenPayload;
  } catch {
    throw Object.assign(new Error("Invalid access token payload"), {
      status: 401,
      code: "ACCESS_TOKEN_INVALID"
    });
  }

  if (!decoded.exp || decoded.exp <= Math.floor(Date.now() / 1000)) {
    throw Object.assign(new Error("Access token expired"), {
      status: 401,
      code: "ACCESS_TOKEN_EXPIRED"
    });
  }

  return decoded;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
