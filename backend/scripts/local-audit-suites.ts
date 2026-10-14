// Keep DB suites on the verified disposable runner. No application imports here.
export const localAuditDatabaseSuites = [
  "test-isolation-positive",
  "otp-security-tests",
  "password-auth-tests",
  "unified-auth-api-tests",
  "auth-api-tests",
  "admin-account-auth-tests",
  "admin-management-tests",
  "admin-audit-password-tests",
  "guest-public-api-tests",
  "client-data-http-tests",
  "full-audit-regression-http-tests",
  "catalog-distance-tests",
  "category-integration-tests",
  "worker-application-tests",
  "worker-self-registration-tests",
  "banner-media-tests",
  "order-capability-tests",
  "order-lifecycle-tests",
  "order-expiry-http-tests",
  "order-location-snapshot-tests",
  "worker-created-order-tests",
  "notification-rating-v1-tests",
  "chat-privacy-http-tests",
  "chat-sync-http-tests",
  "chat-read-compat-http-tests",
  "chat-mobile-state-tests",
  "legal-routes-test",
  "sprint-b-smoke"
] as const;

export const localAuditPureSuites = [
  "test-isolation-tests",
  "category-stage1-tests",
  "local-database-guard-tests",
  "address-contract-tests",
  "media-content-tests",
  "eskiz-provider-tests",
  "error-handler-tests",
  "store-race-tests",
  "order-refresh-store-tests",
  "guest-catalog-access-tests"
] as const;
