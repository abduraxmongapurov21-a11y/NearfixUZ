/* global __dirname */
/* Actual source execution with controlled store/native/Prisma fixtures; no device or database. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const vm = require("node:vm");
const ts = require("../backend/node_modules/typescript");
const root = path.resolve(__dirname, "..");
const source = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const element = (type, props, key) => ({ type, props, key });
const nodes = (value) => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
const content = (value) => Array.isArray(value) ? value.map(content).join("") : value && typeof value === "object" ? content(value.props?.children) : value == null ? "" : String(value);
function compile(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const target = new Module(filename, module);
  target.filename = filename;
  target.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = target.require.bind(target);
  target.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  target._compile(ts.transpileModule(source(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, filename);
  return target.exports;
}

async function main() {
  const fixedNow = new Date(2026, 9, 13, 12);
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixedNow])); } }
  const orders = [
    ...Array.from({ length: 6 }, (_, index) => ({ id: `today-${index}`, amount: (index + 1) * 1000, updatedAt: new Date(2026, 9, 13, 10) })),
    { id: "yesterday", amount: 7000, updatedAt: new Date(2026, 9, 12, 10) },
    { id: "early-month", amount: 8000, updatedAt: new Date(2026, 9, 1, 10) },
    { id: "last-month", amount: 9000, updatedAt: new Date(2026, 8, 29, 10) }
  ].map((order) => ({ ...order, finalAmount: order.amount, payments: [], events: [] }));
  const workerSource = source("backend/src/modules/workers/worker.service.ts");
  const helpers = workerSource.slice(workerSource.indexOf("function startOfDay("), workerSource.indexOf("function activeHoursForOrder("));
  const method = workerSource.slice(workerSource.indexOf("export async function getOwnWorkerEarnings("), workerSource.indexOf("export async function getOwnWorkerTransactions("));
  const serviceContext = vm.createContext({
    Date: FixedDate, exports: {}, OrderStatus: { COMPLETED: "COMPLETED" }, platformFeeRate: 0.05,
    activeHoursForOrder: () => 0,
    prisma: { workerProfile: { findUnique: async () => ({ id: "worker-a" }) }, order: { findMany: async () => orders } }
  });
  vm.runInContext(ts.transpileModule(helpers + method, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, serviceContext);
  const earnings = await serviceContext.exports.getOwnWorkerEarnings("user-a");
  assert.equal(earnings.todayEarnings, 21000);
  assert.equal(earnings.weekEarnings, 28000);
  assert.equal(earnings.monthEarnings, 36000);
  for (const [range, total, jobs, days, average] of [["today", 21000, 6, 1, 21000], ["week", 28000, 7, 7, 14000], ["month", 36000, 8, 31, Math.round(36000 / 13)]]) {
    const period = earnings.periods[range];
    assert.equal(period.total, total);
    assert.equal(period.completedJobs, jobs);
    assert.equal(period.revenueTrend.length, days);
    assert.equal(period.revenueTrend.reduce((sum, day) => sum + day.amount, 0), total);
    assert.equal(period.averagePerDay, average);
    assert.equal(new Date(period.startAt).getHours(), 0);
  }
  assert.equal(earnings.periods.today.growthPercentage, 200);
  assert.equal(earnings.periods.month.growthPercentage, 300);

  let state = [], slot = 0;
  const react = {
    useMemo: (fn) => fn(),
    useState: (initial) => { const index = slot++; if (!(index in state)) state[index] = initial; return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; }
  };
  const transactions = [...orders].reverse().map((order) => ({ ...order, clientName: order.id, service: "Service", createdAt: order.updatedAt.toISOString(), netAmount: order.id === "today-0" ? 0 : order.amount * 0.95 }));
  let transactionsNextCursor = null;
  let transactionsLoading = false;
  let transactionsError = null;
  let moreCalls = 0;
  const { WorkerEarningsScreen } = compile("src/screens/worker/WorkerEarningsScreen.js", {
    react,
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "react-native": { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", RefreshControl: "RefreshControl", ScrollView: "ScrollView", View: "View", StyleSheet: { create: (value) => value } },
    "lucide-react-native": new Proxy({}, { get: (_, key) => key }),
    "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Defs: "Defs", LinearGradient: "LinearGradient", Path: "Path", Stop: "Stop" },
    "../../constants/env": { env: { paymentsEnabled: false } },
    "../../store/workerStore": { useWorkerStore: (selector) => selector({ earnings, transactions, transactionsNextCursor, transactionsLoading, transactionsError, loadMoreTransactionsFromApi: async () => { moreCalls += 1; }, syncWorkerFromApi: async () => {} }) },
    "../../theme": { radius: { pill: 999 } },
    "../../i18n/native": { Text: "Text" }
  });
  const render = () => { slot = 0; return nodes(WorkerEarningsScreen()); };
  const rows = (tree) => tree.filter((node) => node.type?.name === "TransactionRow");
  const button = (tree, label) => tree.find((node) => node.type === "Pressable" && content(node) === label);
  const rangeButton = (tree, label) => tree.find((node) => node.type?.name === "RangeButton" && node.props.label === label);
  let tree = render();
  assert.equal(rows(tree).length, 5);
  assert.equal(typeof button(tree, "Barchasi").props.onPress, "function");
  button(tree, "Barchasi").props.onPress();
  tree = render();
  assert.equal(rows(tree).length, 7);
  assert.ok(!rows(tree).some((row) => row.props.transaction.id === "early-month"));
  button(tree, "Kamroq ko'rsatish").props.onPress();
  tree = render();
  assert.equal(rows(tree).length, 5);
  rangeButton(tree, "Bu oy").props.onPress();
  tree = render();
  button(tree, "Barchasi").props.onPress();
  tree = render();
  assert.equal(rows(tree).length, 8);
  rangeButton(tree, "Bugun").props.onPress();
  tree = render();
  assert.equal(rows(tree).length, 5, "changing period resets expansion");
  button(tree, "Barchasi").props.onPress();
  tree = render();
  assert.equal(rows(tree).length, 6);
  assert.equal(rows(tree).find((row) => row.props.transaction.id === "today-0").props.transaction.amount, "+0 so'm", "zero net amount must not fall back to gross amount");
  const chart = tree.find((node) => node.type?.name === "RevenueChart");
  assert.equal(chart.props.trend.length, 1);
  const chartTree = nodes(chart.type({ trend: [{ date: "2026-10-12", amount: 10000 }, { date: "2026-10-13", amount: 20000 }] }));
  assert.deepEqual(chartTree.filter((node) => node.type === "Text").slice(0, 4).map(content), ["so'm", (20000).toLocaleString("uz-UZ"), (10000).toLocaleString("uz-UZ"), "0"]);
  assert.equal(chartTree.find((node) => node.type === "Path" && node.props.fill === "none").props.d, "M10 49 L284 10");
  const monthChart = nodes(chart.type({ trend: earnings.periods.month.revenueTrend, range: "month" }));
  const tickNodes = monthChart.filter((node) => node.type === "Text" && node.key);
  assert.ok(tickNodes.length <= 7);
  assert.equal(new Set(tickNodes.map((node) => node.key)).size, tickNodes.length);
  transactionsNextCursor = "next-page";
  tree = render();
  await button(tree, "Ko'proq yuklash").props.onPress();
  assert.equal(moreCalls, 1, "the visible pagination control reaches the store action");
  transactionsError = "Controlled page failure";
  tree = render();
  await button(tree, "Qayta urinish").props.onPress();
  assert.equal(moreCalls, 2, "the same cursor can be retried from the screen");
  transactionsLoading = true;
  tree = render();
  assert.ok(tree.some((node) => node.type === "ActivityIndicator"));
  assert.ok(tree.some((node) => node.type === "Pressable" && node.props.disabled === true));

  const translations = compile("src/i18n/index.js");
  const copies = ["Buyurtma holati tasdiqlanmadi", "Serverdan javob kelmadi. Buyurtma yaratilgan bo'lishi mumkin. Qayta yuborishdan oldin Buyurtmalar bo'limini tekshiring.", "Akkauntni o'chirishdan oldin faol buyurtmalarni yakunlang yoki bekor qiling.", "Ko'proq yuklash"];
  for (const language of ["en", "ru"]) {
    await translations.default.changeLanguage(language);
    for (const copy of copies) assert.notEqual(translations.translateCopy(copy), copy, `${language}: ${copy}`);
  }

  const authSource = source("src/store/authStore.js");
  const deletion = authSource.slice(authSource.indexOf("  deleteAccount: async () => {"), authSource.indexOf("  invalidateSessionForRoleChange:"));
  const session = { token: "test-token" };
  let mutations = 0;
  const deleteContext = vm.createContext({
    get: () => ({ session }), set: () => { mutations += 1; },
    captureAuthRequest: () => "identity", isAuthRequestCurrent: () => true,
    authAttemptGuard: { begin: () => 1, isCurrent: () => true },
    deleteCurrentUserApi: async () => ({ ok: false, code: "ACTIVE_ORDERS_EXIST", message: "Active orders exist" })
  });
  vm.runInContext(`globalThis.deleteAccount = ({${deletion}}).deleteAccount;`, deleteContext);
  const rejected = await deleteContext.deleteAccount();
  assert.equal(rejected.code, "ACTIVE_ORDERS_EXIST");
  assert.equal(rejected.message, copies[2]);
  assert.equal(mutations, 0, "rejected deletion preserves the session");
  console.log("Full-fix mobile: actual earnings service periods, screen expansion/range/zero-net, chart scale/ticks, EN/RU booking/delete/pagination copy, rejected account deletion passed (isolated fixtures).");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
