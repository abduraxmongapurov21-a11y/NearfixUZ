import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const adminRequire = createRequire(new URL("../admin-web/package.json", import.meta.url));
const ts = adminRequire("typescript");
function compile(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
}
const apiCode = compile("../admin-web/services/api-client.ts");
const bannerCode = compile("../admin-web/modules/banners/services/banners-service.ts");
function loadClient(baseUrl, nodeEnv = "production", fetchImpl = async () => {
  throw new Error("Unexpected fetch: tests must remain offline.");
}) {
  const module = { exports: {} };
  const env = { NODE_ENV: nodeEnv };
  if (baseUrl !== undefined) env.NEXT_PUBLIC_API_URL = baseUrl;
  vm.runInNewContext(apiCode, {
    module, exports: module.exports, URL, process: { env }, fetch: fetchImpl,
    window: { localStorage: { getItem: () => "fictional-admin-token" } }
  });
  return module.exports;
}

const failures = [];
for (const url of [
  "https://localhost:4000/api", "https://127.0.0.1:4000/api", "https://127.1:4000",
  "https://[::1]:4000/api", "https://localhost./api", "https://audit.localhost/api",
  "https://[::ffff:127.0.0.1]:4000/api", "https://0.0.0.0:4000", "https://[::]:4000",
  "https://10.0.2.2:4000", "ftp://api.audit.invalid", "ws://api.audit.invalid",
  "http://api.audit.invalid", "https://api.audit.invalid?query=1", "https://api.audit.invalid?",
  "https://api.audit.invalid#fragment", "https://api.audit.invalid#",
  "https://user:password@api.audit.invalid/api", "/api", "invalid-url", "   "
]) {
  try { loadClient(url); failures.push(`Production accepted ${url}`); } catch {}
}
for (const url of [
  "ftp://localhost:4000", "http://localhost:4000?", "http://localhost:4000#",
  "http://user@localhost:4000", "/api"
]) {
  try { loadClient(url, "development"); failures.push(`Development accepted ${url}`); } catch {}
}
assert.deepEqual(failures, [], "Admin API configuration must reject targets that corrupt or misroute authenticated requests.");
assert.throws(() => loadClient(undefined), /NEXT_PUBLIC_API_URL/);
const missing = loadClient(undefined, "development");
await assert.rejects(missing.apiClient("/admin/dashboard"), /NEXT_PUBLIC_API_URL/);

for (const url of ["http://localhost:4000", "http://127.0.0.1:4000/api/", "http://[::1]:4000", "https://api.audit.invalid/api/"]) {
  const calls = [];
  const client = loadClient(url, "development", async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ ok: true }) };
  });
  await client.apiClient("/admin/dashboard");
  assert.equal(calls[0][0], `${url.replace(/\/+$/, "")}/admin/dashboard`);
}

const calls = [];
const client = loadClient(" https://api.audit.invalid/api/v1/// ", "production", async (...args) => {
  calls.push(args);
  return { ok: true, json: async () => ({ ok: true, imageUrl: "https://assets.audit.invalid/banner.jpg" }) };
});
await client.apiClient("/admin/dashboard?status=ACTIVE", { token: "fictional-session-token", headers: { "X-Audit": "yes" } });
assert.equal(calls[0][0], "https://api.audit.invalid/api/v1/admin/dashboard?status=ACTIVE");
assert.equal(calls[0][1].headers.Authorization, "Bearer fictional-session-token");
assert.equal(calls[0][1].headers["X-Audit"], "yes");
await client.apiClient("admin/users");
assert.equal(calls[1][0], "https://api.audit.invalid/api/v1/admin/users");

const bannerModule = { exports: {} };
vm.runInNewContext(bannerCode, {
  module: bannerModule, exports: bannerModule.exports, FormData,
  require: (name) => {
    assert.equal(name, "@/services/api-client");
    return client;
  },
  process: { env: { NEXT_PUBLIC_API_URL: " https://api.audit.invalid/api/v1/// " } },
  fetch: async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ ok: true, imageUrl: "https://assets.audit.invalid/banner.jpg" }) };
  }
});
const uploadedBanner = await bannerModule.exports.uploadBannerMedia(new File(["audit"], "banner.jpg", { type: "image/jpeg" }));
assert.equal(uploadedBanner.imageUrl, "https://assets.audit.invalid/banner.jpg");
assert.equal(uploadedBanner.mediaType, "IMAGE");
assert.equal(calls[2][0], "https://api.audit.invalid/api/v1/admin/banners/upload");
assert.equal(calls[2][1].headers.Authorization, "Bearer fictional-admin-token");
assert.equal(calls[2][1].headers["Content-Type"], undefined, "The browser must retain multipart boundary generation.");

const denied = loadClient("https://api.audit.invalid", "production", async () => ({
  ok: false, status: 403, json: async () => ({ message: "Permission denied", code: "FORBIDDEN" })
}));
await assert.rejects(denied.apiClient("/admin/dashboard"), (error) => error instanceof denied.ApiClientError && error.status === 403 && error.code === "FORBIDDEN");
console.log("Actual admin JSON/upload clients reject unusable production API targets; normalized prefixes, slash joining, local development, authentication headers, multipart and API errors pass offline.");
