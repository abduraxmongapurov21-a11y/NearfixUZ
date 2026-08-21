const LOCAL_DEVELOPMENT_HOSTS = new Set(["10.0.2.2", "127.0.0.1", "localhost", "::1"]);
const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV?.trim();
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");

if (!appEnvironment || !["development", "production"].includes(appEnvironment)) {
  throw new Error("EXPO_PUBLIC_APP_ENV must be explicitly set to development or production.");
}

if (!configuredApiBaseUrl) {
  throw new Error(`EXPO_PUBLIC_API_BASE_URL is required for ${appEnvironment}. Production fallback is disabled.`);
}

let parsedApiUrl;
try {
  parsedApiUrl = new URL(configuredApiBaseUrl);
} catch {
  throw new Error("EXPO_PUBLIC_API_BASE_URL must be a valid absolute URL.");
}

if (appEnvironment === "development" && !LOCAL_DEVELOPMENT_HOSTS.has(parsedApiUrl.hostname)) {
  throw new Error("Development API must use localhost, loopback, or the Android emulator host bridge.");
}

if (appEnvironment === "production" && parsedApiUrl.protocol !== "https:") {
  throw new Error("Production API must use HTTPS.");
}

export const env = {
  appEnvironment,
  apiBaseUrl: configuredApiBaseUrl,
  authEnabled: process.env.EXPO_PUBLIC_AUTH_ENABLED !== "false",
  paymentsEnabled: process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === "true",
  mockDataEnabled: process.env.EXPO_PUBLIC_ENABLE_MOCK_DATA === "true",
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || `${configuredApiBaseUrl}/legal/privacy`,
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL || `${configuredApiBaseUrl}/legal/terms`
};
