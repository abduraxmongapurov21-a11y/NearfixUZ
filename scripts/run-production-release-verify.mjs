import { readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const easConfig = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8"));
const productionEnv = easConfig.build?.production?.env;

if (productionEnv?.EXPO_PUBLIC_APP_ENV !== "production") {
  throw new Error("eas.json must explicitly set build.production.env.EXPO_PUBLIC_APP_ENV to production.");
}

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("Run production verification through `npm run release:verify`.");
}

console.log("Running release verification with EXPO_PUBLIC_APP_ENV=production from eas.json.");

// Preflight subprocesses cannot propagate their dotenv variables back to the
// parent. Export resolves app.config before loading dotenv, so load it here.
Object.assign(process.env, productionEnv, { NODE_ENV: "production" });
createRequire(import.meta.url)("@expo/env").load(fileURLToPath(new URL("..", import.meta.url)));
const verificationEnv = { ...process.env };
const preflight = spawnSync(process.execPath, [fileURLToPath(new URL("./verify-native-map-config.mjs", import.meta.url))], {
  stdio: "inherit",
  env: verificationEnv
});
if (preflight.error) throw preflight.error;
if (preflight.status !== 0) process.exit(preflight.status ?? 1);

const storePreflight = spawnSync(process.execPath, [fileURLToPath(new URL("./verify-store-build-config.mjs", import.meta.url))], {
  stdio: "inherit", env: verificationEnv
});
if (storePreflight.error) throw storePreflight.error;
if (storePreflight.status !== 0) process.exit(storePreflight.status ?? 1);

rmSync(new URL("../dist-test-store", import.meta.url), { recursive: true, force: true });

const result = spawnSync(process.execPath, [npmCli, "run", "release:verify:production"], {
  stdio: "inherit",
  env: verificationEnv
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
