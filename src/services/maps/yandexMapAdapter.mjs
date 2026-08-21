const DEFAULT_ZOOM = 16;

function roundCoordinate(value) {
  return Number(value.toFixed(7));
}

export function toCanonicalCoordinate(value) {
  const source = value?.nativeEvent?.point || value?.point || value;
  const latitude = Number(source?.latitude ?? source?.lat);
  const longitude = Number(source?.longitude ?? source?.lon);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude)
  };
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
