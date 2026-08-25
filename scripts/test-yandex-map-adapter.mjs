import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_ZOOM,
  toCanonicalCoordinate,
  toYandexInitialRegion,
  toYandexPoint
} from "../src/services/maps/yandexMapAdapter.mjs";

const canonical = { latitude: 41.3110814, longitude: 69.2405624 };
const cameraEvent = {
  nativeEvent: {
    point: { lat: canonical.latitude, lon: canonical.longitude },
    zoom: 16,
    reason: "GESTURES",
    finished: true
  }
};

assert.deepEqual(toCanonicalCoordinate(cameraEvent), canonical);
assert.deepEqual(toYandexPoint(canonical), { lat: canonical.latitude, lon: canonical.longitude });
assert.deepEqual(toYandexInitialRegion(canonical), {
  lat: canonical.latitude,
  lon: canonical.longitude,
  zoom: DEFAULT_ZOOM,
  azimuth: 0,
  tilt: 0
});
assert.equal(toCanonicalCoordinate({ lat: 91, lon: 69 }), null);
assert.equal(toCanonicalCoordinate({ latitude: 41, longitude: Number.NaN }), null);

const mapPickerSource = fs.readFileSync("src/screens/maps/MapPickerScreen.js", "utf8");
const mapKitLoaderSource = fs.readFileSync("src/services/maps/yandexMapKit.js", "utf8");
assert.equal(mapPickerSource.includes("react-native-maps"), false);
assert.equal(mapPickerSource.includes("react-native-yamap-plus"), false);
assert.equal(mapPickerSource.includes("reverseGeocodeLocation"), true);
assert.equal(mapPickerSource.includes("useUiStore((state) => state.locale)"), true);
assert.equal(mapPickerSource.includes("geocoderRef.current.resolve({ ...selected, locale })"), true);
assert.equal(mapPickerSource.includes("toCanonicalCoordinate"), true);
const appBase = JSON.parse(fs.readFileSync("app.base.json", "utf8"));
const yandexPlugin = appBase.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "react-native-yamap-plus");
assert.equal(yandexPlugin[1].android_useYandexMapKitLite, false);
assert.equal(yandexPlugin[1].ios_useYandexMapKitLite, false);
const androidGradleProperties = fs.readFileSync("android/gradle.properties", "utf8");
assert.equal(androidGradleProperties.includes("EXPO_useYandexMapKitLite=false"), true);
assert.equal(mapKitLoaderSource.includes('require("react-native-yamap-plus")'), false);
assert.equal(mapKitLoaderSource.includes("src/components/Yamap/Yamap"), true);
assert.equal(mapKitLoaderSource.includes("src/modules/YamapInstance"), true);

const configSource = fs.readFileSync("app.config.js", "utf8");
const baseConfigSource = fs.readFileSync("app.base.json", "utf8");
assert.equal(configSource.includes("GOOGLE_MAPS_ANDROID_API_KEY"), false);
assert.equal(configSource.includes("YANDEX_MAPKIT_API_KEY"), true);
assert.equal(baseConfigSource.includes('"android_useYandexMapKitLite": false'), true);
assert.equal(baseConfigSource.includes('"ios_useYandexMapKitLite": false'), true);
assert.equal(baseConfigSource.includes('"minSdkVersion": 26'), true);

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(packageJson.dependencies["react-native-maps"], undefined);
assert.equal(packageJson.dependencies["react-native-yamap-plus"], "6.10.1");

console.log("Yandex MapKit adapter and Full Search configuration tests passed.");
