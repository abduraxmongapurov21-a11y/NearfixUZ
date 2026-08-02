export function normalizeDistanceMeters(value) {
  if (value === null || value === undefined || value === "") return null;
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance < 0) return null;
  return Math.round(distance);
}

export function formatDistanceMeters(value) {
  const distance = normalizeDistanceMeters(value);
  if (distance === null) return "Masofa aniqlanmagan";
  if (distance < 1000) return `${distance} m`;

  const kilometers = Math.round(distance / 100) / 10;
  return `${kilometers} km`;
}

export function formatApproximateDistance(value) {
  const distance = normalizeDistanceMeters(value);
  return distance === null ? "Masofa aniqlanmagan" : `${formatDistanceMeters(distance)} uzoqlikda`;
}

export function hasAddressCoordinates(address) {
  const rawLatitude = address?.lat ?? address?.latitude;
  const rawLongitude = address?.lng ?? address?.longitude;
  if (
    rawLatitude === null ||
    rawLatitude === undefined ||
    (typeof rawLatitude === "string" && rawLatitude.trim() === "") ||
    rawLongitude === null ||
    rawLongitude === undefined ||
    (typeof rawLongitude === "string" && rawLongitude.trim() === "")
  ) {
    return false;
  }

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function resolveCatalogOriginAddressId(currentAddressId, addresses = []) {
  const eligibleAddresses = addresses.filter(hasAddressCoordinates);
  const selected = eligibleAddresses.find((address) => address.id === currentAddressId);
  if (selected) return selected.id;

  return eligibleAddresses.find((address) => address.isDefault)?.id || eligibleAddresses[0]?.id || null;
}

export function shouldApplyCatalogResponse(responseVersion, activeVersion) {
  return responseVersion === activeVersion;
}
