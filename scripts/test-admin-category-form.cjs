/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("../backend/node_modules/typescript");

const root = path.resolve(__dirname, "..");
const cache = new Map();
let state = [];
let slot = 0;
let pending;
let failure = null;
const calls = [];
const invalidations = [];
const categories = [{ id: "cat_one", slug: "plumbing", nameUz: "Santexnik", nameRu: "Сантехник", nameEn: "Plumber", iconKey: "wrench", isActive: true, sortOrder: 0 }];

function element(type, props) { return { type, props }; }
function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const target = new Module(filename);
  target.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = target.require.bind(target);
  target.require = (id) => {
    if (id === "react") return {
      useState: (initial) => { const index = slot++; if (!(index in state)) state[index] = initial; return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; },
      useMemo: (fn) => fn()
    };
    if (id === "react/jsx-runtime") return { jsx: element, jsxs: element };
    if (id === "@tanstack/react-query") return {
      useQueryClient: () => ({ invalidateQueries: async (query) => invalidations.push(query.queryKey) }),
      useMutation: (options) => ({ isPending: false, mutate: () => {
        pending = (async () => {
          try { await options.mutationFn(); await options.onSuccess?.(); }
          catch (error) { await options.onError?.(error); }
        })();
      } })
    };
    if (id === "@/stores/admin-session-store") return { useAdminSessionStore: (selector) => selector({ session: { role: "super_admin" } }) };
    if (id === "@/shared/auth/permissions") return { hasPermission: () => true };
    if (id === "../hooks/use-categories") return { useCategories: () => ({ data: { categories, iconKeys: ["grid", "lock", "wrench"] } }) };
    if (id === "../category-icons") return { resolveCategoryIcon: () => "Icon", resolveCategoryIconLabel: (key) => key };
    if (id === "../category-form") return load(path.resolve(path.dirname(filename), "../category-form.ts"));
    if (id === "../services/categories-service") return {
      createCategory: async (input) => { calls.push({ method: "create", input }); if (failure) throw failure; },
      updateCategory: async (id, input) => { calls.push({ method: "update", id, input }); if (failure) throw failure; }
    };
    if (id.startsWith("@/components/") || id.startsWith("@/shared/components/") || id === "lucide-react") return new Proxy({}, { get: (_target, key) => String(key) });
    return originalRequire(id);
  };
  target._compile(compiled, filename);
  cache.set(filename, target.exports);
  return target.exports;
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const { CategoriesManager } = load(path.join(root, "admin-web/modules/categories/components/categories-manager.tsx"));
const { validateCategoryDraft, categorySaveErrorMessage } = load(path.join(root, "admin-web/modules/categories/category-form.ts"));
const { createCategorySchema } = load(path.join(root, "backend/src/modules/categories/category.contracts.ts"));
const render = () => { slot = 0; return CategoriesManager(); };
function change(label, value) {
  const control = nodes(nodes(render()).find((node) => node.type === "label" && node.props.children[0] === label))
    .find((node) => ["Input", "select"].includes(node.type));
  assert.ok(control, `Missing ${label} control`);
  control.props.onChange({ target: { value } });
}
async function submit() {
  pending = undefined;
  nodes(render()).find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  await pending;
}
const errorText = () => nodes(render()).find((node) => node.props?.role === "alert")?.props.children;

async function main() {
  const reported = { slug: "test slug", nameUz: "yangi", nameRu: "noviy", nameEn: "new", iconKey: "lock", isActive: true };
  const rejected = createCategorySchema.safeParse(reported);
  assert.equal(rejected.success, false);
  assert.deepEqual(Object.keys(rejected.error.flatten().fieldErrors), ["slug"]);
  for (const [label, field] of [["Slug", "slug"], ["O'zbekcha nomi", "nameUz"], ["Ruscha nomi", "nameRu"], ["Inglizcha nomi", "nameEn"], ["Ikonka", "iconKey"]]) change(label, reported[field]);
  await submit();
  assert.equal(calls.length, 0, "Reported invalid slug must never reach the create API");
  assert.match(errorText(), /Slug:.*Bo'shliq.*test-slug/);
  const slugInput = nodes(render()).find((node) => node.type === "Input" && node.props.value === "test slug");
  assert.ok(nodes(render()).some((node) => node.props?.id === slugInput.props["aria-describedby"]), "Slug format help must be associated with the input");

  change("Slug", "test-slug");
  await submit();
  assert.equal(calls.length, 1);
  assert.equal(createCategorySchema.safeParse(calls[0].input).success, true, "Corrected actual form payload must satisfy the backend contract");
  assert.equal(errorText(), undefined);
  assert.deepEqual(invalidations, [["categories"]]);

  for (const slug of ["Test-slug", "test--slug", "-test", "test-", "a", "a".repeat(65)]) {
    assert.match(validateCategoryDraft({ ...reported, slug }, false), /Slug:/);
  }
  for (const name of ["", "  ", " x ", "a".repeat(81)]) {
    assert.match(validateCategoryDraft({ ...reported, slug: "test-slug", nameRu: name }, false), /Ruscha nomi:/);
  }
  assert.equal(validateCategoryDraft({ ...reported, slug: " test-slug " }, false), null, "Surrounding whitespace accepted by backend trim must remain accepted");
  assert.equal(validateCategoryDraft(reported, true), null, "Immutable slug must not be revalidated on edits");

  const apiError = Object.assign(new Error("Request validation failed"), { code: "VALIDATION_ERROR", payload: { issues: rejected.error.flatten() } });
  assert.match(categorySaveErrorMessage(apiError), /Slug:.*test-slug/);
  assert.equal(categorySaveErrorMessage(Object.assign(new Error("Forbidden"), { code: "PERMISSION_DENIED" })), "Forbidden");
  assert.equal(categorySaveErrorMessage(Object.assign(new Error("Request validation failed"), { code: "VALIDATION_ERROR", payload: { issues: { fieldErrors: null } } })), "Request validation failed");

  state = [];
  const table = nodes(render()).find((node) => node.type === "DataTable");
  const actions = nodes(table.props.columns.at(-1).cell({ row: { original: categories[0] } }));
  actions.find((node) => node.type === "Button" && nodes(node).some((child) => child.type === "Pencil")).props.onClick();
  failure = Object.assign(new Error("Request validation failed"), { code: "VALIDATION_ERROR", payload: { issues: { fieldErrors: { iconKey: ["Invalid enum value"] } } } });
  await submit();
  assert.equal(calls.at(-1).method, "update");
  assert.equal("slug" in calls.at(-1).input, false, "Edit request must preserve the immutable-slug API contract");
  assert.match(errorText(), /Ikonka:/, "Server validation errors must identify the failed field in the actual component");
  console.log("Admin category form: reported slug rejected before API; corrected payload, edit contract, field errors and validation boundaries PASS.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
