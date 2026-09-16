import assert from "node:assert/strict";
import { sortCatalogWorkers } from "../src/services/catalog/catalogSorting.mjs";

const workers = [
  { id: "available-mid", availability: "available", rating: "4.5", basePriceValue: 200_000, distanceMeters: 3_000 },
  { id: "busy-top", availability: "busy", rating: "5", basePriceValue: 100_000, distanceMeters: 1_000 },
  { id: "available-unpriced", availability: "available", rating: "4.8", basePriceValue: 0, distanceMeters: 2_000 },
  { id: "available-priced", availability: "available", rating: "4.8", basePriceValue: 150_000, distanceMeters: null }
];
const originalOrder = workers.map((worker) => worker.id);

assert.deepEqual(sortCatalogWorkers(workers, "recommended").map((worker) => worker.id), [
  "available-priced", "available-unpriced", "available-mid", "busy-top"
]);
assert.deepEqual(sortCatalogWorkers(workers, "nearest").map((worker) => worker.id), [
  "busy-top", "available-unpriced", "available-mid", "available-priced"
]);
assert.deepEqual(sortCatalogWorkers(workers, "rating").map((worker) => worker.id), [
  "busy-top", "available-priced", "available-unpriced", "available-mid"
]);
assert.deepEqual(sortCatalogWorkers(workers, "price").map((worker) => worker.id), [
  "busy-top", "available-priced", "available-mid", "available-unpriced"
]);
assert.deepEqual(sortCatalogWorkers(workers, "unknown").map((worker) => worker.id), [
  "available-priced", "available-unpriced", "available-mid", "busy-top"
]);
assert.deepEqual(workers.map((worker) => worker.id), originalOrder, "sorting must not mutate store data");

console.log("Catalog recommended, nearest, rating and price sorting tests passed.");
