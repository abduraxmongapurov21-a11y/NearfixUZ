import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertProductionMapConfig } from "./verify-native-map-config.mjs";

const require = createRequire(import.meta.url);
const appConfig = require("../app.config.js");
const originalEnvironment = process.env;
const productionEnvironment = {
  NODE_ENV: "production",
  EXPO_PUBLIC_APP_ENV: "production",
  EXPO_PUBLIC_API_BASE_URL: "https://api.audit.invalid"
};

function resolve(environment) {
  process.env = environment;
  return appConfig();
}

try {
  for (const profile of [undefined, "production", "preview"]) {
    for (const key of [undefined, "", " ", "\t\n"]) {
      assert.throws(() => resolve({
        ...productionEnvironment,
        ...(profile ? { EAS_BUILD_PROFILE: profile } : {}),
        ...(key !== undefined ? { YANDEX_MAPKIT_API_KEY: key } : {})
      }), /YANDEX_MAPKIT_API_KEY is required/);
    }
    const config = resolve({
      ...productionEnvironment,
      ...(profile ? { EAS_BUILD_PROFILE: profile } : {}),
      YANDEX_MAPKIT_API_KEY: " audit-mapkit-key "
    });
    assert.equal(config.extra.yandexMapKitApiKey, "audit-mapkit-key");
    assert.deepEqual(assertProductionMapConfig(config), { appEnvironment: "production", mapKitKeyPresent: true });
  }

  const development = {
    EXPO_PUBLIC_APP_ENV: "development",
    EXPO_PUBLIC_API_BASE_URL: "http://localhost:4000"
  };
  for (const key of [undefined, " "]) {
    const config = resolve({ ...development, ...(key !== undefined ? { YANDEX_MAPKIT_API_KEY: key } : {}) });
    assert.equal(config.extra.yandexMapKitApiKey, undefined);
    assert.throws(() => assertProductionMapConfig(config), /requires EXPO_PUBLIC_APP_ENV=production/);
  }
  assert.throws(() => resolve({ ...development, EAS_BUILD_PROFILE: "production" }), /YANDEX_MAPKIT_API_KEY is required/);

  for (const key of [undefined, "", " ", true, 123]) {
    assert.throws(() => assertProductionMapConfig({ extra: {
      appEnvironment: "production",
      yandexMapKitApiKey: key
    } }), /missing YANDEX_MAPKIT_API_KEY/);
  }
  assert.throws(() => appConfig.resolveMobileRuntimeConfig({ EXPO_PUBLIC_APP_ENV: "production" }), /API_BASE_URL is required/);
  assert.throws(() => appConfig.resolveMobileRuntimeConfig({
    EXPO_PUBLIC_APP_ENV: "production", EXPO_PUBLIC_API_BASE_URL: "http://api.audit.invalid"
  }), /must use HTTPS/);
  assert.throws(() => appConfig.resolveMobileRuntimeConfig({
    EXPO_PUBLIC_APP_ENV: "development", EXPO_PUBLIC_API_BASE_URL: "https://api.audit.invalid"
  }), /Development API must use/);
} finally {
  process.env = originalEnvironment;
}

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const cliPath = fileURLToPath(new URL("./verify-native-map-config.mjs", import.meta.url));
for (const key of [undefined, " ", "audit-mapkit-key"]) {
  const environment = { ...originalEnvironment, ...productionEnvironment, EXPO_NO_DOTENV: "1" };
  delete environment.YANDEX_MAPKIT_API_KEY;
  delete environment.EAS_BUILD_PROFILE;
  if (key !== undefined) environment.YANDEX_MAPKIT_API_KEY = key;
  const result = spawnSync(process.execPath, [cliPath], { cwd: projectRoot, env: environment, encoding: "utf8" });
  assert.equal(result.error, undefined);
  if (key?.trim()) {
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)), {
      appEnvironment: "production", mapKitKeyPresent: true
    });
    assert.equal(result.stdout.includes(key), false, "release preflight must never print the key");
  } else {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /YANDEX_MAPKIT_API_KEY is required/);
  }
}
const runnerEnvironment = {
  ...originalEnvironment,
  EXPO_NO_DOTENV: "1",
  npm_execpath: "audit-unused-npm-cli"
};
delete runnerEnvironment.YANDEX_MAPKIT_API_KEY;
delete runnerEnvironment.EAS_BUILD_PROFILE;
const rejectedRunner = spawnSync(process.execPath, [fileURLToPath(new URL("./run-production-release-verify.mjs", import.meta.url))], {
  cwd: projectRoot, env: runnerEnvironment, encoding: "utf8"
});
assert.equal(rejectedRunner.error, undefined);
assert.notEqual(rejectedRunner.status, 0);
assert.match(rejectedRunner.stderr, /YANDEX_MAPKIT_API_KEY is required/);
assert.equal(rejectedRunner.stderr.includes("audit-unused-npm-cli"), false, "missing key must fail before npm/export starts");

const temporaryRoot = path.resolve(tmpdir());
const destination = mkdtempSync(path.join(temporaryRoot, "nearfix-map-constants-audit-"));
try {
  const nativeConfigGenerator = path.join(path.dirname(require.resolve("expo-constants/package.json")), "scripts/build/getAppConfig.js");
  const environment = {
    ...originalEnvironment,
    ...productionEnvironment,
    EXPO_NO_DOTENV: "1",
    YANDEX_MAPKIT_API_KEY: " audit-mapkit-key "
  };
  delete environment.EAS_BUILD_PROFILE;
  const generated = spawnSync(process.execPath, [nativeConfigGenerator, projectRoot, destination], {
    cwd: projectRoot, env: environment, encoding: "utf8"
  });
  assert.equal(generated.error, undefined);
  assert.equal(generated.status, 0, generated.stderr);
  const embeddedConfig = JSON.parse(readFileSync(path.join(destination, "app.config"), "utf8"));
  assert.deepEqual(assertProductionMapConfig(embeddedConfig), { appEnvironment: "production", mapKitKeyPresent: true });
  assert.equal(embeddedConfig.extra.yandexMapKitApiKey, "audit-mapkit-key");
} finally {
  if (path.dirname(path.resolve(destination)) !== temporaryRoot) throw new Error("Refusing to remove an unexpected audit directory.");
  rmSync(destination, { recursive: true, force: true });
}

console.log("Native map production config, Xcode profile absence, whitespace, and release preflight tests passed.");
