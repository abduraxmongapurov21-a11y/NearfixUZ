function finiteCoordinate(value, minimum, maximum) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

export const GENERIC_BOOKING_PROBLEMS = Object.freeze([
  "Ta'mirlash kerak",
  "Ishlamayapti",
  "O'rnatish kerak",
  "Almashtirish kerak",
  "Tekshirib berish kerak",
  "Boshqa"
]);

export function bookingProblemOptions(category) {
  return category?.id ? [...GENERIC_BOOKING_PROBLEMS] : [];
}

export function categoryBookingDraft({ category, worker, problemTitle, locationDraft }) {
  if (!category?.id || !worker?.id || !problemTitle || !locationDraft) return null;
  return {
    selectedWorkerId: worker.id,
    serviceId: category.id,
    problemTitle,
    description: undefined,
    ...locationDraft
  };
}

export function normalizeBookingMapSelection(value) {
  const latitude = finiteCoordinate(value?.latitude, -90, 90);
  const longitude = finiteCoordinate(value?.longitude, -180, 180);
  const addressText = typeof value?.address === "string" ? value.address.trim() : "";
  if (latitude === null || longitude === null) return null;

  return {
    latitude,
    longitude,
    addressText,
    ...(typeof value?.locale === "string" || value?.locale === null ? { locale: value.locale } : {}),
    ...(typeof value?.source === "string" && value.source ? { source: value.source } : {}),
    ...(typeof value?.district === "string" && value.district.trim()
      ? { district: value.district.trim() }
      : {})
  };
}

// Presentation only: never copy this fallback into the location snapshot.
export function orderLocationDisplayText(location) {
  if (location?.addressText?.trim()) return location.addressText;
  return finiteCoordinate(location?.latitude, -90, 90) !== null &&
    finiteCoordinate(location?.longitude, -180, 180) !== null
    ? "Xaritada belgilangan joy"
    : "Manzil ma'lumoti yo'q";
}

export function sortBookingAddresses(addresses) {
  return (addresses || [])
    .map((address, index) => ({ address, index }))
    .sort((first, second) => {
      const defaultDifference = Number(Boolean(second.address.isDefault)) - Number(Boolean(first.address.isDefault));
      if (defaultDifference) return defaultDifference;
      return first.index - second.index || String(first.address.id).localeCompare(String(second.address.id));
    })
    .map(({ address }) => address);
}

export function bookingLocationDraft(savedAddress, oneTimeLocation) {
  if (oneTimeLocation) {
    return {
      addressId: null,
      location: oneTimeLocation,
      address: oneTimeLocation.addressText
    };
  }
  if (!savedAddress?.id) return null;
  return {
    addressId: savedAddress.id,
    location: null,
    address: savedAddress.addressText || savedAddress.address || ""
  };
}

export async function createOrderThenOptionallySave({ createOrder, saveAddress, shouldSave }) {
  const orderResult = await createOrder();
  if (!orderResult?.ok || !shouldSave) return { orderResult, saveResult: null };

  try {
    return { orderResult, saveResult: await saveAddress() };
  } catch (error) {
    return { orderResult, saveResult: { ok: false, message: error?.message } };
  }
}

export function createBookingSubmissionLock() {
  let locked = false;
  return {
    acquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    }
  };
}
