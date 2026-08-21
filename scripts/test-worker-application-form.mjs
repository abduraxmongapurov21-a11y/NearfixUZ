import assert from "node:assert/strict";
import {
  formatGroupedDigits,
  missingWorkerApplicationFields,
  normalizeDigits,
  toggleProfessionSelection,
  workerApplicationPayload,
  workerApplicationErrorMessage
} from "../src/services/workers/workerApplicationForm.mjs";

assert.equal(formatGroupedDigits("1000"), "1 000");
assert.equal(formatGroupedDigits("200000"), "200 000");
assert.equal(formatGroupedDigits("1 000 000"), "1 000 000");
assert.equal(normalizeDigits("2 500 000 so'm"), "2500000");

let selection = toggleProfessionSelection([], "Elektrik");
selection = toggleProfessionSelection(selection.professions, "Santexnik");
assert.deepEqual(selection.professions, ["Elektrik", "Santexnik"]);
selection = toggleProfessionSelection(selection.professions, "Elektrik");
assert.deepEqual(selection.professions, ["Santexnik"]);
const full = ["A", "B", "C", "D", "E"];
assert.deepEqual(toggleProfessionSelection(full, "F"), { professions: full, limitReached: true });

const complete = {
  name: "Test Usta",
  cityId: "tashkent",
  professions: ["Elektrik", "Santexnik"],
  experienceYears: "5",
  profileImageUrl: "https://example.com/photo.jpg",
  bio: "Tajribali mutaxassis",
  basePrice: "200000"
};
assert.deepEqual(workerApplicationPayload(complete), {
  name: "Test Usta",
  cityId: "tashkent",
  profession: "Elektrik",
  professions: ["Elektrik", "Santexnik"],
  experienceYears: 5,
  profileImageUrl: "https://example.com/photo.jpg",
  bio: "Tajribali mutaxassis",
  basePrice: 200000
});
assert.deepEqual(missingWorkerApplicationFields(complete), []);
assert.ok(missingWorkerApplicationFields({ ...complete, professions: [], bio: "" }).includes("Xizmat sohasi"));
assert.match(workerApplicationErrorMessage({ status: 404 }), /API serverda topilmadi/);
assert.match(workerApplicationErrorMessage({ code: "NETWORK_REQUEST_FAILED" }), /Backend bilan aloqa/);

console.log("Worker application multi-select, price formatting, validation, and API error tests passed.");
