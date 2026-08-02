import fs from "node:fs";
import path from "node:path";
import { extractCopy } from "./i18n-copy-tools.mjs";

const root = process.cwd();
const localeDirectory = path.join(root, "src", "i18n", "locales");
const languages = ["uz", "en", "ru"];
const resources = Object.fromEntries(
  languages.map((language) => [language, JSON.parse(fs.readFileSync(path.join(localeDirectory, `${language}.json`), "utf8"))])
);
const failures = [];
const baseKeys = Object.keys(resources.uz).sort();

for (const language of languages.slice(1)) {
  const keys = Object.keys(resources[language]).sort();
  const missing = baseKeys.filter((key) => !Object.prototype.hasOwnProperty.call(resources[language], key));
  const extra = keys.filter((key) => !Object.prototype.hasOwnProperty.call(resources.uz, key));
  if (missing.length) failures.push(`${language}: ${missing.length} missing key(s): ${missing.slice(0, 5).join(" | ")}`);
  if (extra.length) failures.push(`${language}: ${extra.length} extra key(s): ${extra.slice(0, 5).join(" | ")}`);
}

function placeholders(value) {
  return [...String(value).matchAll(/\{\{(value\d+)\}\}/g)].map((match) => match[1]).sort();
}

for (const key of baseKeys) {
  const expected = placeholders(key).join(",");
  for (const language of languages) {
    const actual = placeholders(resources[language][key]).join(",");
    if (actual !== expected) failures.push(`${language}: placeholder mismatch for ${JSON.stringify(key)} (${actual} !== ${expected})`);
    if (typeof resources[language][key] !== "string" || !resources[language][key].trim()) {
      failures.push(`${language}: empty translation for ${JSON.stringify(key)}`);
    }
  }
}

const extracted = extractCopy({ root });
const uncovered = [...extracted.keys()].filter((key) => !Object.prototype.hasOwnProperty.call(resources.uz, key));
if (uncovered.length) failures.push(`Source copy missing from locales (${uncovered.length}): ${uncovered.slice(0, 10).join(" | ")}`);

const sourceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (/\.jsx?$/.test(entry.name)) sourceFiles.push(absolute);
  }
}
walk(path.join(root, "src"));
sourceFiles.push(path.join(root, "App.js"));

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  const isNativeAdapter = path.normalize(file) === path.join(root, "src", "i18n", "native.js");
  if (isNativeAdapter && /from\s*["']\.\/native["']/.test(source)) {
    failures.push("src/i18n/native.js must not import itself");
  }
  for (const match of source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*["']react-native["'];/g)) {
    const forbidden = match[1]
      .split(",")
      .map((value) => value.trim().split(/\s+as\s+/)[0])
      .filter((name) => ["Alert", "Text", "TextInput"].includes(name));
    if (!isNativeAdapter && forbidden.length) {
      failures.push(`${path.relative(root, file)} imports ${forbidden.join(", ")} directly from react-native`);
    }
  }
}

if (failures.length) {
  console.error(`i18n verification failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`i18n verified: ${baseKeys.length} synchronized keys across ${languages.join(", ")}; ${extracted.size} source copy candidates covered.`);
