import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeLocale } from "../../i18n";

export const UI_SETTINGS_STORAGE_KEY = "nearfix-ui-settings";

export function parsePersistedLocale(value, fallbackLocale) {
  if (typeof value !== "string" || !value.trim()) return normalizeLocale(fallbackLocale);

  try {
    return normalizeLocale(JSON.parse(value)?.state?.locale || fallbackLocale);
  } catch {
    return normalizeLocale(fallbackLocale);
  }
}

export async function readPersistedLocale(fallbackLocale) {
  try {
    const value = await AsyncStorage.getItem(UI_SETTINGS_STORAGE_KEY);
    return parsePersistedLocale(value, fallbackLocale);
  } catch {
    return normalizeLocale(fallbackLocale);
  }
}

export async function persistLocale(locale) {
  await AsyncStorage.setItem(
    UI_SETTINGS_STORAGE_KEY,
    JSON.stringify({ state: { locale: normalizeLocale(locale) }, version: 0 })
  );
}
