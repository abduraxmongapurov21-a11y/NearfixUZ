import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createInstance } from "i18next";

const root = process.cwd();
const locales = Object.fromEntries(
  ["uz", "en", "ru"].map((language) => [
    language,
    {
      translation: JSON.parse(fs.readFileSync(path.join(root, "src", "i18n", "locales", `${language}.json`), "utf8"))
    }
  ])
);
const instance = createInstance();

await instance.init({
  resources: locales,
  lng: "uz",
  fallbackLng: "uz",
  supportedLngs: ["uz", "en", "ru"],
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false }
});

assert.equal(instance.t("Uy"), "Uy");
assert.equal(instance.t("{{value0}} ta manzil", { value0: 3 }), "3 ta manzil");

await instance.changeLanguage("en");
assert.equal(instance.t("Uy"), "Home");
assert.equal(instance.t("Bosh"), "Home");
assert.equal(instance.t("Usta"), "Professional");
assert.equal(instance.t("{{value0}} ta manzil", { value0: 3 }), "3 addresses");

await instance.changeLanguage("ru");
assert.equal(instance.t("Uy"), "Главная");
assert.equal(instance.t("Bosh"), "Главная");
assert.equal(instance.t("Usta"), "Специалист");
assert.equal(instance.t("{{value0}} ta manzil", { value0: 3 }), "3 адреса");

console.log("i18n runtime smoke tests passed for uz, en and ru.");
