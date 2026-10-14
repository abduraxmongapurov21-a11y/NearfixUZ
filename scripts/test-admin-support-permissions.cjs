/* global __dirname */
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("../backend/node_modules/typescript");

const root = path.resolve(__dirname, "../admin-web");
const sourcePath = path.join(root, "modules/support/components/support-center.tsx");
const source = fs.readFileSync(sourcePath, "utf8");
const sourceHash = createHash("sha256").update(source).digest("hex");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const permissionPath = path.join(root, "shared/auth/permissions.ts");
const permissionsModule = new Module(permissionPath);
permissionsModule._compile(ts.transpileModule(fs.readFileSync(permissionPath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, permissionPath);

const tickets = [
  { id: "ticket-a", reason: "Synthetic support A", message: "Synthetic message", status: "OPEN", adminNote: "Saved A", user: { name: "QA A", phone: "fixture-a" } },
  { id: "ticket-b", reason: "Synthetic support B", status: "RESOLVED", adminNote: "Saved B", user: { name: "QA B", phone: "fixture-b" } }
];
const clone = (value) => JSON.parse(JSON.stringify(value));
const element = (type, props, key) => ({ type, props, key });
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const labels = { IN_PROGRESS: "Jarayonga olish", RESOLVED: "Hal qilish", CLOSED: "Yopish" };
function fixture(session) {
  const slots = [];
  let slot = 0;
  let effects = [];
  let failure = null;
  const requests = [];
  const writes = [];
  const useAdminSessionStore = (selector) => selector({ session });
  useAdminSessionStore.getState = () => ({ session });
  const target = new Module(sourcePath);
  const originalRequire = target.require.bind(target);
  target.require = (id) => {
    if (id === "react") return {
      useState(initial) {
        const index = slot++;
        if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
        return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
      },
      useRef(initial) {
        const index = slot++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useCallback(callback, deps) {
        const index = slot++;
        const previous = slots[index];
        if (!previous || deps.some((value, position) => !Object.is(value, previous.deps[position]))) slots[index] = { callback, deps };
        return slots[index].callback;
      },
      useEffect(callback, deps) {
        const index = slot++;
        const previous = slots[index];
        if (!previous || deps.some((value, position) => !Object.is(value, previous.deps[position]))) {
          slots[index] = { deps };
          effects.push(callback);
        }
      }
    };
    if (id === "react/jsx-runtime") return { jsx: element, jsxs: element };
    if (id === "@/stores/admin-session-store") return { useAdminSessionStore };
    if (id === "@/shared/auth/permissions") return permissionsModule.exports;
    if (id === "@/lib/admin-labels") return { adminLabel: (value) => value };
    if (id === "../services/support-service") return {
      getSupportTickets: async (query) => { requests.push(query); return clone(tickets); },
      updateSupportTicket: async (id, status, adminNote) => { writes.push({ id, status, adminNote }); if (failure) throw failure; }
    };
    if (id.startsWith("@/components/ui/")) return new Proxy({}, { get: (_target, key) => String(key) });
    return originalRequire(id);
  };
  target._compile(compiled, sourcePath);
  function render() {
    slot = 0;
    const tree = target.exports.SupportCenter();
    const pendingEffects = effects;
    effects = [];
    pendingEffects.forEach((callback) => callback());
    return tree;
  }
  async function settle() {
    await Promise.resolve();
    await Promise.resolve();
    return render();
  }
  async function ready() { render(); await settle(); select("ticket-a"); }
  function select(id) {
    const row = nodes(render()).find((node) => node.type === "button" && node.key === id);
    assert.ok(row, "Real support ticket row exists");
    row.props.onClick();
  }
  function action(status) {
    const button = nodes(render()).find((node) => node.type === "Button" && node.props.children === labels[status]);
    assert.ok(button, `Real ${status} write control exists`);
    return button;
  }
  function note() { return nodes(render()).find((node) => node.type === "textarea"); }
  return { render, settle, ready, select, action, note, requests, writes, fail: (value) => { failure = value; } };
}

let passed = 0;
let failed = 0;
async function test(label, run) {
  try { await run(); passed += 1; console.log(`[SUPPORT] PASS ${label}`); }
  catch (error) { failed += 1; console.log(`[SUPPORT] FAIL ${label}: ${error.message}`); }
}
function session(permissions, role = "admin", tokenType = "admin_account") {
  return { id: "synthetic-admin", token: "synthetic-session-token", permissions, role, tokenType };
}
function assertReadOnly(page) {
  for (const status of Object.keys(labels)) assert.equal(page.action(status).props.disabled, true, "Readonly status controls must be disabled");
  assert.ok(page.note().props.disabled || page.note().props.readOnly, "Readonly admin note must not accept edits");
}

(async () => {
  console.log(`[SUPPORT] Full SupportCenter TSX source SHA256=${sourceHash}; deterministic React hook/service fixture; no HTTP/DB`);
  await test("support.read: three write controls and note editor are readonly", async () => {
    const page = fixture(session(["support.read"])); await page.ready(); assertReadOnly(page);
  });
  for (const status of Object.keys(labels)) await test(`support.read: direct ${status} handler cannot call write service`, async () => {
    const page = fixture(session(["support.read"])); await page.ready();
    await page.action(status).props.onClick();
    assert.equal(page.writes.length, 0, "Disabled control also requires a handler permission guard");
  });
  for (const [label, actor] of [["unrelated manage permission", session(["support.read", "reports.manage"])], ["absent session", null]]) {
    await test(`${label}: no support write capability`, async () => {
      const page = fixture(actor); await page.ready(); assertReadOnly(page);
      await page.action("CLOSED").props.onClick(); assert.equal(page.writes.length, 0);
    });
  }
  await test("support.manage: note editor and all status controls enabled", async () => {
    const page = fixture(session(["support.read", "support.manage"])); await page.ready();
    for (const status of Object.keys(labels)) assert.ok(!page.action(status).props.disabled);
    assert.ok(!page.note().props.disabled && !page.note().props.readOnly);
  });
  for (const status of Object.keys(labels)) await test(`support.manage: existing ${status} save flow remains available`, async () => {
    const page = fixture(session(["support.read", "support.manage"])); await page.ready();
    page.note().props.onChange({ target: { value: "Synthetic manager note" } });
    await page.action(status).props.onClick();
    await page.settle();
    assert.deepEqual(page.writes, [{ id: "ticket-a", status, adminNote: "Synthetic manager note" }]);
    assert.equal(page.requests.length, 2, "Existing successful save refresh remains intact");
  });
  for (const [label, actor] of [["DB super admin", session([], "super_admin")], ["environment admin", session([], "admin", "env_admin")]]) {
    await test(`${label}: implicit support manage capability preserved`, async () => {
      const page = fixture(actor); await page.ready();
      assert.ok(!page.action("RESOLVED").props.disabled);
      await page.action("RESOLVED").props.onClick(); assert.equal(page.writes.length, 1);
    });
  }
  await test("readonly browsing, search and status filter still load tickets", async () => {
    const page = fixture(session(["support.read"])); await page.ready(); page.select("ticket-b");
    const search = nodes(page.render()).find((node) => node.type === "Input");
    search.props.onChange({ target: { value: "Synthetic query" } }); await page.settle(); await page.settle();
    nodes(page.render()).find((node) => node.type === "select").props.onChange({ target: { value: "OPEN" } });
    await page.settle(); await page.settle();
    assert.equal(page.requests.at(-1), "?status=OPEN&search=Synthetic+query");
    assert.equal(page.writes.length, 0);
    assert.equal(page.note().props.value, "Saved B");
  });
  await test("current manager save failure remains visible without successful reload", async () => {
    const page = fixture(session(["support.manage"])); await page.ready();
    page.fail(new Error("Synthetic support save rejected"));
    await page.action("CLOSED").props.onClick();
    assert.ok(nodes(page.render()).some((node) => node.props?.children === "Synthetic support save rejected"));
    assert.equal(page.requests.length, 1);
  });
  console.log(`[SUPPORT] ${passed + failed} cases; ${passed} passed; ${failed} failed. Scope=permissions only; save/session races intentionally deferred.`);
  if (failed) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
