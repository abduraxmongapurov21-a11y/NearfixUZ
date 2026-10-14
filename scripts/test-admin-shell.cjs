/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("../backend/node_modules/typescript");
const root = path.resolve(__dirname, "../admin-web");
const element = (type, props, key) => ({ type, props, key });
const nodes = (value) => !value || typeof value !== "object" ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
const text = (value) => typeof value === "string" ? value : Array.isArray(value) ? value.map(text).join("") : value && typeof value === "object" ? text(value.props?.children) : "";
const session = (permissions, extra = {}) => ({ role: "admin", tokenType: "admin_account", token: "fixture-token", permissions, username: "fixture", ...extra });

function fixture(initialSession) {
  let currentSession = initialSession;
  const values = [], effects = [], cache = new Map(), requests = [], navigation = [];
  let slot = 0;
  const useStore = (select) => select({ session: currentSession, isSessionReady: true,
    hydrateSession: async () => {}, logout: () => { currentSession = null; }, login: async () => ({ ok: true }) });
  useStore.getState = () => ({ session: currentSession });
  const react = {
    useState: (initial) => { const index = slot++; if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }]; },
    useEffect: (run, dependencies) => { const index = slot++; const previous = effects[index];
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) effects[index] = { run, dependencies, cleanup: previous?.cleanup, pending: true }; },
    useMemo: (run) => run(),
    useRef: (initial) => { const index = slot++; if (!(index in values)) values[index] = { current: initial }; return values[index]; }
  };
  let query = "fixture-search";
  function load(relative) {
    let filename = path.resolve(root, relative);
    if (!fs.existsSync(filename)) filename = [filename + ".ts", filename + ".tsx"].find(fs.existsSync);
    if (cache.has(filename)) return cache.get(filename);
    const target = new Module(filename);
    target.paths = Module._nodeModulePaths(path.dirname(filename));
    const fallback = target.require.bind(target);
    target.require = (id) => {
      if (id === "react") return react;
      if (id === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (id === "next/link") return { default: "a" };
      if (id === "next/navigation") return { useRouter: () => ({ replace: (url) => navigation.push(url) }), usePathname: () => "/orders" };
      if (id === "lucide-react") return new Proxy({}, { get: (_value, key) => String(key) });
      if (id === "@/stores/admin-session-store") return { useAdminSessionStore: useStore };
      if (id === "@/services/admin-auth") return { changeAdminPassword: (token, body) => new Promise((resolve, reject) => requests.push({ url: "/admin/auth/change-password", options: { token, body }, resolve, reject })) };
      if (id === "@/stores/ui-store") return { useAdminUiStore: (select) => select({ globalSearch: query, setGlobalSearch: (next) => { query = next; } }) };
      if (id === "./api-client") return { apiClient: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })) };
      if (id.startsWith("@/components/") || id === "@/shared/components/app-sidebar") return new Proxy({}, { get: (_value, key) => String(key) });
      if (id.startsWith("@/")) return load(id.slice(2));
      if (id.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), id)));
      return fallback(id);
    };
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    target._compile(compiled, filename); cache.set(filename, target.exports); return target.exports;
  }
  function render(Component, props) { slot = 0; return Component(props); }
  function flushEffects() { for (const effect of effects) if (effect?.pending) { effect.cleanup?.(); effect.cleanup = effect.run(); effect.pending = false; } }
  return { load, render, flushEffects, requests, navigation, setSession: (value) => { currentSession = value; }, getSession: () => currentSession, getQuery: () => query };
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

(async () => {
  {
    const f = fixture(null);
    const { getAdminLandingPath, canAccessAdminPath } = f.load("shared/auth/navigation.ts");
    assert.equal(getAdminLandingPath(null), "/login");
    assert.equal(getAdminLandingPath(session(["orders.read"])), "/orders");
    assert.equal(getAdminLandingPath(session(["support.read"])), "/support");
    assert.equal(getAdminLandingPath(session(["content.read"])), "/content/banners");
    assert.equal(getAdminLandingPath(session(["admins.manage"])), "/system/admins");
    assert.equal(getAdminLandingPath(session([])), "/account");
    assert.equal(getAdminLandingPath(session(["orders.read"], { mustChangePassword: true })), "/change-password");
    assert.equal(getAdminLandingPath(session([], { role: "super_admin" })), "/dashboard");
    assert.equal(canAccessAdminPath(session(["orders.read"]), "/dashboard"), false);
    assert.equal(canAccessAdminPath(session(["orders.read"]), "/orders"), true);
    console.log("PASS admin landing: permission scope, no permissions, required password and superadmin.");
  }
  for (const [identity, expected] of [[session(["orders.read"]), "/orders"], [session([], { mustChangePassword: true }), "/change-password"], [session([]), "/account"]]) {
    const f = fixture(identity), Login = f.load("app/(auth)/login/page.tsx").default;
    const form = nodes(f.render(Login)).find((node) => node.type === "form");
    await form.props.onSubmit({ preventDefault() {} });
    assert.equal(f.navigation.at(-1), expected);
  }
  console.log("PASS actual login handler uses the allowed landing destination.");
  {
    const f = fixture(session(["orders.read"], { mustChangePassword: true }));
    const Layout = f.load("app/(dashboard)/layout.tsx").default;
    assert.equal(f.render(Layout, { children: "private-content" }), null); f.flushEffects();
    assert.equal(f.navigation.at(-1), "/change-password");
    console.log("PASS required-password layout never renders protected content.");
  }
  {
    const f = fixture(session(["orders.read"])), Topbar = f.load("shared/components/topbar.tsx").Topbar;
    const button = nodes(f.render(Topbar)).find((node) => node.type === "button" && text(node).includes("Chiqish"));
    button.props.onClick();
    assert.equal(f.getSession(), null); assert.equal(f.getQuery(), ""); assert.equal(f.navigation.at(-1), "/login");
    console.log("PASS actual topbar logout clears the session/search and navigates to login.");
  }
  for (const fail of [false, true]) {
    const accountB = session(["orders.read"], { token: "token-B" });
    const f = fixture(session(["orders.read"], { token: "token-A" }));
    const Page = f.load("app/(auth)/change-password/page.tsx").default;
    let tree = f.render(Page);
    nodes(tree).find((node) => node.props?.placeholder === "Joriy parol").props.onChange({ target: { value: "OldFixture-123!" } });
    nodes(tree).find((node) => node.props?.placeholder === "Yangi parol").props.onChange({ target: { value: "N3w-Strong-Password!" } });
    tree = f.render(Page);
    const submitted = nodes(tree).find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
    assert.equal(f.requests.length, 1);
    nodes(f.render(Page)).find((node) => node.type === "Button" && text(node) === "Chiqish").props.onClick();
    f.setSession(accountB);
    if (fail) f.requests[0].reject(new Error("late account-A failure")); else f.requests[0].resolve({ ok: true });
    await submitted;
    assert.equal(f.getSession(), accountB, "late password request must not log out another account");
    assert.equal(f.navigation.length, 1, "only the explicit logout may navigate");
    assert.equal(text(f.render(Page)).includes("late account-A failure"), false);
  }
  console.log("PASS password-change success/failure cannot mutate a later account after logout.");
  {
    const f = fixture(session(["orders.read"]));
    const { getAdminNotifications } = f.load("services/admin-notifications.ts");
    const pending = getAdminNotifications(f.getSession());
    assert.equal(f.requests.length, 1); assert.match(f.requests[0].url, /^\/admin\/orders/);
    assert.equal(f.requests[0].options.token, "fixture-token");
    f.requests[0].resolve({ items: [{ id: "waiting", publicCode: "NF-test", createdAt: "2026-10-13T00:00:00Z" }] });
    const result = await pending;
    assert.equal(result.items[0].href, "/orders"); assert.equal(result.hasError, false);
    console.log("PASS admin notifications request only permission-allowed queues with the captured token.");
  }
  {
    const f = fixture(session(["orders.read", "support.read"]));
    const { getAdminNotifications } = f.load("services/admin-notifications.ts");
    const pending = getAdminNotifications(f.getSession());
    f.requests[0].reject(new Error("fixture network failure"));
    f.requests[1].resolve({ tickets: [{ id: "help", reason: "Help", createdAt: "2026-10-13T00:00:00Z" }] });
    const result = await pending;
    assert.equal(result.hasError, true); assert.equal(result.items[0].href, "/support");
    console.log("PASS admin notification partial errors preserve the successful queue.");
  }
  {
    const f = fixture(session(["orders.read"]));
    const Notifications = f.load("shared/components/admin-notifications.tsx").AdminNotifications;
    const bell = () => nodes(f.render(Notifications)).find((node) => node.props?.["aria-label"] === "Bildirishnomalar");
    assert.equal(bell().props["aria-expanded"], false); bell().props.onClick();
    f.render(Notifications); f.flushEffects();
    assert.equal(f.requests.length, 1);
    // Closing and switching identity invalidates the old response.
    bell().props.onClick(); f.setSession(session([], { token: "next-session" }));
    f.render(Notifications); f.flushEffects();
    f.requests[0].resolve({ items: [{ id: "old-private", publicCode: "Old account", createdAt: "2026-10-13T00:00:00Z" }] });
    await settle(); bell().props.onClick(); f.render(Notifications); f.flushEffects(); await settle();
    assert.equal(text(f.render(Notifications)).includes("Old account"), false);
    let focusRestored = 0;
    bell().props.ref.current = { focus: () => { focusRestored++; } };
    const close = nodes(f.render(Notifications)).find((node) => node.props?.["aria-label"] === "Bildirishnomalarni yopish");
    close.props.onClick();
    assert.equal(focusRestored, 1); assert.equal(bell().props["aria-expanded"], false);
    console.log("PASS actual notification disclosure opens and ignores an old-account response.");
  }
  {
    const previousFetch = global.fetch, previousWindow = global.window;
    const previousApi = process.env.NEXT_PUBLIC_API_URL, previousEnvironment = process.env.NODE_ENV;
    const redirects = [];
    try {
      process.env.NODE_ENV = "development";
      process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:41013";
      let storedToken = "token-A";
      global.window = { localStorage: { getItem: () => storedToken }, location: { pathname: "/orders", assign: (url) => redirects.push(url) } };
      global.fetch = async () => ({ ok: false, status: 403, json: async () => ({ code: "ADMIN_PASSWORD_CHANGE_REQUIRED", message: "Change password" }) });
      const { apiClient } = fixture(null).load("services/api-client.ts");
      await assert.rejects(apiClient("/admin/orders", { token: "token-A" }), (error) => error.code === "ADMIN_PASSWORD_CHANGE_REQUIRED" && error.status === 403);
      assert.deepEqual(redirects, ["/change-password"]);
      global.window.location.pathname = "/change-password";
      await assert.rejects(apiClient("/admin/auth/change-password", { token: "token-A" }));
      assert.equal(redirects.length, 1, "password flow must not cause a redirect loop");
      global.window.location.pathname = "/orders";
      storedToken = "token-B";
      await assert.rejects(apiClient("/admin/orders", { token: "token-A" }));
      assert.equal(redirects.length, 1, "old account's 403 must not redirect a new account");
      console.log("PASS actual API client handles a newly required password without a redirect loop.");
    } finally {
      global.fetch = previousFetch; global.window = previousWindow;
      if (previousApi === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = previousApi;
      if (previousEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnvironment;
    }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
