export type Coordinates = {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_METERS = 6_371_008.8;

function assertCoordinates({ lat, lng }: Coordinates) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new RangeError("Latitude must be a finite number between -90 and 90");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new RangeError("Longitude must be a finite number between -180 and 180");
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceMeters(origin: Coordinates, destination: Coordinates) {
  assertCoordinates(origin);
  assertCoordinates(destination);

  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);
  const latitudeDelta = destinationLat - originLat;
  const longitudeDelta = toRadians(destination.lng - origin.lng);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(longitudeDelta / 2) ** 2;
  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
  const distance = Math.round(EARTH_RADIUS_METERS * angularDistance);

  if (!Number.isFinite(distance) || distance < 0) {
    throw new RangeError("Calculated distance is invalid");
  }

  return distance;
}
