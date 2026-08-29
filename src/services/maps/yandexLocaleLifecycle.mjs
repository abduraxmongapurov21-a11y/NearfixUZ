import { mapKitLocaleMatchesAppLocale, toYandexMapKitLocale } from "../location/reverseGeocodeModel.mjs";

export const IOS_YANDEX_LOCALE_RELAUNCH_REQUIRED = "yandex.locale-relaunch-required";

export async function initializeYandexMapKitLocale({
  currentLocale,
  readLocale,
  setNativeLocale,
  initializeNative
}) {
  const appLocale = await readLocale(currentLocale);
  const mapKitLocale = toYandexMapKitLocale(appLocale);

  if (mapKitLocale) await setNativeLocale(mapKitLocale);
  await initializeNative();

  return { appLocale, mapKitLocale };
}

export function getYandexLocaleTransition({ platform, initializedLocale, requestedLocale }) {
  const requestedMapKitLocale = toYandexMapKitLocale(requestedLocale);
  if (!requestedMapKitLocale) return { action: "native-provider" };
  if (mapKitLocaleMatchesAppLocale(initializedLocale, requestedLocale)) {
    return { action: "use-initialized", mapKitLocale: requestedMapKitLocale };
  }
  if (platform === "ios") {
    return { action: "cold-relaunch-required", mapKitLocale: requestedMapKitLocale };
  }
  return { action: "set-runtime", mapKitLocale: requestedMapKitLocale };
}

export function createIosYandexLocaleRelaunchError() {
  return Object.assign(new Error(IOS_YANDEX_LOCALE_RELAUNCH_REQUIRED), {
    code: IOS_YANDEX_LOCALE_RELAUNCH_REQUIRED,
    preventFallback: true
  });
}
