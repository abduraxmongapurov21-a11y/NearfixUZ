/* global __dirname, Buffer */
/* Executes production service/store source with isolated Prisma/network fixtures. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Module = require("node:module");
const { pathToFileURL } = require("node:url");
const ts = require("../backend/node_modules/typescript");
const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
function compile(relative, mocks) {
  const file = path.join(root, relative);
  const target = new Module(file, module);
  target.filename = file;
  target.paths = Module._nodeModulePaths(path.dirname(file));
  const original = target.require.bind(target);
  target.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  target._compile(ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
  return target.exports;
}
async function main() {
  const orders = Array.from({ length: 215 }, (_, index) => ({
    id: `order-${String(index).padStart(4, "0")}`, workerId: "worker-a", status: "COMPLETED",
    updatedAt: new Date(index < 120 ? "2026-10-13T10:00:00Z" : "2026-10-12T10:00:00Z"),
    finalAmount: 1000 + index, priceEstimate: null, payments: [],
    client: { name: `Client ${index}` }, publicCode: `NF-${index}`, serviceType: "Fixture"
  }));
  orders.push({ ...orders[0], id: "other-worker", workerId: "worker-b" });
  const requests = [];
  const workerSource = read("backend/src/modules/workers/worker.service.ts");
  const methods = workerSource.slice(workerSource.indexOf("export async function getOwnWorkerTransactions("), workerSource.indexOf("export async function updateOwnWorkerProfile("));
  const amount = workerSource.slice(workerSource.indexOf("function orderAmount("), workerSource.indexOf("function activeHoursForOrder("));
  const serviceContext = vm.createContext({
    exports: {}, Buffer, OrderStatus: { COMPLETED: "COMPLETED" }, platformFeeRate: 0.05,
    prisma: {
      workerProfile: { findUnique: async ({ where }) => ({ id: where.userId === "user-a" ? "worker-a" : "worker-b" }) },
      order: { findMany: async (query) => {
        requests.push(query);
        return orders.filter((order) => {
          if (order.workerId !== query.where.workerId || order.status !== query.where.status) return false;
          if (!query.where.OR) return true;
          const boundary = query.where.OR[1];
          return order.updatedAt < boundary.updatedAt || (order.updatedAt.getTime() === boundary.updatedAt.getTime() && order.id < boundary.id.lt);
        }).sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : -1)).slice(0, query.take);
      } }
    }
  });
  vm.runInContext(ts.transpileModule(amount + methods, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, serviceContext);
  const { getOwnWorkerTransactionsPage: page, getOwnWorkerTransactions: legacy } = serviceContext.exports;
  let result = await page("user-a");
  assert.equal(result.transactions.length, 100);
  assert.ok(result.nextCursor);
  assert.equal(requests[0].take, 101, "database reads remain bounded");
  const all = [...result.transactions];
  while (result.nextCursor) {
    result = await page("user-a", { cursor: result.nextCursor });
    all.push(...result.transactions);
  }
  assert.equal(all.length, 215);
  assert.equal(new Set(all.map((row) => row.id)).size, 215, "equal-timestamp page boundaries do not duplicate or skip rows");
  assert.ok(!all.some((row) => row.id === "other-worker"));
  assert.equal((await legacy("user-a")).length, 100, "existing array-returning service remains compatible");
  for (const limit of [0, 101, -1, 1.5, "bad", [1]]) await assert.rejects(page("user-a", { limit }), (error) => error.status === 400);
  for (const cursor of ["bad!", "", Buffer.from(JSON.stringify(["not-a-date", "id"])).toString("base64url")]) await assert.rejects(page("user-a", { cursor }), (error) => error.status === 400);

  const guard = await import(pathToFileURL(path.join(root, "src/store/requestGeneration.mjs")));
  let session = { userId: "user-a", token: "fixture-a" };
  let fetchTransactions = (token, options) => page(session.userId, options).then((payload) => ({ ok: true, ...payload }));
  const serviceMocks = new Proxy({}, { get: (_, key) => key === "__esModule" ? true : async () => ({ ok: false }) });
  const { useWorkerStore: store, configureWorkerStoreForTests } = compile("src/store/workerStore.js", {
    "../constants/orderTracking": { TRACKING_STATUSES: { ACCEPTED: "ACCEPTED", ON_THE_WAY: "ON_THE_WAY", IN_PROGRESS: "IN_PROGRESS", COMPLETED: "COMPLETED" } },
    "../constants/workerStatus": { WORKER_STATUS: { OFFLINE: "offline" } },
    "../services/workers/workerService": serviceMocks,
    "./authStore": { useAuthStore: { getState: () => ({ session }) } },
    "./sessionReset": { registerSessionResetHandler() {} },
    "./requestGeneration.mjs": guard,
    "./workerSyncState.mjs": { buildWorkerProfileSyncStatus: () => ({ loading: false }) }
  });
  const restore = configureWorkerStoreForTests({
    getSession: () => session,
    fetchWorkerMeApi: async () => ({ ok: true, worker: { id: "worker-a" } }),
    fetchIncomingOrdersApi: async () => ({ ok: true, requests: [] }),
    fetchWorkerOrdersApi: async () => ({ ok: true, orders: [] }),
    fetchWorkerEarningsApi: async () => ({ ok: true, earnings: {} }),
    fetchWorkerTransactionsApi: (...args) => fetchTransactions(...args)
  });
  await store.getState().syncWorkerFromApi();
  assert.equal(store.getState().transactions.length, 100);
  await store.getState().loadMoreTransactionsFromApi();
  assert.equal(store.getState().transactions.length, 200);
  await store.getState().loadMoreTransactionsFromApi();
  assert.equal(store.getState().transactions.length, 215);
  assert.equal(store.getState().transactionsNextCursor, null);

  store.setState({ transactions: [{ id: "kept" }], transactionsNextCursor: "retry" });
  fetchTransactions = async () => ({ ok: false, message: "Controlled failure" });
  await store.getState().loadMoreTransactionsFromApi();
  assert.equal(store.getState().transactionsError, "Controlled failure");
  assert.equal(store.getState().transactionsNextCursor, "retry");
  let resolvePage;
  fetchTransactions = () => new Promise((resolve) => { resolvePage = resolve; });
  const pendingPage = store.getState().loadMoreTransactionsFromApi();
  assert.equal((await store.getState().loadMoreTransactionsFromApi()).skipped, true);
  session = { userId: "user-b", token: "fixture-b" };
  store.getState().clearUserData();
  resolvePage({ ok: true, transactions: [{ id: "stale-a" }], nextCursor: null });
  assert.equal((await pendingPage).stale, true);
  assert.equal(store.getState().transactions.length, 0, "account reset prevents transaction leakage");

  session = { userId: "user-a", token: "fixture-a" };
  store.setState({ transactions: [{ id: "kept" }], transactionsNextCursor: "old-page" });
  const oldPage = store.getState().loadMoreTransactionsFromApi();
  fetchTransactions = async () => ({ ok: true, transactions: [{ id: "fresh" }], nextCursor: "fresh-cursor" });
  await store.getState().syncWorkerFromApi();
  resolvePage({ ok: true, transactions: [{ id: "obsolete" }], nextCursor: null });
  assert.equal((await oldPage).stale, true);
  assert.equal(store.getState().transactions[0].id, "fresh", "refresh invalidates an older page response");
  assert.equal(store.getState().transactionsNextCursor, "fresh-cursor");
  restore();
  store.getState().clearUserData();

  const urls = [];
  const client = compile("src/services/workers/workerService.js", {
    "../../constants/orderTracking": { TRACKING_STATUSES: {} }, "../../constants/workerStatus": { WORKER_STATUS: {} },
    "../api/client": { apiRequest: (callback) => callback() },
    "../api/authenticatedClient": { httpAuthRequest: async (url) => { urls.push(url); return { transactions: [], nextCursor: "next" }; } },
    "../orders/orderService": {}, "../orders/bookingLocation.mjs": {}, "./serviceLocation.mjs": {}
  });
  const response = await client.fetchWorkerTransactionsApi("fixture-a", { cursor: "opaque+/=", limit: 50 });
  assert.equal(urls[0], "/workers/me/transactions?limit=50&cursor=opaque%2B%2F%3D");
  assert.equal(response.nextCursor, "next");
  console.log("Worker transactions: actual service/store/client passed 215-row bounded cursor traversal with timestamp ties, backwards compatibility, invalid queries, identity isolation, retry, duplicate clicks and refresh races (isolated fixtures).");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
