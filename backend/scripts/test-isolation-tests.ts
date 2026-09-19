import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { authorizeTestProcess, isolationClaim } from "./test-isolation.js";

// Fake configuration and grant/connection spies only. No DB client is imported.
const fakeDatabase = `nearfix_chat_test_${"a".repeat(32)}`;
const fakeUrl = `postgresql://f1_test@127.0.0.1:59999/${fakeDatabase}?schema=public`;
const base: NodeJS.ProcessEnv = {
  NODE_ENV: "test", DATABASE_URL: fakeUrl, DIRECT_URL: fakeUrl,
  F1_DISPOSABLE_DATABASE: fakeDatabase, F21_TEST_RUN_ID: "11111111-1111-4111-8111-111111111111",
  DOTENV_CONFIG_PATH: "fake-owned-empty.env"
};
let grants = 0; let connections = 0; let bootstraps = 0; let mutations = 0;
const grantSpy = async (claim: ReturnType<typeof isolationClaim>, nonce: string) => {
  grants++; return { ...claim, nonce, approved: true };
};
async function protectedBody(env: NodeJS.ProcessEnv, transport?: typeof grantSpy) {
  await authorizeTestProcess(env, transport);
  connections++; bootstraps++; mutations++;
}
for (const [label, env, transport] of [
  ["direct/no live IPC (even matching test env)", base, undefined],
  ["missing environment", {}, grantSpy],
  ["missing DATABASE_URL", { ...base, DATABASE_URL: undefined }, grantSpy],
  ["missing DIRECT_URL", { ...base, DIRECT_URL: undefined }, grantSpy],
  ["missing run identity", { ...base, F21_TEST_RUN_ID: undefined }, grantSpy],
  ["ordinary local target", { ...base, DATABASE_URL: "postgresql://f1_test@127.0.0.1:59999/nearfix?schema=public", DIRECT_URL: "postgresql://f1_test@127.0.0.1:59999/nearfix?schema=public", F1_DISPOSABLE_DATABASE: "nearfix" }, grantSpy],
  ["mismatched direct target", { ...base, DIRECT_URL: fakeUrl.replace("59999", "59998") }, grantSpy],
  ["mismatched database marker", { ...base, F1_DISPOSABLE_DATABASE: `nearfix_chat_test_${"b".repeat(32)}` }, grantSpy],
  ["NODE_ENV alone is not proof", { ...base, F21_TEST_RUN_ID: undefined }, grantSpy],
  ["inherited Node preload", { ...base, NODE_OPTIONS: "--require ignored" }, grantSpy],
  ["dotenv override", { ...base, DOTENV_CONFIG_OVERRIDE: "true" }, grantSpy]
] as const) {
  await assert.rejects(protectedBody(env, transport), /TEST_ISOLATION_REFUSED/);
  assert.equal(grants, 0); assert.equal(connections + bootstraps + mutations, 0);
  console.log(`[F2.1] PASS negative: ${label}; connection/bootstrap/mutation spies=0`);
}
await assert.rejects(protectedBody(base, async (claim, nonce) => ({ ...claim, nonce, approved: false })), /TEST_ISOLATION_REFUSED/);
await assert.rejects(protectedBody(base, async (claim, nonce) => ({ ...claim, nonce, approved: true, fingerprint: "wrong-target" })), /TEST_ISOLATION_REFUSED/);
await assert.rejects(protectedBody(base, async (claim) => ({ ...claim, nonce: "wrong-nonce", approved: true })), /TEST_ISOLATION_REFUSED/);
const changed = { ...base };
await assert.rejects(protectedBody(changed, async (claim, nonce) => {
  changed.DATABASE_URL = fakeUrl.replace("59999", "59998"); return { ...claim, nonce, approved: true };
}), /TEST_ISOLATION_REFUSED/);
assert.equal(connections + bootstraps + mutations, 0);
console.log("[F2.1] PASS negative: unconfirmed/mismatched/replayed grant and changed target; no connection/bootstrap/mutation");

// Exercise the actual guarded entrypoints with no runner, using fake targets.
// A net spy aborts any attempted TCP connection without opening a socket.
const probe = 'import net from "node:net"; const original=net.Socket.prototype.connect; net.Socket.prototype.connect = function(...args){const first=Array.isArray(args[0])?args[0][0]:args[0]; if(typeof first === "number" || (first && typeof first === "object" && "port" in first) || (typeof first === "string" && /^[0-9]+$/.test(first))){process.stderr.write("CONNECTION_SPY_CALLED"); process.exit(91);} return original.apply(this,args);};';
for (const script of ["chat-read-compat-http-tests", "chat-sync-http-tests", "chat-mobile-state-tests", "chat-mobile-runtime", "chat-test-fixture", "notification-rating-v1-tests", "chat-privacy-http-tests", "password-auth-tests", "unified-auth-api-tests", "order-expiry-http-tests", "order-lifecycle-tests", "order-capability-tests", "worker-created-order-tests", "order-location-snapshot-tests", "order-mobile-runtime"]) {
  const env = { ...process.env, ...base }; delete env.NODE_OPTIONS; delete env.DOTENV_CONFIG_OVERRIDE;
  const child = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(probe)}`, "--import", "tsx", `scripts/${script}.ts`], { env, encoding: "utf8", timeout: 15000, windowsHide: true });
  assert.equal(child.status, 1, `${script} must reject direct invocation`);
  assert.match(child.stderr, /TEST_ISOLATION_REFUSED before test\/bootstrap/);
  assert.doesNotMatch(child.stderr + child.stdout, /CONNECTION_SPY_CALLED/);
  console.log(`[F2.1] PASS direct entrypoint: ${script}; refused before TCP/test/bootstrap`);
}
const directTsxEnv = { ...process.env, ...base }; delete directTsxEnv.NODE_OPTIONS; delete directTsxEnv.DOTENV_CONFIG_OVERRIDE;
const directTsx = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/notification-rating-v1-tests.ts"], {
  env: directTsxEnv, encoding: "utf8", timeout: 15000, windowsHide: true
});
assert.equal(directTsx.status, 1);
assert.match(directTsx.stderr, /TEST_ISOLATION_REFUSED before test\/bootstrap/);
console.log("[F2.1] PASS original direct tsx invocation refused; only fake configuration supplied");
console.log("[F2.1] Isolation negative suite PASS; no database targets contacted");
