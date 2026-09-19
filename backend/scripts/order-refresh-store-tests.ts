import assert from "node:assert/strict";
process.env.EXPO_PUBLIC_APP_ENV = "development";
process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:4000";
const { startOrderRefreshLoop, resolveOrderDetail, ORDER_REFRESH_INTERVAL_MS } = await import("../../src/services/orders/orderRefreshLoop.mjs");
const { configureClientStoreForTests, useClientStore } = await import("../../src/store/clientStore.js");
const { configureWorkerStoreForTests, useWorkerStore } = await import("../../src/store/workerStore.js");
function deferred() { let resolve: (value: any) => void = () => {}; const promise = new Promise<any>((done) => { resolve = done; }); return { promise, resolve }; }
const flush = () => new Promise((resolve) => setImmediate(resolve));
let tick = () => {}; let active = true; let calls = 0; let cleared = false; let context: any;
const waiting = deferred();
const loop = startOrderRefreshLoop(async (value: any) => { calls++; context = value; await waiting.promise; }, () => active, {
  setIntervalFn(callback: () => void, interval: number) { assert.equal(interval, 5000); tick = callback; return 1; },
  clearIntervalFn() { cleared = true; }
});
assert.equal(ORDER_REFRESH_INTERVAL_MS, 5000);
tick(); assert.equal(calls, 1, "in-flight requests cannot overlap");
active = false; assert.equal(context.isCurrent(), false); tick(); assert.equal(calls, 1);
waiting.resolve(null); await flush(); active = true; tick(); await flush(); assert.equal(calls, 2);
loop.stop(); assert.equal(cleared, true); assert.equal(context.isCurrent(), false); tick(); assert.equal(calls, 2);
let retries = 0;
const retry = startOrderRefreshLoop(async () => { retries++; throw new Error("synthetic offline"); }, () => true, {
  setIntervalFn(callback: () => void) { tick = callback; return 2; }, clearIntervalFn() {}
});
await flush(); tick(); await flush(); assert.equal(retries, 2); retry.stop();
console.log("[F2] PASS refresh loop: immediate/focused retry, no overlap, inactive guard, cleanup invalidates late responses");

let session: any = { userId: "synthetic-a", token: "synthetic", role: "PROVIDER", experienceMode: "client" };
let orders = [{ id: "order", statusKey: "request_sent" }];
let clientPending: any = null;
const restoreClient = configureClientStoreForTests({ getSession: () => session, fetchOrdersApi: () => clientPending?.promise || Promise.resolve({ ok: true, orders }) });
await useClientStore.getState().syncOrdersFromApi();
const selectedId = "order";
orders = [{ id: "order", statusKey: "accepted" }];
await useClientStore.getState().syncOrdersFromApi();
assert.equal(resolveOrderDetail(useClientStore.getState().orders, null, selectedId)?.statusKey, "accepted");
orders = [{ id: "order", statusKey: "cancelled" }];
await useClientStore.getState().syncOrdersFromApi();
assert.equal(resolveOrderDetail(useClientStore.getState().orders, null, selectedId)?.statusKey, "cancelled");
assert.equal(useClientStore.getState().orders.length, 1, "cancelled order stays in history");
clientPending = deferred(); const oldClient = useClientStore.getState().syncOrdersFromApi({ isCurrent: () => false });
clientPending.resolve({ ok: true, orders: [{ id: "old", statusKey: "request_sent" }] });
assert.equal((await oldClient).stale, true); assert.equal(useClientStore.getState().orders[0].id, selectedId);
console.log("[F2] PASS client detail derives refreshed order by id; cancellation remains in history; stale context rejected");

session = { ...session, experienceMode: "worker" };
let incoming = [{ id: "incoming" }]; let acceptCalls = 0; let acceptPending = deferred(); let incomingPending: any = null;
const restoreWorker = configureWorkerStoreForTests({
  getSession: () => session,
  fetchWorkerMeApi: async () => ({ ok: true, worker: { id: "worker", availability: "AVAILABLE" } }),
  fetchIncomingOrdersApi: () => incomingPending?.promise || Promise.resolve({ ok: true, requests: incoming }),
  fetchWorkerOrdersApi: async () => ({ ok: true, orders: [] }),
  acceptOrderApi: () => { acceptCalls++; return acceptPending.promise; }
});
try {
  await useWorkerStore.getState().syncWorkerFromApi({ ordersOnly: true });
  const accept = useWorkerStore.getState().acceptIncomingRequest("incoming");
  assert.equal((await useWorkerStore.getState().acceptIncomingRequest("incoming")).pending, true);
  assert.equal(acceptCalls, 1);
  incomingPending = deferred(); const staleSync = useWorkerStore.getState().syncWorkerFromApi({ ordersOnly: true });
  acceptPending.resolve({ ok: true, order: { id: "incoming", title: "Synthetic", statusKey: "accepted" } }); await accept;
  incomingPending.resolve({ ok: true, requests: incoming });
  assert.equal((await staleSync).stale, true); assert.equal(useWorkerStore.getState().incomingRequests.length, 0);
  assert.equal(useWorkerStore.getState().activeJob?.id, "incoming");
  incomingPending = null; incoming = [];
  useWorkerStore.setState({ incomingRequests: [{ id: "expired" }], activeJob: null });
  acceptPending = deferred(); const expired = useWorkerStore.getState().acceptIncomingRequest("expired");
  acceptPending.resolve({ ok: false, code: "ORDER_RESPONSE_EXPIRED" }); await expired;
  assert.equal(useWorkerStore.getState().incomingRequests.length, 0); assert.equal(useWorkerStore.getState().pendingIncomingRequestId, null);
  acceptPending = deferred(); const switched = useWorkerStore.getState().acceptIncomingRequest("old-account");
  useWorkerStore.getState().clearUserData(); session = { ...session, userId: "synthetic-b" };
  acceptPending.resolve({ ok: true, order: { id: "old-account" } });
  assert.equal((await switched).stale, true); assert.equal(useWorkerStore.getState().activeJob, null);
  console.log("[F2] PASS worker: double-submit blocked, pre-mutation sync discarded, expired card refetched, account switch guarded");
} finally { restoreClient(); restoreWorker(); useClientStore.getState().clearUserData(); useWorkerStore.getState().clearUserData(); }
