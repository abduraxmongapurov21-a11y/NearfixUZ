import assert from "node:assert/strict";
import { getCatalogDeviceLocation } from "../src/services/location/catalogDeviceLocation.mjs";
import { resolveCatalogRequestOrigin } from "../src/services/catalog/catalogDistance.mjs";
import { reconcileCatalogAddressState } from "../src/store/clientAddressState.mjs";

const calls = [];
const api = {
  Accuracy: { Balanced: "balanced" },
  getForegroundPermissionsAsync: async () => ({ granted: true }),
  requestForegroundPermissionsAsync: async () => { calls.push("permission"); return { granted: true }; },
  hasServicesEnabledAsync: async () => true,
  getCurrentPositionAsync: async (options) => { calls.push(options.accuracy); return { coords: { latitude: 41.31, longitude: 69.24 } }; }
};
assert.deepEqual(await getCatalogDeviceLocation(api), { ok: true, coordinates: { lat: 41.31, lng: 69.24 } });
assert.deepEqual(calls, ["balanced"]);
const savedAddresses = [{ id: "office", lat: 0, lng: 0, isDefault: true }];
assert.deepEqual(resolveCatalogRequestOrigin({ catalogUseDeviceLocation: true, catalogOriginCoordinates: { lat: 41.31, lng: 69.24 }, catalogOriginAddressId: "office", savedAddresses }), {
  originAddressId: null, originCoordinates: { lat: 41.31, lng: 69.24 }
});
assert.deepEqual(resolveCatalogRequestOrigin({ catalogUseDeviceLocation: true, catalogOriginCoordinates: null, catalogOriginAddressId: "office", savedAddresses }), {
  originAddressId: null, originCoordinates: null
}, "denied GPS must never silently fall back to a saved address");
assert.equal(reconcileCatalogAddressState({ catalogUseDeviceLocation: true, catalogOriginCoordinates: { lat: 41.31, lng: 69.24 }, catalogSort: "nearest" }, []).catalogSort, "nearest", "address refresh must not reset GPS sorting");

calls.length = 0;
assert.equal((await getCatalogDeviceLocation({ ...api, getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: true }) })).ok, true);
assert.deepEqual(calls, ["permission", "balanced"]);
calls.length = 0;
const denied = { ...api, getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }) };
assert.equal((await getCatalogDeviceLocation(denied)).code, "LOCATION_PERMISSION_DENIED");
assert.deepEqual(calls, []);
assert.equal((await getCatalogDeviceLocation({ ...denied, getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: true }) }, { requestPermission: false })).code, "LOCATION_PERMISSION_DENIED");
assert.deepEqual(calls, [], "foreground refresh must not repeatedly open the permission dialog");
assert.equal((await getCatalogDeviceLocation({ ...api, hasServicesEnabledAsync: async () => false })).code, "LOCATION_UNAVAILABLE");
assert.equal((await getCatalogDeviceLocation({ ...api, getCurrentPositionAsync: async () => ({ coords: { latitude: 0, longitude: 0 } }) })).ok, true);
assert.equal((await getCatalogDeviceLocation({ ...api, getCurrentPositionAsync: async () => ({ coords: { latitude: 91, longitude: 0 } }) })).code, "LOCATION_UNAVAILABLE");
assert.equal((await getCatalogDeviceLocation({ ...api, getCurrentPositionAsync: async () => { throw new Error("GPS unavailable"); } })).code, "LOCATION_UNAVAILABLE");
assert.equal((await getCatalogDeviceLocation({ ...api, getCurrentPositionAsync: () => new Promise(() => {}) }, { timeoutMs: 5 })).code, "LOCATION_UNAVAILABLE", "a missing GPS fix cannot hang the catalog");
console.log("Device GPS permission, denial, zero coordinates, timeout and saved-address isolation tests passed.");
