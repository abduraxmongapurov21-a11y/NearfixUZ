export const ADDRESS_PRESET_IDS = Object.freeze(["home", "office", "work", "parentsHome"]);

const ADDRESS_PRESET_LABEL_KEYS = Object.freeze({
  home: "addressPreset.home",
  office: "addressPreset.office",
  work: "addressPreset.work",
  parentsHome: "addressPreset.parentsHome"
});

const LEGACY_ADDRESS_PRESET_IDS = Object.freeze({
  Uy: "home",
  Ofis: "office",
  Ish: "work",
  "Ota-ona uyi": "parentsHome"
});

export function getAddressPresetLabel(presetId, translate) {
  return translate(ADDRESS_PRESET_LABEL_KEYS[presetId]);
}

export function applyAddressPreset(draft, presetId, translate) {
  return { ...draft, title: getAddressPresetLabel(presetId, translate) };
}

export function isAddressPresetActive(title, presetId, translate) {
  return title === getAddressPresetLabel(presetId, translate);
}

export function localizeLegacyAddressPresetTitle(title, translate) {
  const presetId = LEGACY_ADDRESS_PRESET_IDS[title];
  return presetId ? getAddressPresetLabel(presetId, translate) : title;
}
