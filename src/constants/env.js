export const PRODUCTION_API_BASE_URL = "https://nearfix-production-c0db.up.railway.app";
export const PRODUCTION_PRIVACY_POLICY_URL = `${PRODUCTION_API_BASE_URL}/legal/privacy`;
export const PRODUCTION_TERMS_URL = `${PRODUCTION_API_BASE_URL}/legal/terms`;

export const env = {
  // Keep the store binary independent from local .env files and LAN addresses.
  apiBaseUrl: PRODUCTION_API_BASE_URL,
  authEnabled: process.env.EXPO_PUBLIC_AUTH_ENABLED !== "false",
  paymentsEnabled: process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === "true",
  mockDataEnabled: process.env.EXPO_PUBLIC_ENABLE_MOCK_DATA === "true",
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || PRODUCTION_PRIVACY_POLICY_URL,
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL || PRODUCTION_TERMS_URL
};
