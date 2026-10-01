import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const React = require("react");
const { transformSync } = require("@babel/core");
const source = readFileSync(new URL("../App.js", import.meta.url), "utf8");
const { code } = transformSync(source, {
  filename: "App.js",
  babelrc: false,
  configFile: false,
  plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"]
});

async function renderStartup(fontResult, { splashFailure = false } = {}) {
  const effects = [];
  const splashCalls = [];
  const authState = { session: null };
  const useAuthStore = (selector) => selector(authState);
  useAuthStore.getState = () => authState;
  const splashOperation = (name) => async () => {
    splashCalls.push(name);
    if (splashFailure) throw new Error("Splash API unavailable");
  };
  const mocks = {
    react: {
      ...React,
      useCallback: (callback) => callback,
      useEffect: (effect) => effects.push(effect),
      useRef: (value) => ({ current: value })
    },
    "react-native": { View: "View", StatusBar: "StatusBar", StyleSheet: { create: (styles) => styles } },
    "@react-navigation/native": { NavigationContainer: "NavigationContainer", createNavigationContainerRef: () => ({}) },
    "expo-notifications": {
      setNotificationHandler: () => {},
      addNotificationResponseReceivedListener: () => ({ remove() {} }),
      getLastNotificationResponseAsync: async () => null
    },
    "expo-splash-screen": {
      preventAutoHideAsync: splashOperation("prevent"),
      hideAsync: splashOperation("hide")
    },
    "react-native-safe-area-context": { SafeAreaProvider: "SafeAreaProvider", SafeAreaView: "SafeAreaView" },
    "react-native-screens": { enableScreens() {} },
    "@expo-google-fonts/inter": { useFonts: () => fontResult },
    "./src/navigation/AppNavigator": { AppNavigator: "AppNavigator" },
    "./src/theme": { colors: {} },
    "./src/i18n": {},
    "./src/i18n/native": { Text: "Text" },
    "./src/store/authStore": { useAuthStore },
    "./src/services/notifications/notificationNavigation.mjs": { processNotificationResponse: () => ({ status: "pending" }) }
  };
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require(name) {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected startup dependency: ${name}`);
      return mocks[name];
    },
    console
  }, { filename: "App.js" });
  const tree = module.exports.default();
  for (const effect of effects) effect();
  await new Promise((resolve) => setImmediate(resolve));
  return { tree, splashCalls };
}

function containsNavigator(tree) {
  if (!tree) return false;
  if (Array.isArray(tree)) return tree.some(containsNavigator);
  return tree.type === "AppNavigator" || containsNavigator(tree.props?.children);
}

const failedFont = await renderStartup([false, new Error("Bundled font failed to load")]);
assert.equal(containsNavigator(failedFont.tree), true, "A failed font must not prevent app navigation from mounting");
assert.deepEqual(failedFont.splashCalls, ["prevent", "hide"], "Font failure must release the native splash");

const loadedFonts = await renderStartup([true, null]);
assert.equal(containsNavigator(loadedFonts.tree), true);
assert.deepEqual(loadedFonts.splashCalls, ["prevent", "hide"]);

const pendingFonts = await renderStartup([false, null]);
assert.equal(pendingFonts.tree, null, "Keep the native splash while fonts are still loading");
assert.deepEqual(pendingFonts.splashCalls, ["prevent"]);

const unavailableSplash = await renderStartup([true, null], { splashFailure: true });
assert.equal(containsNavigator(unavailableSplash.tree), true, "Splash API rejection must not prevent navigation");

console.log("App startup tests passed (font success, pending, failure, and splash API rejection). Native iOS runtime is not exercised.");
