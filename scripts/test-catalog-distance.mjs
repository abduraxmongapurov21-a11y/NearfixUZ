import assert from "node:assert/strict";
import {
  formatApproximateDistance,
  formatDistanceMeters,
  hasAddressCoordinates,
  normalizeDistanceMeters,
  resolveCatalogOriginAddressId,
  shouldApplyCatalogResponse
} from "../src/services/catalog/catalogDistance.mjs";
import { mapApiAddress } from "../src/services/addresses/addressMapper.mjs";

assert.equal(normalizeDistanceMeters(undefined), null);
assert.equal(normalizeDistanceMeters(null), null);
assert.equal(normalizeDistanceMeters(-1), null);
assert.equal(normalizeDistanceMeters(Number.POSITIVE_INFINITY), null);
assert.equal(normalizeDistanceMeters(849.6), 850);

assert.equal(formatDistanceMeters(0), "0 m");
assert.equal(formatDistanceMeters(999), "999 m");
assert.equal(formatDistanceMeters(1000), "1 km");
assert.equal(formatDistanceMeters(3150), "3.2 km");
assert.equal(formatDistanceMeters(12_345_678), "12345.7 km");
assert.equal(formatDistanceMeters(null), "Masofa aniqlanmagan");
assert.equal(formatApproximateDistance(3200), "3.2 km uzoqlikda");
assert.equal(formatApproximateDistance(undefined), "Masofa aniqlanmagan");

const addresses = [
  { id: "home", title: "Uy", lat: 41.31, lng: 69.24, isDefault: true },
  { id: "office", title: "Ish", latitude: 41.32, longitude: 69.25, isDefault: false },
  { id: "invalid", title: "Eski", lat: null, lng: null, isDefault: false }
];

assert.equal(hasAddressCoordinates(addresses[0]), true);
assert.equal(hasAddressCoordinates(addresses[2]), false);
assert.equal(hasAddressCoordinates({ lat: null, lng: null, latitude: null, longitude: null }), false);
assert.equal(hasAddressCoordinates({ lat: undefined, lng: undefined }), false);
assert.equal(hasAddressCoordinates({ lat: "", lng: "69.2" }), false);
assert.equal(hasAddressCoordinates({ lat: "   ", lng: "69.2" }), false);
assert.equal(hasAddressCoordinates({ lat: 0, lng: 0 }), true);
assert.equal(hasAddressCoordinates({ lat: "41.31", lng: "69.24" }), true);
assert.equal(hasAddressCoordinates(mapApiAddress({ id: "api-null", lat: null, lng: null })), false);
assert.equal(hasAddressCoordinates({ lat: 41.3 }), false);
assert.equal(hasAddressCoordinates({ lng: 69.2 }), false);
assert.equal(hasAddressCoordinates({ lat: -90.1, lng: 69.2 }), false);
assert.equal(hasAddressCoordinates({ lat: 41.3, lng: 180.1 }), false);
assert.equal(hasAddressCoordinates({ lat: 91, lng: 69 }), false);
assert.equal(resolveCatalogOriginAddressId("office", addresses), "office");
assert.equal(resolveCatalogOriginAddressId("deleted", addresses), "home");
assert.equal(resolveCatalogOriginAddressId("invalid", addresses), "home");
assert.equal(resolveCatalogOriginAddressId(null, addresses), "home");
assert.equal(resolveCatalogOriginAddressId(null, addresses.map((item) => ({ ...item, isDefault: false }))), "home");
assert.equal(resolveCatalogOriginAddressId(null, [addresses[2]]), null);
assert.equal(shouldApplyCatalogResponse(2, 2), true);
assert.equal(shouldApplyCatalogResponse(1, 2), false);

const mapperFixtures = [
  { input: { lat: "", lng: "" }, expected: [null, null], eligible: false },
  { input: { lat: " ", lng: " " }, expected: [null, null], eligible: false },
  { input: { lat: null, lng: null }, expected: [null, null], eligible: false },
  { input: { lat: undefined, lng: undefined }, expected: [null, null], eligible: false },
  { input: { lat: 0, lng: 0 }, expected: [0, 0], eligible: true },
  { input: { lat: "0", lng: "0" }, expected: [0, 0], eligible: true },
  { input: { lat: "41.311081", lng: "69.240562" }, expected: [41.311081, 69.240562], eligible: true },
  { input: { lat: 41.3, lng: undefined }, expected: [null, null], eligible: false },
  { input: { lat: 91, lng: 69.2 }, expected: [null, null], eligible: false },
  { input: { lat: 41.3, lng: -181 }, expected: [null, null], eligible: false },
  { input: { lat: Number.NaN, lng: 69.2 }, expected: [null, null], eligible: false },
  { input: { lat: 41.3, lng: Number.POSITIVE_INFINITY }, expected: [null, null], eligible: false }
];

for (const [index, fixture] of mapperFixtures.entries()) {
  const mapped = mapApiAddress({ id: `mapper-${index}`, ...fixture.input });
  assert.deepEqual([mapped.lat, mapped.lng], fixture.expected);
  assert.deepEqual([mapped.latitude, mapped.longitude], fixture.expected);
  assert.equal(hasAddressCoordinates(mapped), fixture.eligible);
}

console.log(
  JSON.stringify({
    distanceFormatting: "pass",
    addressCoordinateValidation: "pass",
    originPriorityAndFallback: "pass",
    staleResponseGuard: "pass"
  })
);
