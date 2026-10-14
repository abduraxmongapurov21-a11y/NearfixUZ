import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/screens/notifications/NotificationsScreen.js", import.meta.url), "utf8");
const callback = source.slice(source.indexOf("  const loadNotifications = useCallback"), source.indexOf("  useEffect(() => {", source.indexOf("  const loadNotifications = useCallback")));
const pending = [];
let notifications = [];
const context = vm.createContext({
  token: "account-a-token",
  loadGeneration: { current: 0 },
  loadingMoreRef: { current: false },
  readGeneration: { current: 0 },
  useCallback: (fn) => fn,
  useAuthStore: { getState: () => ({ captureAuthRequest: () => "account-a", isAuthRequestCurrent: () => true }) },
  setNotifications: (next) => { notifications = typeof next === "function" ? next(notifications) : next; },
  setError() {}, setLoading() {}, setLoadingMore() {}, setPageError() {}, setNextCursor() {}, setUnreadTotal() {},
  fetchNotificationsApi: () => new Promise((resolve) => pending.push(resolve))
});
vm.runInContext(callback + "\nglobalThis.loadNotifications = loadNotifications;", context);
const oldLoad = context.loadNotifications();
const newLoad = context.loadNotifications();
pending[1]({ ok: true, notifications: [{ id: "notification-1", readAt: "2026-10-05T00:00:00Z" }, { id: "new-notification" }] });
await newLoad;
pending[0]({ ok: true, notifications: [{ id: "notification-1", readAt: null }] });
await oldLoad;
assert.equal(notifications.length, 2, "older load must not remove a newer notification");
assert.equal(notifications[0].readAt, "2026-10-05T00:00:00Z", "older load must not undo read state");

const anotherLoad = context.loadNotifications();
// Marking a notification read can complete after a GET was sent.
notifications[0].readAt = "2026-10-05T00:01:00Z";
pending[2]({ ok: true, notifications: [{ id: "notification-1", readAt: null }] });
await anotherLoad;
assert.equal(notifications[0].readAt, "2026-10-05T00:01:00Z", "a pre-read server snapshot cannot undo a completed read");
const unmountedLoad = context.loadNotifications();
context.loadGeneration.current += 1;
pending[3]({ ok: true, notifications: [{ id: "unmounted-response" }] });
await unmountedLoad;
assert.equal(notifications[0].id, "notification-1", "cleanup invalidates outstanding loads");
console.log("Isolated notification callback deferred reverse-order, monotonic read-state and unmount-response tests passed.");
