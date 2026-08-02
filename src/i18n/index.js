import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uz from "./locales/uz.json";

export const DEFAULT_LOCALE = "uz";
export const SUPPORTED_LOCALES = Object.freeze(["uz", "en", "ru"]);
export const LANGUAGES = Object.freeze({
  uz: "O'zbekcha",
  en: "English",
  ru: "Русский"
});

const resources = {
  uz: { translation: uz },
  en: { translation: en },
  ru: { translation: ru }
};

const copyPatterns = Object.keys(uz)
  .filter((key) => /\{\{value\d+\}\}/.test(key))
  .map((key) => {
    const placeholders = [];
    const markerPattern = /\{\{value(\d+)\}\}/g;
    let lastIndex = 0;
    let expression = "^";
    let match;

    while ((match = markerPattern.exec(key))) {
      expression += escapeRegExp(key.slice(lastIndex, match.index));
      expression += "(.+?)";
      placeholders.push(`value${match[1]}`);
      lastIndex = match.index + match[0].length;
    }

    expression += `${escapeRegExp(key.slice(lastIndex))}$`;
    return { key, placeholders, expression: new RegExp(expression, "u") };
  });

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeLocale(locale) {
  const normalized = String(locale || "")
    .toLowerCase()
    .split(/[-_]/)[0];
  return SUPPORTED_LOCALES.includes(normalized) ? normalized : DEFAULT_LOCALE;
}

export function normalizeCopy(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

export function translateCopy(value, options) {
  if (typeof value !== "string") return value;

  const leadingWhitespace = value.match(/^\s*/u)?.[0] || "";
  const trailingWhitespace = value.match(/\s*$/u)?.[0] || "";
  const normalized = normalizeCopy(value);
  if (!normalized) return value;

  let translated;
  if (Object.prototype.hasOwnProperty.call(uz, normalized)) {
    // The initialized instance method is required here so the active runtime language is used.
    // eslint-disable-next-line import/no-named-as-default-member
    translated = i18n.t(normalized, options);
  } else {
    for (const pattern of copyPatterns) {
      const match = normalized.match(pattern.expression);
      if (!match) continue;
      const interpolation = Object.fromEntries(
        pattern.placeholders.map((placeholder, index) => [placeholder, match[index + 1]])
      );
      // eslint-disable-next-line import/no-named-as-default-member
      translated = i18n.t(pattern.key, { ...options, ...interpolation });
      break;
    }
  }

  if (translated === undefined) return value;
  return `${leadingWhitespace}${translated}${trailingWhitespace}`;
}

if (!i18n.isInitialized) {
  // eslint-disable-next-line import/no-named-as-default-member
  i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
  });
}

export default i18n;
