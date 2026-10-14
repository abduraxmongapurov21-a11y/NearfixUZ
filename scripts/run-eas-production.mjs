import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { verifyStoreBuildConfig } from "./verify-store-build-config.mjs";

const require = createRequire(import.meta.url);
const eas = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8"));
const [command, ...arguments_] = process.argv.slice(2);
if (!["build", "submit"].includes(command)) throw new Error("Supported production actions: build, submit.");
if (!process.env.npm_execpath) throw new Error("Use the package.json release:build or release:submit commands.");
Object.assign(process.env, eas.build.production.env, { NODE_ENV: "production" });
// EAS disables dotenv loading in its Expo config subprocess. Load required local
// native config into the parent environment before EAS resolves the project.
require("@expo/env").load(process.cwd());
if (command === "build") console.log(JSON.stringify(verifyStoreBuildConfig()));
const result = spawnSync(process.execPath, [process.env.npm_execpath, "exec", "--yes", `--package=eas-cli@${eas.cli.version}`, "--", "eas", command, ...arguments_, "--profile", "production"], {
  stdio: "inherit", env: process.env, windowsHide: true
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
