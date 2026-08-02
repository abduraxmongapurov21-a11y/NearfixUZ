import assert from "node:assert/strict";
import { configureClientStoreForTests, useClientStore } from "../../src/store/clientStore.js";
import { configureWorkerStoreForTests, useWorkerStore } from "../../src/store/workerStore.js";

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
  create: [] as Deferred<any>[],
  update: [] as Deferred<any>[],
  remove: [] as Deferred<any>[]
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
  createAddressApi: () => take(clientCalls.create),
  updateAddressApi: () => take(clientCalls.update),
  deleteAddressApi: () => take(clientCalls.remove)
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

try {
  await testClientAccountSwitches();
  await testClientSameAccountOrdering();
  await testWorkerRaces();
  console.log("Real client and worker store deferred race tests passed.");
} finally {
  resetStores();
  restoreClientDependencies();
  restoreWorkerDependencies();
}
