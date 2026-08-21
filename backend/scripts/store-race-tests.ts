import assert from "node:assert/strict";

process.env.EXPO_PUBLIC_APP_ENV = "development";
process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:4000";

const { configureClientStoreForTests, useClientStore } = await import("../../src/store/clientStore.js");
const { configureWorkerStoreForTests, useWorkerStore } = await import("../../src/store/workerStore.js");
const { useAuthStore } = await import("../../src/store/authStore.js");

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let session: { userId: string; token: string } | null = null;
const clientCalls = {
  addresses: [] as Deferred<any>[],
  favorites: [] as Deferred<any>[],
  favoriteAdd: [] as Deferred<any>[],
  favoriteRemove: [] as Deferred<any>[],
  create: [] as Deferred<any>[],
  update: [] as Deferred<any>[],
  remove: [] as Deferred<any>[],
  orders: [] as Deferred<any>[],
  orderCreate: [] as Deferred<any>[],
  orderCancel: [] as Deferred<any>[]
};
const workerCalls = {
  profile: [] as Deferred<any>[],
  incoming: [] as Deferred<any>[],
  orders: [] as Deferred<any>[],
  earnings: [] as Deferred<any>[],
  transactions: [] as Deferred<any>[],
  location: [] as Deferred<any>[]
};

function enqueue<T>(queue: Deferred<T>[]) {
  const pending = deferred<T>();
  queue.push(pending);
  return pending;
}

function take<T>(queue: Deferred<T>[]) {
  const pending = queue.shift();
  assert.ok(pending, "A deferred API response must be queued before invoking the store action");
  return pending.promise;
}

const restoreClientDependencies = configureClientStoreForTests({
  getSession: () => session,
  getAddressesApi: () => take(clientCalls.addresses),
  fetchFavoritesApi: () => take(clientCalls.favorites),
  addFavoriteApi: () => take(clientCalls.favoriteAdd),
  removeFavoriteApi: () => take(clientCalls.favoriteRemove),
  createAddressApi: () => take(clientCalls.create),
  updateAddressApi: () => take(clientCalls.update),
  deleteAddressApi: () => take(clientCalls.remove),
  fetchOrdersApi: () => take(clientCalls.orders),
  createOrderApi: () => take(clientCalls.orderCreate),
  cancelOrderApi: () => take(clientCalls.orderCancel)
});
const restoreWorkerDependencies = configureWorkerStoreForTests({
  getSession: () => session,
  fetchWorkerMeApi: () => take(workerCalls.profile),
  fetchIncomingOrdersApi: () => take(workerCalls.incoming),
  fetchWorkerOrdersApi: () => take(workerCalls.orders),
  fetchWorkerEarningsApi: () => take(workerCalls.earnings),
  fetchWorkerTransactionsApi: () => take(workerCalls.transactions),
  updateWorkerServiceLocationApi: () => take(workerCalls.location)
});

function resetStores() {
  useClientStore.getState().clearUserData();
  useWorkerStore.getState().clearUserData();
  session = null;
  for (const queue of [...Object.values(clientCalls), ...Object.values(workerCalls)]) queue.length = 0;
}

function setAccount(account: "a" | "b") {
  session = { userId: `account-${account}`, token: `test-token-${account}` };
}

async function testClientAccountSwitches() {
  resetStores();
  setAccount("a");
  useClientStore.setState({ savedAddresses: [{ id: "a-old", isDefault: true }], catalogOriginAddressId: "a-old" });
  const aLoadResponse = enqueue(clientCalls.addresses);
  const aLoad = useClientStore.getState().loadAddresses();
  useClientStore.getState().clearUserData();
  setAccount("b");
  const bLoadResponse = enqueue(clientCalls.addresses);
  const bLoad = useClientStore.getState().loadAddresses();
  bLoadResponse.resolve({ ok: true, addresses: [{ id: "b-home", isDefault: true, lat: 41.3, lng: 69.2 }] });
  await bLoad;
  aLoadResponse.resolve({ ok: true, addresses: [{ id: "a-home", isDefault: true }] });
  assert.equal((await aLoad).stale, true);
  assert.deepEqual(useClientStore.getState().savedAddresses.map((item) => item.id), ["b-home"]);
  assert.equal(useClientStore.getState().catalogOriginAddressId, "b-home");

  resetStores();
  setAccount("a");
  const aProfileAddresses = enqueue(clientCalls.addresses);
  const aProfileFavorites = enqueue(clientCalls.favorites);
  const aProfile = useClientStore.getState().syncClientProfileFromApi();
  useClientStore.getState().clearUserData();
  setAccount("b");
  const bProfileAddresses = enqueue(clientCalls.addresses);
  const bProfileFavorites = enqueue(clientCalls.favorites);
  const bProfile = useClientStore.getState().syncClientProfileFromApi();
  bProfileAddresses.resolve({ ok: true, addresses: [{ id: "b-profile-home", isDefault: true, lat: 0, lng: 0 }] });
  bProfileFavorites.resolve({ ok: true, favoriteWorkerIds: ["b-worker"] });
  await bProfile;
  aProfileAddresses.resolve({ ok: true, addresses: [{ id: "a-profile-home", isDefault: true }] });
  aProfileFavorites.resolve({ ok: true, favoriteWorkerIds: ["a-worker"] });
  assert.equal((await aProfile).stale, true);
  assert.deepEqual(useClientStore.getState().savedAddresses.map((item) => item.id), ["b-profile-home"]);
  assert.deepEqual(useClientStore.getState().favoriteWorkerIds, ["b-worker"]);

  resetStores();
  setAccount("a");
  const aCreateResponse = enqueue(clientCalls.create);
  const aCreate = useClientStore.getState().createAddress({ title: "A", address: "A", isDefault: true });
  useClientStore.getState().clearUserData();
  setAccount("b");
  useClientStore.setState({ savedAddresses: [{ id: "b-base", isDefault: false }] });
  const bCreateResponse = enqueue(clientCalls.create);
  const bCreate = useClientStore.getState().createAddress({ title: "B", address: "B", isDefault: true });
  bCreateResponse.resolve({ ok: true, address: { id: "b-created", isDefault: true, lat: 41.3, lng: 69.2 } });
  await bCreate;
  aCreateResponse.resolve({ ok: true, address: { id: "a-created", isDefault: true } });
  assert.equal((await aCreate).stale, true);
  assert.deepEqual(useClientStore.getState().savedAddresses.map((item) => item.id), ["b-base", "b-created"]);

  resetStores();
  setAccount("a");
  useClientStore.setState({ savedAddresses: [{ id: "shared", title: "A old", isDefault: true }] });
  const aUpdateResponse = enqueue(clientCalls.update);
  const aUpdate = useClientStore.getState().updateAddress("shared", { title: "A pending" });
  useClientStore.getState().clearUserData();
  setAccount("b");
  useClientStore.setState({ savedAddresses: [{ id: "shared", title: "B old", isDefault: true }] });
  const bUpdateResponse = enqueue(clientCalls.update);
  const bUpdate = useClientStore.getState().updateAddress("shared", { title: "B pending" });
  bUpdateResponse.resolve({ ok: true, address: { id: "shared", title: "B saved", isDefault: true } });
  await bUpdate;
  aUpdateResponse.resolve({ ok: true, address: { id: "shared", title: "A saved", isDefault: true } });
  assert.equal((await aUpdate).stale, true);
  assert.equal(useClientStore.getState().savedAddresses[0].title, "B saved");

  resetStores();
  setAccount("a");
  useClientStore.setState({ savedAddresses: [{ id: "a-remove", isDefault: true }] });
  const aRemoveResponse = enqueue(clientCalls.remove);
  const aRemove = useClientStore.getState().removeAddress("a-remove");
  useClientStore.getState().clearUserData();
  setAccount("b");
  useClientStore.setState({ savedAddresses: [{ id: "b-keep", isDefault: true }, { id: "b-remove", isDefault: false }] });
  const bRemoveResponse = enqueue(clientCalls.remove);
  const bRemove = useClientStore.getState().removeAddress("b-remove");
  bRemoveResponse.resolve({ ok: true });
  await bRemove;
  aRemoveResponse.resolve({ ok: true });
  assert.equal((await aRemove).stale, true);
  assert.deepEqual(useClientStore.getState().savedAddresses.map((item) => item.id), ["b-keep"]);

  resetStores();
  setAccount("a");
  const aOrdersResponse = enqueue(clientCalls.orders);
  const aOrders = useClientStore.getState().syncOrdersFromApi();
  useClientStore.getState().clearUserData();
  setAccount("b");
  const bOrdersResponse = enqueue(clientCalls.orders);
  const bOrders = useClientStore.getState().syncOrdersFromApi();
  bOrdersResponse.resolve({ ok: true, orders: [{ id: "b-order", statusKey: "completed" }] });
  await bOrders;
  aOrdersResponse.resolve({ ok: true, orders: [{ id: "a-order", statusKey: "completed" }] });
  assert.equal((await aOrders).stale, true);
  assert.deepEqual(useClientStore.getState().orders.map((item) => item.id), ["b-order"]);

  resetStores();
  setAccount("a");
  useClientStore.setState({ workers: [{ id: "a-worker", specialty: "A" }], selectedWorkerId: "a-worker", orderDraft: { selectedWorkerId: "a-worker" } });
  const aCreateOrderResponse = enqueue(clientCalls.orderCreate);
  const aCreateOrder = useClientStore.getState().createOrderFromDraft();
  useClientStore.getState().clearUserData();
  setAccount("b");
  useClientStore.setState({ workers: [{ id: "b-worker", specialty: "B" }], selectedWorkerId: "b-worker", orderDraft: { selectedWorkerId: "b-worker" } });
  const bCreateOrderResponse = enqueue(clientCalls.orderCreate);
  const bCreateOrder = useClientStore.getState().createOrderFromDraft();
  bCreateOrderResponse.resolve({ ok: true, order: { id: "b-created-order" } });
  await bCreateOrder;
  aCreateOrderResponse.resolve({ ok: true, order: { id: "a-created-order" } });
  assert.equal((await aCreateOrder).stale, true);
  assert.equal(useClientStore.getState().activeOrder.id, "b-created-order");

  resetStores();
  setAccount("a");
  useClientStore.setState({ activeOrder: { id: "a-active" } });
  const aCancelResponse = enqueue(clientCalls.orderCancel);
  const aCancel = useClientStore.getState().cancelActiveOrder("a");
  useClientStore.getState().clearUserData();
  setAccount("b");
  useClientStore.setState({ activeOrder: { id: "b-active" } });
  const bCancelResponse = enqueue(clientCalls.orderCancel);
  const bCancel = useClientStore.getState().cancelActiveOrder("b");
  bCancelResponse.resolve({ ok: true, order: { id: "b-active", statusKey: "cancelled" } });
  await bCancel;
  aCancelResponse.resolve({ ok: true, order: { id: "a-active", statusKey: "cancelled" } });
  assert.equal((await aCancel).stale, true);
  assert.equal(useClientStore.getState().activeOrder.id, "b-active");
}

async function testClientSameAccountOrdering() {
  resetStores();
  setAccount("b");
  const olderResponse = enqueue(clientCalls.addresses);
  const newerResponse = enqueue(clientCalls.addresses);
  const older = useClientStore.getState().loadAddresses();
  const newer = useClientStore.getState().loadAddresses();
  newerResponse.resolve({ ok: true, addresses: [{ id: "newer", isDefault: true, lat: 0, lng: 0 }] });
  await newer;
  olderResponse.resolve({ ok: true, addresses: [{ id: "older", isDefault: true }] });
  assert.equal((await older).stale, true);
  assert.deepEqual(useClientStore.getState().savedAddresses.map((item) => item.id), ["newer"]);

  useClientStore.setState({ savedAddresses: [{ id: "same", title: "initial", isDefault: true }] });
  const olderUpdateResponse = enqueue(clientCalls.update);
  const newerUpdateResponse = enqueue(clientCalls.update);
  const olderUpdate = useClientStore.getState().updateAddress("same", { title: "older pending" });
  const newerUpdate = useClientStore.getState().updateAddress("same", { title: "newer pending" });
  newerUpdateResponse.resolve({ ok: true, address: { id: "same", title: "newer saved", isDefault: true } });
  await newerUpdate;
  olderUpdateResponse.resolve({ ok: true, address: { id: "same", title: "older saved", isDefault: true } });
  assert.equal((await olderUpdate).stale, true);
  assert.equal(useClientStore.getState().savedAddresses[0].title, "newer saved");
}

async function testFavoriteMutationRaces() {
  resetStores();
  setAccount("a");
  const staleAddResponse = enqueue(clientCalls.favoriteAdd);
  const staleAdd = useClientStore.getState().toggleFavoriteWorker("shared-worker");
  useClientStore.getState().clearUserData();
  setAccount("b");
  useClientStore.setState({ favoriteWorkerIds: ["b-worker"] });
  staleAddResponse.resolve({ ok: true });
  assert.equal((await staleAdd).stale, true);
  assert.deepEqual(useClientStore.getState().favoriteWorkerIds, ["b-worker"]);

  resetStores();
  setAccount("a");
  useClientStore.setState({ favoriteWorkerIds: ["shared-worker"] });
  const staleRemoveResponse = enqueue(clientCalls.favoriteRemove);
  const staleRemove = useClientStore.getState().toggleFavoriteWorker("shared-worker");
  useClientStore.getState().clearUserData();
  setAccount("b");
  useClientStore.setState({ favoriteWorkerIds: ["shared-worker", "b-worker"] });
  staleRemoveResponse.resolve({ ok: true });
  assert.equal((await staleRemove).stale, true);
  assert.deepEqual(useClientStore.getState().favoriteWorkerIds, ["shared-worker", "b-worker"]);

  resetStores();
  setAccount("b");
  const failedAddResponse = enqueue(clientCalls.favoriteAdd);
  const failedAdd = useClientStore.getState().toggleFavoriteWorker("failed-worker");
  failedAddResponse.resolve({ ok: false, message: "rejected" });
  assert.equal((await failedAdd).ok, false);
  assert.deepEqual(useClientStore.getState().favoriteWorkerIds, []);

  const olderResponse = enqueue(clientCalls.favoriteAdd);
  const newerResponse = enqueue(clientCalls.favoriteAdd);
  const older = useClientStore.getState().toggleFavoriteWorker("overlap-worker");
  const newer = useClientStore.getState().toggleFavoriteWorker("overlap-worker");
  newerResponse.resolve({ ok: true });
  assert.equal((await newer).ok, true);
  olderResponse.resolve({ ok: true });
  assert.equal((await older).stale, true);
  assert.deepEqual(useClientStore.getState().favoriteWorkerIds, ["overlap-worker"]);
}

function queueWorkerSync() {
  return {
    profile: enqueue(workerCalls.profile),
    incoming: enqueue(workerCalls.incoming),
    orders: enqueue(workerCalls.orders),
    earnings: enqueue(workerCalls.earnings),
    transactions: enqueue(workerCalls.transactions)
  };
}

function resolveWorkerSync(pending: ReturnType<typeof queueWorkerSync>, account: "a" | "b") {
  pending.profile.resolve({ ok: true, worker: { id: `worker-${account}`, name: account.toUpperCase(), serviceLat: account === "b" ? 41.3 : 42 } });
  pending.incoming.resolve({ ok: true, requests: [{ id: `${account}-request` }] });
  pending.orders.resolve({ ok: true, orders: [] });
  pending.earnings.resolve({ ok: true, earnings: { owner: account } });
  pending.transactions.resolve({ ok: true, transactions: [{ id: `${account}-transaction` }] });
}

async function testWorkerRaces() {
  resetStores();
  setAccount("a");
  useWorkerStore.setState({ workerProfile: { id: "worker-a-old" } });
  const aSyncResponses = queueWorkerSync();
  const aSync = useWorkerStore.getState().syncWorkerFromApi();
  useWorkerStore.getState().clearUserData();
  setAccount("b");
  const bSyncResponses = queueWorkerSync();
  const bSync = useWorkerStore.getState().syncWorkerFromApi();
  resolveWorkerSync(bSyncResponses, "b");
  await bSync;
  resolveWorkerSync(aSyncResponses, "a");
  assert.equal((await aSync).stale, true);
  assert.equal(useWorkerStore.getState().workerProfile.id, "worker-b");
  assert.deepEqual(useWorkerStore.getState().incomingRequests.map((item) => item.id), ["b-request"]);

  const olderSyncResponses = queueWorkerSync();
  const newerSyncResponses = queueWorkerSync();
  const olderSync = useWorkerStore.getState().syncWorkerFromApi();
  const newerSync = useWorkerStore.getState().syncWorkerFromApi();
  resolveWorkerSync(newerSyncResponses, "b");
  await newerSync;
  resolveWorkerSync(olderSyncResponses, "a");
  assert.equal((await olderSync).stale, true);
  assert.equal(useWorkerStore.getState().workerProfile.id, "worker-b");

  resetStores();
  setAccount("a");
  useWorkerStore.setState({ workerProfile: { id: "worker-a" } });
  const aLocationResponse = enqueue(workerCalls.location);
  const aLocation = useWorkerStore.getState().saveServiceLocation({ serviceLat: 42, serviceLng: 70 });
  useWorkerStore.getState().clearUserData();
  setAccount("b");
  useWorkerStore.setState({ workerProfile: { id: "worker-b" } });
  const bLocationResponse = enqueue(workerCalls.location);
  const bLocation = useWorkerStore.getState().saveServiceLocation({ serviceLat: 41.3, serviceLng: 69.2 });
  bLocationResponse.resolve({ ok: true, worker: { id: "worker-b", serviceLat: 41.3, serviceLng: 69.2 } });
  await bLocation;
  aLocationResponse.resolve({ ok: true, worker: { id: "worker-a", serviceLat: 42, serviceLng: 70 } });
  assert.equal((await aLocation).stale, true);
  assert.equal(useWorkerStore.getState().workerProfile.id, "worker-b");
  assert.equal(useWorkerStore.getState().workerProfile.serviceLat, 41.3);

  const olderLocationResponse = enqueue(workerCalls.location);
  const newerLocationResponse = enqueue(workerCalls.location);
  const olderLocation = useWorkerStore.getState().saveServiceLocation({ serviceLat: 41.31, serviceLng: 69.21 });
  const newerLocation = useWorkerStore.getState().saveServiceLocation({ serviceLat: 41.32, serviceLng: 69.22 });
  newerLocationResponse.resolve({ ok: true, worker: { id: "worker-b", serviceLat: 41.32, serviceLng: 69.22 } });
  await newerLocation;
  olderLocationResponse.resolve({ ok: true, worker: { id: "worker-b", serviceLat: 41.31, serviceLng: 69.21 } });
  assert.equal((await olderLocation).stale, true);
  assert.equal(useWorkerStore.getState().workerProfile.serviceLat, 41.32);
}

async function testModeSwitchInvalidatesStaleRoleState() {
  resetStores();
  setAccount("a");
  const persisted = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => persisted.get(key) ?? null,
      setItem: (key: string, value: string) => persisted.set(key, value),
      removeItem: (key: string) => persisted.delete(key)
    }
  };
  useAuthStore.setState({
    session: { userId: "account-a", token: "test-token-a", role: "provider", experienceMode: "client", sessionVersion: 2 },
    invalidation: null
  });
  const lateClientOrdersResponse = enqueue(clientCalls.orders);
  const lateClientOrders = useClientStore.getState().syncOrdersFromApi();
  assert.equal(useAuthStore.getState().setExperienceMode("worker"), true);
  lateClientOrdersResponse.resolve({ ok: true, orders: [{ id: "stale-client-order" }] });
  assert.equal((await lateClientOrders).stale, true);
  assert.deepEqual(useClientStore.getState().orders, []);

  const lateWorkerResponses = queueWorkerSync();
  const lateWorkerSync = useWorkerStore.getState().syncWorkerFromApi();
  assert.equal(useAuthStore.getState().setExperienceMode("client"), true);
  resolveWorkerSync(lateWorkerResponses, "a");
  assert.equal((await lateWorkerSync).stale, true);
  assert.equal(useWorkerStore.getState().workerProfile, null);
  assert.equal(useAuthStore.getState().session?.experienceMode, "client");
}

try {
  await testClientAccountSwitches();
  await testClientSameAccountOrdering();
  await testFavoriteMutationRaces();
  await testWorkerRaces();
  await testModeSwitchInvalidatesStaleRoleState();
  console.log("Real client and worker store deferred race tests passed.");
} finally {
  resetStores();
  useAuthStore.setState({ session: null, invalidation: null, pendingIntent: null });
  restoreClientDependencies();
  restoreWorkerDependencies();
}
