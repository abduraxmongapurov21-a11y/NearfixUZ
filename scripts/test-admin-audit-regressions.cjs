/* global __dirname */
// Execute actual TSX with deterministic hook/service fixtures. This is not browser or HTTP coverage.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("../admin-web/node_modules/typescript");
const root = path.resolve(__dirname, "..");
const baseline = process.argv.includes("--baseline");
const element = (type, props, key) => ({ type, props, key });
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(typeof node.type === "function" ? node.type(node.props) : node.props?.children)];
}
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return node && typeof node === "object" ? text(typeof node.type === "function" ? node.type(node.props) : node.props?.children) : "";
}
function defer() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(file, exported, options = {}) {
  const slots = [], cache = new Map(), calls = [];
  let slot = 0, effects = [], globalSearch = options.globalSearch || "", retries = 0;
  const session = options.session || { role: "admin", permissions: ["orders.read"] };
  const failedQuery = () => ({ data: undefined, isPending: false, isLoading: false, error: new Error("Synthetic API unavailable"), refetch: async () => { retries += 1; } });
  function load(relative) {
    const filename = path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const saved = path.join(root, "artifacts/full-fix-2026-10-13/before", relative);
    const source = fs.readFileSync(baseline && fs.existsSync(saved) ? saved : filename, "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const target = new Module(filename);
    const original = target.require.bind(target);
    target.require = (id) => {
      if (id === "react") return {
        useState: (initial) => { const index = slot++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
        useRef: (initial) => { const index = slot++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
        useMemo: (callback) => callback(),
        useCallback: (callback, deps) => { const index = slot++; const previous = slots[index]; if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) slots[index] = { callback, deps }; return slots[index].callback; },
        useEffect: (callback, deps) => { const index = slot++; const previous = slots[index]; if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) { slots[index] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = callback(); }); } }
      };
      if (id === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (id === "@tanstack/react-query") return {
        useQueryClient: () => ({ refetchQueries: async () => {}, invalidateQueries: async () => {} }),
        useQuery: (query) => options.query?.(query) || failedQuery(),
        useMutation: (mutation) => ({ isPending: false, mutate: (value) => { calls.push({ mutation: value }); return mutation.mutationFn(value); } })
      };
      if (id === "@/stores/admin-session-store") return { useAdminSessionStore: (selector) => selector({ session }) };
      if (id === "@/stores/ui-store") return { useAdminUiStore: (selector) => selector({ globalSearch, setGlobalSearch: (value) => { globalSearch = value; } }) };
      if (id === "@/shared/auth/permissions") return load("admin-web/shared/auth/permissions.ts");
      if (id === "@/shared/components/filter-bar") return load("admin-web/shared/components/filter-bar.tsx");
      if (id === "./order-detail-drawer") return load("admin-web/modules/orders/components/order-detail-drawer.tsx");
      if (id === "@/lib/admin-labels") return { adminLabel: (value) => value, auditActionLabel: (value) => value };
      if (id === "@/modules/workers/hooks/use-workers") return { useWorkers: () => ({ data: [] }) };
      if (id === "../hooks/use-orders") return { useOrders: (query) => { calls.push({ query }); return options.orders || failedQuery(); } };
      if (id === "../hooks/use-dashboard-summary") return { useDashboardSummary: failedQuery };
      if (id === "../hooks/use-categories") return { useCategories: failedQuery };
      if (id === "../hooks/use-admins") return { useAdmins: failedQuery };
      if (id === "../services/orders-service") return { runOrderAction: async (...args) => { calls.push({ orderAction: args }); }, getOrderDetail: async () => options.order };
      if (id === "../services/support-service") return options.support;
      if (id === "../services/reports-service") return options.reports;
      if (id.startsWith("@/") || id.startsWith("../") || id.startsWith("./") || id === "lucide-react") return new Proxy({}, { get: (_target, key) => key === "resolveCategoryIcon" ? () => "Icon" : String(key) });
      return original(id);
    };
    target._compile(compiled, filename); cache.set(filename, target.exports); return target.exports;
  }
  const Component = load(file)[exported];
  function render() { slot = 0; return Component(); }
  const all = () => nodes(render());
  const button = (label) => all().find((node) => (node.type === "Button" || node.type === "button") && text(node) === label);
  const click = async (label) => { const found = button(label); assert.ok(found, `Missing button: ${label}`); return found.props.onClick(); };
  const select = async (id) => { const found = all().find((node) => node.type === "button" && node.key === id); assert.ok(found, `Missing record: ${id}`); return found.props.onClick(); };
  async function flushEffects() { render(); const pending = effects; effects = []; pending.forEach((callback) => callback()); await Promise.resolve(); await Promise.resolve(); }
  return { render, all, button, click, select, calls, slots, load, flushEffects, global: (value) => { globalSearch = value; }, retries: () => retries };
}
const ordersFile = "admin-web/modules/orders/components/orders-table.tsx";
const supportFile = "admin-web/modules/support/components/support-center.tsx";
const reportsFile = "admin-web/modules/reports/components/reports-center.tsx";
const tickets = ["A", "B"].map((id) => ({ id, reason: id, status: "OPEN", adminNote: `note-${id}`, user: { name: id } }));
const manager = (permissions) => ({ role: "admin", permissions });
const report = (id = "A", targetType = "USER") => ({ id, targetId: `target-${id}`, targetType, status: "PENDING", reason: "OTHER", adminNote: `note-${id}`, createdAt: "2026-10-13T00:00:00Z", reporter: { name: id }, target: {} });
const reportsSession = manager(["reports.read", "reports.manage", "users.manage", "reviews.manage"]);
let passed = 0, failed = 0;
async function test(label, run) { try { await run(); passed += 1; console.log(`PASS ${label}`); } catch (error) { failed += 1; console.error(`FAIL ${label}: ${error.message}`); } }
function alerts(page) { return page.all().filter((node) => node.props?.role === "alert").map(text).join(" "); }
async function main() {
  await test("Read-only orders: every active status hides actions and handler denies direct invocation", async () => {
    for (const status of ["WAITING_RESPONSE", "ACCEPTED", "ON_THE_WAY", "IN_PROGRESS"]) {
      const order = { id: "A", status, client: {}, worker: {}, payments: [], timeline: [] };
      const page = fixture(ordersFile, "OrdersTable", { orders: { data: { items: [{ orderId: "A" }], totalPages: 1 } }, query: () => ({ data: order, isLoading: false }) });
      page.all().find((node) => node.type === "DataTable").props.onRowClick({ orderId: "A" });
      assert.ok(!page.button("Buyurtmani bekor qilish"), "Readonly cancel must not be offered");
      const drawer = page.all().find((node) => typeof node.type === "function" && node.type.name === "OrderDetailDrawer");
      await drawer.props.onAction("cancel");
      assert.equal(page.calls.filter((call) => call.orderAction).length, 0);
    }
  });
  await test("Order manager retains permitted action; terminal order has no writes", async () => {
    const order = { id: "A", status: "ACCEPTED", client: {}, worker: {}, payments: [], timeline: [] };
    const page = fixture(ordersFile, "OrdersTable", { session: manager(["orders.manage"]), orders: { data: { items: [{ orderId: "A" }], totalPages: 1 } }, query: () => ({ data: order }) });
    page.all().find((node) => node.type === "DataTable").props.onRowClick({ orderId: "A" });
    await page.click("Yo'lga chiqdi deb belgilash");
    assert.deepEqual(page.calls.find((call) => call.orderAction).orderAction, ["A", "on_the_way"]);
    order.status = "CANCELLED";
    assert.ok(!page.button("Buyurtmani bekor qilish"));
  });
  await test("Orders topbar and table search share API query and page reset dependency", async () => {
    const page = fixture(ordersFile, "OrdersTable", { globalSearch: "GLOBAL", orders: { data: { items: [], totalPages: 1 } } });
    page.render(); assert.equal(page.calls.at(-1).query.search, "GLOBAL");
    const search = page.all().find((node) => node.type === "Input" && node.props.placeholder === "Buyurtma yoki mijozni qidirish");
    assert.equal(search.props.value, "GLOBAL");
    search.props.onChange({ target: { value: "LOCAL" } });
    page.render(); assert.equal(page.calls.at(-1).query.search, "LOCAL");
    page.global(""); page.render(); assert.equal(page.calls.at(-1).query.search, "");
  });
  for (const [file, name, falseEmpty] of [
    ["admin-web/modules/dashboard/components/dashboard-overview.tsx", "DashboardOverview", ""],
    [ordersFile, "OrdersTable", "Jami 0 ta"],
    ["admin-web/modules/admins/components/admins-manager.tsx", "AdminsManager", "0 ta admin"],
    ["admin-web/modules/categories/components/categories-manager.tsx", "CategoriesManager", ""],
    ["admin-web/modules/audit/components/audit-logs-table.tsx", "AuditLogsTable", "Amallar tarixi topilmadi."]
  ]) await test(`${name}: initial query error is visible, retry invokes refetch, false empty state absent`, async () => {
    const page = fixture(file, name);
    assert.ok(alerts(page).includes("Synthetic API unavailable"));
    await page.click("Qayta urinish"); assert.equal(page.retries(), 1);
    assert.ok(!page.all().some((node) => node.type === "DataTable"));
    if (falseEmpty) assert.ok(!text(page.render()).includes(falseEmpty));
  });
  await test("Order detail query error has retry and does not claim record absent", async () => {
    const page = fixture(ordersFile, "OrdersTable", { orders: { data: { items: [{ orderId: "A" }], totalPages: 1 } } });
    page.all().find((node) => node.type === "DataTable").props.onRowClick({ orderId: "A" });
    assert.ok(alerts(page).includes("Synthetic API unavailable"));
    await page.click("Qayta urinish"); assert.equal(page.retries(), 1);
    assert.ok(!text(page.render()).includes("Buyurtma tafsilotlari topilmadi."));
  });
  await test("Support: delayed A update preserves selected B status and note, prevents duplicate writes", async () => {
    const update = defer(), writes = [];
    const page = fixture(supportFile, "SupportCenter", { session: manager(["support.manage"]), support: { getSupportTickets: async () => tickets, updateSupportTicket: (...args) => { writes.push(args); return update.promise; } } });
    await page.click("Filtrlash"); await page.select("A");
    const pending = page.click("Hal qilish");
    assert.equal(page.button("Hal qilish").props.disabled, true);
    await page.click("Hal qilish"); assert.equal(writes.length, 1);
    await page.select("B"); update.resolve(); await pending;
    assert.equal(page.slots[1].id, "B"); assert.equal(page.slots[1].status, "OPEN"); assert.equal(page.slots[1].adminNote, "note-B");
    assert.equal(page.all().find((node) => node.type === "textarea").props.value, "note-B");
    assert.equal(page.button("Hal qilish").props.disabled, false);
    await page.flushEffects();
  });
  for (const rejected of [false, true]) await test(`Support: stale ${rejected ? "rejected" : "successful"} response cannot replace latest search or error/loading`, async () => {
    const first = defer(), second = defer(); let requests = 0;
    const page = fixture(supportFile, "SupportCenter", { support: { getSupportTickets: () => ++requests === 1 ? first.promise : second.promise } });
    const older = page.click("Filtrlash");
    page.all().find((node) => node.type === "Input").props.onChange({ target: { value: "new-query" } });
    const newer = page.click("Yuklanmoqda...");
    second.resolve([{ ...tickets[1], id: "new" }]); await newer;
    if (rejected) first.reject(new Error("Old failure")); else first.resolve([{ ...tickets[0], id: "old" }]);
    await older;
    assert.equal(page.slots[0][0].id, "new"); assert.equal(alerts(page), ""); assert.ok(!text(page.render()).includes("Old failure")); assert.ok(page.button("Filtrlash"));
  });
  await test("Support: older response cannot stop loading while latest request is pending", async () => {
    const first = defer(), second = defer(); let requests = 0;
    const page = fixture(supportFile, "SupportCenter", { support: { getSupportTickets: () => ++requests === 1 ? first.promise : second.promise } });
    const older = page.click("Filtrlash");
    page.all().find((node) => node.type === "Input").props.onChange({ target: { value: "latest" } });
    const newer = page.click("Yuklanmoqda...");
    first.resolve([{ ...tickets[0], id: "old" }]); await older;
    assert.equal(page.slots[0].length, 0); assert.ok(page.button("Yuklanmoqda..."));
    second.resolve([{ ...tickets[1], id: "new" }]); await newer;
    assert.equal(page.slots[0][0].id, "new"); assert.ok(page.button("Filtrlash"));
  });
  await test("Support: successful delayed save refreshes current search instead of old closure", async () => {
    const update = defer(), queries = [];
    const page = fixture(supportFile, "SupportCenter", { session: manager(["support.manage"]), support: { getSupportTickets: async (query) => { queries.push(query); return tickets; }, updateSupportTicket: () => update.promise } });
    await page.flushEffects(); await page.select("A"); const pending = page.click("Hal qilish");
    page.all().find((node) => node.type === "Input").props.onChange({ target: { value: "latest" } });
    await page.flushEffects(); update.resolve(); await pending; await page.flushEffects();
    assert.equal(queries.at(-1), "?search=latest");
  });
  await test("Reports: status failure is caught, visible and retryable", async () => {
    let failure = true;
    const page = fixture(reportsFile, "ReportsCenter", { session: reportsSession, reports: { getReports: async () => [report()], getReport: async () => report(), updateReport: async () => { if (failure) throw new Error("Synthetic moderation failure"); } } });
    await page.click("Filtrlarni qo'llash"); await page.select("A");
    await page.click("Hal qilish"); assert.ok(alerts(page).includes("Synthetic moderation failure"));
    assert.equal(page.button("Hal qilish").props.disabled, false);
    failure = false; await page.click("Hal qilish"); assert.equal(alerts(page), ""); assert.equal(page.slots[1].status, "RESOLVED");
  });
  for (const type of ["USER", "REVIEW"]) await test(`Reports ${type}: partial target success is explicit; status-only recovery avoids target replay`, async () => {
    let failure = true, actions = 0; const writes = [];
    const record = report("A", type);
    const page = fixture(reportsFile, "ReportsCenter", { session: reportsSession, reports: {
      getReports: async () => [record], getReport: async () => record,
      updateReport: async (...args) => { writes.push(args); if (failure) throw new Error("Status write rejected"); },
      suspendUser: async () => { actions += 1; }, moderateReview: async () => { actions += 1; }
    } });
    await page.click("Filtrlarni qo'llash"); await page.select("A");
    const label = type === "USER" ? "Foydalanuvchini to'xtatish" : "Sharhni yashirish";
    await page.click(label); assert.equal(actions, 1);
    assert.ok(alerts(page).includes("Amal bajarildi, ammo shikoyat holati saqlanmadi"));
    assert.equal(page.button(label).props.disabled, true);
    await page.click(label); assert.equal(actions, 1);
    failure = false; await page.click("Amal holatini saqlash");
    assert.equal(actions, 1); assert.equal(writes.at(-1)[1], "ACTION_TAKEN");
    assert.equal(page.slots[1].status, "ACTION_TAKEN"); assert.equal(alerts(page), "");
  });
  await test("Reports: first-step target failure does not change report status", async () => {
    let writes = 0;
    const page = fixture(reportsFile, "ReportsCenter", { session: reportsSession, reports: { getReports: async () => [report()], getReport: async () => report(), updateReport: async () => { writes += 1; }, suspendUser: async () => { throw new Error("Suspend failed"); } } });
    await page.click("Filtrlarni qo'llash"); await page.select("A"); await page.click("Foydalanuvchini to'xtatish");
    assert.equal(writes, 0); assert.ok(alerts(page).includes("Suspend failed"));
  });
  await test("Reports: delayed A status update cannot replace selected B or its note", async () => {
    const update = defer();
    const page = fixture(reportsFile, "ReportsCenter", { session: reportsSession, reports: { getReports: async () => [report("A"), report("B")], getReport: async (id) => report(id), updateReport: () => update.promise } });
    await page.click("Filtrlarni qo'llash"); await page.select("A"); const pending = page.click("Hal qilish"); await page.select("B");
    update.resolve(); await pending;
    assert.equal(page.slots[1].id, "B"); assert.equal(page.slots[1].status, "PENDING"); assert.equal(page.all().find((node) => node.type === "textarea").props.value, "note-B");
  });
  await test("Reports: older detail response cannot replace newer selection", async () => {
    const first = defer(), second = defer();
    const page = fixture(reportsFile, "ReportsCenter", { session: reportsSession, reports: { getReports: async () => [report("A"), report("B")], getReport: (id) => id === "A" ? first.promise : second.promise } });
    await page.click("Filtrlarni qo'llash"); const older = page.select("A"); const newer = page.select("B");
    second.resolve(report("B")); await newer; first.resolve(report("A")); await older;
    assert.equal(page.slots[1].id, "B"); assert.equal(page.all().find((node) => node.type === "textarea").props.value, "note-B");
  });
  await test("Reports: detail refresh failure preserves saved status and remains visible after list refresh", async () => {
    let details = 0;
    const record = report();
    const page = fixture(reportsFile, "ReportsCenter", { session: reportsSession, reports: {
      getReports: async () => [record], getReport: async () => { if (++details > 1) throw new Error("Detail refresh rejected"); return record; },
      updateReport: async (_id, status) => { record.status = status; }, suspendUser: async () => {}
    } });
    await page.flushEffects(); await page.select("A"); await page.click("Foydalanuvchini to'xtatish");
    assert.equal(page.slots[1].status, "ACTION_TAKEN");
    assert.ok(alerts(page).includes("Amal bajarildi va shikoyat holati saqlandi"));
    await page.flushEffects(); assert.ok(alerts(page).includes("Detail refresh rejected"));
  });
  await test("Reports: pending target action cannot be repeated", async () => {
    const target = defer(); let actions = 0, writes = 0;
    const record = report();
    const page = fixture(reportsFile, "ReportsCenter", { session: reportsSession, reports: {
      getReports: async () => [record], getReport: async () => record, updateReport: async (_id, status) => { writes += 1; record.status = status; },
      suspendUser: () => { actions += 1; return target.promise; }
    } });
    await page.click("Filtrlarni qo'llash"); await page.select("A"); const pending = page.click("Foydalanuvchini to'xtatish");
    assert.equal(page.button("Foydalanuvchini to'xtatish").props.disabled, true);
    await page.click("Foydalanuvchini to'xtatish"); await page.click("Hal qilish"); assert.equal(actions, 1); assert.equal(writes, 0);
    target.resolve(); await pending; assert.equal(writes, 1); assert.equal(page.slots[1].status, "ACTION_TAKEN");
  });
  console.log(`${passed + failed} admin audit regression cases: ${passed} passed, ${failed} failed${baseline ? " (pre-fix snapshots)" : ""}.`);
  if (failed) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
