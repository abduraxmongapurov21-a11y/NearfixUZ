import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertProductionMapConfig } from "./verify-native-map-config.mjs";

const require = createRequire(import.meta.url);

export function assertStoreBuildConfig({ app, eas, firebase, packageVersion }) {
  assertProductionMapConfig(app);
  const fail = (message) => { throw new Error(message); };
  if (!app.version || app.version !== packageVersion) fail("App and package versions must match.");
  if (!app.android?.package || app.android.package !== app.ios?.bundleIdentifier) fail("Native application identifiers must match.");
  if (!app.extra?.eas?.projectId) fail("The existing EAS project must be configured.");
  const properties = app.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties")?.[1];
  if (!(properties?.android?.targetSdkVersion >= 36) || !(properties?.android?.compileSdkVersion >= properties.android.targetSdkVersion)) {
    fail("Android store builds require explicit targetSdkVersion >= 36 and a matching compile SDK.");
  }
  const production = eas.build?.production;
  if (production?.distribution !== "store" || production.environment !== "production" || production.android?.buildType !== "app-bundle") {
    fail("Production must use the store environment and Android app-bundle output.");
  }
  if (!/xcode-(?:2[6-9]|[3-9]\d)\./.test(production.ios?.image || "")) fail("Pin a supported Xcode 26 or newer production image.");
  if (eas.cli?.appVersionSource !== "remote" || production.autoIncrement !== true) fail("Store build numbers must use EAS remote auto-increment.");
  if (firebase?.type === "service_account" || firebase?.private_key) fail("Use the Firebase Android app config, never a Google service-account private key.");
  if (!firebase?.project_info?.project_id || !firebase?.project_info?.project_number || !firebase?.client?.some((client) =>
    client.client_info?.android_client_info?.package_name === app.android.package && client.client_info?.mobilesdk_app_id && client.api_key?.some((key) => key.current_key))) {
    fail("Firebase Android app config is incomplete or does not match the application ID.");
  }
  return { version: app.version, applicationId: app.android.package, environment: "production", mapKitKeyPresent: true, firebasePackageMatches: true, androidTargetSdk: properties.android.targetSdkVersion, iosImage: production.ios.image };
}

export function verifyStoreBuildConfig(projectRoot = process.cwd()) {
  const eas = JSON.parse(readFileSync(path.join(projectRoot, "eas.json"), "utf8"));
  // Match the actual production profile without requiring users to replace their development .env.
  Object.assign(process.env, eas.build.production.env, { NODE_ENV: "production" });
  require("@expo/env").load(projectRoot);
  const { exp: app } = require("@expo/config").getConfig(projectRoot, { isPublicConfig: true });
  const firebasePath = path.resolve(projectRoot, app.android.googleServicesFile);
  if (!existsSync(firebasePath)) throw new Error("Firebase Android app config file is missing. Provide GOOGLE_SERVICES_JSON or google-services.json.");
  let firebase;
  try { firebase = JSON.parse(readFileSync(firebasePath, "utf8")); }
  catch { throw new Error("Firebase Android app config must be valid JSON."); }
  const packageVersion = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")).version;
  return assertStoreBuildConfig({ app, eas, firebase, packageVersion });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(verifyStoreBuildConfig()));
}
