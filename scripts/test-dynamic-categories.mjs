import assert from "node:assert/strict";
import { categoryName, findCategoryByLegacyValue, mapApiCategory, workerCategoryLabel } from "../src/services/content/categoryModel.mjs";
import {
  CATEGORY_CACHE_VERSION,
  categoryAvailabilityFailure,
  categoryAvailabilityFromCache,
  categoryAvailabilityLoading,
  categoryAvailabilitySuccess,
  initialCategoryAvailability,
  resolveCategoryRoute,
  visibleHomeCategoryItems
} from "../src/services/content/categoryAvailability.mjs";

const category = mapApiCategory({ id: "cat_plumbing", slug: "plumbing", nameUz: "Santexnik", nameRu: "Сантехник", nameEn: "Plumber", iconKey: "wrench", sortOrder: 0, isActive: true });
assert.equal(categoryName(category, "uz"), "Santexnik");
assert.equal(categoryName(category, "ru-RU"), "Сантехник");
assert.equal(categoryName(category, "en"), "Plumber");
assert.equal(findCategoryByLegacyValue([category], " PLUMBING ")?.id, category.id);
assert.equal(findCategoryByLegacyValue([category], "unknown"), undefined);
assert.deepEqual(workerCategoryLabel({ categories: [category], specialty: "legacy" }, "en"), { label: "Plumber", dynamic: true });
assert.deepEqual(workerCategoryLabel({ specialty: "Legacy" }, "en"), { label: "Legacy", dynamic: false });

const coldLoading = categoryAvailabilityLoading(initialCategoryAvailability);
assert.equal(coldLoading.status, "loading");
const coldSuccess = categoryAvailabilitySuccess([category], 100);
assert.equal(coldSuccess.status, "ready");
assert.equal(coldSuccess.lastLoadedAt, 100);
const coldFailure = categoryAvailabilityFailure(coldLoading, "offline");
assert.equal(coldFailure.status, "error");
assert.deepEqual(coldFailure.categories, []);

const cached = categoryAvailabilityFromCache({ version: CATEGORY_CACHE_VERSION, categories: [category], lastLoadedAt: 50 });
const cachedRefreshing = categoryAvailabilityLoading(cached);
const cachedFailure = categoryAvailabilityFailure(cachedRefreshing, "offline");
assert.equal(cachedFailure.status, "ready");
assert.equal(cachedFailure.categories[0].id, category.id);
assert.equal(cachedFailure.error, "offline");

const empty = categoryAvailabilitySuccess([], 200);
assert.equal(empty.status, "empty");
assert.deepEqual(resolveCategoryRoute(initialCategoryAvailability, "cat_plumbing"), { kind: "pending" });
assert.deepEqual(resolveCategoryRoute(coldSuccess, "missing"), { kind: "unavailable", reason: "invalid" });
assert.deepEqual(resolveCategoryRoute(coldSuccess, undefined, false), { kind: "unavailable", reason: "invalid" });
assert.deepEqual(resolveCategoryRoute(empty, "cat_plumbing"), { kind: "unavailable", reason: "empty" });
assert.equal(resolveCategoryRoute(coldSuccess, "cat_plumbing").kind, "ready");

const manyCategories = Array.from({ length: 10 }, (_, index) => ({ id: `cat-${index}` }));
const moreItem = { id: "more" };
assert.deepEqual(visibleHomeCategoryItems(manyCategories, moreItem).map((item) => item.id), [
  "cat-0", "cat-1", "cat-2", "cat-3", "cat-4", "cat-5", "cat-6", "more"
]);
assert.deepEqual(visibleHomeCategoryItems(manyCategories, moreItem, true), manyCategories);
assert.deepEqual(visibleHomeCategoryItems(manyCategories.slice(0, 8), moreItem), manyCategories.slice(0, 8));
console.log("Dynamic category mapping tests passed.");
