function finiteCoordinate(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

export function normalizeBookingMapSelection(value) {
  const latitude = finiteCoordinate(value?.latitude, -90, 90);
  const longitude = finiteCoordinate(value?.longitude, -180, 180);
  const addressText = typeof value?.address === "string" ? value.address.trim() : "";
  if (latitude === null || longitude === null || addressText.length < 4) return null;

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
