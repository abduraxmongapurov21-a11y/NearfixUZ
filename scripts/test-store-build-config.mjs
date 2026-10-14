import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { assertStoreBuildConfig } from "./verify-store-build-config.mjs";

const require = createRequire(import.meta.url);
const resolve = require("../app.config.js");
const eas = require("../eas.json");
const previous = process.env;
let app;
try {
  process.env = { ...eas.build.production.env, YANDEX_MAPKIT_API_KEY: "test-map-key" };
  app = resolve();
  assert.equal(app.android.googleServicesFile, "./google-services.json");
  process.env.GOOGLE_SERVICES_JSON = " /eas/files/firebase-android.json ";
  assert.equal(resolve().android.googleServicesFile, "/eas/files/firebase-android.json", "EAS file variable overrides local fallback");
} finally { process.env = previous; }
const fixture = { app, eas, packageVersion: require("../package.json").version, firebase: {
  project_info: { project_id: "fixture", project_number: "123" },
  client: [{ client_info: { android_client_info: { package_name: app.android.package }, mobilesdk_app_id: "fixture-app" }, api_key: [{ current_key: "fixture-key" }] }]
} };
assert.equal(assertStoreBuildConfig(fixture).firebasePackageMatches, true);
for (const [mutate, expected] of [
  [(value) => { value.firebase.client[0].client_info.android_client_info.package_name = "wrong.app"; }, /does not match/],
  [(value) => { value.firebase = { type: "service_account", private_key: "fixture" }; }, /never a Google service-account/],
  [(value) => { value.app.extra.yandexMapKitApiKey = ""; }, /missing YANDEX/],
  [(value) => { value.packageVersion = "0.0.0"; }, /versions must match/],
  [(value) => { value.eas.build.production.android.buildType = "apk"; }, /app-bundle/],
  [(value) => { value.eas.build.production.ios.image = "macos-sequoia-15.6-xcode-16.4"; }, /Xcode 26/],
  [(value) => { value.app.plugins.find((p) => Array.isArray(p) && p[0] === "expo-build-properties")[1].android.targetSdkVersion = 35; }, /targetSdkVersion/],
  [(value) => { value.eas.build.production.autoIncrement = false; }, /auto-increment/]
]) {
  const invalid = structuredClone(fixture);
  mutate(invalid);
  assert.throws(() => assertStoreBuildConfig(invalid), expected);
}
const excluded = readFileSync(new URL("../.easignore", import.meta.url), "utf8").split(/\r?\n/).filter((line) => !line.startsWith("#"));
assert.equal(excluded.includes("google-services.json"), false, "required public Firebase file must not be excluded from cloud builds");
assert.ok(excluded.includes("*.p12") && excluded.includes("*.key") && excluded.includes(".env*"), "private signing and environment files remain excluded");
console.log("Store build config: Firebase fallback/remote file, package matching, secret-file rejection, platform SDKs, versioning and archive regression PASS.");
