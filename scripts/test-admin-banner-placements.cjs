/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("../backend/node_modules/typescript");

const root = path.resolve(__dirname, "..");
let state = [];
let slot = 0;
let pending;
let uploadResolve;
const calls = [];
const queries = [];
const banners = [
  { id: "home1", title: "Hero one", placement: "HOME", imageUrl: "https://example.com/hero.png", mediaType: "IMAGE", targetType: "URL", targetValue: "https://example.com/offer", sortOrder: 0, isActive: true },
  { id: "category1", title: "Category one", placement: "CATEGORY", imageUrl: "https://example.com/strip.png", mediaType: "IMAGE", targetType: "NONE", sortOrder: 0, isActive: true },
  { id: "home2", title: "Hero two", placement: "HOME", imageUrl: "https://example.com/hero.mp4", mediaType: "VIDEO", targetType: "NONE", sortOrder: 1, isActive: false },
  { id: "category2", title: "Category two", placement: "CATEGORY", imageUrl: "https://example.com/strip.mp4", mediaType: "VIDEO", targetType: "NONE", sortOrder: 1, isActive: false }
];
const element = (type, props, key) => ({ type, props, key });
function load(relative) {
  const filename = path.join(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const target = new Module(filename);
  const original = target.require.bind(target);
  target.require = (id) => {
    if (id === "react") return {
      useMemo: (fn) => fn(),
      useState: (initial) => {
        const owner = state, index = slot++;
        if (!(index in owner)) owner[index] = typeof initial === "function" ? initial() : initial;
        return [owner[index], (value) => { owner[index] = typeof value === "function" ? value(owner[index]) : value; }];
      }
    };
    if (id === "react/jsx-runtime") return { jsx: element, jsxs: element };
    if (id === "@/stores/admin-session-store") return { useAdminSessionStore: (selector) => selector({ session: { role: "admin", permissions: ["content.manage"] } }) };
    if (id === "@/shared/auth/permissions") return load("admin-web/shared/auth/permissions.ts");
    if (id === "@tanstack/react-query") return {
      useQuery: (options) => { queries.push(options); return options; },
      useQueryClient: () => ({ invalidateQueries: async () => {} }),
      useMutation: (options) => ({ isPending: false, mutate: (input) => {
        pending = (async () => { await options.onMutate?.(); const result = await options.mutationFn(input); await options.onSuccess?.(result); })();
      } })
    };
    if (id === "../hooks/use-banners") return { useBanners: (placement) => { queries.push(placement); return { data: banners }; } };
    if (id === "@/modules/categories/hooks/use-categories") return { useCategories: () => ({ data: { categories: [{ id: "cat1", nameUz: "Santexnik", isActive: true }] } }) };
    if (id === "@/services/api-client") return {
      getAdminToken: () => "test-token", getApiUrl: (url) => url,
      apiClient: async (url, options) => { calls.push({ method: "http", url, options }); return { banners: [] }; }
    };
    if (id === "../services/banners-service") return {
      createBanner: async (input) => calls.push({ method: "create", input }),
      updateBanner: async (id, input) => calls.push({ method: "update", id, input }),
      deleteBanner: async (id) => calls.push({ method: "delete", id }),
      reorderBanners: async (items, placement) => calls.push({ method: "reorder", items, placement }),
      getBanners: async (placement) => calls.push({ method: "list", placement }),
      uploadBannerMedia: () => new Promise((resolve) => { uploadResolve = resolve; })
    };
    if (id.startsWith("@/") || id === "lucide-react" || id === "next/link") return new Proxy({}, { get: (_target, key) => String(key) });
    return original(id);
  };
  target._compile(compiled, filename);
  return target.exports;
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const { BannersManager } = load("admin-web/modules/banners/components/banners-manager.tsx");
const render = (placement) => { slot = 0; return BannersManager({ placement }); };
const table = (placement) => nodes(render(placement)).find((node) => node.type === "DataTable");
const input = (placement, id) => nodes(render(placement)).find((node) => node.props?.id === id);
const actions = (placement, banner) => nodes(table(placement).props.columns.at(-1).cell({ row: { original: banner } }));
function action(placement, banner, icon) {
  return actions(placement, banner).find((node) => node.type === "Button" && nodes(node).some((child) => child.type === icon));
}
async function submit(placement) {
  pending = undefined;
  nodes(render(placement)).find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  await pending;
}
async function main() {
  for (const placement of ["HOME", "CATEGORY"]) {
    state = [];
    const own = banners.filter((banner) => banner.placement === placement);
    assert.deepEqual(table(placement).props.data.map((banner) => banner.id), own.map((banner) => banner.id), "editor must filter even a mixed legacy response");
    action(placement, own[0], "Edit3").props.onClick();
    assert.equal(input(placement, "banner-title").props.value, own[0].title);
    await submit(placement);
    assert.equal(calls.at(-1).method, "update");
    assert.equal(calls.at(-1).id, own[0].id);
    assert.equal(calls.at(-1).input.placement, placement, "editing preserves the original placement");
    assert.equal(calls.at(-1).input.imageUrl, own[0].imageUrl);
    assert.equal(input(placement, "banner-title").props.value, "", "successful save resets only this placement's draft");
    input(placement, "banner-title").props.onChange({ target: { value: `New ${placement}` } });
    const newUpload = input(placement, "banner-media").props.onChange({ target: { files: [{}], value: "test.png" } });
    uploadResolve({ imageUrl: own[0].imageUrl, mediaType: "IMAGE" }); await newUpload;
    await submit(placement);
    assert.equal(calls.at(-1).method, "create");
    assert.equal(calls.at(-1).input.placement, placement);
    action(placement, own[0], "ArrowDown").props.onClick(); await pending;
    assert.deepEqual(calls.at(-1), { method: "reorder", placement, items: [{ id: own[1].id, sortOrder: 0 }, { id: own[0].id, sortOrder: 1 }] });
    actions(placement, own[1]).find((node) => node.props?.children === "Faollashtirish").props.onClick(); await pending;
    assert.deepEqual(calls.at(-1), { method: "update", id: own[1].id, input: { isActive: true } });
  }
  state = [];
  const upload = input("HOME", "banner-media").props.onChange({ target: { files: [{}], value: "test.png" } });
  const count = calls.length;
  await submit("HOME"); assert.equal(calls.length, count, "cannot save while upload is pending");
  state = []; // Separate route/key unmounts the HOME editor and creates a new CATEGORY instance.
  assert.equal(input("CATEGORY", "banner-title").props.value, "");
  uploadResolve({ imageUrl: "https://example.com/uploaded.png", mediaType: "IMAGE" }); await upload;
  const createButton = nodes(render("CATEGORY")).find((node) => node.type === "Button" && node.props.type === "submit");
  assert.equal(createButton.props.disabled, true, "late HOME upload must never fill CATEGORY draft or enable saving");
  for (const [file, placement] of [["page.tsx", "HOME"], ["category/page.tsx", "CATEGORY"]]) {
    const Page = load(`admin-web/app/(dashboard)/content/banners/${file}`).default;
    const manager = nodes(Page()).find((node) => node.type === "BannersManager");
    assert.equal(manager.props.placement, placement); assert.equal(manager.key, placement);
  }
  const { useBanners: runQueryHook } = load("admin-web/modules/banners/hooks/use-banners.ts");
  for (const placement of ["HOME", "CATEGORY"]) {
    const query = runQueryHook(placement);
    assert.deepEqual(query.queryKey, ["banners", placement]); await query.queryFn();
    assert.deepEqual(calls.at(-1), { method: "list", placement });
  }
  const services = load("admin-web/modules/banners/services/banners-service.ts");
  for (const placement of ["HOME", "CATEGORY"]) {
    await services.getBanners(placement); assert.equal(calls.at(-1).url, `/admin/banners?placement=${placement}`);
    await services.reorderBanners([{ id: "one", sortOrder: 0 }], placement);
    assert.equal(JSON.parse(calls.at(-1).options.body).placement, placement);
  }
  console.log("Actual admin banner components: separate routes/cache, filtered lists, immutable edits, creation, scoped ordering/toggle, upload pending/unmount isolation PASS.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
