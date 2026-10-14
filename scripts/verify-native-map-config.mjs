import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

export function assertProductionMapConfig(config) {
  if (config.extra?.appEnvironment !== "production") {
    throw new Error("Native release verification requires EXPO_PUBLIC_APP_ENV=production.");
  }
  const key = config.extra?.yandexMapKitApiKey;
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("Native release configuration is missing YANDEX_MAPKIT_API_KEY.");
  }
  return { appEnvironment: "production", mapKitKeyPresent: true };
}

export function verifyProductionMapConfig(projectRoot = process.cwd()) {
  require("@expo/env").load(projectRoot);
  const { exp } = require("@expo/config").getConfig(projectRoot, { isPublicConfig: true });
  return assertProductionMapConfig(exp);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(verifyProductionMapConfig()));
}
