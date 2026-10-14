import { normalizeCoordinate } from "../location/reverseGeocodeModel.mjs";

const DEFAULT_ZOOM = 16;

export function toCanonicalCoordinate(value) {
  const source = value?.nativeEvent?.point || value?.point || value;
  return normalizeCoordinate({
    latitude: source?.latitude ?? source?.lat,
    longitude: source?.longitude ?? source?.lon
  });
}

export function toYandexPoint(coordinate) {
  const canonical = toCanonicalCoordinate(coordinate);
  if (!canonical) return null;

  return {
    lat: canonical.latitude,
    lon: canonical.longitude
  };
}

export function toYandexInitialRegion(coordinate, zoom = DEFAULT_ZOOM) {
  const point = toYandexPoint(coordinate);
  if (!point) return null;

  return {
    ...point,
    zoom,
    azimuth: 0,
    tilt: 0
  };
}

export { DEFAULT_ZOOM };
