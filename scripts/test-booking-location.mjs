import assert from "node:assert/strict";
import {
  bookingLocationDraft,
  bookingProblemOptions,
  categoryBookingDraft,
  createBookingSubmissionLock,
  createOrderThenOptionallySave,
  normalizeBookingMapSelection,
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
assert.equal(normalizeBookingMapSelection({ latitude: 41.3, longitude: 69.2, address: " " }), null);

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
