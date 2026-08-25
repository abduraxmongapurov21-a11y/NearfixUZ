import { readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

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

rmSync(new URL("../dist-test-store", import.meta.url), { recursive: true, force: true });

const result = spawnSync(process.execPath, [npmCli, "run", "release:verify:production"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...productionEnv
  }
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
