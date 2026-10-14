import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { transformSync } from "@babel/core";

const require = createRequire(import.meta.url);
const appConfig = require("../app.config.js");
const envRequire = createRequire(new URL("../src/constants/env.js", import.meta.url));
const { code } = transformSync(readFileSync(new URL("../src/constants/env.js", import.meta.url), "utf8"), {
  filename: "env.js", configFile: false, babelrc: false,
  plugins: ["@babel/plugin-transform-modules-commonjs"]
});

function resolveRuntime(source) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, process: { env: source }, URL, require: envRequire });
  return module.exports.env;
}
const resolvers = [
  ["app.config", (source) => appConfig.resolveMobileRuntimeConfig(source)],
  ["mobile env", resolveRuntime]
];
const failures = [];
for (const [name, resolve] of resolvers) {
  for (const url of ["https://localhost:4000", "https://127.0.0.1:4000", "https://[::1]:4000", "https://10.0.2.2:4000", "https://127.1:4000"]) {
    try { resolve({ EXPO_PUBLIC_APP_ENV: "production", EXPO_PUBLIC_API_BASE_URL: url }); failures.push(`${name} accepted production local host ${url}`); } catch {}
  }
  for (const [environment, url] of [
    ["development", "ftp://localhost:4000"],
    ["development", "ws://localhost:4000"],
    ["development", "http://localhost:4000?token=unsafe"],
    ["development", "http://localhost:4000#fragment"],
    ["development", "http://user:password@localhost:4000"],
    ["development", "https://api.audit.invalid"],
    ["development", "http://8.8.8.8:4000"],
    ["development", "http://172.15.0.1:4000"],
    ["development", "http://172.32.0.1:4000"],
    ["development", "http://192.169.0.1:4000"],
    ["development", "http://10.example.com:4000"],
    ["production", "https://api.audit.invalid?"],
    ["production", "https://api.audit.invalid#"],
    ["production", "https://user@api.audit.invalid/api"],
    ["production", "http://api.audit.invalid"]
  ]) {
    try { resolve({ EXPO_PUBLIC_APP_ENV: environment, EXPO_PUBLIC_API_BASE_URL: url }); failures.push(`${name} accepted an unusable API base ${url}`); } catch {}
  }
  for (const url of ["http://localhost:4000", "http://127.0.0.1:4000", "http://10.0.2.2:4000", "http://[::1]:4000", "https://localhost:4443/api", "http://192.168.0.102:4000", "http://10.1.2.3:4000", "http://172.16.0.1:4000", "https://172.31.255.254:4443/api"]) {
    try {
      const config = resolve({ EXPO_PUBLIC_APP_ENV: "development", EXPO_PUBLIC_API_BASE_URL: url });
      assert.equal(config.apiBaseUrl, url);
    } catch { failures.push(`${name} rejected valid local HTTP(S) ${url}`); }
  }
  const config = resolve({ EXPO_PUBLIC_APP_ENV: " production ", EXPO_PUBLIC_API_BASE_URL: " https://api.audit.invalid/api/v1/ " });
  assert.equal(config.appEnvironment, "production");
  assert.equal(config.apiBaseUrl, "https://api.audit.invalid/api/v1");
  assert.equal(new URL(`${config.apiBaseUrl}/orders`).pathname, "/api/v1/orders");
  assert.throws(() => resolve({ EXPO_PUBLIC_APP_ENV: "preview", EXPO_PUBLIC_API_BASE_URL: "https://api.audit.invalid" }), /explicitly set/);
  assert.throws(() => resolve({ EXPO_PUBLIC_APP_ENV: "production" }), /API_BASE_URL is required/);
}
assert.deepEqual(failures, [], "build config and mobile runtime must share safe API URL validation");
const runtime = resolveRuntime({ EXPO_PUBLIC_APP_ENV: "development", EXPO_PUBLIC_API_BASE_URL: "http://[::1]:4000/api/", EXPO_PUBLIC_AUTH_ENABLED: "false", EXPO_PUBLIC_PAYMENTS_ENABLED: "true" });
assert.equal(runtime.authEnabled, false);
assert.equal(runtime.paymentsEnabled, true);
assert.equal(runtime.privacyPolicyUrl, "http://[::1]:4000/api/legal/privacy");
assert.equal(runtime.termsUrl, "http://[::1]:4000/api/legal/terms");
console.log("Actual build/mobile API resolvers reject production loopback, non-HTTP protocols, query/fragment/userinfo; IPv6 loopback, prefixes, flags and legal paths pass.");
