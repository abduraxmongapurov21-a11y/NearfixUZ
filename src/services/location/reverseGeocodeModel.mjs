function cleanSegment(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/gu, " ").trim().replace(/^[,;\s]+|[,;\s]+$/gu, "");
  return cleaned || null;
}

function segmentKey(value) {
  return value.toLocaleLowerCase("uz").replace(/[\s,.;]+/gu, " ").trim();
}

export function isCoordinateLikeAddress(value) {
  const cleaned = cleanSegment(value);
  if (!cleaned) return false;

  const normalized = cleaned.replace(/[−–—]/gu, "-");
  const numericTokens = normalized.match(/[+-]?\d{1,3}(?:\.\d+)?/gu) || [];
  if (numericTokens.length !== 2) return false;

  const values = numericTokens.map(Number);
  const inCoordinateRange =
    (Math.abs(values[0]) <= 90 && Math.abs(values[1]) <= 180) ||
    (Math.abs(values[1]) <= 90 && Math.abs(values[0]) <= 180);
  if (!inCoordinateRange) return false;

  const hasCoordinateLabel = /(?:latitude|longitude|lat|lng|long)\s*[:=]?|[°º]|\b[NSWE]\b/iu.test(normalized);
  const hasPreciseDecimals = numericTokens.every((token) => /\.\d{3,}$/u.test(token));
  if (!hasCoordinateLabel && !hasPreciseDecimals) return false;

  const remainder = normalized
    .replace(/(?:latitude|longitude|lat|lng|long)\s*[:=]?/giu, "")
    .replace(/[+-]?\d{1,3}(?:\.\d+)?/gu, "")
    .replace(/[\s,;/|()[\]{}°ºNSEW:=+-]/giu, "");

  return remainder.length === 0;
}

function uniqueSegments(values) {
  const seen = new Set();
  const segments = [];

  for (const value of values) {
    const segment = cleanSegment(value);
    if (!segment) continue;
    if (isCoordinateLikeAddress(segment)) continue;
    const key = segmentKey(segment);
    if (seen.has(key)) continue;
    seen.add(key);
    segments.push(segment);
  }

  return segments;
}

function buildStreetLine(address) {
  const street = cleanSegment(address?.street);
  const streetNumber = cleanSegment(address?.streetNumber);
  const name = cleanSegment(address?.name);

  if (street && !isCoordinateLikeAddress(street)) {
    if (!streetNumber || segmentKey(street).includes(segmentKey(streetNumber))) return street;
    return `${street} ${streetNumber}`;
  }

  if (!name || isCoordinateLikeAddress(name)) return null;
  if (!streetNumber || segmentKey(name).includes(segmentKey(streetNumber))) return name;
  return `${name} ${streetNumber}`;
}

export function normalizeCoordinate(value) {
  if (
    value?.latitude === null ||
    value?.latitude === undefined ||
    value?.latitude === "" ||
    value?.longitude === null ||
    value?.longitude === undefined ||
    value?.longitude === ""
  ) {
    return null;
  }
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;

  return {
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7))
  };
}

export function coordinatesMatch(first, second) {
  const normalizedFirst = normalizeCoordinate(first);
  const normalizedSecond = normalizeCoordinate(second);
  return Boolean(
    normalizedFirst &&
      normalizedSecond &&
      normalizedFirst.latitude === normalizedSecond.latitude &&
      normalizedFirst.longitude === normalizedSecond.longitude
  );
}

export function formatReverseGeocodeAddress(address) {
  if (!address || typeof address !== "object") return null;

  const structuredSegments = uniqueSegments([
    buildStreetLine(address),
    address.district,
    address.subregion,
    address.city,
    address.region,
    address.country,
    address.postalCode
  ]);

  if (structuredSegments.length) return structuredSegments.join(", ");
  const formattedAddress = cleanSegment(address.formattedAddress);
  return formattedAddress && !isCoordinateLikeAddress(formattedAddress) ? formattedAddress : null;
}

export function normalizeReverseGeocodeResult(results) {
  if (!Array.isArray(results)) return null;

  for (const candidate of results) {
    const address = formatReverseGeocodeAddress(candidate);
    if (!address) continue;

    return {
      address,
      ...(cleanSegment(candidate.city) ? { city: cleanSegment(candidate.city) } : {}),
      ...(cleanSegment(candidate.district || candidate.subregion)
        ? { district: cleanSegment(candidate.district || candidate.subregion) }
        : {}),
      ...(cleanSegment(candidate.street) ? { street: cleanSegment(candidate.street) } : {}),
      ...(cleanSegment(candidate.postalCode) ? { postalCode: cleanSegment(candidate.postalCode) } : {})
    };
  }

  return null;
}

export async function resolveReverseGeocode(coordinate, reverseGeocodeAsync) {
  const normalizedCoordinate = normalizeCoordinate(coordinate);
  if (!normalizedCoordinate) {
    return { ok: false, code: "invalid.coordinates", coordinate: null };
  }

  if (typeof reverseGeocodeAsync !== "function") {
    return { ok: false, code: "geocoder.unavailable", coordinate: normalizedCoordinate };
  }

  try {
    const results = await reverseGeocodeAsync(normalizedCoordinate);
    const location = normalizeReverseGeocodeResult(results);
    if (!location) {
      return { ok: false, code: "address.not-found", coordinate: normalizedCoordinate };
    }

    return {
      ok: true,
      coordinate: normalizedCoordinate,
      location,
      selectedLocation: { ...normalizedCoordinate, ...location }
    };
  } catch {
    return { ok: false, code: "geocoder.unavailable", coordinate: normalizedCoordinate };
  }
}

export function createLatestReverseGeocodeController(reverseGeocode) {
  let generation = 0;
  let latestCoordinate = null;

  return {
    async resolve(coordinate) {
      const requestGeneration = ++generation;
      latestCoordinate = normalizeCoordinate(coordinate);
      const result = await reverseGeocode(coordinate);

      return {
        ...result,
        stale: requestGeneration !== generation || !coordinatesMatch(result.coordinate, latestCoordinate)
      };
    },
    invalidate() {
      generation += 1;
    },
    currentCoordinate() {
      return latestCoordinate ? { ...latestCoordinate } : null;
    }
  };
}
