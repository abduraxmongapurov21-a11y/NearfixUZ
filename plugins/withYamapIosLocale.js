const fs = require("node:fs/promises");
const path = require("node:path");
const { withDangerousMod } = require("@expo/config-plugins");

const YAMAP_IOS_MODULE_PATH = path.join(
  "node_modules",
  "react-native-yamap-plus",
  "ios",
  "Module",
  "RTNYamapModule.mm"
);
const UNSUPPORTED_SET_LOCALE = "[YRTI18nManagerFactory setLocaleWithLocale:locale];";
const SUPPORTED_SET_LOCALE = "[YMKMapKit setLocale:locale];";

function patchYamapIosLocaleSource(source) {
  if (source.includes(SUPPORTED_SET_LOCALE)) return source;
  if (!source.includes(UNSUPPORTED_SET_LOCALE)) {
    throw new Error(
      "react-native-yamap-plus iOS locale implementation changed; refusing to apply an unverified MapKit patch."
    );
  }
  return source.replace(UNSUPPORTED_SET_LOCALE, SUPPORTED_SET_LOCALE);
}

async function patchYamapIosLocale(projectRoot) {
  const modulePath = path.join(projectRoot, YAMAP_IOS_MODULE_PATH);
  const source = await fs.readFile(modulePath, "utf8");
  const patched = patchYamapIosLocaleSource(source);
  if (patched !== source) await fs.writeFile(modulePath, patched, "utf8");
}

function withYamapIosLocale(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      await patchYamapIosLocale(modConfig.modRequest.projectRoot);
      return modConfig;
    }
  ]);
}

module.exports = withYamapIosLocale;
module.exports.patchYamapIosLocaleSource = patchYamapIosLocaleSource;
module.exports.YAMAP_IOS_MODULE_PATH = YAMAP_IOS_MODULE_PATH;
