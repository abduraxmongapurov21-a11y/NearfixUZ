import assert from "node:assert/strict";
import { createAddressSchema, updateAddressSchema } from "../src/modules/addresses/address.contracts.js";
import { orderLocationSchema, createWorkerOrderSchema } from "../src/modules/orders/order.contracts.js";
import { updateWorkerServiceLocationSchema } from "../src/modules/workers/worker.contracts.js";

const address = { title: "Uy", address: "Toshkent markazi" };
let checks = 0;
for (const invalid of [true, false, [], [41], {}, { valueOf: () => 41 }, Number.NaN, Infinity, -Infinity, "abc"]) {
  for (const schema of [createAddressSchema, updateAddressSchema]) {
    assert.equal(schema.safeParse({ ...address, lat: invalid, lng: invalid }).success, false);
    checks++;
  }
  assert.equal(orderLocationSchema.safeParse({ latitude: invalid, longitude: invalid }).success, false);
  assert.equal(updateWorkerServiceLocationSchema.safeParse({ serviceLat: invalid, serviceLng: invalid }).success, false);
  assert.equal(createWorkerOrderSchema.safeParse({
    clientPhone: "+998900000000", categoryId: "category", description: "Telefon buyurtmasi",
    location: { addressText: address.address, latitude: invalid, longitude: invalid }
  }).success, false);
  checks += 3;
}
for (const [lat, lng] of [[41.3, 69.2], ["41.3", "69.2"], [0, 0], [-90, -180], [90, 180]]) {
  const parsed = createAddressSchema.parse({ ...address, lat, lng });
  assert.equal(parsed.lat, Number(lat));
  assert.equal(parsed.lng, Number(lng));
  checks += 2;
}
for (const missing of [undefined, null, "", "   "]) {
  const parsed = createAddressSchema.parse({ ...address, lat: missing, lng: missing });
  assert.equal(parsed.lat, undefined);
  assert.equal(parsed.lng, undefined);
  checks += 2;
}
for (const coordinates of [{ lat: 41.3 }, { lng: 69.2 }, { lat: 91, lng: 69.2 }, { lat: 41.3, lng: -181 }]) {
  assert.equal(createAddressSchema.safeParse({ ...address, ...coordinates }).success, false);
  checks++;
}
console.log(`Address coordinate contracts: ${checks} checks PASS; malformed JSON types rejected, numeric strings and text-only addresses retained.`);
