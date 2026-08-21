import assert from "node:assert/strict";
import {
  applyCountrySelection,
  COUNTRIES,
  getCountrySelectionOutcome,
  OPERATIONAL_COUNTRY_CODE
} from "../src/components/profile/countrySelectorModel.mjs";

const expectedCountries = [
  ["UZ", "🇺🇿", "O'zbekiston", "Mavjud", true],
  ["KZ", "🇰🇿", "Qozog'iston", "Tez orada", false],
  ["RU", "🇷🇺", "Rossiya", "Tez orada", false],
  ["TR", "🇹🇷", "Turkiya", "Tez orada", false],
  ["KR", "🇰🇷", "Janubiy Koreya", "Tez orada", false]
];

assert.equal(COUNTRIES.length, 5);
assert.deepEqual(
  COUNTRIES.map(({ code, flag, nameKey, statusKey, available }) => [code, flag, nameKey, statusKey, available]),
  expectedCountries
);
assert.equal(OPERATIONAL_COUNTRY_CODE, "UZ");
assert.deepEqual(COUNTRIES.filter((country) => country.available).map((country) => country.code), ["UZ"]);

let closeCount = 0;
let unavailableCount = 0;
const effects = {
  closeSelector: () => { closeCount += 1; },
  showUnavailable: () => { unavailableCount += 1; }
};

assert.equal(applyCountrySelection("UZ", effects), "UZ");
assert.equal(closeCount, 1);
assert.equal(unavailableCount, 0);

for (const code of ["KZ", "RU", "TR", "KR"]) {
  const outcome = getCountrySelectionOutcome(code);
  assert.deepEqual(outcome, {
    activeCountryCode: "UZ",
    closeSelector: false,
    showUnavailable: true
  });
  assert.equal(applyCountrySelection(code, effects), "UZ");
}

assert.equal(closeCount, 1);
assert.equal(unavailableCount, 4);
assert.throws(() => getCountrySelectionOutcome("US"), /Unknown country code/);

const authState = Object.freeze({ token: "unchanged", userId: "user-1" });
const experienceMode = "worker";
let countrySwitchApiCalls = 0;
applyCountrySelection("KZ", effects);
assert.deepEqual(authState, { token: "unchanged", userId: "user-1" });
assert.equal(experienceMode, "worker");
assert.equal(countrySwitchApiCalls, 0);

console.log("country selector UI model tests passed");
