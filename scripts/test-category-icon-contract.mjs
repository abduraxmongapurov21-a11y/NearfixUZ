import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [backendSource, adminSource, mobileSource, adminExports, mobileExports] = await Promise.all([
  readFile(new URL("backend/src/modules/categories/category.contracts.ts", root), "utf8"),
  readFile(new URL("admin-web/modules/categories/category-icons.tsx", root), "utf8"),
  readFile(new URL("src/constants/categoryIcons.js", root), "utf8"),
  readFile(new URL("admin-web/node_modules/lucide-react/dist/esm/lucide-react.js", root), "utf8"),
  readFile(new URL("node_modules/lucide-react-native/dist/esm/lucide-react-native.mjs", root), "utf8")
]);

function parseBackendKeys(source) {
  const match = source.match(/CATEGORY_ICON_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  assert.ok(match, "backend icon key whitelist must be readable");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function parseObject(source, name) {
  const match = source.match(new RegExp(`(?:export const|const) ${name}[^=]*=\\s*(?:Object\\.freeze\\()?\\{([\\s\\S]*?)\\}\\)?;`));
  assert.ok(match, `${name} must be readable`);
  return new Map([...match[1].matchAll(/^\s*"([^"]+)":\s*(?:"([^"]*)"|([A-Za-z0-9]+)),?$/gm)].map((item) => [item[1], item[2] || item[3]]));
}

function sorted(values) {
  return [...values].sort();
}

function assertExported(source, componentName, packageName) {
  const exportPattern = new RegExp(`\\b(?:as|default as) ${componentName}(?:,| |})`);
  assert.match(source, exportPattern, `${componentName} must be exported by ${packageName}`);
}

const backendKeys = parseBackendKeys(backendSource);
const adminIcons = parseObject(adminSource, "categoryIcons");
const adminLabels = parseObject(adminSource, "categoryIconLabels");
const mobileIcons = parseObject(mobileSource, "CATEGORY_ICONS");
const mobileColors = parseObject(mobileSource, "iconColors");
const legacyKeys = ["wrench", "zap", "flame", "hammer", "snowflake", "paint", "sparkles", "brush", "grid"];

assert.equal(backendKeys.length, 30, "the expanded whitelist must contain 30 reusable keys");
assert.equal(new Set(backendKeys).size, backendKeys.length, "backend icon keys must be unique");
assert.ok(legacyKeys.every((key) => backendKeys.includes(key)), "all legacy icon keys must remain supported");
assert.deepEqual(sorted(adminIcons.keys()), sorted(backendKeys), "admin mapping must match the backend whitelist");
assert.deepEqual(sorted(adminLabels.keys()), sorted(backendKeys), "admin labels must match the backend whitelist");
assert.deepEqual(sorted(mobileIcons.keys()), sorted(backendKeys), "mobile mapping must match the backend whitelist");
assert.deepEqual(sorted(mobileColors.keys()), sorted(backendKeys), "mobile colors must match the mobile icon mapping");

for (const iconKey of backendKeys) {
  const adminComponent = adminIcons.get(iconKey);
  const mobileComponent = mobileIcons.get(iconKey);
  assert.equal(adminComponent, mobileComponent, `${iconKey} must use the same component in admin and mobile`);
  assertExported(adminExports, adminComponent, "lucide-react");
  assertExported(mobileExports, mobileComponent, "lucide-react-native");
}

assert.match(adminSource, /return categoryIcons\[iconKey\] \|\| Grid2X2;/, "admin unknown keys must fall back to Grid2X2");
assert.match(mobileSource, /return CATEGORY_ICONS\[iconKey\] \|\| Grid2X2;/, "mobile unknown keys must fall back to Grid2X2");
assert.match(mobileSource, /return iconColors\[iconKey\] \|\| iconColors\.grid;/, "mobile unknown colors must fall back to the grid color");

console.log(`Category icon contracts are synchronized for ${backendKeys.length} keys; legacy and fallback behavior are preserved.`);
