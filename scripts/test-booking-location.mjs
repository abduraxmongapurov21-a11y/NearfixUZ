import assert from "node:assert/strict";
import fs from "node:fs";
import { createLatestReverseGeocodeController, resolveReverseGeocode } from "../src/services/location/reverseGeocodeModel.mjs";
import {
  bookingLocationDraft,
  bookingProblemOptions,
  categoryBookingDraft,
  createBookingSubmissionLock,
  createOrderThenOptionallySave,
  normalizeBookingMapSelection,
  orderLocationDisplayText,
  sortBookingAddresses
} from "../src/services/orders/bookingLocation.mjs";

const mapLocation = normalizeBookingMapSelection({
  latitude: 41.311081,
  longitude: 69.240562,
  address: "  Toshkent, test manzili  ",
  district: " Chilonzor ",
  locale: "ru",
  source: "yandex-mapkit"
});
assert.deepEqual(mapLocation, {
  latitude: 41.311081,
  longitude: 69.240562,
  addressText: "Toshkent, test manzili",
  district: "Chilonzor",
  locale: "ru",
  source: "yandex-mapkit"
});
assert.equal(normalizeBookingMapSelection({ latitude: 91, longitude: 69.2, address: "Invalid" }), null);
const coordinateOnly = { latitude: 41.311081, longitude: 69.240562, addressText: "" };
assert.deepEqual(normalizeBookingMapSelection({ ...coordinateOnly, address: " " }), coordinateOnly);
for (const invalid of [null, undefined, "", " ", true, false, [], {}, NaN, Infinity, -Infinity]) {
  assert.equal(normalizeBookingMapSelection({ latitude: invalid, longitude: 69.2 }), null);
  assert.equal(normalizeBookingMapSelection({ latitude: 41.3, longitude: invalid }), null);
}
assert.equal(normalizeBookingMapSelection({ latitude: -91, longitude: 69.2 }), null);
assert.equal(normalizeBookingMapSelection({ latitude: 41.3, longitude: 181 }), null);
assert.equal(normalizeBookingMapSelection({ latitude: 41.3, longitude: -181 }), null);
assert.deepEqual(normalizeBookingMapSelection({ latitude: 0, longitude: 0 }), { latitude: 0, longitude: 0, addressText: "" });
assert.equal(orderLocationDisplayText(coordinateOnly), "Xaritada belgilangan joy");
assert.equal(orderLocationDisplayText(mapLocation), mapLocation.addressText);
assert.equal(orderLocationDisplayText(null), "Manzil ma'lumoti yo'q");

// Exercise the production native timeout adapter with a provider that never settles.
const adapterSource = fs.readFileSync("src/services/location/reverseGeocodeLocation.js", "utf8")
  .replace(/^import[\s\S]*?from ["'][^"']+["'];\r?\n/gm, "")
  .replace("export function reverseGeocodeLocation", "function reverseGeocodeLocation");
const nativeTimeout = new Function("Location", "resolveReverseGeocode", `${adapterSource}; return reverseGeocodeLocation;`)(
  { reverseGeocodeAsync: () => new Promise(() => {}) }, resolveReverseGeocode
);
const outcomes = [
  await resolveReverseGeocode({ ...coordinateOnly, locale: "uz" }, { nativeReverseGeocode: async () => [] }),
  await resolveReverseGeocode({ ...coordinateOnly, locale: "uz" }, { nativeReverseGeocode: async () => { throw new Error("provider error"); } }),
  await nativeTimeout({ ...coordinateOnly, locale: "uz" })
];
for (const result of outcomes) {
  assert.equal(result.ok, false);
  const selected = normalizeBookingMapSelection(result.coordinate);
  assert.deepEqual(selected, coordinateOnly);
  assert.equal(bookingLocationDraft(null, selected).location.addressText, "", "display fallback must not become address data");
}

let finishOld;
const controller = createLatestReverseGeocodeController((request) => request.latitude === 41.3
  ? new Promise((resolve) => { finishOld = resolve; })
  : resolveReverseGeocode({ ...request, locale: "uz" }, { nativeReverseGeocode: async () => [] }));
const old = controller.resolve({ latitude: 41.3, longitude: 69.2 });
const latest = await controller.resolve(coordinateOnly);
finishOld({ ok: true, coordinate: { latitude: 41.3, longitude: 69.2 }, location: { address: "Old address" } });
assert.equal((await old).stale, true);
assert.equal(latest.stale, false);
assert.deepEqual(normalizeBookingMapSelection(latest.coordinate), coordinateOnly);

// Run the production API mapping with controlled transports, including server/network failure.
const serviceSource = fs.readFileSync("src/services/orders/orderService.js", "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/export (async )?function /g, "$1function ");
let sentBody;
let transportFailure;
const { createOrderApi } = new Function("TRACKING_STATUSES", "apiRequest", "httpAuthRequest", "orderLocationDisplayText",
  `${serviceSource}; return { createOrderApi };`)(
  {}, async (handler) => { try { return await handler(); } catch { return { ok: false }; } },
  async (_path, options) => {
    sentBody = options.body;
    if (transportFailure) throw new Error(transportFailure);
    return { order: { id: "confirmed-order", location: options.body.location, createdAt: "2026-09-19T00:00:00Z" } };
  }, orderLocationDisplayText
);
const created = await createOrderApi("fixture", bookingLocationDraft(null, coordinateOnly), { id: "category" }, { id: "worker" });
assert.equal(created.ok, true);
assert.deepEqual(sentBody.location, coordinateOnly);
assert.deepEqual(created.order.location, coordinateOnly);
assert.equal(created.order.address, "Xaritada belgilangan joy");
assert.equal(JSON.stringify(sentBody).includes("Xaritada"), false);
for (transportFailure of ["HTTP 500", "network unavailable"]) {
  assert.equal((await createOrderApi("fixture", bookingLocationDraft(null, coordinateOnly), {}, { id: "worker" })).ok, false);
}

for (const locale of ["uz", "ru", "en"]) {
  const copy = JSON.parse(fs.readFileSync(`src/i18n/locales/${locale}.json`, "utf8"));
  assert.ok(copy["Xaritada belgilangan joy"]);
  assert.ok(copy["Xaritadan yaroqli nuqta tanlang."]);
}

const addresses = [
  { id: "second", isDefault: false },
  { id: "default", isDefault: true },
  { id: "third", isDefault: false }
];
assert.deepEqual(sortBookingAddresses(addresses).map((address) => address.id), ["default", "second", "third"]);
assert.deepEqual(bookingLocationDraft({ id: "saved", addressText: "Saved address" }, null), {
  addressId: "saved",
  location: null,
  address: "Saved address"
});
assert.deepEqual(bookingLocationDraft(null, mapLocation), {
  addressId: null,
  location: mapLocation,
  address: mapLocation.addressText
});

const adminCreatedCategory = {
  id: "cat_appliance_repair",
  slug: "appliance-repair",
  nameUz: "Maishiy texnika",
  nameRu: "Бытовая техника",
  nameEn: "Appliance repair"
};
const adminCategoryWorker = { id: "worker-new-category", categoryIds: [adminCreatedCategory.id] };
assert.deepEqual(bookingProblemOptions(adminCreatedCategory), [
  "Ta'mirlash kerak",
  "Ishlamayapti",
  "O'rnatish kerak",
  "Almashtirish kerak",
  "Tekshirib berish kerak",
  "Boshqa"
]);
assert.deepEqual(categoryBookingDraft({
  category: adminCreatedCategory,
  worker: adminCategoryWorker,
  problemTitle: "Ishlamayapti",
  locationDraft: { addressId: "saved", location: null, address: "Saved address" }
}), {
  selectedWorkerId: adminCategoryWorker.id,
  serviceId: adminCreatedCategory.id,
  problemTitle: "Ishlamayapti",
  description: undefined,
  addressId: "saved",
  location: null,
  address: "Saved address"
});

let saveCalls = 0;
const failedOrder = await createOrderThenOptionallySave({
  createOrder: async () => ({ ok: false }),
  shouldSave: true,
  saveAddress: async () => { saveCalls += 1; return { ok: true }; }
});
assert.equal(failedOrder.orderResult.ok, false);
assert.equal(saveCalls, 0, "optional save must not run before a successful order");

const sequence = [];
const successfulOrder = await createOrderThenOptionallySave({
  createOrder: async () => { sequence.push("order"); return { ok: true, order: { id: "order" } }; },
  shouldSave: true,
  saveAddress: async () => { sequence.push("save"); throw new Error("save failed"); }
});
assert.deepEqual(sequence, ["order", "save"]);
assert.equal(successfulOrder.orderResult.ok, true);
assert.equal(successfulOrder.saveResult.ok, false, "save failure must not roll back the order");

const lock = createBookingSubmissionLock();
assert.equal(lock.acquire(), true);
assert.equal(lock.acquire(), false, "duplicate submission must be blocked while the first is active");
lock.release();
assert.equal(lock.acquire(), true);

console.log("Booking one-time location, ordering, optional save, and duplicate-submit tests passed.");
