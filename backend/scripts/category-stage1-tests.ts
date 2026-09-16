import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CATEGORY_ICON_KEYS, createCategorySchema, reorderCategoriesSchema, updateCategorySchema } from "../src/modules/categories/category.contracts.js";
import { immutableLegacyNameForCategory, releasedCategorySlugForLegacyValue } from "../src/modules/categories/category.legacy.js";
import { createOrderSchema } from "../src/modules/orders/order.contracts.js";
import { workerApplicationDraftSchema } from "../src/modules/workers/worker.contracts.js";

const category = { slug: "appliance-repair", nameUz: "Maishiy texnika", nameRu: "Бытовая техника", nameEn: "Appliance repair", iconKey: "wrench" };
const legacyIconKeys = ["wrench", "zap", "flame", "hammer", "snowflake", "paint", "sparkles", "brush", "grid"];
assert.equal(CATEGORY_ICON_KEYS.length, 30);
assert.equal(new Set(CATEGORY_ICON_KEYS).size, CATEGORY_ICON_KEYS.length);
assert.equal(legacyIconKeys.every((iconKey) => CATEGORY_ICON_KEYS.includes(iconKey as typeof CATEGORY_ICON_KEYS[number])), true);
for (const iconKey of CATEGORY_ICON_KEYS) {
  assert.equal(createCategorySchema.safeParse({ ...category, iconKey }).success, true, `${iconKey} must be accepted`);
}
assert.equal(createCategorySchema.safeParse(category).success, true);
assert.equal(createCategorySchema.safeParse({ ...category, iconKey: "arbitrary-icon" }).success, false);
assert.equal(createCategorySchema.safeParse({ ...category, sortOrder: 99 }).success, false, "create must not accept sortOrder");
assert.equal(updateCategorySchema.safeParse({ slug: "changed" }).success, false, "slug updates must be rejected");
assert.equal(updateCategorySchema.safeParse({ sortOrder: 99 }).success, false, "update must not accept sortOrder");
assert.equal(workerApplicationDraftSchema.safeParse({ categoryIds: ["cat_one"] }).success, true);
assert.equal(workerApplicationDraftSchema.safeParse({ categoryIds: [] }).success, false);
assert.equal(releasedCategorySlugForLegacyValue(" Santexnik "), "plumbing");
assert.equal(immutableLegacyNameForCategory({ slug: "plumbing", nameUz: "Suv ustasi" } as any), "Santexnik");
assert.equal(releasedCategorySlugForLegacyValue("free form"), undefined);
assert.equal(reorderCategoriesSchema.safeParse({ items: [{ id: "a", sortOrder: 0 }, { id: "a", sortOrder: 1 }] }).success, false);
assert.equal(reorderCategoriesSchema.safeParse({ items: [{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 0 }] }).success, false);
assert.equal(reorderCategoriesSchema.safeParse({ items: [{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 2 }] }).success, false);
assert.equal(reorderCategoriesSchema.safeParse({ items: [{ id: "b", sortOrder: 1 }, { id: "a", sortOrder: 0 }] }).success, true);

const location = { latitude: 41.31, longitude: 69.24, addressText: "Toshkent shahar markazi" };
assert.equal(createOrderSchema.safeParse({ workerId: "worker", cityId: "tashkent", categoryId: "cat_one", problemTitle: "Yordam kerak", location }).success, true);
assert.equal(createOrderSchema.safeParse({ workerId: "worker", cityId: "tashkent", serviceType: "Legacy service", problemTitle: "Yordam kerak", location }).success, true);
assert.equal(createOrderSchema.safeParse({ workerId: "worker", cityId: "tashkent", problemTitle: "Yordam kerak", location }).success, false);

const migration = await readFile(new URL("../prisma/migrations/20260826120000_add_categories_stage1/migration.sql", import.meta.url), "utf8");
assert.match(migration, /ON DELETE RESTRICT/);
assert.match(migration, /lower\(btrim\(wv\.value\)\) = sv\.value/);
assert.doesNotMatch(migration, /DELETE FROM "WorkerProfile"|DELETE FROM "Order"/);
assert.doesNotMatch(migration, /UPDATE "WorkerProfile"/);
console.log("Category Stage 1 contracts and additive backfill checks passed.");
