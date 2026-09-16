const UZBEK_COUNTRY_CODE = "998";
const UZBEK_NATIONAL_NUMBER_LENGTH = 9;

export function normalizeWorkerPhone(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || !/^\+?[\d\s().-]+$/.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, "");
  const normalizedDigits = digits.startsWith(UZBEK_COUNTRY_CODE)
    ? digits
    : digits.length === UZBEK_NATIONAL_NUMBER_LENGTH
      ? `${UZBEK_COUNTRY_CODE}${digits}`
      : "";

  return /^998\d{9}$/.test(normalizedDigits) ? `+${normalizedDigits}` : null;
}

export function formatWorkerPhone(value) {
  const phone = normalizeWorkerPhone(value);
  if (!phone) return null;

  return `${phone.slice(0, 4)} ${phone.slice(4, 6)} ${phone.slice(6, 9)} ${phone.slice(9, 11)} ${phone.slice(11)}`;
}
