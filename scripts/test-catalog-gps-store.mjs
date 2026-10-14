import assert from "node:assert/strict";
process.env.EXPO_PUBLIC_APP_ENV = "development";
process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:4000";
const { configureClientStoreForTests, useClientStore } = await import("../src/store/clientStore.js");
const requests = [];
let deferred = false;
const restore = configureClientStoreForTests({
  fetchCatalogWorkers: (categoryId, options) => {
    if (!deferred) { requests.push({ categoryId, options }); return Promise.resolve({ ok: true, workers: [{ id: "near-worker", distanceMeters: 70 }], source: "api" }); }
    return new Promise((resolve) => requests.push({ categoryId, options, resolve }));
  }
});
try {
  useClientStore.setState({ savedAddresses: [{ id: "office", isDefault: true, lat: 0, lng: 0 }], catalogOriginAddressId: "office" });
  useClientStore.getState().setCatalogDeviceLocation({ lat: 41.31, lng: 69.24 });
  useClientStore.getState().setCatalogSort("nearest");
  await useClientStore.getState().syncCatalogFromApi("cat_plumbing");
  assert.equal(requests[0].options.originAddressId, null);
  assert.deepEqual(requests[0].options.originCoordinates, { lat: 41.31, lng: 69.24 });
  assert.equal(requests[0].options.sort, "nearest");
  assert.equal(useClientStore.getState().workers[0].distanceMeters, 70);
  useClientStore.getState().setCatalogDeviceLocation(null, { preserveSort: true });
  assert.equal(useClientStore.getState().catalogSort, "nearest", "a GPS refresh preserves the chosen nearest sort while waiting");
  useClientStore.getState().setCatalogDeviceLocation({ lat: 41.31, lng: 69.24 });

  deferred = true;
  const previousPosition = useClientStore.getState().syncCatalogFromApi("cat_plumbing");
  useClientStore.getState().setCatalogDeviceLocation({ lat: 41.32, lng: 69.25 });
  assert.deepEqual(useClientStore.getState().workers, [], "previous-position distances are removed");
  const currentPosition = useClientStore.getState().syncCatalogFromApi("cat_plumbing");
  requests[2].resolve({ ok: true, workers: [{ id: "current-worker", distanceMeters: 25 }] });
  await currentPosition;
  requests[1].resolve({ ok: true, workers: [{ id: "stale-worker", distanceMeters: 700 }] });
  assert.equal((await previousPosition).stale, true);
  assert.equal(useClientStore.getState().workers[0].id, "current-worker");

  const beforeDenial = useClientStore.getState().syncCatalogFromApi("cat_plumbing");
  useClientStore.getState().setCatalogDeviceLocation(null);
  requests[3].resolve({ ok: true, workers: [{ id: "before-denial-worker" }] });
  assert.equal((await beforeDenial).stale, true);
  assert.deepEqual(useClientStore.getState().workers, []);
  assert.equal(useClientStore.getState().catalogSort, "recommended");
  deferred = false;
  await useClientStore.getState().syncCatalogFromApi("cat_plumbing");
  assert.equal(requests[4].options.originAddressId, null, "permission denial cannot use office coordinates");
  assert.equal(requests[4].options.originCoordinates, null);
  useClientStore.getState().clearUserData();
  assert.equal(useClientStore.getState().catalogOriginCoordinates, null);
  assert.deepEqual(useClientStore.getState().workers, []);
  console.log("Actual catalog store GPS origin, nearest sorting, moved-location race and denied-location isolation tests passed.");
} finally { restore(); }
