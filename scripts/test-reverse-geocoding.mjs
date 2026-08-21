import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createLatestReverseGeocodeController,
  formatReverseGeocodeAddress,
  isCoordinateLikeAddress,
  normalizeReverseGeocodeResult,
  resolveReverseGeocode
} from "../src/services/location/reverseGeocodeModel.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

assert.equal(
  formatReverseGeocodeAddress({ street: "Bunyodkor shoh ko'chasi", streetNumber: "12", district: null, city: "Toshkent" }),
  "Bunyodkor shoh ko'chasi 12, Toshkent"
);
assert.equal(
  formatReverseGeocodeAddress({ district: "Chilonzor tumani", subregion: "Chilonzor tumani", city: "Toshkent", region: "Toshkent" }),
  "Chilonzor tumani, Toshkent"
);
const noEmptyCopy = formatReverseGeocodeAddress({ name: "  ", district: undefined, city: "Toshkent", country: null });
assert.equal(noEmptyCopy, "Toshkent");
assert.equal(noEmptyCopy.includes("undefined"), false);
assert.equal(noEmptyCopy.includes("null"), false);
assert.equal(isCoordinateLikeAddress("41.311081, 69.240562"), true);
assert.equal(isCoordinateLikeAddress("lng: 69.240562, lat: 41.311081"), true);
assert.equal(isCoordinateLikeAddress("12/14"), false);
assert.equal(isCoordinateLikeAddress("100097"), false);
assert.equal(
  formatReverseGeocodeAddress({ name: "41.311081, 69.240562", district: "Chilonzor", city: "Toshkent" }),
  "Chilonzor, Toshkent"
);
assert.equal(formatReverseGeocodeAddress({ formattedAddress: "41.311081, 69.240562" }), null);

assert.deepEqual(
  normalizeReverseGeocodeResult([
    {
      street: "Bunyodkor shoh ko'chasi",
      streetNumber: "12",
      district: "Chilonzor tumani",
      city: "Toshkent",
      postalCode: "100097"
    }
  ]),
  {
    address: "Bunyodkor shoh ko'chasi 12, Chilonzor tumani, Toshkent, 100097",
    city: "Toshkent",
    district: "Chilonzor tumani",
    street: "Bunyodkor shoh ko'chasi",
    postalCode: "100097"
  }
);
assert.equal(normalizeReverseGeocodeResult([]), null);
assert.equal(normalizeReverseGeocodeResult([{}]), null);

const failingCoordinate = { latitude: 41.311081, longitude: 69.240562 };
const emptyResult = await resolveReverseGeocode(failingCoordinate, async () => []);
assert.deepEqual(emptyResult, {
  ok: false,
  code: "address.not-found",
  coordinate: failingCoordinate
});
assert.equal((await resolveReverseGeocode({ latitude: null, longitude: 69.2 }, async () => [])).coordinate, null);

const failed = await resolveReverseGeocode(failingCoordinate, async () => {
  throw new Error("native provider detail must not escape");
});
assert.deepEqual(failed, {
  ok: false,
  code: "geocoder.unavailable",
  coordinate: failingCoordinate
});

const pending = new Map();
const controller = createLatestReverseGeocodeController(async (coordinate) => {
  const request = deferred();
  pending.set(coordinate.latitude, request);
  const result = await request.promise;
  return {
    ok: true,
    coordinate,
    location: { address: result },
    selectedLocation: { ...coordinate, address: result }
  };
});

const coordinateA = { latitude: 41.31, longitude: 69.24 };
const coordinateB = { latitude: 41.32, longitude: 69.25 };
const requestA = controller.resolve(coordinateA);
const requestB = controller.resolve(coordinateB);
pending.get(coordinateB.latitude).resolve("Address B");
const resultB = await requestB;
pending.get(coordinateA.latitude).resolve("Address A");
const resultA = await requestA;
assert.equal(resultB.stale, false);
assert.equal(resultB.selectedLocation.address, "Address B");
assert.deepEqual(resultB.coordinate, coordinateB);
assert.equal(resultA.stale, true);
assert.deepEqual(controller.currentCoordinate(), coordinateB);
assert.deepEqual(resultB.selectedLocation, { ...coordinateB, address: "Address B" });

const authState = { experienceMode: "worker" };
await resolveReverseGeocode(coordinateB, async () => [{ district: "Chilonzor", city: "Toshkent" }]);
assert.equal(authState.experienceMode, "worker");

const workerServiceSource = fs.readFileSync("backend/src/modules/workers/worker.service.ts", "utf8");
const clientProfileSource = fs.readFileSync("src/screens/profile/ClientProfileScreen.js", "utf8");
const addressListSource = clientProfileSource.slice(
  clientProfileSource.indexOf("function AddressManager"),
  clientProfileSource.indexOf("function AddressFormModal")
);
assert.equal(addressListSource.includes("address.lat.toFixed"), false);
assert.equal(addressListSource.includes("address.lng.toFixed"), false);
const publicSelect = workerServiceSource.slice(
  workerServiceSource.indexOf("const publicWorkerSelect"),
  workerServiceSource.indexOf("type PublicWorkerRecord")
);
assert.equal(publicSelect.includes("serviceLat"), false);
assert.equal(publicSelect.includes("serviceLng"), false);

console.log("Native reverse-geocoding formatter, fallback, pairing, and stale-response tests passed.");
