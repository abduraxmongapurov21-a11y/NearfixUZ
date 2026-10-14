/* global __dirname */
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../backend/node_modules/typescript");

const root = path.resolve(__dirname, "..");
const files = {
  native: "src/i18n/native.js",
  client: "src/screens/profile/ClientProfileScreen.js",
  worker: "src/screens/worker/WorkerProfileManageScreen.js",
  webAlert: "node_modules/react-native-web/dist/exports/Alert/index.js"
};
const sources = Object.fromEntries(Object.entries(files).map(([key, relative]) => [key, fs.readFileSync(path.join(root, relative), "utf8")]));
const hashes = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, createHash("sha256").update(source).digest("hex")]));
const translations = Object.fromEntries(["uz", "en", "ru"].map((language) => [language, JSON.parse(fs.readFileSync(path.join(root, `src/i18n/locales/${language}.json`), "utf8"))]));
const noop = () => {};
const element = (type, props, key) => ({ type, props, key });
const hooks = {
  useState: (initial) => [typeof initial === "function" ? initial() : initial, noop],
  useMemo: (factory) => factory(), useCallback: (callback) => callback,
  useEffect: noop, useRef: (initial) => ({ current: initial }), forwardRef: (render) => ({ render })
};
function evaluate(source, filename, imports, globals = {}) {
  const compiled = ts.transpileModule(source, {
    fileName: `${filename}.tsx`, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, allowJs: true
    }
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, ...globals,
    require(id) {
      if (Object.hasOwn(imports, id)) return imports[id];
      throw new Error(`Unexpected mocked dependency: ${id}`);
    }
  });
  new vm.Script(compiled, { filename }).runInContext(context);
  return module.exports;
}
const actualWebAlert = evaluate(sources.webAlert, files.webAlert, {}).default;
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

function fixture(platform = "web", language = "uz", dialog = true) {
  const nativeCalls = [];
  const promptCalls = [];
  const dialogCalls = [];
  const calls = { logout: 0, deleteAccount: 0, clearUserData: 0, api: 0 };
  const translateCopy = (value) => typeof value === "string" ? translations[language][value] ?? value : value;
  const NativeAlert = platform === "web" ? actualWebAlert : {
    alert: (...args) => { nativeCalls.push(args); }, prompt: (...args) => { promptCalls.push(args); }
  };
  const nativeComponents = new Proxy({
    Alert: NativeAlert, Platform: { OS: platform, select: (options) => options[platform] ?? options.default },
    StyleSheet: { create: (styles) => styles, absoluteFillObject: {} },
    Keyboard: { dismiss: noop }
  }, { get: (target, key) => target[key] ?? String(key) });
  const reactTranslation = { useTranslation: () => ({ t: translateCopy, i18n: { language } }) };
  const globals = {};
  if (dialog !== "unavailable") globals.confirm = (message) => {
    dialogCalls.push(message);
    if (dialog === "throws") throw new Error("Synthetic unavailable dialog");
    return dialog;
  };
  const native = evaluate(sources.native, files.native, {
    react: hooks, "react/jsx-runtime": { jsx: element, jsxs: element },
    "react-native": nativeComponents, "react-i18next": reactTranslation, "./index": { translateCopy }
  }, globals);
  const auth = {
    session: { userId: "synthetic-user", token: "synthetic-token", phone: "fixture-phone", name: "QA", role: "provider" },
    logout: () => { calls.logout += 1; },
    deleteAccount: () => { calls.deleteAccount += 1; }, updateProfile: noop, setExperienceMode: noop
  };
  const client = {
    user: { name: "QA" }, savedAddresses: [], addressStatus: { loading: false, error: null },
    categories: [], categoryStatus: "ready", categoryError: null, syncCategoriesFromApi: noop,
    syncClientProfileFromApi: noop, loadAddresses: noop, createAddress: noop, updateAddress: noop, removeAddress: noop,
    clearUserData: () => { calls.clearUserData += 1; }
  };
  const worker = {
    workerProfile: { name: "QA", status: "approved", categoryIds: [], categories: [] },
    profileSyncStatus: { isStale: false }, syncWorkerFromApi: noop, submitWorkerProfile: noop,
    saveServiceLocation: noop, clearUserData: () => { calls.clearUserData += 1; }
  };
  const theme = { colors: new Proxy({}, { get: () => "#123456" }), font: {}, radius: {}, shadow: {}, CLIENT_CONTENT_BOTTOM: 0 };
  const imported = {
    react: hooks, "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "Fragment" },
    "react-native": nativeComponents, "react-i18next": reactTranslation,
    "@react-navigation/native": { useFocusEffect: noop },
    "lucide-react-native": new Proxy({}, { get: (_target, key) => String(key) }),
    "expo-image-picker": {},
    "../../constants/routes": { ROUTES: {} },
    "../../services/notifications/notificationService": { fetchUnreadNotificationCountApi: () => { calls.api += 1; } },
    "../../services/moderation/moderationService": {}, "../../services/media/mediaService": {},
    "../../store/authStore": { useAuthStore: (selector) => selector(auth) },
    "../../store/clientStore": { useClientStore: (selector) => selector(client) },
    "../../store/workerStore": { useWorkerStore: (selector) => selector(worker) },
    "../../store/uiStore": { useUiStore: (selector) => selector({ locale: language, setLocale: noop }) },
    "../../utils/legalLinks": {}, "../../components/support/SupportRequestModal": { SupportRequestModal: "SupportRequestModal" },
    "../../components/profile/countrySelectorModel.mjs": {},
    "../../i18n": { LANGUAGES: {}, SUPPORTED_LOCALES: ["uz", "en", "ru"] },
    "../../theme/clientTheme": theme, "../../theme": theme,
    "../../components/client/ClientHeader": { ClientHeader: "ClientHeader" },
    "../../components/client/GlassSurface": { GlassSurface: "GlassSurface" },
    "../../components/profile/LanguageSelector": { LanguageSelector: "LanguageSelector" },
    "../../components/category/CategoryAvailabilityState": { CategoryAvailabilityState: "CategoryAvailabilityState" },
    "../../services/content/categoryService": { categoryName: (value) => value.name },
    "../../services/workers/serviceLocation.mjs": { createSubmissionGuard: () => ({}), normalizeServiceLocation: () => null },
    "./addressPresets.mjs": {}, "../../i18n/native": native
  };
  function screenAction(screen, label = "Chiqish") {
    const exports = evaluate(sources[screen], files[screen], imported);
    const Component = exports[screen === "client" ? "ClientProfileScreen" : "WorkerProfileManageScreen"];
    const tree = Component({ navigation: { navigate: noop, setParams: noop }, route: { params: {} } });
    const action = nodes(tree).find((node) => node.props?.label === label && typeof node.props.onPress === "function");
    assert.ok(action, `Actual full ${screen} profile contains ${label} action`);
    return action.props.onPress;
  }
  return { native, NativeAlert, calls, dialogCalls, nativeCalls, promptCalls, translateCopy, screenAction };
}

let passed = 0;
let failed = 0;
async function test(label, run) {
  try { await run(); passed += 1; console.log(`[LOGOUT] PASS ${label}`); }
  catch (error) { failed += 1; console.log(`[LOGOUT] FAIL ${label}: ${error.message}`); }
}
(async () => {
  console.log(`[LOGOUT] Full native adapter + two full profile modules SHA256=${JSON.stringify(hashes)}; deterministic mocked hooks/auth; actual installed RN-web Alert; no HTTP/device proof`);
  for (const screen of ["client", "worker"]) {
    for (const language of ["uz", "en", "ru"]) {
      for (const confirmed of [true, false]) await test(`${screen} ${language}: web ${confirmed ? "confirm logs out exactly once" : "cancel preserves session"}`, () => {
        const h = fixture("web", language, confirmed);
        h.screenAction(screen)();
        assert.equal(h.dialogCalls.length, 1, "Web logout must request a browser confirmation");
        const message = screen === "client" ? "Akkauntingizdan chiqmoqchimisiz?" : "Usta profilidan chiqishni tasdiqlaysizmi?";
        assert.ok(h.dialogCalls[0].includes(h.translateCopy("Chiqish")), "Browser confirmation title uses active locale");
        assert.ok(h.dialogCalls[0].includes(h.translateCopy(message)), "Browser confirmation message uses active locale");
        assert.equal(h.calls.logout, confirmed ? 1 : 0);
        assert.equal(h.calls.deleteAccount, 0);
        assert.equal(h.calls.clearUserData, 0);
        assert.equal(h.calls.api, 0);
      });
    }
    for (const dialog of ["unavailable", "throws"]) await test(`${screen}: ${dialog} browser dialog never auto-logs out or throws`, () => {
      const h = fixture("web", "uz", dialog);
      assert.doesNotThrow(() => h.screenAction(screen)());
      assert.equal(h.calls.logout, 0);
      assert.equal(h.calls.deleteAccount, 0);
      assert.equal(h.calls.clearUserData, 0);
    });
    for (const platform of ["ios", "android"]) await test(`${screen}: ${platform} native confirmation callbacks remain intact`, () => {
      const h = fixture(platform, "en"); h.screenAction(screen)();
      assert.equal(h.dialogCalls.length, 0);
      assert.equal(h.nativeCalls.length, 1);
      const buttons = h.nativeCalls[0][2];
      assert.equal(buttons.length, 2);
      assert.equal(buttons[0].style, "cancel");
      assert.equal(buttons[1].style, "destructive");
      assert.equal(buttons[1].text, h.translateCopy("Chiqish"));
      assert.equal(h.calls.logout, 0, "Native callback must wait for confirmation");
      buttons[1].onPress(); assert.equal(h.calls.logout, 1);
    });
    await test(`${screen}: existing delete-account Alert.alert flow remains unchanged on web`, () => {
      const h = fixture("web", "en"); h.screenAction(screen, "Akkauntni o'chirish")();
      assert.equal(h.dialogCalls.length, 0, "Logout fix must not route delete-account through new browser dialog");
      assert.equal(h.calls.deleteAccount, 0);
      assert.equal(h.calls.logout, 0);
    });
  }
  await test("native adapter confirm preserves translated buttons, callbacks and original options", () => {
    const h = fixture("ios", "ru"); const options = { cancelable: false, onDismiss: noop };
    let cancelled = 0; let confirmed = 0;
    assert.equal(typeof h.native.Alert.confirm, "function", "Scoped confirmation adapter must exist");
    h.native.Alert.confirm("Chiqish", "Akkauntingizdan chiqmoqchimisiz?", [
      { text: "Bekor qilish", style: "cancel", onPress: () => { cancelled += 1; } },
      { text: "Chiqish", style: "destructive", onPress: () => { confirmed += 1; } }
    ], options);
    const [title, message, buttons, actualOptions] = h.nativeCalls[0];
    assert.equal(title, h.translateCopy("Chiqish")); assert.equal(message, h.translateCopy("Akkauntingizdan chiqmoqchimisiz?"));
    assert.equal(actualOptions, options); buttons[0].onPress(); buttons[1].onPress();
    assert.equal(cancelled, 1); assert.equal(confirmed, 1);
  });
  await test("existing native Alert.alert and Alert.prompt contracts are preserved", () => {
    const h = fixture("android", "en"); const options = { cancelable: true }; const callback = noop;
    h.native.Alert.alert("Chiqish", "Akkauntingizdan chiqmoqchimisiz?", [{ text: "Chiqish", onPress: callback }], options);
    assert.equal(h.nativeCalls[0][0], h.translateCopy("Chiqish")); assert.equal(h.nativeCalls[0][2][0].onPress, callback);
    assert.equal(h.nativeCalls[0][3], options);
    h.native.Alert.prompt("Chiqish", "Akkauntingizdan chiqmoqchimisiz?", callback, "plain-text", "fixture", "default", options);
    assert.equal(h.promptCalls[0][2], callback); assert.equal(h.promptCalls[0][6], options);
  });
  console.log(`[LOGOUT] ${passed + failed} cases; ${passed} passed; ${failed} failed. No authStore/push/session-reset changes.`);
  if (failed) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
