import { hasAddressCoordinates } from "../catalog/catalogDistance.mjs";

export async function getCatalogDeviceLocation(locationApi, { requestPermission = true, timeoutMs = 12000 } = {}) {
  let timeout;
  try {
    let permission = await locationApi.getForegroundPermissionsAsync();
    if (!permission.granted && requestPermission && permission.canAskAgain !== false) {
      permission = await locationApi.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return { ok: false, code: "LOCATION_PERMISSION_DENIED" };
    if (!(await locationApi.hasServicesEnabledAsync())) return { ok: false, code: "LOCATION_UNAVAILABLE" };
    const result = await Promise.race([
      locationApi.getCurrentPositionAsync({ accuracy: locationApi.Accuracy.Balanced }),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Location timeout")), timeoutMs); })
    ]);
    if (!hasAddressCoordinates(result?.coords)) return { ok: false, code: "LOCATION_UNAVAILABLE" };
    return { ok: true, coordinates: { lat: Number(result.coords.latitude), lng: Number(result.coords.longitude) } };
  } catch {
    return { ok: false, code: "LOCATION_UNAVAILABLE" };
  } finally {
    clearTimeout(timeout);
  }
}
