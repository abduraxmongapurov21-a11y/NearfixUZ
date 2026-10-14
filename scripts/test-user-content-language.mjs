import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import React from "react";
import { transformSync } from "@babel/core";
import { createInstance } from "i18next";
import { workerExperienceLabel } from "../src/utils/workerExperience.mjs";

function source(path) { return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }
const i18n = createInstance();
await i18n.init({
  resources: Object.fromEntries(["uz", "en", "ru"].map((language) => [language, { translation: JSON.parse(source(`src/i18n/locales/${language}.json`)) }])),
  lng: "uz", fallbackLng: "uz", keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false }
});
const translatedYears = {
  uz: ["1 yil", "2 yil", "9 yil", "21 yil"],
  en: ["1 year", "2 years", "9 years", "21 years"],
  ru: ["1 год", "2 года", "9 лет", "21 год"]
};
for (const language of ["uz", "en", "ru"]) {
  await i18n.changeLanguage(language);
  assert.deepEqual([1, 2, 9, 21].map((years) => workerExperienceLabel(`${years} yil`, (...args) => i18n.t(...args))), translatedYears[language]);
}
await i18n.changeLanguage("en");
assert.equal(i18n.t("{{value0}} ta o'qilmagan xabar", { value0: 1, count: 1 }), "1 unread message");
assert.equal(i18n.t("{{value0}} ta o'qilmagan xabar", { value0: 2, count: 2 }), "2 unread messages");
const nativeText = source("src/i18n/native.js").replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
const compiled = transformSync(nativeText, { configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-react-jsx"] }).code;
for (const [language, translatedUy] of [["uz", "Uy"], ["en", "Home"], ["ru", "Главная"]]) {
  const context = vm.createContext({
    React,
    forwardRef: (render) => ({ render }),
    NativeText: "native-text", NativeTextInput: "native-input", NativeAlert: {},
    useTranslation() {},
    translateCopy: (value) => value === "Uy" ? translatedUy : value
  });
  vm.runInContext(compiled + "\nglobalThis.localizedText = Text;", context);
  assert.equal(context.localizedText.render({ children: "Uy", translate: false }).props.children, "Uy", `${language}: a user's name/message remains unchanged`);
  assert.equal(context.localizedText.render({ children: "Uy" }).props.children, translatedUy, `${language}: UI copy is still translated`);
}
const profile = source("src/screens/profile/ClientProfileScreen.js");
assert.match(profile, /<Text translate=\{!session\?\.name && !user\.name\} style=\{styles\.profileName\}/);
assert.match(profile, /<Text translate=\{!session\?\.name && !user\.name\} style=\{styles\.summaryValue\}/);
const orderCard = source("src/components/orders/ActiveOrderCard.js");
assert.match(orderCard, /<Text translate=\{!worker\?\.name && !order\.provider\} style=\{styles\.workerName\}/);
assert.match(orderCard, /<Text translate=\{!order\.address\} style=\{styles\.infoText\}/);
const chats = source("src/screens/chats/ChatScreen.js");
assert.match(chats, /<Text translate=\{false\} style=\{styles\.roomTitle\}/);
assert.match(chats, /<Text translate=\{!room\.lastMessage\?\.body\} style=\{styles\.roomSubtitle\}/);

const thread = source("src/screens/chats/ChatThreadScreen.js");
const subtitle = thread.split("\n").find((line) => line.includes("const chatSubtitle ="));
assert.equal(vm.runInNewContext(subtitle + "\nchatSubtitle", { room: { type: "direct" } }), "Shaxsiy chat");
assert.equal(vm.runInNewContext(subtitle + "\nchatSubtitle", { room: { orderId: "order-a" } }), "Buyurtma chati");
assert.match(thread, /subtitle=\{chatSubtitle\}/);
assert.match(thread, /<Text style=\{styles\.subtitle\}>\{chatSubtitle\}<\/Text>/);
const fallback = thread.slice(thread.indexOf("  const room = route.params?.room || {"), thread.indexOf("  const isApiRoom"));
const counterpart = thread.split("\n").find((line) => line.includes("const counterpartUserId ="));
assert.equal(vm.runInNewContext(fallback + "const currentUserId = 'client-a';\n" + counterpart + "\ncounterpartUserId", { route: { params: {} } }), undefined, "the missing-room fallback must not throw while resolving participants");
console.log("Actual localized Text renders raw user content in uz/en/ru, relevant screen contracts and missing-room fallback passed (isolated rendering; no device UI).");
