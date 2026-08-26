import AsyncStorage from "@react-native-async-storage/async-storage";
import { categoryAvailabilityFromCache } from "./categoryAvailability.mjs";

const CATEGORY_CACHE_KEY = "nearfix:categories:v1";

export async function loadCategoryCache() {
  try {
    const value = await AsyncStorage.getItem(CATEGORY_CACHE_KEY);
    return value ? categoryAvailabilityFromCache(JSON.parse(value)) : null;
  } catch {
    return null;
  }
}

export async function saveCategoryCache(payload) {
  try {
    await AsyncStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // A cache write must never turn a successful public API response into a failure.
  }
}
