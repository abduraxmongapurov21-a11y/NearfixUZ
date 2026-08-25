import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createLatestReverseGeocodeController,
  formatReverseGeocodeAddress,
  isCoordinateLikeAddress,
  mapKitLocaleMatchesAppLocale,
  normalizeReverseGeocodeResult,
  normalizeReverseGeocodeLocale,
  normalizeYandexReverseGeocodeResult,
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
assert.equal(normalizeReverseGeocodeLocale("RU-ru"), "ru");
assert.equal(normalizeReverseGeocodeLocale("en_US"), "en");
assert.equal(normalizeReverseGeocodeLocale("fr-FR"), null);
assert.equal(mapKitLocaleMatchesAppLocale("ru-RU", "ru"), true);
assert.equal(mapKitLocaleMatchesAppLocale("en_RU", "en"), true);
assert.equal(mapKitLocaleMatchesAppLocale("ru_RU", "en"), false);

const yandexResult = {
  formatted: "Russia Street 12, Tashkent, Uzbekistan",
  Components: [
    { kind: 5, name: "Tashkent" },
    { kind: 6, name: "Chilanzar District" },
    { kind: 7, name: "Russia Street" }
  ]
};
assert.deepEqual(normalizeYandexReverseGeocodeResult(yandexResult), {
  address: "Russia Street 12, Tashkent, Uzbekistan",
  city: "Tashkent",
  district: "Chilanzar District",
  street: "Russia Street"
});

const failingCoordinate = { latitude: 41.311081, longitude: 69.240562 };
const emptyResult = await resolveReverseGeocode(
  { ...failingCoordinate, locale: "uz" },
  { nativeReverseGeocode: async () => [], getNativeLocale: () => "uz-UZ" }
);
assert.deepEqual(emptyResult, {
  ok: false,
  code: "address.not-found",
  coordinate: failingCoordinate
});
assert.equal(
  (await resolveReverseGeocode(
    { latitude: null, longitude: 69.2, locale: "uz" },
    { nativeReverseGeocode: async () => [] }
  )).coordinate,
  null
);

const failed = await resolveReverseGeocode(
  { ...failingCoordinate, locale: "uz" },
  { nativeReverseGeocode: async () => { throw new Error("native provider detail must not escape"); } }
);
assert.deepEqual(failed, {
  ok: false,
  code: "geocoder.unavailable",
  coordinate: failingCoordinate
});

const mismatchCases = [
  { systemLocale: "uz-UZ", appLocale: "ru" },
  { systemLocale: "uz-UZ", appLocale: "en" },
  { systemLocale: "ru-RU", appLocale: "en" },
  { systemLocale: "en-US", appLocale: "ru" }
];
for (const mismatch of mismatchCases) {
  let receivedLocale = null;
  let nativeCalls = 0;
  const result = await resolveReverseGeocode(
    { ...failingCoordinate, locale: mismatch.appLocale },
    {
      localizedReverseGeocode: async (coordinate, locale) => {
        assert.deepEqual(coordinate, failingCoordinate);
        receivedLocale = locale;
        return yandexResult;
      },
      nativeReverseGeocode: async () => {
        nativeCalls += 1;
        return [];
      },
      getNativeLocale: () => mismatch.systemLocale
    }
  );
  assert.equal(receivedLocale, mismatch.appLocale);
  assert.equal(nativeCalls, 0);
  assert.equal(result.location.locale, mismatch.appLocale);
  assert.equal(result.location.source, "yandex-mapkit");
}

let uzPrimaryCalls = 0;
const uzResult = await resolveReverseGeocode(
  { ...failingCoordinate, locale: "uz" },
  {
    localizedReverseGeocode: async () => { uzPrimaryCalls += 1; return yandexResult; },
    nativeReverseGeocode: async () => [{ street: "Bunyodkor ko'chasi", city: "Toshkent" }],
    getNativeLocale: () => "uz-UZ"
  }
);
assert.equal(uzPrimaryCalls, 0, "unsupported Yandex Uzbek locale must not be fabricated");
assert.equal(uzResult.location.locale, "uz");
assert.equal(uzResult.location.source, "native-device");

let unsupportedCalls = 0;
const unsupported = await resolveReverseGeocode(
  { ...failingCoordinate, locale: "fr" },
  { nativeReverseGeocode: async () => { unsupportedCalls += 1; return []; } }
);
assert.equal(unsupported.code, "locale.unsupported");
assert.equal(unsupportedCalls, 0);

const fallback = await resolveReverseGeocode(
  { ...failingCoordinate, locale: "ru" },
  {
    localizedReverseGeocode: async () => { throw new Error("primary unavailable"); },
    nativeReverseGeocode: async () => [{ street: "Bunyodkor ko'chasi", city: "Toshkent" }],
    getNativeLocale: () => "uz-UZ"
  }
);
assert.equal(fallback.location.source, "native-device");
assert.equal(fallback.location.locale, "uz");
assert.notEqual(fallback.location.locale, "ru");

const unknownFallbackLocale = await resolveReverseGeocode(
  { ...failingCoordinate, locale: "en" },
  {
    localizedReverseGeocode: async () => { throw new Error("primary unavailable"); },
    nativeReverseGeocode: async () => [{ city: "Tashkent" }],
    getNativeLocale: () => "fr-FR"
  }
);
assert.equal(unknownFallbackLocale.location.locale, null);
assert.equal(unknownFallbackLocale.location.source, "native-device");

const pending = new Map();
const controllerLocales = [];
const controller = createLatestReverseGeocodeController(async (request) => {
  const coordinate = { latitude: request.latitude, longitude: request.longitude };
  controllerLocales.push(request.locale);
  const pendingRequest = deferred();
  pending.set(coordinate.latitude, pendingRequest);
  const result = await pendingRequest.promise;
  return {
    ok: true,
    coordinate,
    location: { address: result },
    selectedLocation: { ...coordinate, address: result }
  };
});

const coordinateA = { latitude: 41.31, longitude: 69.24 };
const coordinateB = { latitude: 41.32, longitude: 69.25 };
const requestA = controller.resolve({ ...coordinateA, locale: "ru" });
const requestB = controller.resolve({ ...coordinateB, locale: "en" });
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
assert.deepEqual(controllerLocales, ["ru", "en"]);

const authState = { experienceMode: "worker" };
await resolveReverseGeocode(
  { ...coordinateB, locale: "uz" },
  { nativeReverseGeocode: async () => [{ district: "Chilonzor", city: "Toshkent" }] }
);
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
