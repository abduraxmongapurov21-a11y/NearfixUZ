import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const { ROUTES, USER_ROLES } = await import("data:text/javascript," + encodeURIComponent(fs.readFileSync(new URL("../src/constants/routes.js", import.meta.url), "utf8")));

const source = fs.readFileSync(new URL("../src/navigation/protectedActions.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
const pending = [];
const calls = [];
let session = { userId: "account-a", token: "token-a" };
let intent = { kind: "BOOKING", workerId: "worker-a", categoryId: "electric" };
const auth = {
  get session() { return session; },
  consumePendingIntent: () => intent,
  captureAuthRequest: () => session?.userId,
  isAuthRequestCurrent: (identity) => Boolean(identity && identity === session?.userId)
};
const context = vm.createContext({
  ROUTES, USER_ROLES,
  useAuthStore: { getState: () => auth },
  useClientStore: { getState: () => ({ upsertPublicWorker: (worker) => calls.push({ cache: worker.id }) }) },
  fetchPublicWorker: () => new Promise((resolve) => pending.push(resolve)),
  openClientTab: (_navigation, screen) => calls.push({ tab: screen })
});
vm.runInContext(source + "\nglobalThis.resume = resumeAfterAuthentication;", context);
const navigation = { getParent: () => ({ replace: (routeName, params) => calls.push({ routeName, params }) }) };
const oldResume = context.resume(navigation, "client");
session = { userId: "account-b", token: "token-b" };
pending[0]({ ok: true, worker: { id: "worker-a", availability: "available" } });
await oldResume;
assert.equal(calls.length, 0, "public profile loading for account A must not cache/navigate after switching to B");
const mismatchResume = context.resume(navigation, "client");
pending[1]({ ok: true, worker: { id: "worker-other", availability: "available" } });
await mismatchResume;
assert.equal(calls.some((call) => call.cache || call.routeName === ROUTES.BOOKING), false, "a mismatched profile ID must never become the booking target");
calls.length = 0;
const correctResume = context.resume(navigation, "client");
pending[2]({ ok: true, worker: { id: "worker-a", availability: "available" } });
await correctResume;
assert.equal(calls.at(-1).params.workerId, "worker-a");
assert.equal(calls.at(-1).params.categoryId, "electric");
intent = { kind: "PROTECTED_ROUTE", routeName: ROUTES.WORKER_PROFILE, workerId: "worker-a", categoryId: "electric" };
calls.length = 0;
const profileResume = context.resume(navigation, "client");
session = null;
pending[3]({ ok: true, worker: { id: "worker-a", availability: "available" } });
await profileResume;
assert.equal(calls.length, 0, "logout invalidates a pending profile resume");
console.log("Isolated authentication resume deferred account-switch/logout, mismatched ID and selected-category tests passed.");
