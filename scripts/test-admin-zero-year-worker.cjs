/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { createRequire } = require("node:module");
const { createHash } = require("node:crypto");
const ts = require("../backend/node_modules/typescript");

const root = path.resolve(__dirname, "..");
const admin = path.join(root, "admin-web");
const adminRequire = createRequire(path.join(admin, "package.json"));
const React = adminRequire("react");
const { renderToStaticMarkup } = adminRequire("react-dom/server");
const sourceIndex = process.argv.indexOf("--source");
const componentPath = sourceIndex === -1 ? path.join(admin, "modules/workers/components/workers-table.tsx")
  : path.resolve(root, process.argv[sourceIndex + 1]);
const reproduce = process.argv.includes("--reproduce");
let permission = true;
let mutationPending = false;
let pending;
let buttons = [];
let calls = [];
let invalidations = [];
let worker;
let passed = 0;
const cache = new Map();
class ApiClientError extends Error {}

function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const target = new Module(filename);
  target.paths = Module._nodeModulePaths(path.dirname(filename));
  target.require = (id) => {
    if (id === "react" || id === "react/jsx-runtime") return adminRequire(id);
    if (id === "@tanstack/react-query") return {
      useQueryClient: () => ({ invalidateQueries: async (input) => { invalidations.push(input.queryKey); } }),
      useMutation: (options) => ({ isPending: mutationPending, mutate: (value) => {
        pending = (async () => {
          try {
            await options.onMutate?.(value);
            const result = await options.mutationFn(value);
            await options.onSuccess?.(result, value);
          } catch (error) { await options.onError?.(error, value); }
          finally { await options.onSettled?.(); }
        })();
      } })
    };
    if (id === "../hooks/use-workers") return { useWorkers: () => ({ data: [worker], error: null, isPending: false, refetch: async () => {} }) };
    if (id === "@/stores/ui-store") return { useAdminUiStore: (selector) => selector({ globalSearch: "" }) };
    if (id === "@/stores/admin-session-store") return { useAdminSessionStore: (selector) => selector({ session: { role: "admin", permissions: permission ? ["workers.manage"] : [] } }) };
    if (id === "@/shared/auth/permissions") return load(path.join(admin, "shared/auth/permissions.ts"));
    if (id === "@/shared/utils/table-filters") return load(path.join(admin, "shared/utils/table-filters.ts"));
    if (id === "@/lib/admin-labels") return load(path.join(admin, "lib/admin-labels.ts"));
    if (id === "../services/workers-service") return load(path.join(admin, "modules/workers/services/workers-service.ts"));
    if (id === "../tables/workers-columns") return { workersColumns: [] };
    if (id === "@/services/api-client") return {
      ApiClientError, getAdminToken: () => "synthetic-admin-token",
      apiClient: async (url, init) => {
        calls.push({ url, method: init.method, body: JSON.parse(init.body) });
        return { ok: true, worker: { status: "APPROVED", availability: { status: "AVAILABLE" } } };
      }
    };
    if (id === "@/components/ui/button") return { Button: (props) => {
      buttons.push(props);
      const { children, size: _size, variant: _variant, ...htmlProps } = props;
      return React.createElement("button", htmlProps, children);
    } };
    if (id === "@/components/ui/card") return Object.fromEntries(["Card", "CardContent", "CardHeader", "CardTitle"].map((name) =>
      [name, ({ children }) => React.createElement("div", null, children)]));
    if (id === "@/shared/components/data-table") return { DataTable: () => null };
    if (id === "@/shared/components/filter-bar") return { FilterBar: () => null, FilterSelect: () => null, TableLoadState: () => null };
    if (id === "lucide-react") return new Proxy({}, { get: () => () => null });
    throw new Error(`Unexpected module: ${id}`);
  };
  target._compile(compiled, filename);
  cache.set(filename, target.exports);
  return target.exports;
}
const { WorkersTable } = load(componentPath);
function fixture(overrides = {}) {
  worker = {
    id: "synthetic-zero-year-worker", name: "Synthetic complete worker", phone: "synthetic-phone",
    profession: "Elektrik", professions: ["Elektrik"], city: "tashkent", status: "draft",
    submittedAt: "10.10.2026", experienceYears: 0, basePrice: 100000,
    profileImageUrl: "https://example.invalid/fixture.png", bio: "Synthetic complete application",
    ...overrides
  };
  permission = true; mutationPending = false; pending = undefined;
  buttons = []; calls = []; invalidations = [];
}
function text(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(text).join("");
  return value && typeof value === "object" ? text(value.props?.children) : "";
}
function render() {
  buttons = [];
  const html = renderToStaticMarkup(React.createElement(WorkersTable));
  const approve = buttons.find((button) => text(button.children) === "Tasdiqlash");
  assert.ok(approve, "Actual WorkersTable must render approval control");
  return { html, approve };
}
async function test(name, body) {
  fixture();
  await body();
  passed += 1;
  console.log(`[P2-ZERO] PASS ${name}`);
}
async function main() {
  if (reproduce) {
    fixture();
    const { html, approve } = render();
    assert.equal(approve.disabled, true, "Original fully complete zero-year draft is blocked");
    assert.match(html, /To&#x27;ldirilmagan: Tajriba/);
    assert.match(html, /0 yil/);
    assert.equal(calls.length, 0);
    console.log("[P2-ZERO] REPRODUCE contractFAIL: complete0yearDraft=true; approvalDisabled=true; falseMissingExperience=true; APIcalls=0; actualReactSSR=true");
    return;
  }
  await test("complete zero-year draft has enabled approval without false missing-experience warning", async () => {
    const { html, approve } = render();
    assert.equal(approve.disabled, false);
    assert.doesNotMatch(html, /To&#x27;ldirilmagan:/);
    assert.match(html, /0 yil/);
    approve.onClick();
    await pending;
    assert.deepEqual(calls, [{ url: `/admin/workers/${worker.id}/approve`, method: "POST", body: {
      profession: "Elektrik", professions: ["Elektrik"], cityId: "tashkent", experienceYears: 0,
      profileImageUrl: worker.profileImageUrl, bio: worker.bio, basePrice: 100000
    } }]);
    assert.deepEqual(invalidations, [["workers"]]);
  });
  await test("positive experience retains enabled approval and exact service payload", async () => {
    worker.experienceYears = 3;
    const { approve } = render();
    assert.equal(approve.disabled, false);
    approve.onClick(); await pending;
    assert.equal(calls[0].body.experienceYears, 3);
  });
  await test("read-only admin cannot invoke zero-year approval even through direct handler", async () => {
    permission = false;
    const { approve } = render();
    assert.equal(approve.disabled, true);
    approve.onClick(); await pending;
    assert.equal(calls.length, 0);
  });
  await test("pending mutation still blocks zero-year approval and direct handler", async () => {
    mutationPending = true;
    const { approve } = render();
    assert.equal(approve.disabled, true);
    approve.onClick(); await pending;
    assert.equal(calls.length, 0);
  });
  for (const [field, value, label] of [["bio", "", "Bio"], ["profileImageUrl", undefined, "Rasm"], ["basePrice", 0, "Narx"]]) {
    await test(`missing ${label} still blocks approval independently of zero experience`, async () => {
      worker[field] = value;
      const { html, approve } = render();
      assert.equal(approve.disabled, true);
      assert.ok(html.includes(`To&#x27;ldirilmagan: ${label}`));
      assert.equal(html.includes("To&#x27;ldirilmagan: Tajriba"), false);
      assert.equal(calls.length, 0);
    });
  }
  for (const value of [undefined, null]) {
    await test(`absent experience (${String(value)}) remains incomplete`, async () => {
      worker.experienceYears = value;
      const { html, approve } = render();
      assert.equal(approve.disabled, true);
      assert.match(html, /To&#x27;ldirilmagan: Tajriba/);
      assert.equal(calls.length, 0);
    });
  }
  console.log(`[P2-ZERO] ${passed} cases PASS; actual full WorkersTable + real React/ReactDOM SSR + actual approveWorker service; query/data/API/UI wrappers mocked; no browser or realHTTP claim`);
}
console.log(`[P2-ZERO] componentSHA256=${createHash("sha256").update(fs.readFileSync(componentPath)).digest("hex")}`);
main().catch((error) => { console.error(error); process.exitCode = 1; });
