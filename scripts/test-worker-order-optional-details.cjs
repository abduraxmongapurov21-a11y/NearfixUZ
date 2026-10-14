/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("../backend/node_modules/typescript");

async function main() {
  const phone = await import("../src/utils/workerPhone.mjs");
  let values = [], slot = 0, activeJob = null, createPhoneOrder;
  const requests = [], navigations = [], alerts = [];
  const element = (type, props) => ({ type, props: props || {} });
  const deps = {
    "react/jsx-runtime": { jsx: element, jsxs: element },
    react: { useEffect() {}, useMemo: (fn) => fn(), useState: (initial) => {
      const index = slot++;
      if (!(index in values)) values[index] = initial;
      return [values[index], (next) => { values[index] = next; }];
    } },
    "react-native": { ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView", Platform: { OS: "android" }, Pressable: "Pressable", ScrollView: "ScrollView", View: "View", StyleSheet: { create: (value) => value } },
    "react-i18next": { useTranslation: () => ({ t: (text) => text, i18n: { language: "uz" } }) },
    "lucide-react-native": { ArrowLeft: "ArrowLeft", Check: "Check", Plus: "Plus" },
    "../../constants/routes": { ROUTES: { WORKER_TABS: "WorkerTabs", WORKER_JOBS_TAB: "WorkerJobs" } },
    "../../i18n/native": { Text: "Text", TextInput: "TextInput", Alert: { alert: (...args) => alerts.push(args) } },
    "../../services/content/categoryService": { categoryName: (category) => category.nameUz },
    "../../store/workerStore": { useWorkerStore: (select) => select({ activeJob, workerProfile: { categories: [{ id: "electric", nameUz: "Elektrik", isActive: true }] }, syncWorkerFromApi() {}, createPhoneOrder }) },
    "../../theme": { colors: {}, radius: {} },
    "../../utils/workerPhone.mjs": phone,
    "../../constants/orderTracking": { TRACKING_STATUSES: {} },
    "../../constants/workerStatus": { WORKER_STATUS: {} },
    "../api/client": { apiRequest: (fn) => fn() },
    "../api/authenticatedClient": { httpAuthRequest: async (url, options) => {
      requests.push({ url, token: options.token, body: JSON.parse(JSON.stringify(options.body)) });
      return { order: { id: "created-order", status: "ACCEPTED" } };
    } },
    "../orders/orderService": { mapApiOrder: (order) => order },
    "../orders/bookingLocation.mjs": {}, "./serviceLocation.mjs": {}
  };
  function compile(relative) {
    const filename = path.resolve(__dirname, relative), target = new Module(filename);
    target.require = (id) => { assert.ok(id in deps, `Unexpected dependency: ${id}`); return deps[id]; };
    target._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { allowJs: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
    }).outputText, filename);
    return target.exports;
  }
  const { createWorkerOrderApi } = compile("../src/services/workers/workerService.js");
  createPhoneOrder = (input) => createWorkerOrderApi("fixture-token", input);
  const { WorkerCreateOrderScreen } = compile("../src/screens/worker/WorkerCreateOrderScreen.js");
  function expand(node) {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== "object") return node;
    if (typeof node.type === "function") return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props.children) } };
  }
  const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props.children)] : [];
  const render = () => { slot = 0; return expand(element(WorkerCreateOrderScreen, { navigation: { navigate: (...args) => navigations.push(args) } })); };
  const button = (tree, label) => nodes(tree).find((node) => node.type === "Pressable" && nodes(node).some((child) => child.type === "Text" && child.props.children === label));
  const fill = (tree, placeholder, value) => nodes(tree).find((node) => node.type === "TextInput" && node.props.placeholder === placeholder).props.onChangeText(value);
  const base = { clientPhone: "+998901234567", categoryId: "electric" };
  for (const [description, address, district, expected] of [
    ["", "", "", base],
    ["  ", "  ", "", base],
    ["  Ish tavsifi  ", "", "", { ...base, description: "Ish tavsifi" }],
    ["", "  Uy  ", "", { ...base, location: { addressText: "Uy" } }],
    ["", "", "Yunusobod", { ...base, location: { district: "Yunusobod" } }],
    ["A", "1", "", { ...base, description: "A", location: { addressText: "1" } }]
  ]) {
    values = [];
    let tree = render();
    assert.ok(nodes(tree).some((node) => node.props.children === "Ish tavsifi (ixtiyoriy)"));
    assert.ok(nodes(tree).some((node) => node.props.children === "Manzil (ixtiyoriy)"));
    fill(tree, "+998 90 123 45 67", "90 123 45 67");
    fill(tree, "Bajariladigan ishni qisqacha yozing", description);
    fill(tree, "Ko'cha, uy va mo'ljal", address);
    fill(tree, "Tuman", district);
    button(tree, "Elektrik").props.onPress();
    tree = render();
    await button(tree, "Buyurtma yaratish").props.onPress();
    assert.deepEqual(requests.at(-1), { url: "/workers/orders", token: "fixture-token", body: expected });
    assert.equal(navigations.at(-1)[1].params.orderId, "created-order");
  }
  assert.equal(requests.length, 6);
  assert.equal(alerts.length, 6);
  values = [];
  let tree = render();
  await button(tree, "Buyurtma yaratish").props.onPress();
  tree = render();
  assert.ok(nodes(tree).some((node) => node.props.children === "Telefon raqamni to'liq kiriting."));
  assert.equal(requests.length, 6, "Phone remains required");
  fill(tree, "+998 90 123 45 67", "90 123 45 67");
  await button(render(), "Buyurtma yaratish").props.onPress();
  assert.equal(requests.length, 6, "Category remains required");
  activeJob = { id: "busy" };
  await button(render(), "Buyurtma yaratish").props.onPress();
  assert.equal(requests.length, 6, "Active-order guard remains in place");
  console.log("Worker order optional details form/API tests passed: blank, whitespace, either field, district-only, short text, navigation, and mandatory phone/category guards.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
