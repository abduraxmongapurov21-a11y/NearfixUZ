export const OPERATIONAL_COUNTRY_CODE = "UZ";

export const COUNTRIES = Object.freeze([
  Object.freeze({ code: "UZ", flag: "🇺🇿", nameKey: "O'zbekiston", statusKey: "Mavjud", available: true }),
  Object.freeze({ code: "KZ", flag: "🇰🇿", nameKey: "Qozog'iston", statusKey: "Tez orada", available: false }),
  Object.freeze({ code: "RU", flag: "🇷🇺", nameKey: "Rossiya", statusKey: "Tez orada", available: false }),
  Object.freeze({ code: "TR", flag: "🇹🇷", nameKey: "Turkiya", statusKey: "Tez orada", available: false }),
  Object.freeze({ code: "KR", flag: "🇰🇷", nameKey: "Janubiy Koreya", statusKey: "Tez orada", available: false })
]);

export function getCountrySelectionOutcome(countryCode) {
  const country = COUNTRIES.find((item) => item.code === countryCode);
  if (!country) throw new Error(`Unknown country code: ${countryCode}`);

  return Object.freeze({
    activeCountryCode: OPERATIONAL_COUNTRY_CODE,
    closeSelector: country.available,
    showUnavailable: !country.available
  });
}

export function applyCountrySelection(countryCode, { closeSelector, showUnavailable } = {}) {
  const outcome = getCountrySelectionOutcome(countryCode);

  if (outcome.closeSelector) closeSelector?.();
  if (outcome.showUnavailable) showUnavailable?.();

  return outcome.activeCountryCode;
}
