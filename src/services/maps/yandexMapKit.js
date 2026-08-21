import Constants from "expo-constants";

let cachedIntegration;

export function loadYandexMapKit() {
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
    YamapInstance.init(apiKey);
    cachedIntegration = { ready: true, MapComponent: Yamap };
  } catch {
    cachedIntegration = { ready: false, reason: "native-module-unavailable" };
  }

  return cachedIntegration;
}
