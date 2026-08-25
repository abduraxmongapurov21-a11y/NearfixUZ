import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ADDRESS_PRESET_IDS,
  applyAddressPreset,
  getAddressPresetLabel,
  isAddressPresetActive,
  localizeLegacyAddressPresetTitle
} from "../src/screens/profile/addressPresets.mjs";

const expectedLabels = {
  uz: ["Uy", "Ofis", "Ish", "Ota-ona uyi"],
  ru: ["Дом", "Офис", "Работа", "Родительский дом"],
  en: ["Home", "Office", "Work", "Parents' home"]
};
const legacyTitles = ["Uy", "Ofis", "Ish", "Ota-ona uyi"];

for (const locale of ["uz", "ru", "en"]) {
  const translations = JSON.parse(fs.readFileSync(`src/i18n/locales/${locale}.json`, "utf8"));
  const translate = (key) => translations[key];
  const labels = ADDRESS_PRESET_IDS.map((presetId) => getAddressPresetLabel(presetId, translate));
  assert.deepEqual(labels, expectedLabels[locale], `${locale}: localized chip labels`);

  for (const [index, presetId] of ADDRESS_PRESET_IDS.entries()) {
    const label = expectedLabels[locale][index];
    const createdDraft = applyAddressPreset({ title: "" }, presetId, translate);
    const editedDraft = applyAddressPreset({ title: "Custom title", address: "Saved address" }, presetId, translate);

    assert.equal(createdDraft.title, label, `${locale}: create selected value`);
    assert.equal(editedDraft.title, label, `${locale}: edit selected value`);
    assert.equal(editedDraft.address, "Saved address", `${locale}: edit preserves other fields`);
    assert.equal(isAddressPresetActive(label, presetId, translate), true, `${locale}: active comparison`);
    assert.equal(
      localizeLegacyAddressPresetTitle(legacyTitles[index], translate),
      label,
      `${locale}: legacy edit prefill`
    );
  }

  assert.equal(
    localizeLegacyAddressPresetTitle("Uy yonidagi yangi uy", translate),
    "Uy yonidagi yangi uy",
    `${locale}: custom edit title remains unchanged`
  );
}

console.log("Address preset create/edit localization tests passed for uz, ru, and en.");
