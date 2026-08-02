function toCoordinate(value, min, max) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function mapApiAddress(address) {
  const latitude = toCoordinate(address.lat, -90, 90);
  const longitude = toCoordinate(address.lng, -180, 180);
  const hasCoordinatePair = latitude !== null && longitude !== null;
  const lat = hasCoordinatePair ? latitude : null;
  const lng = hasCoordinatePair ? longitude : null;

  return {
    id: address.id,
    title: address.title || address.label || "Manzil",
    label: address.title || address.label || "Manzil",
    address: address.address || address.addressText || "",
    addressText: address.address || address.addressText || "",
    district: address.district,
    cityId: address.cityId,
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    isDefault: Boolean(address.isDefault)
  };
}
