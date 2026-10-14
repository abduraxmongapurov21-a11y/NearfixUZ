import { resolveMobileRuntimeConfig } from "./mobileRuntimeConfig";

// Keep direct process.env property reads so Expo inlines the public build values.
const { appEnvironment, apiBaseUrl: configuredApiBaseUrl } = resolveMobileRuntimeConfig({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL
});

export const env = {
  appEnvironment,
  apiBaseUrl: configuredApiBaseUrl,
  authEnabled: process.env.EXPO_PUBLIC_AUTH_ENABLED !== "false",
  paymentsEnabled: process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === "true",
  mockDataEnabled: process.env.EXPO_PUBLIC_ENABLE_MOCK_DATA === "true",
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || `${configuredApiBaseUrl}/legal/privacy`,
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL || `${configuredApiBaseUrl}/legal/terms`
};
