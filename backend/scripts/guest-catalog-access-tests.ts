import assert from "node:assert/strict";

process.env.EXPO_PUBLIC_APP_ENV = "development";
process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:4000";

const { configureClientStoreForTests, useClientStore } = await import("../../src/store/clientStore.js");

const calls: Array<{ categoryId: string; options: Record<string, unknown> }> = [];
const restoreDependencies = configureClientStoreForTests({
  getSession: () => null,
  fetchCatalogWorkers: async (categoryId: string, options: Record<string, unknown>) => {
    calls.push({ categoryId, options });
    return {
      ok: true,
      source: "api",
      workers: [{ id: "demo-worker", availability: "available" }]
    };
  }
});

try {
  useClientStore.getState().clearUserData();
  useClientStore.setState({
    savedAddresses: [],
    catalogOriginAddressId: null,
    catalogSort: "recommended"
  });

  const result = await useClientStore.getState().syncCatalogFromApi("category-demo");

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1, "guest catalog must call the backend without an address");
  assert.equal(calls[0].categoryId, "category-demo");
  assert.equal(calls[0].options.originAddressId, null);
  assert.equal(calls[0].options.sort, "recommended");
  assert.equal(calls[0].options.token, undefined);
  assert.deepEqual(
    useClientStore.getState().workers.map((worker: { id: string }) => worker.id),
    ["demo-worker"]
  );

  useClientStore.getState().setCatalogSort("rating");
  assert.equal(useClientStore.getState().catalogSort, "rating");
  await useClientStore.getState().syncCatalogFromApi("category-demo");
  assert.equal(calls[1].options.sort, "recommended", "rating sorting is applied locally after a complete catalog fetch");
  assert.equal(useClientStore.getState().catalogSort, "rating");

  useClientStore.getState().setCatalogSort("price");
  useClientStore.getState().setCatalogOriginAddressId(null);
  assert.equal(useClientStore.getState().catalogSort, "price", "removing an address must preserve non-distance sorting");
  await useClientStore.getState().syncCatalogFromApi("category-demo");
  assert.equal(calls[2].options.sort, "recommended", "price sorting is applied locally after a complete catalog fetch");
  assert.equal(useClientStore.getState().catalogSort, "price");

  useClientStore.getState().setCatalogSort("nearest");
  assert.equal(useClientStore.getState().catalogSort, "recommended", "nearest sorting requires an origin address");

  console.log("Guest catalog access and local catalog sort state tests passed.");
} finally {
  restoreDependencies();
  useClientStore.getState().clearUserData();
}
