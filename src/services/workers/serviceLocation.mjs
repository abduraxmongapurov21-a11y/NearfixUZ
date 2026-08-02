function finiteCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? numeric : null;
}

export function normalizeServiceLocation(value) {
  const latitude = finiteCoordinate(value?.latitude ?? value?.serviceLat, -90, 90);
  const longitude = finiteCoordinate(value?.longitude ?? value?.serviceLng, -180, 180);

  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

export function buildServiceLocationPayload(value) {
  const location = normalizeServiceLocation(value);
  if (!location) return null;

  return {
    serviceLat: location.latitude,
    serviceLng: location.longitude
  };
}

export function createSubmissionGuard() {
  let active = false;

  return {
    tryStart() {
      if (active) return false;
      active = true;
      return true;
    },
    finish() {
      active = false;
    },
    isActive() {
      return active;
    }
  };
}

export async function submitServiceLocationOnce({ guard, location, submit, onStart }) {
  const payload = buildServiceLocationPayload(location);
  if (!payload) return { ok: false, code: "INVALID_SERVICE_LOCATION", message: "Lokatsiyani saqlab bo'lmadi." };
  if (!guard.tryStart()) return { ok: false, code: "SAVE_IN_PROGRESS" };

  onStart?.();
  try {
    return await submit(payload);
  } catch (error) {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: error?.message || "Lokatsiyani saqlab bo'lmadi."
    };
  } finally {
    guard.finish();
  }
}
