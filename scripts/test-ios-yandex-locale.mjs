import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { resolveReverseGeocode } from "../src/services/location/reverseGeocodeModel.mjs";
import {
  createIosYandexLocaleRelaunchError,
  getYandexLocaleTransition,
  initializeYandexMapKitLocale,
  IOS_YANDEX_LOCALE_RELAUNCH_REQUIRED
} from "../src/services/maps/yandexLocaleLifecycle.mjs";

const require = createRequire(import.meta.url);
const { patchYamapIosLocaleSource, YAMAP_IOS_MODULE_PATH } = require("../plugins/withYamapIosLocale.js");

const calls = [];
const initialization = await initializeYandexMapKitLocale({
  currentLocale: "uz",
  readLocale: async () => {
    calls.push("read:ru");
    return "ru";
  },
  setNativeLocale: async (locale) => calls.push(`set:${locale}`),
  initializeNative: async () => calls.push("init")
});
assert.deepEqual(calls, ["read:ru", "set:ru_RU", "init"]);
assert.deepEqual(initialization, { appLocale: "ru", mapKitLocale: "ru_RU" });

assert.deepEqual(
  getYandexLocaleTransition({ platform: "ios", initializedLocale: "ru_RU", requestedLocale: "ru" }),
  { action: "use-initialized", mapKitLocale: "ru_RU" }
);
assert.deepEqual(
  getYandexLocaleTransition({ platform: "ios", initializedLocale: "ru_RU", requestedLocale: "en" }),
  { action: "cold-relaunch-required", mapKitLocale: "en_RU" }
);
assert.deepEqual(
  getYandexLocaleTransition({ platform: "android", initializedLocale: "ru_RU", requestedLocale: "en" }),
  { action: "set-runtime", mapKitLocale: "en_RU" }
);

let nativeFallbackCalls = 0;
const blocked = await resolveReverseGeocode(
  { latitude: 41.311081, longitude: 69.240562, locale: "en" },
  {
    localizedReverseGeocode: async () => {
      throw createIosYandexLocaleRelaunchError();
    },
    nativeReverseGeocode: async () => {
      nativeFallbackCalls += 1;
      return [{ city: "Toshkent" }];
    }
  }
);
assert.equal(nativeFallbackCalls, 0, "locale lifecycle failures must not fall back to a wrong-language provider");
assert.deepEqual(blocked, {
  ok: false,
  code: IOS_YANDEX_LOCALE_RELAUNCH_REQUIRED,
  coordinate: { latitude: 41.311081, longitude: 69.240562 }
});

const nativeSource = `
#import <YandexMapsMobile/YMKMapKitFactory.h>
#import <YandexMapsMobile/YRTI18nManager.h>
- (void)setLocaleImpl:(NSString *) locale resolver:(RCTPromiseResolveBlock)resolve {
    [YRTI18nManagerFactory setLocaleWithLocale:locale];
    resolve(nil);
}
`;
const patchedSource = patchYamapIosLocaleSource(nativeSource);
assert.equal(patchedSource.includes("[YMKMapKit setLocale:locale];"), true);
assert.equal(patchedSource.includes("[YRTI18nManagerFactory setLocaleWithLocale:locale];"), false);
assert.equal(patchYamapIosLocaleSource(patchedSource), patchedSource, "the prebuild patch must be idempotent");
assert.throws(
  () => patchYamapIosLocaleSource("unrecognized upstream implementation"),
  /refusing to apply an unverified MapKit patch/u
);

const installedSource = fs.readFileSync(YAMAP_IOS_MODULE_PATH, "utf8");
const patchedInstalledSource = patchYamapIosLocaleSource(installedSource);
assert.equal(patchedInstalledSource.includes("[YMKMapKit setLocale:locale];"), true);
assert.equal(patchedInstalledSource.includes("[[YMKMapKit sharedInstance] onStart];"), true);

const appBase = JSON.parse(fs.readFileSync("app.base.json", "utf8"));
assert.equal(appBase.expo.plugins.includes("./plugins/withYamapIosLocale"), true);

console.log("iOS Yandex MapKit locale lifecycle tests passed.");
