import Constants from "expo-constants";
import { readPersistedLocale } from "../app/localeStorage";
import { initializeYandexMapKitLocale } from "./yandexLocaleLifecycle.mjs";

let cachedIntegration;
let cachedGeocoder;

export function loadYandexMapKit(locale) {
  if (cachedIntegration) return cachedIntegration;

  const apiKey = Constants.expoConfig?.extra?.yandexMapKitApiKey;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    cachedIntegration = { ready: false, reason: "missing-key" };
    return cachedIntegration;
  }

  try {
    // The package root eagerly imports optional Search/Suggest TurboModules.
    // Loading only the map APIs keeps an unavailable optional module from
    // crashing Expo Go or an older development binary before this fallback runs.
    const { Yamap } = require("react-native-yamap-plus/src/components/Yamap/Yamap");
    const { YamapInstance } = require("react-native-yamap-plus/src/modules/YamapInstance");
    const initialization = initializeYandexMapKitLocale({
      currentLocale: locale,
      readLocale: readPersistedLocale,
      setNativeLocale: (mapKitLocale) => YamapInstance.setLocale(mapKitLocale),
      initializeNative: () => YamapInstance.init(apiKey)
    });
    void initialization.catch(() => undefined);
    cachedIntegration = { ready: true, MapComponent: Yamap, YamapInstance, initialization };
  } catch {
    cachedIntegration = { ready: false, reason: "native-module-unavailable" };
  }

  return cachedIntegration;
}

export function loadYandexGeocoder(locale) {
  if (cachedGeocoder) return cachedGeocoder;

  const mapKit = loadYandexMapKit(locale);
  if (!mapKit.ready) {
    cachedGeocoder = mapKit;
    return cachedGeocoder;
  }

  try {
    const { Search } = require("react-native-yamap-plus/src/modules/Search");
    cachedGeocoder = {
      ready: true,
      Search,
      YamapInstance: mapKit.YamapInstance,
      initialization: mapKit.initialization
    };
  } catch {
    cachedGeocoder = { ready: false, reason: "search-module-unavailable" };
  }

  return cachedGeocoder;
}
