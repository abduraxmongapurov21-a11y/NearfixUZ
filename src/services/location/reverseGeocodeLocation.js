import * as Location from "expo-location";
import { loadYandexGeocoder } from "../maps/yandexMapKit";
import {
  mapKitLocaleMatchesAppLocale,
  resolveReverseGeocode,
  toYandexMapKitLocale
} from "./reverseGeocodeModel.mjs";

const NATIVE_GEOCODER_TIMEOUT_MS = 8000;
const YANDEX_GEOCODER_TIMEOUT_MS = 8000;

async function reverseGeocodeWithTimeout(location) {
  let timeoutId;
  try {
    return await Promise.race([
      Location.reverseGeocodeAsync(location),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error()), NATIVE_GEOCODER_TIMEOUT_MS);
      })
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

let yandexRequestQueue = Promise.resolve();

function runYandexRequest(task) {
  const request = yandexRequestQueue.then(task, task);
  yandexRequestQueue = request.catch(() => undefined);
  return request;
}

async function reverseGeocodeWithYandex(coordinate, locale) {
  return runYandexRequest(async () => {
    const integration = loadYandexGeocoder(locale);
    if (!integration.ready) throw new Error();

    await integration.initialization;
    const mapKitLocale = toYandexMapKitLocale(locale);
    let effectiveLocale = await integration.YamapInstance.getLocale();
    if (!mapKitLocaleMatchesAppLocale(effectiveLocale, locale)) {
      await integration.YamapInstance.setLocale(mapKitLocale);
      effectiveLocale = await integration.YamapInstance.getLocale();
    }
    if (!mapKitLocaleMatchesAppLocale(effectiveLocale, locale)) throw new Error();

    let timeoutId;
    try {
      return await Promise.race([
        integration.Search.geocodePoint({ lat: coordinate.latitude, lon: coordinate.longitude }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error()), YANDEX_GEOCODER_TIMEOUT_MS);
        })
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

function getNativeLocale() {
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

export function reverseGeocodeLocation(request) {
  return resolveReverseGeocode(request, {
    localizedReverseGeocode: reverseGeocodeWithYandex,
    nativeReverseGeocode: reverseGeocodeWithTimeout,
    getNativeLocale
  });
}
