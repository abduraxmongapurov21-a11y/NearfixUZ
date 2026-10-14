import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rootPackage = require("../package.json");
const config = require("../eas.json");
const appConfig = require("../app.config.js");
const profile = config.build["development-ios"];
assert.match(rootPackage.dependencies.expo, /^~54\./, "iOS development build preserves the chosen SDK 54");
assert.equal(profile.extends, "development");
const base = config.build[profile.extends];
const resolved = { ...base, ...profile, env: { ...base.env, ...profile.env } };
assert.equal(resolved.developmentClient, true);
assert.equal(resolved.distribution, "internal");
assert.equal(resolved.ios.simulator, false, "physical iPhone builds cannot use a simulator artifact");
assert.equal(resolved.env.EXPO_PUBLIC_APP_ENV, "development");
const origin = new URL(resolved.env.EXPO_PUBLIC_API_BASE_URL);
assert.equal(origin.protocol, "http:");
assert.match(origin.hostname, /^192\.168\./);
assert.equal(origin.port, "4000");
assert.equal(resolved.env.EXPO_PUBLIC_PRIVACY_POLICY_URL, `${origin.origin}/legal/privacy`);
assert.equal(resolved.env.EXPO_PUBLIC_TERMS_URL, `${origin.origin}/legal/terms`);
assert.equal(base.env.EXPO_PUBLIC_API_BASE_URL, "http://10.0.2.2:4000", "existing Android development settings are preserved");
assert.equal(config.build.production.env.EXPO_PUBLIC_APP_ENV, "production");
assert.equal(profile.environment, "production", "reuse the existing EAS MapKit SDK key; profile overrides keep the API local");
const originalEnvironment = process.env;
try {
  process.env = { ...resolved.env, EAS_BUILD_PROFILE: "development-ios", YANDEX_MAPKIT_API_KEY: "test-native-key" };
  const app = appConfig();
  assert.equal(app.ios.bundleIdentifier, "uz.nearfix.app");
  assert.equal(app.scheme, "nearfix");
  assert.equal(app.extra.appEnvironment, "development");
  assert.equal(app.extra.apiBaseUrl, origin.origin);
} finally { process.env = originalEnvironment; }
const ignored = readFileSync(new URL("../.easignore", import.meta.url), "utf8").split(/\r?\n/);
for (const entry of ["node_modules/", "backend/", "admin-web/", "artifacts/", ".env*", "**/.env*", "*.p12", "*.key", "/android/", "/ios/"]) {
  assert.ok(ignored.includes(entry), `EAS archive must exclude ${entry}`);
}
console.log("SDK54 physical iOS development profile, local API/legal URLs, inherited settings, MapKit environment and archive exclusions PASS.");
