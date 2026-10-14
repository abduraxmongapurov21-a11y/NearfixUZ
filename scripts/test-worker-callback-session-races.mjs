import fs from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { create } from "zustand";
import { TRACKING_STATUSES } from "../src/constants/orderTracking.js";
import { WORKER_STATUS } from "../src/constants/workerStatus.js";
import { createAccountRequestGuard } from "../src/store/requestGeneration.mjs";
import { registerSessionResetHandler, resetRoleStores } from "../src/store/sessionReset.js";
import { buildWorkerProfileSyncStatus } from "../src/store/workerSyncState.mjs";

// Compile and execute the entire current product module, including its real
// Zustand initializer and registered reset handler. Only module dependencies
// are injected: no copied callback bodies, source rewrites or real transport.
const require = createRequire(import.meta.url);
const { transformSync } = require("@babel/core");
const source = fs.readFileSync(new URL("../src/store/workerStore.js", import.meta.url), "utf8");
const sourceHash = createHash("sha256").update(source).digest("hex");
const compiled = transformSync(source, {
  filename: "workerStore.js", babelrc: false, configFile: false,
  plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")]
}).code;
const reproduce = process.argv.includes("--reproduce");
const plannedCases = 81;
const failures = [];
let cases = 0;
let assertions = 0;

class CheckFailure extends Error {}
function check(condition, message) {
  assertions += 1;
  if (!condition) throw new CheckFailure(message);
}
async function testCase(label, action) {
  cases += 1;
  try { await action(); console.log(`[RACE] PASS ${label}`); }
  catch (error) {
    const message = error instanceof CheckFailure ? error.message : "unexpected test/runtime error (details suppressed)";
    failures.push({ label, message });
    console.log(`[RACE] FAIL ${label}: ${message}`);
  }
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function observed(promise) { return promise.then((value) => ({ value }), (error) => ({ error })); }
function snapshot(store) { return JSON.stringify(store.getState()); }
function session(owner = "A", tokenSuffix = "initial", experienceMode = "worker") {
  return { userId: owner, token: `synthetic-${owner}-${tokenSuffix}`, role: "provider", experienceMode, sessionVersion: 7 };
}
function harness() {
  const h = { session: session(), calls: [], cleanups: [] };
  const api = (kind) => (token, ...args) => {
    const request = { kind, token, args, ...deferred() };
    h.calls.push(request);
    return request.promise;
  };
  const services = {
    updateAvailabilityApi: api("availability"), updateWorkerProfileApi: api("profile"), updateOrderStatusApi: api("order")
  };
  const unexpected = () => { throw new Error("Unexpected dependency invocation"); };
  const injectedServices = new Proxy(services, { get: (target, key) => target[key] || unexpected });
  const module = { exports: {} };
  const imports = {
    zustand: { create }, "../constants/orderTracking": { TRACKING_STATUSES }, "../constants/workerStatus": { WORKER_STATUS },
    "../services/workers/workerService": injectedServices,
    "./authStore": { useAuthStore: { getState: () => ({ session: h.session }) } },
    "./sessionReset": { registerSessionResetHandler(handler) {
      const cleanup = registerSessionResetHandler(handler); h.cleanups.push(cleanup); return cleanup;
    } },
    "./requestGeneration.mjs": { createAccountRequestGuard }, "./workerSyncState.mjs": { buildWorkerProfileSyncStatus }
  };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require(name) {
      if (!Object.hasOwn(imports, name)) throw new Error("Unmocked module import");
      return imports[name];
    }, Date, Promise, console
  }, { filename: "actual-workerStore-under-test.js" });
  h.store = module.exports.useWorkerStore;
  // The seam exists in the full product module; after the fix it also supplies
  // the three mutation dependencies, without changing how before code runs.
  h.restore = module.exports.configureWorkerStoreForTests({ getSession: () => h.session, ...services });
  h.dispose = () => { h.restore(); h.cleanups.forEach((cleanup) => cleanup()); };
  return h;
}
function seed(h, owner = "A", job = "job-X") {
  h.store.setState({
    workerProfile: { id: `worker-${owner}`, name: `Profile ${owner}`, availability: WORKER_STATUS.BUSY,
      completedOrders: 3, preserved: `profile-${owner}` },
    incomingRequests: [{ id: `incoming-${owner}` }], pendingIncomingRequestId: null,
    activeJob: job ? { id: job, statusKey: TRACKING_STATUSES.IN_PROGRESS, preserved: `job-${owner}` } : null,
    operationalStatus: WORKER_STATUS.BUSY,
    earnings: { todayEarnings: 125000, weekEarnings: 250000, monthEarnings: 500000, completedJobs: 3,
      activeHours: 1, averagePerDay: 125000, growthPercentage: 0, platformFees: 12500, revenueTrend: [] },
    transactions: [{ id: `transaction-${owner}` }], completedOrders: [{ id: `history-${owner}`, statusKey: TRACKING_STATUSES.COMPLETED }],
    apiStatus: { source: `fixture-${owner}`, lastError: null },
    profileSyncStatus: { loading: false, error: null, isStale: false, lastSyncedAt: "fixture" },
    serviceLocationStatus: { saving: false, error: null }
  });
}
function reply(request, outcome = "success", extra = {}) {
  if (outcome === "error") return { ok: false, code: "SYNTHETIC_ERROR", message: "Deferred API failure", ...extra };
  if (request.kind === "availability") return { ok: true, availability: { status: request.args[0] }, ...extra };
  if (request.kind === "profile") return { ok: true, worker: { name: "Saved profile", ...request.args[0] }, ...extra };
  return { ok: true, order: { id: request.args[0], statusKey: request.args[1], responseMarker: "resolved-order" }, ...extra };
}
const actions = [
  { name: "setOperationalStatus", start: (h) => h.store.getState().setOperationalStatus(WORKER_STATUS.AVAILABLE) },
  { name: "submitWorkerProfile", start: (h) => h.store.getState().submitWorkerProfile({ name: "Saved profile" }) },
  { name: "updateActiveJobStatus", start: (h) => h.store.getState().updateActiveJobStatus(TRACKING_STATUSES.ON_THE_WAY) },
  { name: "completeActiveJob", start: (h) => h.store.getState().completeActiveJob() }
];
const jobActions = actions.slice(2);
const transitions = [
  { name: "A-to-B with role reset", apply(h) { resetRoleStores(); h.session = session("B"); seed(h, "B", "job-Y"); } },
  { name: "A-to-B identity without reset", apply(h) { h.session = session("B"); seed(h, "B", "job-Y"); } },
  { name: "logout", apply(h) { resetRoleStores(); h.session = null; } },
  { name: "same-account re-login", apply(h) { resetRoleStores(); h.session = session("A", "new-login"); seed(h, "A-new-login", "job-Y"); } },
  { name: "mode reset", apply(h) { resetRoleStores(); h.session = session("A", "initial", "client"); } },
  { name: "session generation reset identical token", apply(h) { resetRoleStores(); seed(h, "A-new-generation", "job-X"); } }
];
async function staleResult(h, pending, expectedState) {
  const result = await pending;
  check(!result.error, "Stale callback resolves without throwing into the newer session");
  check(snapshot(h.store) === expectedState, "New session/job state must remain unchanged by old response");
  check(result.value?.ok === false && result.value?.stale === true, "Stale callback reports ok:false/stale:true before caller effects");
}
function currentResult(action, h, result, outcome) {
  check(!result.error, "Current callback does not throw");
  check(Boolean(result.value?.ok) === (outcome === "success"), "Current callback result matches API outcome");
  if (outcome === "error") return;
  const state = h.store.getState();
  if (action.name === "setOperationalStatus") check(state.operationalStatus === WORKER_STATUS.AVAILABLE && state.workerProfile.availability === WORKER_STATUS.AVAILABLE, "Current availability response applies");
  if (action.name === "submitWorkerProfile") check(state.workerProfile.name === "Saved profile" && state.apiStatus.source === "api", "Current profile response applies");
  if (action.name === "updateActiveJobStatus") check(state.activeJob?.id === "job-X" && state.activeJob.statusKey === TRACKING_STATUSES.ON_THE_WAY, "Current job status response applies");
  if (action.name === "completeActiveJob") check(state.activeJob === null && state.earnings.completedJobs === 4 && state.workerProfile.completedOrders === 4 && state.completedOrders.filter((order) => order.id === "job-X").length === 1, "Current completion applies exactly once");
}

console.log(`[RACE] Full actual Zustand workerStore; mode=${reproduce ? "BEFORE reproduction" : "regression"}; sha256=${sourceHash}`);
for (const action of actions) {
  for (const transition of transitions) {
    for (const outcome of ["success", "error"]) {
      await testCase(`${action.name} stale ${outcome}: ${transition.name}`, async () => {
        const h = harness();
        try {
          seed(h); const pending = observed(action.start(h));
          check(h.calls.length === 1, "Actual callback invokes exactly one deferred API dependency");
          transition.apply(h); const expected = snapshot(h.store); const authBefore = JSON.stringify(h.session);
          h.calls[0].resolve(reply(h.calls[0], outcome)); await staleResult(h, pending, expected);
          check(JSON.stringify(h.session) === authBefore, "Worker callback cannot change the current auth identity");
        } finally { h.dispose(); }
      });
    }
  }
}
for (const action of jobActions) {
  for (const replacement of ["job-Y", null]) {
    for (const outcome of ["success", "error"]) {
      await testCase(`${action.name} same-session job-X to ${replacement || "null"} ${outcome}`, async () => {
        const h = harness();
        try {
          seed(h); const pending = observed(action.start(h));
          h.store.setState({ activeJob: replacement ? { id: replacement, statusKey: TRACKING_STATUSES.ACCEPTED, current: true } : null });
          const expected = snapshot(h.store); h.calls[0].resolve(reply(h.calls[0], outcome));
          await staleResult(h, pending, expected);
        } finally { h.dispose(); }
      });
    }
  }
}
for (const newer of ["status", "completion"]) {
  await testCase(`shared active-job operation scope: newer ${newer} wins`, async () => {
    const h = harness();
    try {
      seed(h);
      const older = observed(h.store.getState().updateActiveJobStatus(TRACKING_STATUSES.ON_THE_WAY));
      const latest = observed(newer === "status" ? h.store.getState().updateActiveJobStatus(TRACKING_STATUSES.IN_PROGRESS) : h.store.getState().completeActiveJob());
      h.calls[1].resolve(reply(h.calls[1])); check((await latest).value?.ok === true, "Newest active-job operation succeeds");
      const expected = snapshot(h.store); h.calls[0].resolve(reply(h.calls[0])); await staleResult(h, older, expected);
    } finally { h.dispose(); }
  });
}
for (const order of ["newer-first", "older-first"]) {
  await testCase(`duplicate completion ${order} counts history once`, async () => {
    const h = harness();
    try {
      seed(h); const older = observed(h.store.getState().completeActiveJob()); const latest = observed(h.store.getState().completeActiveJob());
      if (order === "older-first") {
        const expected = snapshot(h.store); h.calls[0].resolve(reply(h.calls[0])); await staleResult(h, older, expected);
        h.calls[1].resolve(reply(h.calls[1])); check((await latest).value?.ok === true, "Latest completion succeeds");
      } else {
        h.calls[1].resolve(reply(h.calls[1])); check((await latest).value?.ok === true, "Latest completion succeeds");
        const expected = snapshot(h.store); h.calls[0].resolve(reply(h.calls[0])); await staleResult(h, older, expected);
      }
      const state = h.store.getState();
      check(state.earnings.completedJobs === 4 && state.workerProfile.completedOrders === 4, "Duplicate completion increments each count once");
      check(state.completedOrders.filter((entry) => entry.id === "job-X").length === 1, "Duplicate completion creates one history row");
    } finally { h.dispose(); }
  });
}
await testCase("completion with existing job history never increments twice", async () => {
  const h = harness();
  try {
    seed(h); h.store.setState({ completedOrders: [{ id: "job-X", statusKey: TRACKING_STATUSES.COMPLETED }] });
    const pending = observed(h.store.getState().completeActiveJob()); h.calls[0].resolve(reply(h.calls[0]));
    check((await pending).value?.ok === true, "Current completion can clear a stale active job snapshot");
    const state = h.store.getState();
    check(state.activeJob === null && state.completedOrders.length === 1 && state.earnings.completedJobs === 3 && state.workerProfile.completedOrders === 3, "Existing completed identity is deduplicated without double counts");
  } finally { h.dispose(); }
});
for (const action of jobActions) {
  await testCase(`${action.name} missing active job makes no request`, async () => {
    const h = harness();
    try {
      seed(h, "A", null); const before = snapshot(h.store); const result = await action.start(h);
      check(result.ok === false && h.calls.length === 0 && snapshot(h.store) === before, "Missing job returns failure without mutation or API call");
    } finally { h.dispose(); }
  });
}
for (const action of actions) {
  for (const outcome of ["success", "error"]) {
    await testCase(`${action.name} current-session ${outcome} control`, async () => {
      const h = harness();
      try {
        seed(h); const before = snapshot(h.store); const pending = observed(action.start(h)); h.calls[0].resolve(reply(h.calls[0], outcome));
        const result = await pending; currentResult(action, h, result, outcome);
        if (outcome === "error") {
          if (action.name === "submitWorkerProfile") check(h.store.getState().apiStatus.lastError === "Deferred API failure", "Current profile error remains visible");
          else check(snapshot(h.store) === before, "Current unsuccessful callback preserves state");
        }
      } finally { h.dispose(); }
    });
  }
  await testCase(`${action.name} no token makes no request`, async () => {
    const h = harness();
    try {
      seed(h); h.session = { userId: "A", role: "provider" }; const before = snapshot(h.store); const result = await action.start(h);
      check(result.ok === false && h.calls.length === 0 && snapshot(h.store) === before, "Missing token fails without API call or state mutation");
    } finally { h.dispose(); }
  });
  await testCase(`${action.name} token refresh within same session stays valid`, async () => {
    const h = harness();
    try {
      seed(h); const pending = observed(action.start(h)); h.session = session("A", "refreshed");
      h.calls[0].resolve(reply(h.calls[0])); currentResult(action, h, await pending, "success");
    } finally { h.dispose(); }
  });
}
for (const action of actions.slice(0, 2)) {
  await testCase(`${action.name} latest request wins reverse responses`, async () => {
    const h = harness();
    try {
      seed(h); const older = observed(action.start(h));
      const latest = observed(action.name === "setOperationalStatus" ? h.store.getState().setOperationalStatus(WORKER_STATUS.OFFLINE) : h.store.getState().submitWorkerProfile({ name: "Newest profile" }));
      h.calls[1].resolve(reply(h.calls[1])); check((await latest).value?.ok === true, "Latest callback succeeds");
      const expected = snapshot(h.store); h.calls[0].resolve(reply(h.calls[0])); await staleResult(h, older, expected);
    } finally { h.dispose(); }
  });
}
if (cases !== plannedCases) failures.push({ label: "case count", message: "Planned logical case count mismatch" });
console.log(`[RACE] Worker callbacks: ${cases}/${plannedCases} named cases; ${cases - failures.length} passed; ${failures.length} failed cases; ${assertions} assertions`);
console.log("[RACE] Evidence scope: actual full Zustand module + actual request generation/reset functions; deferred API/auth dependency mocks; no HTTP/device/push delivery");
console.log(`[RACE] RESULT ${failures.length ? "FAIL" : "PASS"}`);
if (failures.length) process.exitCode = 1;
