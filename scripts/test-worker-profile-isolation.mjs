import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { CommonActions, StackActions, StackRouter } from "@react-navigation/routers";

process.env.EXPO_PUBLIC_APP_ENV = "development";
process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:4000";
const { useClientStore, configureClientStoreForTests } = await import("../src/store/clientStore.js");
const { openClientTab } = await import("../src/navigation/clientTabNavigation.js");

const shavkat = { id: "worker-plumbing", name: "Shavkat", availability: "available", categoryIds: ["plumbing"] };
const diyor = { id: "worker-electric", name: "Diyor", availability: "available", categoryIds: ["electric"] };
const profileSource = fs.readFileSync(new URL("../src/screens/marketplace/WorkerProfileScreen.js", import.meta.url), "utf8");
const hookSource = fs.readFileSync(new URL("../src/hooks/useWorkerById.js", import.meta.url), "utf8");
const profileEffect = profileSource.slice(profileSource.indexOf("  useFocusEffect(useCallback(() => {"), profileSource.indexOf("  useEffect(() => {"));
const pending = [];

function mountProfile(workerId) {
  const context = vm.createContext({
    workerId,
    requestGeneration: { current: 0 },
    upsertPublicWorker: useClientStore.getState().upsertPublicWorker,
    setOpeningChat() {}, setBlocking() {}, setWorkerUnavailable() {}, setWorkerLoading() {},
    useCallback: (callback) => callback,
    useFocusEffect(callback) { context.cleanup = callback(); },
    fetchPublicWorker(id) { return new Promise((resolve) => pending.push({ id, resolve })); }
  });
  vm.runInContext(profileEffect, context);
  return context;
}

function resolveRoute(workerId) {
  return vm.runInNewContext(hookSource.replace(/^import .*;\s*/m, "").replace("export function", "function") + "\nuseWorkerById(workerId)", {
    workerId,
    useClientStore: (selector) => selector(useClientStore.getState())
  });
}

const restore = configureClientStoreForTests({
  getSession: () => ({ userId: "client-a", token: "test-token" }),
  createOrderApi: async (_token, draft, _service, worker) => ({ ok: true, order: { id: "order-test", workerId: worker.id, draft } })
});
try {
  useClientStore.getState().clearUserData();
  useClientStore.setState({ workers: [shavkat, diyor], categories: [{ id: "electric" }] });
  useClientStore.getState().selectWorker(shavkat.id);
  const oldProfile = mountProfile(shavkat.id);
  oldProfile.cleanup(); // The bottom tab removes/blurs the previous profile.
  useClientStore.getState().selectWorker(diyor.id);
  mountProfile(diyor.id);
  pending.find((request) => request.id === diyor.id).resolve({ ok: true, worker: diyor });
  await Promise.resolve();
  pending.find((request) => request.id === shavkat.id).resolve({ ok: true, worker: { ...shavkat, name: "late response" } });
  await Promise.resolve();
  assert.equal(resolveRoute(diyor.id).id, diyor.id, "late profile response cannot replace the route's worker");
  assert.equal(useClientStore.getState().selectedWorkerId, diyor.id, "caching must not select a worker");
  assert.equal(resolveRoute(shavkat.id).name, "Shavkat", "blurred profile response is discarded");

  useClientStore.setState({ workers: [shavkat] });
  useClientStore.getState().upsertPublicWorker({ ...diyor, name: "Diyor updated" });
  assert.deepEqual(useClientStore.getState().workers.map((worker) => worker.id), [shavkat.id], "profile detail cannot insert an unrelated category into the catalog");
  assert.equal(resolveRoute(diyor.id).name, "Diyor updated", "route cache survives another category's catalog response");
  assert.equal(resolveRoute("missing-worker"), null, "missing ID must never fall back to the first worker");
  useClientStore.getState().selectWorker(shavkat.id);
  useClientStore.getState().updateOrderDraft({ selectedWorkerId: diyor.id, serviceId: "electric" });
  const order = await useClientStore.getState().createOrderFromDraft();
  assert.equal(order.order.workerId, diyor.id, "booking's draft ID must win over global selection");
  useClientStore.getState().updateOrderDraft({ selectedWorkerId: "missing-worker" });
  assert.equal((await useClientStore.getState().createOrderFromDraft()).ok, false, "missing booked worker must fail closed");

  const routeNames = ["ClientTabs", "Category", "WorkerProfile", "Booking"];
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  const router = StackRouter({ initialRouteName: "ClientTabs" });
  let state = router.getInitialState(options);
  const navigation = {
    popTo: (name, params) => { state = router.getStateForAction(state, StackActions.popTo(name, params), options); }
  };
  for (let cycle = 0; cycle < 5; cycle += 1) {
    state = router.getStateForAction(state, CommonActions.navigate("Category", { categoryId: cycle % 2 ? "electric" : "plumbing" }), options);
    state = router.getStateForAction(state, CommonActions.navigate("WorkerProfile", { workerId: cycle % 2 ? diyor.id : shavkat.id }), options);
    openClientTab(navigation, "HomeTab");
    assert.equal(state.routes.length, 1, "tab exit must remove previous profile/category routes each cycle");
  }
  state = router.getStateForAction(state, CommonActions.navigate("Booking", { workerId: diyor.id }), options);
  openClientTab(navigation, "OrdersTab");
  assert.equal(state.routes.length, 1);
  assert.equal(state.routes[0].params.screen, "OrdersTab");

  const bookingSource = fs.readFileSync(new URL("../src/screens/marketplace/BookingScreen.js", import.meta.url), "utf8");
  assert.match(bookingSource, /useWorkerById\(route\.params\?\.workerId\)/);
  assert.doesNotMatch(profileSource, /useSelectedWorker|route\.params\?\.workerId \|\| worker\?\.id/);
  useClientStore.getState().clearUserData();
  assert.equal(resolveRoute(diyor.id), null, "session reset clears profile cache");
} finally {
  restore();
  useClientStore.getState().clearUserData();
}
console.log("Worker route identity, late-response isolation, exact booking worker, missing IDs, account reset and repeated tab-stack cycles passed (actual store/router; focused effect isolated, no device runtime).");
