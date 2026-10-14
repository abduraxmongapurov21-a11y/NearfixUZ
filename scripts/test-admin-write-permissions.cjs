/* global __dirname */
// Actual TSX + real permission helper; deterministic hook/JSX/service mocks.
// Browser rendering, HTTP authorization and upload delivery are separate gates.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const crypto = require("node:crypto");
const ts = require("../backend/node_modules/typescript");
const root = path.resolve(__dirname, "..");
const reproduce = process.argv.includes("--reproduce");
const sources = ["admin-web/modules/banners/components/banners-manager.tsx", "admin-web/modules/reports/components/reports-center.tsx"];
const outcomes = [];
const element = (type, props, key) => ({ type, props, key });
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const text = (node) => {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(text).join("");
  return node && typeof node === "object" ? text(node.props?.children) : "";
};
function fixture(component, session, targetType = "USER") {
  let state = [], slot = 0;
  const calls = [], pending = [], prompts = [];
  const cache = new Map();
  const banner = (id, sortOrder) => ({ id, sortOrder, title: id, placement: "HOME", imageUrl: "/synthetic.png", mediaType: "IMAGE", targetType: "NONE", isActive: true });
  const banners = [banner("first", 0), banner("second", 1)];
  const report = { id: "report", targetType, targetId: "target", target: targetType === "MESSAGE" ? { senderId: "target-sender" } : { userId: "target-user" }, status: "PENDING", reason: "OTHER", adminNote: "", createdAt: "2026-10-10T00:00:00Z", reporter: { id: "reporter", name: "Synthetic", phone: "fixture" } };
  const call = (method) => async (...args) => { calls.push({ method, args }); return method === "upload" ? { imageUrl: "/uploaded.png", mediaType: "IMAGE" } : undefined; };
  function load(relative) {
    const filename = path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const target = new Module(filename);
    const original = target.require.bind(target);
    target.require = (id) => {
      if (id === "react") return {
        useState: (initial) => { const index = slot++; if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial; return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; },
        useRef: (initial) => { const index = slot++; if (!(index in state)) state[index] = { current: initial }; return state[index]; },
        useMemo: (fn) => fn(), useCallback: (fn) => fn, useEffect: () => {}
      };
      if (id === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (id === "@/stores/admin-session-store") return { useAdminSessionStore: (selector) => selector({ session }) };
      if (id === "@/shared/auth/permissions") return load("admin-web/shared/auth/permissions.ts");
      if (id === "@/lib/admin-labels") return { adminLabel: (value) => value };
      if (id === "@tanstack/react-query") return {
        useQueryClient: () => ({ invalidateQueries: async () => {} }),
        useMutation: (options) => ({ isPending: false, mutate: (value) => { pending.push((async () => { try { await options.onMutate?.(); const result = await options.mutationFn(value); await options.onSuccess?.(result); } catch (error) { if (options.onError) await options.onError(error); else throw error; } })()); } })
      };
      if (id === "../hooks/use-banners") return { useBanners: (placement) => ({ data: banners.map((item) => ({ ...item, placement })), isPending: false, isError: false }) };
      if (id === "@/modules/categories/hooks/use-categories") return { useCategories: () => ({ data: { categories: [] } }) };
      if (id === "../services/banners-service") return { createBanner: call("create"), updateBanner: call("update"), deleteBanner: call("delete"), reorderBanners: call("reorder"), uploadBannerMedia: call("upload") };
      if (id === "../services/reports-service") return { getReports: async () => [report], getReport: async () => report, updateReport: call("report-status"), suspendUser: call("suspend"), moderateReview: call("hide") };
      if (id.startsWith("@/components/") || id.startsWith("@/shared/components/") || id === "lucide-react") return new Proxy({}, { get: (_target, key) => String(key) });
      return original(id);
    };
    target._compile(compiled, filename); cache.set(filename, target.exports); return target.exports;
  }
  const Component = load(sources[component === "banners" ? 0 : 1])[component === "banners" ? "BannersManager" : "ReportsCenter"];
  let placement = "HOME";
  const render = () => { slot = 0; return Component(component === "banners" ? { placement } : undefined); };
  const all = () => nodes(render());
  const field = (id) => all().find((node) => node.props?.id === id);
  const button = (label) => all().find((node) => node.type === "Button" && text(node) === label);
  const rowActions = () => { const table = all().find((node) => node.type === "DataTable"); return nodes(table.props.columns.at(-1).cell({ row: { original: table.props.data[0] } })); };
  const bannerAction = (label) => rowActions().find((node) => node.type === "Button" && (node.props["aria-label"] === label || text(node) === label));
  async function invoke(node, handler = "onClick", argument) { if (node?.props[handler]) await node.props[handler](argument); await Promise.all(pending.splice(0)); }
  async function openReport() { await invoke(button("Filtrlarni qo'llash")); const row = all().find((node) => node.type === "button"); await invoke(row); }
  global.window = { confirm: () => { prompts.push("confirm"); return true; } };
  return { calls, prompts, all, field, button, bannerAction, invoke, openReport, setPlacement: (value) => { placement = value; }, render };
}
const admin = (permissions) => ({ role: "admin", tokenType: "admin_account", permissions });
async function test(name, fn) { await fn(); outcomes.push(name); console.log(`[P2] ${reproduce ? "REPRODUCE" : "PASS"} ${name}`); }
async function main() {
  for (const placement of ["HOME", "CATEGORY"]) {
    await test(`Banners ${placement}: read-only writes and controls`, async () => {
      const f = fixture("banners", admin(["content.read"])); f.setPlacement(placement);
      const actionLabels = ["Pastga", "Nofaol qilish", "Bannerni tahrirlash", "Bannerni o'chirish"];
      const controlsEnabled = actionLabels.every((label) => !f.bannerAction(label).props.disabled);
      for (const label of actionLabels) await f.invoke(f.bannerAction(label));
      await f.invoke(f.field("banner-media"), "onChange", { target: { files: [{}], value: "fixture.png" } });
      const form = f.all().find((node) => node.type === "form");
      await f.invoke(form, "onSubmit", { preventDefault() {} });
      const methods = [...new Set(f.calls.map((call) => call.method))].sort();
      if (reproduce) { assert.equal(controlsEnabled, true); assert.deepEqual(methods, ["delete", "reorder", "update", "upload"]); assert.equal(f.prompts.length, 1); }
      else {
        for (const label of actionLabels) assert.equal(f.bannerAction(label).props.disabled, true, `${label} disabled for read-only`);
        assert.deepEqual(f.calls, [], "read-only handlers never invoke writes, even when called directly"); assert.equal(f.prompts.length, 0);
        assert.ok(!form || f.all().some((node) => node.type === "fieldset" && node.props.disabled) || f.all().find((node) => node.type === "Button" && node.props.type === "submit")?.props.disabled);
        if (f.field("banner-media")) assert.equal(f.field("banner-media").props.disabled, true, "read-only media input disabled");
      }
    });
  }
  for (const targetType of ["USER", "WORKER", "MESSAGE", "REVIEW"]) {
    await test(`Reports ${targetType}: read-only controls and handlers`, async () => {
      const f = fixture("reports", admin(["reports.read"]), targetType); await f.openReport();
      const labels = ["Ko'rib chiqilmoqda", "Hal qilish", "Rad etish", targetType === "REVIEW" ? "Sharhni yashirish" : "Foydalanuvchini to'xtatish"];
      const enabled = labels.every((label) => !f.button(label).props.disabled);
      for (const label of labels) await f.invoke(f.button(label));
      if (reproduce) { assert.equal(enabled, true); assert.ok(f.calls.some((call) => call.method === "report-status")); assert.ok(f.calls.some((call) => call.method === (targetType === "REVIEW" ? "hide" : "suspend"))); }
      else { for (const label of labels) assert.equal(f.button(label).props.disabled, true, `${label} disabled for read-only`); assert.deepEqual(f.calls, []); assert.equal(f.all().find((node) => node.type === "textarea").props.disabled, true); }
    });
  }
  if (reproduce) return;
  await test("Banners null session: deny by default", async () => {
    const f = fixture("banners", null);
    for (const label of ["Pastga", "Nofaol qilish", "Bannerni tahrirlash", "Bannerni o'chirish"]) {
      assert.equal(f.bannerAction(label).props.disabled, true); await f.invoke(f.bannerAction(label));
    }
    await f.invoke(f.field("banner-media"), "onChange", { target: { files: [{}], value: "fixture.png" } });
    await f.invoke(f.all().find((node) => node.type === "form"), "onSubmit", { preventDefault() {} });
    assert.deepEqual(f.calls, []); assert.equal(f.prompts.length, 0);
  });
  await test("Reports null session: deny by default", async () => {
    const f = fixture("reports", null); await f.openReport();
    for (const label of ["Hal qilish", "Foydalanuvchini to'xtatish"]) { assert.equal(f.button(label).props.disabled, true); await f.invoke(f.button(label)); }
    assert.deepEqual(f.calls, []);
  });
  for (const [targetType, permission, actionLabel] of [["USER", "users.manage", "Foydalanuvchini to'xtatish"], ["REVIEW", "reviews.manage", "Sharhni yashirish"]]) {
    for (const [label, permissions, statusAllowed, targetAllowed] of [
      ["read only", ["reports.read"], false, false], ["target manage only", ["reports.read", permission], false, false],
      ["report manage only", ["reports.read", "reports.manage"], true, false], ["both manage", ["reports.read", "reports.manage", permission], true, true]
    ]) await test(`Reports ${targetType}: ${label} independent permission boundary`, async () => {
      const f = fixture("reports", admin(permissions), targetType); await f.openReport();
      assert.equal(Boolean(f.button("Hal qilish").props.disabled), !statusAllowed);
      assert.equal(Boolean(f.button(actionLabel).props.disabled), !targetAllowed);
      assert.equal(Boolean(f.all().find((node) => node.type === "textarea").props.disabled), !statusAllowed);
      await f.invoke(f.button(actionLabel));
      assert.equal(f.calls.some((call) => call.method === (targetType === "REVIEW" ? "hide" : "suspend")), targetAllowed);
      assert.equal(f.calls.some((call) => call.method === "report-status"), targetAllowed, "target denial must not advance report status");
      f.calls.length = 0;
      await f.invoke(f.button("Hal qilish"));
      assert.equal(f.calls.some((call) => call.method === "report-status"), statusAllowed);
    });
  }
  for (const [targetType, targetUserId] of [["WORKER", "target-user"], ["MESSAGE", "target-sender"]]) await test(`Reports ${targetType}: allowed suspension resolves trusted target identity`, async () => {
    const f = fixture("reports", admin(["reports.manage", "users.manage"]), targetType); await f.openReport();
    await f.invoke(f.button("Foydalanuvchini to'xtatish"));
    assert.deepEqual(f.calls, [{ method: "suspend", args: [targetUserId] }, { method: "report-status", args: ["report", "ACTION_TAKEN", ""] }]);
  });
  for (const [label, session] of [["manager", admin(["content.manage"])], ["DB super", { role: "super_admin", permissions: [] }], ["env admin", { role: "admin", tokenType: "env_admin", permissions: [] }]]) {
    await test(`Banners ${label}: writes remain available`, async () => {
      const f = fixture("banners", session);
      assert.equal(Boolean(f.bannerAction("Pastga").props.disabled), false);
      await f.invoke(f.bannerAction("Pastga")); await f.invoke(f.bannerAction("Nofaol qilish")); await f.invoke(f.bannerAction("Bannerni tahrirlash"));
      await f.invoke(f.all().find((node) => node.type === "form"), "onSubmit", { preventDefault() {} });
      await f.invoke(f.bannerAction("Bannerni o'chirish"));
      await f.invoke(f.field("banner-media"), "onChange", { target: { files: [{}], value: "fixture.png" } });
      await f.invoke(f.all().find((node) => node.type === "form"), "onSubmit", { preventDefault() {} });
      assert.deepEqual([...new Set(f.calls.map((call) => call.method))].sort(), ["create", "delete", "reorder", "update", "upload"]);
    });
  }
  for (const [label, session] of [["DB super", { role: "super_admin", permissions: [] }], ["env admin", { role: "admin", tokenType: "env_admin", permissions: [] }]]) await test(`Reports ${label}: target and status writes remain available`, async () => {
    const f = fixture("reports", session, "REVIEW"); await f.openReport(); await f.invoke(f.button("Sharhni yashirish"));
    assert.deepEqual(f.calls.map((call) => call.method), ["hide", "report-status"]);
  });
}
main().then(() => {
  const hashes = Object.fromEntries(sources.map((file) => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
  console.log(JSON.stringify({ mode: reproduce ? "before-reproduction" : "regression", cases: outcomes.length, pass: true, sourceHashes: hashes, limit: "Actual TSX callbacks with deterministic hook/JSX/API mocks; browser and backend gates separate" }));
}).catch((error) => { console.error(error); process.exitCode = 1; });
