import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as requestGeneration from "../src/store/requestGeneration.mjs";
import * as pendingIntent from "../src/navigation/pendingIntent.mjs";
import * as experienceMode from "../src/navigation/experienceMode.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require("../backend/node_modules/typescript");
const sourceArgument = process.argv.indexOf("--source");
if (sourceArgument !== -1 && !process.argv[sourceArgument + 1]) throw new Error("--source requires a path");
const authPath = sourceArgument === -1
  ? path.join(root, "src/store/authStore.js")
  : path.resolve(root, process.argv[sourceArgument + 1]);
const source = await fs.readFile(authPath, "utf8");
const productRoot = path.resolve(path.dirname(authPath), "../..");
const resetSource = await fs.readFile(path.join(root, "src/store/sessionReset.js"), "utf8");
const reproduce = process.argv.includes("--reproduce");
const PUSH = "nearfix-push-token";
const DEVICE = "nearfix-push-device-id";
const results = [];
const screenSources = [];
let harnessIndex = 0;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function until(predicate, message) {
  for (let tick = 0; tick < 80; tick += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(predicate(), message);
}

function evaluateModule(text, filename, imports = {}, exposeContext) {
  const compiled = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    module, exports: module.exports,
    require(specifier) {
      if (Object.hasOwn(imports, specifier)) return imports[specifier];
      if (specifier === "zustand" || specifier === "zustand/middleware") return require(specifier);
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
    console, setTimeout, clearTimeout
  });
  new vm.Script(compiled, { filename }).runInContext(context);
  exposeContext?.(context);
  return module.exports;
}

function apiSession(label, suffix = "1", role = "client") {
  return {
    ok: true, accessToken: `fixture-access-${label}-${suffix}`, refreshToken: `fixture-refresh-${label}-${suffix}`,
    user: { id: `fixture-user-${label}`, phone: `fixture-phone-${label}`, name: label, role, sessionVersion: 1 }
  };
}

async function harness() {
  const queueUrl = new URL("../src/services/notifications/pushRegistrationQueue.mjs", import.meta.url);
  queueUrl.searchParams.set("harness", String(++harnessIndex));
  const queue = await import(queueUrl.href);
  const storage = new Map([[PUSH, "fixture-push-A"], [DEVICE, "fixture-device"]]);
  const calls = { api: 0, pushReads: 0, pushRemoves: 0, resets: 0, trace: [] };
  const hooks = { read: null, remove: null };
  let deleteImplementation = async () => ({ ok: true, deleted: true });
  let loginImplementation = async () => apiSession("A");
  let refreshImplementation = async () => ({ ok: false });
  const asyncStorage = {
    async getItem(key) {
      if (key === PUSH) {
        calls.pushReads += 1;
        calls.trace.push("push:get:start");
        if (hooks.read) await hooks.read();
        calls.trace.push("push:get:end");
      }
      return storage.get(key) ?? null;
    },
    async setItem(key, value) { storage.set(key, value); },
    async removeItem(key) {
      if (key === PUSH) {
        calls.pushRemoves += 1;
        calls.trace.push("push:remove:start");
        if (hooks.remove) await hooks.remove();
      }
      storage.delete(key);
      if (key === PUSH) calls.trace.push("push:remove:end");
    }
  };
  const roleReset = evaluateModule(resetSource, "src/store/sessionReset.js");
  const unregister = roleReset.registerSessionResetHandler(() => { calls.resets += 1; });
  const api = {
    deleteCurrentUserApi: async () => { calls.api += 1; return deleteImplementation(); },
    logoutApi: async () => ({ ok: true }),
    getCurrentUserApi: async () => ({ ok: false }),
    updateCurrentUserApi: async () => ({ ok: false }),
    refreshAccessTokenApi: (...args) => refreshImplementation(...args)
  };
  for (const action of ["completeOtpRegistration", "loginWithAppReviewDemo", "loginWithPassword", "resetPassword", "setupPassword", "verifyAuthOtp"]) {
    api[action] = (...args) => loginImplementation(...args);
  }
  let authContext;
  const { useAuthStore: store } = evaluateModule(source, "src/store/authStore.js", {
    "@react-native-async-storage/async-storage": asyncStorage,
    "../services/auth": api,
    "./sessionReset": roleReset,
    "./requestGeneration.mjs": requestGeneration,
    "../navigation/pendingIntent.mjs": pendingIntent,
    "../navigation/experienceMode.mjs": experienceMode,
    "../services/notifications/pushRegistrationQueue.mjs": queue
  }, (context) => { authContext = context; });
  await store.persist.rehydrate();
  async function login(label, suffix = "1", role = "client") {
    loginImplementation = async () => apiSession(label, suffix, role);
    const result = await store.getState().loginWithDemoPassword("fixture-phone", "fixture-password");
    assert.equal(result.ok, true);
  }
  function snapshot() {
    const state = store.getState();
    return JSON.parse(JSON.stringify({
      session: state.session, invalidation: state.invalidation, pendingIntent: state.pendingIntent,
      navigationGeneration: state.navigationGeneration, resets: calls.resets, push: storage.get(PUSH) ?? null
    }));
  }
  function startDelete() {
    const response = deferred();
    deleteImplementation = () => response.promise;
    const operation = store.getState().deleteAccount();
    // Attach immediately so a controlled rejection never becomes an unhandled promise.
    const settled = operation.then((value) => ({ value }), (error) => ({ error }));
    return { ...response, settled };
  }
  async function settle(operation) {
    const outcome = await operation.settled;
    if (outcome.error) throw outcome.error;
    return outcome.value;
  }
  async function register(label) {
    return queue.enqueuePushRegistration(async () => {
      calls.trace.push(`registration:${label}`);
      await asyncStorage.setItem(PUSH, `fixture-push-${label}`);
      return { ok: true };
    });
  }
  await login("A");
  return {
    store, storage, calls, hooks, queue, roleReset, context: authContext, login, snapshot, startDelete, settle, register,
    setDelete: (implementation) => { deleteImplementation = implementation; },
    setLogin: (implementation) => { loginImplementation = implementation; },
    setRefresh: (implementation) => { refreshImplementation = implementation; },
    close: async () => { unregister(); await queue.waitForPendingPushRegistration(); }
  };
}

async function test(name, body) {
  const h = await harness();
  try {
    await body(h);
    results.push({ name, status: "PASS" });
    console.log(`[S3-AUTH] PASS ${name}`);
  } catch (error) {
    // Only assertions and synthetic fixture labels are emitted; there is no external API or credential.
    results.push({ name, status: "FAIL", error: String(error.message).slice(0, 700) });
    console.log(`[S3-AUTH] FAIL ${name}: ${String(error.message).slice(0, 700)}`);
  } finally {
    await h.close();
  }
}

await test("no-token preserves state and performs no API or push cleanup", async (h) => {
  h.store.setState({ session: null });
  const before = h.snapshot();
  const result = await h.store.getState().deleteAccount();
  assert.equal(result.ok, false);
  assert.equal(result.message, "No API session token");
  assert.equal(h.calls.api, 0);
  assert.equal(h.calls.pushRemoves, 0);
  assert.deepEqual(h.snapshot(), before);
});

await test("current success clears auth intent and role state exactly once and preserves device ID", async (h) => {
  h.store.getState().setPendingIntent({ kind: "BOOKING", workerId: "fixture-worker" });
  const before = h.snapshot();
  const result = await h.store.getState().deleteAccount();
  assert.equal(result.ok, true);
  const after = h.snapshot();
  assert.equal(after.session, null);
  assert.equal(after.invalidation, null);
  assert.equal(after.pendingIntent, null);
  assert.equal(after.navigationGeneration, before.navigationGeneration + 1);
  assert.equal(after.resets, before.resets + 1);
  assert.equal(after.push, null);
  assert.equal(h.storage.get(DEVICE), "fixture-device");
});

await test("current API error preserves current session and original error result", async (h) => {
  const before = h.snapshot();
  h.setDelete(async () => ({ ok: false, code: "FIXTURE_DELETE_FAILED" }));
  assert.equal((await h.store.getState().deleteAccount()).code, "FIXTURE_DELETE_FAILED");
  assert.deepEqual(h.snapshot(), before);
});

await test("current API exception remains an exception and preserves current state", async (h) => {
  const before = h.snapshot();
  h.setDelete(async () => { throw new Error("fixture-delete-exception"); });
  await assert.rejects(h.store.getState().deleteAccount(), /fixture-delete-exception/);
  assert.deepEqual(h.snapshot(), before);
});

for (const sameAccount of [false, true]) {
  for (const response of ["success", "error", "exception"]) {
    await test(`old ${response} after ${sameAccount ? "same-account newer login" : "B login"} is stale without B effects`, async (h) => {
      const operation = h.startDelete();
      await h.login(sameAccount ? "A" : "B", "2");
      await h.register("B");
      h.store.getState().setPendingIntent({ kind: "BOOKING", workerId: "fixture-new-worker" });
      const before = h.snapshot();
      if (response === "exception") operation.reject(new Error("fixture-old-exception"));
      else operation.resolve(response === "success" ? { ok: true, deleted: true } : { ok: false, code: "USER_BLOCKED" });
      const result = await h.settle(operation);
      assert.equal(result.ok, false);
      assert.equal(result.stale, true);
      assert.deepEqual(h.snapshot(), before);
      assert.equal(h.calls.pushRemoves, 0);
    });
  }
}

for (const response of ["success", "error"]) {
  await test(`old ${response} after logout is stale without duplicate cleanup`, async (h) => {
    const operation = h.startDelete();
    await h.store.getState().logout();
    const before = h.snapshot();
    const removals = h.calls.pushRemoves;
    operation.resolve(response === "success" ? { ok: true, deleted: true } : { ok: false, code: "SESSION_INVALID" });
    const result = await h.settle(operation);
    assert.equal(result.stale, true);
    assert.equal(result.ok, false);
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.calls.pushRemoves, removals);
  });
}

await test("old success after terminal invalidation cannot clear a new invalidation", async (h) => {
  const operation = h.startDelete();
  h.store.getState().handleTerminalSession("USER_BLOCKED", "fixture-blocked");
  const before = h.snapshot();
  operation.resolve({ ok: true, deleted: true });
  assert.equal((await h.settle(operation)).stale, true);
  assert.deepEqual(h.snapshot(), before);
});

await test("provider experience switch invalidates earlier delete response", async (h) => {
  await h.login("A", "provider", "provider");
  const operation = h.startDelete();
  assert.equal(h.store.getState().setExperienceMode("client"), true);
  const before = h.snapshot();
  operation.resolve({ ok: true, deleted: true });
  assert.equal((await h.settle(operation)).stale, true);
  assert.deepEqual(h.snapshot(), before);
});

for (const response of ["success", "error"]) {
  await test(`same-session token refresh permits current delete ${response}`, async (h) => {
    const operation = h.startDelete();
    h.setRefresh(async () => ({ ...apiSession("A", "refreshed"), token: "fixture-refreshed-access" }));
    assert.equal((await h.store.getState().refreshSession()).ok, true);
    const refreshed = h.snapshot();
    operation.resolve(response === "success" ? { ok: true, deleted: true } : { ok: false, code: "FIXTURE_DELETE_FAILED" });
    const result = await h.settle(operation);
    assert.equal(result.stale, undefined);
    if (response === "success") {
      assert.equal(result.ok, true);
      assert.equal(h.store.getState().session, null);
      assert.equal(h.calls.resets, refreshed.resets + 1);
    } else {
      assert.equal(result.code, "FIXTURE_DELETE_FAILED");
      assert.deepEqual(h.snapshot(), refreshed);
    }
  });
}

await test("newer pending login supersedes delete before response and can finish", async (h) => {
  const operation = h.startDelete();
  const loginResponse = deferred();
  h.setLogin(() => loginResponse.promise);
  const login = h.store.getState().loginWithDemoPassword("fixture-phone", "fixture-password");
  const before = h.snapshot();
  operation.resolve({ ok: true, deleted: true });
  const result = await h.settle(operation);
  loginResponse.resolve(apiSession("B"));
  const loginResult = await login;
  assert.equal(result.stale, true);
  assert.equal(result.ok, false);
  assert.equal(loginResult.ok, true);
  assert.equal(h.store.getState().session.userId, "fixture-user-B");
  assert.equal(h.calls.pushRemoves, 0);
  assert.equal(h.calls.resets, before.resets + 1);
});

await test("current delete supersedes an earlier pending login so deleted session cannot revive", async (h) => {
  const loginResponse = deferred();
  h.setLogin(() => loginResponse.promise);
  const login = h.store.getState().loginWithDemoPassword("fixture-phone", "fixture-password");
  assert.equal((await h.store.getState().deleteAccount()).ok, true);
  loginResponse.resolve(apiSession("A", "late"));
  assert.equal((await login).stale, true);
  assert.equal(h.store.getState().session, null);
});

await test("cleanup waits behind an existing registration then removes its final A token", async (h) => {
  const registration = deferred();
  const prior = h.queue.enqueuePushRegistration(async () => {
    await registration.promise;
    h.storage.set(PUSH, "fixture-push-A-final");
  });
  const deletion = h.store.getState().deleteAccount();
  await new Promise((resolve) => setImmediate(resolve));
  const prematureRemoves = h.calls.pushRemoves;
  registration.resolve();
  await prior;
  const result = await deletion;
  assert.equal(prematureRemoves, 0, "delete must serialize after pending registration");
  assert.equal(result.ok, true);
  assert.equal(h.storage.has(PUSH), false);
});

await test("new login while cleanup is queued prevents any token read/remove", async (h) => {
  const registration = deferred();
  const prior = h.queue.enqueuePushRegistration(() => registration.promise);
  const deletion = h.store.getState().deleteAccount();
  const settled = deletion.then((value) => ({ value }), (error) => ({ error }));
  await new Promise((resolve) => setImmediate(resolve));
  await h.login("B");
  const afterLogin = h.snapshot();
  const bRegistration = h.register("B");
  registration.resolve();
  await prior;
  const result = (await settled).value;
  await bRegistration;
  assert.equal(result?.stale, true);
  assert.equal(h.calls.pushReads, 0);
  assert.equal(h.calls.pushRemoves, 0);
  assert.deepEqual(h.snapshot(), { ...afterLogin, push: "fixture-push-B" });
});

for (const sameAccount of [false, true]) {
  await test(`${sameAccount ? "same-account new session" : "B login"} during native remove cannot lose new queued token`, async (h) => {
    const gate = deferred();
    h.hooks.remove = () => gate.promise;
    const deletion = h.store.getState().deleteAccount();
    const settled = deletion.then((value) => ({ value }), (error) => ({ error }));
    await until(() => h.calls.pushRemoves === 1, "push removal must reach deferred native boundary");
    await h.login(sameAccount ? "A" : "B", "2");
    const before = h.snapshot();
    const registration = h.register("B");
    await new Promise((resolve) => setImmediate(resolve));
    const wroteBeforeRemoveFinished = h.calls.trace.includes("registration:B");
    gate.resolve();
    const result = (await settled).value;
    await registration;
    assert.equal(wroteBeforeRemoveFinished, false, "B registration must wait behind native removal");
    assert.equal(result?.ok, false);
    assert.equal(result?.stale, true);
    assert.deepEqual(h.snapshot(), { ...before, push: "fixture-push-B" });
  });
}

await test("new pending login during native removal is not invalidated by late deletion", async (h) => {
  const gate = deferred();
  const loginResponse = deferred();
  h.hooks.remove = () => gate.promise;
  const deletion = h.store.getState().deleteAccount();
  const settled = deletion.then((value) => ({ value }), (error) => ({ error }));
  await until(() => h.calls.pushRemoves === 1, "push removal must reach deferred boundary");
  h.setLogin(() => loginResponse.promise);
  const login = h.store.getState().loginWithDemoPassword("fixture-phone", "fixture-password");
  const before = h.snapshot();
  gate.resolve();
  const result = (await settled).value;
  loginResponse.resolve(apiSession("B"));
  const loginResult = await login;
  await h.register("B");
  assert.equal(result?.stale, true);
  assert.equal(loginResult.ok, true);
  assert.equal(h.store.getState().session.userId, "fixture-user-B");
  assert.equal(h.calls.resets, before.resets + 1);
  assert.equal(h.storage.get(PUSH), "fixture-push-B");
});

for (const boundary of ["remove"]) {
  await test(`current storage ${boundary} exception preserves auth and original rejection`, async (h) => {
    h.hooks[boundary] = async () => { throw new Error(`fixture-storage-${boundary}`); };
    const before = h.snapshot();
    await assert.rejects(h.store.getState().deleteAccount(), new RegExp(`fixture-storage-${boundary}`));
    assert.deepEqual(h.snapshot(), before);
  });
  await test(`old storage ${boundary} exception after B login is stale and queue recovers`, async (h) => {
    const gate = deferred();
    h.hooks[boundary] = () => gate.promise;
    const deletion = h.store.getState().deleteAccount();
    const settled = deletion.then((value) => ({ value }), (error) => ({ error }));
    await new Promise((resolve) => setImmediate(resolve));
    const reached = boundary === "read" ? h.calls.pushReads : h.calls.pushRemoves;
    if (!reached) {
      gate.resolve();
      await settled;
      assert.fail(`cleanup did not reach guarded storage ${boundary}`);
    }
    await h.login("B");
    const before = h.snapshot();
    const registration = h.register("B");
    gate.reject(new Error(`fixture-old-storage-${boundary}`));
    const outcome = await settled;
    await registration;
    assert.equal(outcome.error, undefined);
    assert.equal(outcome.value?.stale, true);
    assert.equal(outcome.value?.ok, false);
    assert.deepEqual(h.snapshot(), { ...before, push: "fixture-push-B" });
  });
}

await test("concurrent deletes allow only the latest operation to clear local state", async (h) => {
  const first = h.startDelete();
  const second = h.startDelete();
  const before = h.snapshot();
  first.resolve({ ok: true, deleted: true });
  const firstResult = await h.settle(first);
  second.resolve({ ok: true, deleted: true });
  const secondResult = await h.settle(second);
  assert.equal(firstResult.stale, true);
  assert.equal(firstResult.ok, false);
  assert.equal(secondResult.ok, true);
  assert.equal(h.calls.resets, before.resets + 1);
  assert.equal(h.calls.pushRemoves, 1);
  assert.equal(h.store.getState().navigationGeneration, before.navigationGeneration + 1);
});

for (const screen of [
  { name: "ClientProfileScreen", file: "src/screens/profile/ClientProfileScreen.js", next: "  async function handleSaveProfile()", role: "client" },
  { name: "WorkerProfileManageScreen", file: "src/screens/worker/WorkerProfileManageScreen.js", next: "  async function handleRefresh()", role: "worker" }
]) {
  const screenPath = path.join(productRoot, screen.file);
  const screenSource = await fs.readFile(screenPath, "utf8");
  screenSources.push({ source: path.relative(root, screenPath).replaceAll("\\", "/"), sha256: createHash("sha256").update(screenSource).digest("hex") });
  await test(`${screen.name} post-delete continuation preserves a newer public login's role data`, async (h) => {
    const phases = [];
    const roleData = { client: ["fixture-A-client"], worker: ["fixture-A-worker"] };
    const clear = (role) => { phases.push(`clear:${role}`); roleData[role] = []; };
    const unregister = [
      h.roleReset.registerSessionResetHandler(() => clear("client")),
      h.roleReset.registerSessionResetHandler(() => clear("worker"))
    ];
    const response = deferred();
    h.setDelete(() => response.promise);
    // The login API promise stays in the source VM realm. Cross-realm promise
    // assimilation would add artificial microtasks to the screen timing proof.
    h.setLogin(vm.runInContext(`async () => ({
      ok: true, token: "fixture-B-session", refreshToken: "fixture-B-refresh",
      user: { id: "fixture-user-B", phone: "fixture-B-phone", name: "B", role: "client", sessionVersion: 1 }
    })`, h.context));
    let armed = true;
    let login;
    const unsubscribe = h.store.subscribe((state) => {
      if (armed && state.session === null) {
        armed = false;
        phases.push("delete-local-reset");
        login = h.store.getState().loginWithDemoPassword("fixture-phone", "fixture-password");
      } else if (state.session?.userId === "fixture-user-B") {
        roleData.client = ["fixture-B-client"];
        roleData.worker = ["fixture-B-worker"];
        phases.push("B-established");
      }
    });
    const start = screenSource.indexOf("  async function handleDeleteAccount() {");
    const end = screenSource.indexOf(screen.next, start);
    assert.ok(start >= 0 && end > start, "actual screen delete handler must be located");
    Object.assign(h.context, {
      deleteAccount: h.store.getState().deleteAccount,
      clearUserData() { phases.push("old-screen-cleanup"); clear(screen.role); },
      setDeletingAccount() {},
      Alert: { alert() { phases.push("screen-alert"); } }
    });
    const handler = vm.runInContext(`(${screenSource.slice(start, end).trim()})`, h.context);
    try {
      const action = handler();
      response.resolve({ ok: true, deleted: true });
      await action;
      assert.ok(login, "new public login must start after deletion's synchronous reset");
      assert.equal((await login).ok, true, "later login must not be invalidated by old deletion");
      assert.equal(h.store.getState().session?.userId, "fixture-user-B");
      assert.ok(phases.indexOf("B-established") >= 0, "B must have populated role data");
      const lateCleanup = phases.indexOf("old-screen-cleanup");
      if (lateCleanup !== -1) {
        assert.ok(lateCleanup > phases.indexOf("B-established"), "proof must place old destructive callback after B login");
      }
      assert.deepEqual(roleData.client, ["fixture-B-client"], `new client data must survive: ${phases.join(",")}`);
      assert.deepEqual(roleData.worker, ["fixture-B-worker"], `new worker data must survive: ${phases.join(",")}`);
    } finally {
      unsubscribe();
      unregister.forEach((remove) => remove());
    }
  });
}

const summary = {
  evidenceLevel: "Actual full authStore source transpiled in VM with installed Zustand create/persist, actual request guards, session-reset registry and push-registration queue; two actual extracted screen handlers run with a public login. API, AsyncStorage and role-data contents are deterministic mocks. No network, backend, native OS or device proof.",
  mode: reproduce ? "before diagnostic" : "regression",
  source: path.relative(root, authPath).replaceAll("\\", "/"),
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  screenSources,
  queueGuarantee: "Tests require delete cleanup to share the actual queue used by AppNavigator registration writes. Arbitrary storage writers outside that queue are not covered.",
  total: results.length,
  passed: results.filter((result) => result.status === "PASS").length,
  failed: results.filter((result) => result.status === "FAIL").length,
  cases: results
};
const artifactDirectory = path.join(root, "artifacts/sprint3-session-isolation-2026-10-10");
await fs.mkdir(artifactDirectory, { recursive: true });
await fs.writeFile(path.join(artifactDirectory, `delete-account-${reproduce ? "before" : "after"}.json`), JSON.stringify(summary, null, 2) + "\n");
console.log(`[S3-AUTH] ${summary.total} cases: ${summary.passed} PASS, ${summary.failed} FAIL (${summary.mode})`);
if (!reproduce && summary.failed) process.exitCode = 1;
if (reproduce && !summary.failed) process.exitCode = 1;
