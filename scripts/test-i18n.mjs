import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createInstance } from "i18next";
import { WORKER_APPLICATION_STATES, workerApplicationStatusCopy } from "../src/services/workers/workerApplicationState.mjs";

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
assert.equal(instance.t("Xayrli tong,"), "Xayrli tong,");
assert.equal(instance.t("Xayrli kun, {{value0}}!", { value0: "Oybek" }), "Xayrli kun, Oybek!");
assert.equal(instance.t("{{value0}} ta manzil", { value0: 3 }), "3 ta manzil");
for (const state of WORKER_APPLICATION_STATES) {
  const copy = workerApplicationStatusCopy(state);
  assert.notEqual(copy, state);
  assert.equal(instance.exists(copy), true);
}
assert.equal(instance.t(workerApplicationStatusCopy("FUTURE_STATE")), "Noma'lum");

await instance.changeLanguage("en");
assert.equal(instance.t("Uy"), "Home");
assert.equal(instance.t("Bosh"), "Home");
assert.equal(instance.t("Usta"), "Professional");
assert.equal(instance.t("Xayrli tong,"), "good morning,");
assert.equal(instance.t("Xayrli kun, {{value0}}!", { value0: "Oybek" }), "Good day, Oybek!");
assert.equal(instance.t("{{value0}} ta manzil", { value0: 3 }), "3 addresses");
assert.deepEqual(WORKER_APPLICATION_STATES.map((state) => instance.t(workerApplicationStatusCopy(state))), ["Draft", "Submitted", "Rejected", "Approved", "Suspended"]);
assert.equal(instance.t(workerApplicationStatusCopy("FUTURE_STATE")), "Unknown");

await instance.changeLanguage("ru");
assert.deepEqual(WORKER_APPLICATION_STATES.map((state) => instance.t(workerApplicationStatusCopy(state))), ["Черновик", "Отправлено", "Отклонено", "Одобрено", "Приостановлено"]);
assert.equal(instance.t(workerApplicationStatusCopy("FUTURE_STATE")), "Неизвестно");
assert.equal(instance.t("Uy"), "Главная");
assert.equal(instance.t("Bosh"), "Главная");
assert.equal(instance.t("Usta"), "Специалист");
assert.equal(instance.t("Xayrli tong,"), "доброе утро,");
assert.equal(instance.t("Xayrli kun, {{value0}}!", { value0: "Oybek" }), "Добрый день, Oybek!");
assert.equal(instance.t("{{value0}} ta manzil", { value0: 3 }), "3 адреса");

console.log("i18n runtime smoke tests passed for uz, en and ru.");
