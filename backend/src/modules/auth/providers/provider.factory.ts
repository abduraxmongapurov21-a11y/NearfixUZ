import { env } from "../../../config/env.js";
import type { AuthProvider } from "./auth-provider.interface.js";
import { EskizAuthProvider } from "./eskiz.provider.js";
import { FakeAuthProvider } from "./fake.provider.js";

export function createAuthProvider(provider = env.OTP_PROVIDER): AuthProvider {
  if (provider === "fake") {
    return new FakeAuthProvider();
  }

  if (!env.ESKIZ_EMAIL || !env.ESKIZ_PASSWORD || !env.ESKIZ_BASE_URL || !env.ESKIZ_TIMEOUT_MS) {
    throw new Error("Eskiz environment variables are required when OTP_PROVIDER=eskiz");
  }

  return new EskizAuthProvider({
    email: env.ESKIZ_EMAIL,
    password: env.ESKIZ_PASSWORD,
    baseUrl: env.ESKIZ_BASE_URL,
    timeoutMs: env.ESKIZ_TIMEOUT_MS,
    sender: env.ESKIZ_SENDER
  });
}
