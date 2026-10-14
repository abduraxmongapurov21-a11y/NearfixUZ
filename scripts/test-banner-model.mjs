import assert from "node:assert/strict";
import { bannersForPlacement, mapApiBanner, nextBannerIndex, resolveBannerTarget } from "../src/services/content/bannerModel.mjs";

const legacy = mapApiBanner({ id: "legacy", imageUrl: "https://example.com/image.jpg", isActive: true });
assert.equal(legacy.placement, "HOME"); assert.equal(legacy.mediaType, "IMAGE");
assert.equal(mapApiBanner({ placement: "CATEGORY", mediaType: "VIDEO" }).mediaType, "VIDEO");
const categories = [{ id: "cat-1", slug: "plumbing", nameUz: "Santexnik", nameRu: "Сантехник", nameEn: "Plumber", isActive: true }];
for (const targetValue of ["cat-1", "plumbing", "Santexnik"]) assert.deepEqual(resolveBannerTarget({ targetType: "CATEGORY", targetValue }, categories), { kind: "category", categoryId: "cat-1" });
assert.equal(resolveBannerTarget({ targetType: "CATEGORY", targetValue: "missing" }, categories), null);
assert.equal(resolveBannerTarget({ targetType: "CATEGORY", targetValue: "cat-1" }, [{ ...categories[0], isActive: false }]), null);
assert.deepEqual(resolveBannerTarget({ targetType: "URL", targetValue: "https://example.com/offer" }, []), { kind: "url", url: "https://example.com/offer" });
for (const targetValue of ["javascript:alert(1)", "file:///tmp/file", "not a URL"]) assert.equal(resolveBannerTarget({ targetType: "URL", targetValue }, []), null);
assert.equal(resolveBannerTarget({ targetType: "NONE", targetValue: "https://example.com" }, []), null);
assert.equal(nextBannerIndex(1, 2), 0); assert.equal(nextBannerIndex(0, 0), 0); assert.equal(nextBannerIndex(0, 1), 0);
const mixed = [
  { id: "c1", placement: "CATEGORY", isActive: true, sortOrder: 0 },
  { id: "h2", placement: "HOME", isActive: true, sortOrder: 2 },
  { id: "hidden", placement: "HOME", isActive: false, sortOrder: 0 },
  { ...legacy, sortOrder: 1 }
];
assert.deepEqual(bannersForPlacement(mixed, "HOME").map((item) => item.id), ["legacy", "h2"]);
assert.deepEqual(bannersForPlacement(mixed, "CATEGORY").map((item) => item.id), ["c1"]);
assert.equal(mixed[0].id, "c1", "filtering and sorting cannot mutate the shared cache");
assert.deepEqual(bannersForPlacement(undefined, "HOME"), []);
console.log("Banner compatibility, safe links, category routing and carousel wrap tests passed.");
