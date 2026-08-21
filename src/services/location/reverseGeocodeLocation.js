import * as Location from "expo-location";
import { resolveReverseGeocode } from "./reverseGeocodeModel.mjs";

const NATIVE_GEOCODER_TIMEOUT_MS = 8000;

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

export function reverseGeocodeLocation(coordinate) {
  return resolveReverseGeocode(coordinate, reverseGeocodeWithTimeout);
}
