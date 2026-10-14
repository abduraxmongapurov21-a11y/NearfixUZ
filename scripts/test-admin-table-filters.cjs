/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("../backend/node_modules/typescript");

const root = path.resolve(__dirname, "../admin-web");
let state = [];
let slot = 0;
let globalSearch = "";
let permission = true;
let loadError = null;
let loading = false;
let mutations = [];
let executeMutations = false;
let mutationPending = false;
let mutationVariable;
let pendingMutation;
let apiFailure = null;
let apiWait = null;
let apiCalls = [];
let invalidations = [];
let token = "audit-admin-token";
const fixtures = {
  workers: [
    { id: "w1", name: "Rustam Karimov", phone: "+998 90 123 45 67", profession: "Elektrik", professions: ["Elektrik", "Santexnik"], city: "tashkent", status: "approved" },
    { id: "w2", name: "Ali Valiyev", phone: "+998 91 999 00 00", profession: "Santexnik", professions: ["Santexnik"], city: "samarqand", status: "suspended" },
    { id: "w3", name: "Yangi Usta", phone: "+998 93 111 00 00", profession: "Elektrik", professions: ["Elektrik"], city: "tashkent", status: "draft", submittedAt: "05.10.2026", experienceYears: 3, basePrice: 100000, profileImageUrl: "/a.jpg", bio: "Tajriba" }
  ],
  users: [
    { id: "u1", name: "Aziza Aliyeva", phone: "+998 90 123 45 67", role: "client", city: "tashkent", registeredAt: "05.10.2026" },
    { id: "u2", name: "Rustam Karimov", phone: "+998 91 999 00 00", role: "provider", city: "samarqand", registeredAt: "04.10.2026" }
  ],
  reviews: [
    { id: "r1", worker: "Rustam Karimov", client: "Aziza", rating: 5, text: "Juda yaxshi", date: "05.10.2026", status: "published" },
    { id: "r2", worker: "Ali Valiyev", client: "Akmal", rating: 2, text: "Kechikdi", date: "04.10.2026", status: "hidden" }
  ]
};
const cache = new Map();
function load(relativePath) {
  const filename = path.join(root, relativePath);
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const target = new Module(filename);
  target.paths = Module._nodeModulePaths(path.dirname(filename));
  const defaultRequire = target.require.bind(target);
  target.require = (id) => {
    if (id === "react") return {
      useState: (initial) => { const index = slot++; if (!(index in state)) state[index] = initial; return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; },
      useMemo: (factory) => factory()
    };
    if (id === "react/jsx-runtime") return { jsx: element, jsxs: element, Fragment: "Fragment" };
    if (id === "@tanstack/react-query") return {
      useQueryClient: () => ({ invalidateQueries: async (query) => { invalidations.push(query.queryKey); } }),
      useMutation: (options) => ({ isPending: mutationPending, variables: mutationVariable, mutate: (value) => {
        mutations.push(value);
        if (!executeMutations) return;
        mutationPending = true;
        mutationVariable = value;
        pendingMutation = (async () => {
          try {
            await options.onMutate?.(value);
            const result = await options.mutationFn(value);
            await options.onSuccess?.(result, value);
          } catch (error) {
            await options.onError?.(error);
          } finally {
            mutationPending = false;
            await options.onSettled?.();
          }
        })();
      } })
    };
    if (/hooks\/use-(workers|users|reviews)$/.test(id)) {
      const table = id.match(/use-(workers|users|reviews)$/)[1];
      const name = `use${table[0].toUpperCase()}${table.slice(1)}`;
      return { [name]: () => ({ data: fixtures[table], error: loadError, isPending: loading, refetch: async () => {} }) };
    }
    if (id === "@/stores/ui-store") return { useAdminUiStore: (selector) => selector({ globalSearch }) };
    if (id === "@/stores/admin-session-store") return { useAdminSessionStore: (selector) => selector({ session: { role: "admin", permissions: permission ? ["workers.manage", "reviews.manage", "users.manage"] : [] } }) };
    if (id === "@/shared/auth/permissions") return load("shared/auth/permissions.ts");
    if (id === "@/shared/utils/table-filters") return load("shared/utils/table-filters.ts");
    if (id === "@/shared/components/filter-bar") return load("shared/components/filter-bar.tsx");
    if (id === "@/lib/admin-labels") return load("lib/admin-labels.ts");
    if (id.includes("tables/workers-columns")) return { workersColumns: [] };
    if (id.includes("tables/users-columns")) return load("modules/users/tables/users-columns.tsx");
    if (id.includes("workers-service") || id.includes("reviews-service")) return {};
    if (id === "@/services/api-client") return {
      ApiClientError: class extends Error {},
      getAdminToken: () => token,
      apiClient: async (url, init) => {
        apiCalls.push({ url, init });
        if (apiWait) await apiWait;
        if (apiFailure) throw apiFailure;
        return { ok: true };
      }
    };
    if (id.startsWith("@/components/") || id.startsWith("@/shared/components/") || id === "lucide-react") return new Proxy({}, { get: (_target, key) => String(key) });
    return defaultRequire(id);
  };
  target._compile(compiled, filename);
  cache.set(filename, target.exports);
  return target.exports;
}
function element(type, props, key) { return { type, props, key }; }
function nodes(rootNode) {
  if (rootNode === null || rootNode === undefined || typeof rootNode !== "object") return [];
  if (Array.isArray(rootNode)) return rootNode.flatMap(nodes);
  if (typeof rootNode.type === "function") return [rootNode, ...nodes(rootNode.type(rootNode.props))];
  return [rootNode, ...nodes(rootNode.props?.children)];
}
function rows(tree) { return nodes(tree).filter((node) => node.type === "DataTable").flatMap((node) => node.props.data); }
function reset() {
  state = []; globalSearch = ""; permission = true; loadError = null; loading = false; mutations = [];
  executeMutations = false; mutationPending = false; mutationVariable = undefined; pendingMutation = undefined;
  apiFailure = null; apiWait = null; apiCalls = []; invalidations = []; token = "audit-admin-token";
}
function setup(table) {
  reset();
  const Component = load(`modules/${table}/components/${table}-table.tsx`)[`${table[0].toUpperCase()}${table.slice(1)}Table`];
  const render = () => { slot = 0; return Component(); };
  const search = (value) => {
    const bar = nodes(render()).find((node) => node.type === load("shared/components/filter-bar.tsx").FilterBar);
    assert.equal(typeof bar.props.onSearchChange, "function", `${table} search must be connected to state and row filtering`);
    bar.props.onSearchChange(value);
    return render();
  };
  const select = (label, value) => {
    const control = nodes(render()).find((node) => node.type === "select" && node.props["aria-label"] === label);
    assert.ok(control, `${table} ${label} must be a labelled select with a working change handler`);
    control.props.onChange({ target: { value } });
    return render();
  };
  return { render, search, select };
}

for (const table of ["workers", "users", "reviews"]) {
  const page = setup(table);
  assert.deepEqual(rows(page.search("no matching record")), [], `${table} must remove non-matching rows`);
  page.search("");
  assert.ok(rows(page.render()).length > 0, `${table} clearing search restores rows`);
  globalSearch = "no matching record";
  assert.deepEqual(rows(page.render()), [], `${table} must consume topbar search`);
  globalSearch = "";
  loadError = new Error("Audit: unavailable");
  assert.ok(nodes(page.render()).some((node) => node.props?.role === "alert"), `${table} load errors must be visible`);
  loading = true;
  assert.ok(nodes(page.render()).some((node) => node.props?.role === "status"), `${table} loading must be visible`);
}
let page = setup("workers");
assert.deepEqual(rows(page.search("rustam elektrik")).map((row) => row.id), ["w1"]);
assert.deepEqual(rows(page.search("901234567")).map((row) => row.id), ["w1"], "formatted phone search");
page.search("");
assert.deepEqual(rows(page.select("Kasb", "Elektrik")).map((row) => row.id), ["w1"]);
page.select("Kasb", "");
assert.deepEqual(rows(page.select("Holat", "suspended")).map((row) => row.id), ["w2"]);
page.select("Holat", "");
assert.deepEqual(rows(page.select("Shahar", "samarqand")).map((row) => row.id), ["w2"]);
page.select("Shahar", "");
permission = false;
const workerActions = nodes(page.render()).filter((node) => node.type === "DataTable").flatMap((node) => node.props.columns.filter((column) => column.id === "actions").flatMap((column) => nodes(column.cell({ row: { original: node.props.data[0] } }))));
assert.ok(workerActions.filter((node) => node.type === "Button").every((node) => node.props.disabled), "read-only workers actions must be disabled");
workerActions.find((node) => node.type === "Button").props.onClick();
assert.equal(mutations.length, 0, "read-only workers must not invoke mutation even if a click is called");
page = setup("users");
assert.deepEqual(rows(page.select("Rol", "provider")).map((row) => row.id), ["u2"]);
page.select("Rol", "");
assert.deepEqual(rows(page.select("Shahar", "tashkent")).map((row) => row.id), ["u1"]);
page.select("Shahar", "");
assert.deepEqual(rows(page.select("Ro'yxatdan o'tgan sana", "04.10.2026")).map((row) => row.id), ["u2"]);
page = setup("reviews");
assert.deepEqual(rows(page.search("juda yaxshi")).map((row) => row.id), ["r1"], "review text search");
page.search("");
assert.deepEqual(rows(page.select("Reyting", "2")).map((row) => row.id), ["r2"]);
page.select("Reyting", "");
assert.deepEqual(rows(page.select("Holat", "hidden")).map((row) => row.id), ["r2"]);
page.select("Holat", "");
assert.deepEqual(rows(page.select("Sana", "05.10.2026")).map((row) => row.id), ["r1"]);
page.select("Sana", "");
permission = false;
const reviewTable = nodes(page.render()).find((node) => node.type === "DataTable");
const reviewAction = nodes(reviewTable.props.columns.find((column) => column.id === "actions").cell({ row: { original: fixtures.reviews[0] } })).find((node) => node.type === "Button");
assert.equal(reviewAction.props.disabled, true);
reviewAction.props.onClick();
assert.equal(mutations.length, 0, "read-only review action must not invoke mutation");

function userAction(page) {
  const table = nodes(page.render()).find((node) => node.type === "DataTable");
  const column = table.props.columns.find((column) => column.id === "actions");
  assert.ok(column, "Users must retain the existing action column");
  return nodes(column.cell({ row: { original: fixtures.users[0] } })).find((node) => node.type === "Button");
}

(async () => {
  page = setup("users");
  executeMutations = true;
  permission = false;
  assert.equal(userAction(page).props.disabled, true, "users.manage permission is required");
  userAction(page).props.onClick();
  assert.equal(apiCalls.length, 0, "read-only Users must not call promotion API");
  assert.equal(mutations.length, 0);

  permission = true;
  let resolveApi;
  apiWait = new Promise((resolve) => { resolveApi = resolve; });
  userAction(page).props.onClick();
  await Promise.resolve();
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].url, "/admin/users/u1/promote-provider");
  assert.equal(apiCalls[0].init.method, "POST");
  assert.equal(apiCalls[0].init.token, token);
  assert.equal(userAction(page).props.disabled, true, "pending promotion cannot be repeated");
  assert.equal(userAction(page).props.children, "Tayyorlanmoqda...");
  userAction(page).props.onClick();
  assert.equal(apiCalls.length, 1);
  resolveApi();
  await pendingMutation;
  assert.ok(nodes(page.render()).some((node) => node.props?.role === "status" && node.props.children === "Usta arizasi uchun profil tayyorlandi."), "application preparation success must be visible");
  assert.deepEqual(invalidations, [["users"], ["workers"]], "refresh both affected lists after application preparation");
  assert.equal(userAction(page).props.disabled, false);
  assert.equal(fixtures.users[0].role, "client", "client role stays unchanged until worker application approval");

  apiWait = null;
  apiFailure = new Error("Audit: application rejected");
  userAction(page).props.onClick();
  await pendingMutation;
  assert.ok(nodes(page.render()).some((node) => node.props?.role === "alert" && node.props.children === apiFailure.message), "promotion failure must be caught and visible");
  assert.ok(!nodes(page.render()).some((node) => node.props?.role === "status" && node.props.children === "Usta arizasi uchun profil tayyorlandi."), "previous success clears before retry");
  assert.equal(invalidations.length, 2, "failed preparation must not claim success or refresh as successful");
  assert.equal(userAction(page).props.disabled, false, "failed action permits retry");

  token = null;
  apiFailure = null;
  const callsBeforeLogout = apiCalls.length;
  userAction(page).props.onClick();
  await pendingMutation;
  assert.equal(apiCalls.length, callsBeforeLogout, "missing token must not call API");
  assert.ok(nodes(page.render()).some((node) => node.props?.role === "alert" && node.props.children === "Admin sifatida kirish talab qilinadi"));
  console.log("Admin tables passed: local/global search, all filters, phone/text search, errors/loading, read-only guards and Users promotion pending/success/error/token/refetch cycles.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
