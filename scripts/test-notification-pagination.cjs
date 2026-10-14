/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Module = require("node:module");
const path = require("node:path");
const ts = require("../backend/node_modules/typescript");
const screen = fs.readFileSync(path.join(__dirname, "../src/screens/notifications/NotificationsScreen.js"), "utf8");
const loader = screen.slice(screen.indexOf("  const loadNotifications = useCallback"), screen.indexOf("  useEffect(() => {", screen.indexOf("  const loadNotifications = useCallback")));
const loadMore = screen.slice(screen.indexOf("  async function handleLoadMore()"), screen.indexOf("  async function handlePress("));

async function main() {
  let notifications = [{ id: "newest", readAt: "2026-10-13T00:00:00Z" }];
  let current = true;
  let unreadTotal = 1;
  let pageError = "";
  const pending = [];
  const context = vm.createContext({
    token: "fixture-token", nextCursor: "first-cursor", refreshing: false,
    loadGeneration: { current: 1 }, readGeneration: { current: 0 }, loadingMoreRef: { current: false },
    useCallback: (callback) => callback,
    useAuthStore: { getState: () => ({ captureAuthRequest: () => "identity-a", isAuthRequestCurrent: () => current }) },
    fetchNotificationsApi: (token, options) => new Promise((resolve) => pending.push({ token, options, resolve })),
    setNotifications: (next) => { notifications = typeof next === "function" ? next(notifications) : next; },
    setUnreadTotal: (next) => { unreadTotal = typeof next === "function" ? next(unreadTotal) : next; },
    setNextCursor: (next) => { context.nextCursor = next; },
    setPageError: (next) => { pageError = next; },
    setLoadingMore() {}, setError() {}, setLoading() {}
  });
  vm.runInContext(loader + loadMore + "\nglobalThis.loadNotifications = loadNotifications;globalThis.handleLoadMore = handleLoadMore;", context);
  const more = context.handleLoadMore();
  await context.handleLoadMore();
  assert.equal(pending.length, 1, "double load-more clicks cannot request duplicate pages");
  assert.equal(pending[0].options.cursor, "first-cursor");
  pending.shift().resolve({ ok: true, notifications: [{ id: "newest", readAt: null }, { id: "old-unread", readAt: null }], nextCursor: null, unreadCount: 1 });
  await more;
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].readAt, "2026-10-13T00:00:00Z", "overlapping pages retain completed read state");
  assert.equal(notifications[1].id, "old-unread", "an unread notification older than first page is reachable");
  assert.equal(unreadTotal, 1);
  assert.equal(context.nextCursor, null);

  context.nextCursor = "next-cursor";
  const failed = context.handleLoadMore();
  pending.shift().resolve({ ok: false, message: "Controlled network failure" });
  await failed;
  assert.equal(context.nextCursor, "next-cursor", "failed pages remain retryable");
  assert.equal(pageError, "Controlled network failure");
  assert.equal(notifications.length, 2);

  const oldPage = context.handleLoadMore();
  const refresh = context.loadNotifications();
  assert.equal(pending.length, 2);
  pending[1].resolve({ ok: true, notifications: [{ id: "fresh", readAt: null }], nextCursor: "fresh-cursor", unreadCount: 2 });
  await refresh;
  pending[0].resolve({ ok: true, notifications: [{ id: "obsolete" }], nextCursor: null, unreadCount: 0 });
  await oldPage;
  pending.length = 0;
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].id, "fresh", "refresh invalidates an older page response");
  assert.equal(context.nextCursor, "fresh-cursor");

  const readRace = context.loadNotifications();
  context.readGeneration.current += 1;
  unreadTotal = 1;
  pending.shift().resolve({ ok: true, notifications: [{ id: "fresh", readAt: null }], nextCursor: "fresh-cursor", unreadCount: 2 });
  await readRace;
  assert.equal(unreadTotal, 1, "a completed read cannot be undone by older total counts");

  const stalePage = context.handleLoadMore();
  current = false;
  pending.shift().resolve({ ok: true, notifications: [{ id: "other-account" }], nextCursor: null, unreadCount: 9 });
  await stalePage;
  assert.equal(notifications[0].id, "fresh", "old account pages cannot leak into another session");

  const file = path.join(__dirname, "../src/services/notifications/notificationService.js");
  const target = new Module(file, module);
  target.filename = file;
  const requests = [];
  const mocks = {
    "react-native": { Platform: { OS: "web" } },
    "@react-native-async-storage/async-storage": {}, "expo-constants": {}, "expo-notifications": {},
    "../api/client": { apiRequest: (callback) => callback() },
    "../api/authenticatedClient": { httpAuthRequest: async (url, options) => { requests.push({ url, options }); return { notifications: [{ id: "older" }], nextCursor: "opaque", unreadCount: 1 }; } }
  };
  target.require = (id) => { if (!Object.hasOwn(mocks, id)) throw new Error(`Unexpected module ${id}`); return mocks[id]; };
  target._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
  const result = await target.exports.fetchNotificationsApi("fixture-token", { cursor: "opaque+/=", limit: 50 });
  assert.equal(requests[0].url, "/notifications?limit=50&cursor=opaque%2B%2F%3D");
  assert.equal(result.nextCursor, "opaque");
  assert.equal(result.unreadCount, 1);
  console.log("Notification pagination: actual service query/metadata and callbacks passed old unread reachability, duplicate/read preservation, retry, refresh/session races and unread-count race (isolated fixtures).");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
