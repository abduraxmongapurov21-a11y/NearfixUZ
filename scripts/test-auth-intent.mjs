import assert from "node:assert/strict";
import { createPendingIntentMemory, discoveryNavigatorKey, rootExperienceForRole, sanitizePendingIntent } from "../src/navigation/pendingIntent.mjs";
import { guestRouteDecision, isPrivateClientRoute, pendingIntentForPrivateRoute, privateClientRoutes } from "../src/navigation/routeProtection.mjs";
import { createAccountRequestGuard, createOperationGuard } from "../src/store/requestGeneration.mjs";

assert.equal(rootExperienceForRole(null), "discovery");
assert.equal(rootExperienceForRole("client"), "discovery");
assert.equal(rootExperienceForRole("provider"), "worker");

const booking = sanitizePendingIntent({
  kind: "BOOKING",
  workerId: "worker-public-id",
  addressId: "must-drop",
  coordinates: { lat: 1, lng: 2 },
  problemDescription: "must-drop",
  token: "must-drop"
});
assert.deepEqual(booking, { kind: "BOOKING", workerId: "worker-public-id" });
assert.equal(sanitizePendingIntent({ kind: "BOOKING", workerId: { id: "unsafe-object" } }), null);
assert.equal(sanitizePendingIntent({ kind: "BOOKING", workerId: "   " }), null);
assert.equal(sanitizePendingIntent({ kind: "PROTECTED_ROUTE", routeName: "AdminUsers", token: "unsafe" }), null);
assert.deepEqual(sanitizePendingIntent({ kind: "PROTECTED_ROUTE", routeName: "ChatsTab", room: { id: "unsafe" } }), { kind: "PROTECTED_ROUTE", routeName: "ChatsTab" });

const memory = createPendingIntentMemory();
memory.set(booking);
assert.deepEqual(memory.consume(), booking);
assert.equal(memory.consume(), null, "intent must be single-use");
assert.equal(memory.consume(), null, "a duplicate resume callback cannot consume the intent twice");
memory.set({ kind: "BECOME_WORKER" });
memory.clear();
assert.equal(memory.peek(), null, "cancellation/logout must clear intent");

const operations = createOperationGuard();
const oldLogin = operations.begin();
const newLogin = operations.begin();
assert.equal(operations.isCurrent(oldLogin), false);
assert.equal(operations.isCurrent(newLogin), true);
operations.invalidate();
assert.equal(operations.isCurrent(newLogin), false);

const accounts = createAccountRequestGuard();
const accountA = accounts.begin("orders", "account-a");
accounts.invalidateSession();
const accountB = accounts.begin("orders", "account-b");
assert.equal(accounts.isCurrent(accountA, "account-b"), false);
assert.equal(accounts.isCurrent(accountB, "account-b"), true);

assert.equal(discoveryNavigatorKey(null, 3), "discovery-3");
assert.equal(discoveryNavigatorKey({ reason: "blocked" }, 3), "invalidated-3");
for (const routeName of privateClientRoutes) {
  assert.equal(isPrivateClientRoute(routeName), true);
  assert.equal(guestRouteDecision(routeName, routeName === "Booking" ? { workerId: "worker-id" } : {}).requireAuthentication, true);
}
assert.deepEqual(guestRouteDecision("WorkerProfile"), { allow: true, requireAuthentication: false, intent: null });
assert.deepEqual(pendingIntentForPrivateRoute("Booking", { workerId: "worker-id" }), { kind: "BOOKING", workerId: "worker-id" });
assert.deepEqual(pendingIntentForPrivateRoute("ChatThread", { room: { id: "must-drop" } }), { kind: "PROTECTED_ROUTE", routeName: "ChatsTab" });
assert.deepEqual(pendingIntentForPrivateRoute("MapPicker", { coordinates: { lat: 1, lng: 2 } }), { kind: "PROTECTED_ROUTE", routeName: "ProfileTab" });
assert.equal(pendingIntentForPrivateRoute("WorkerProfile", { workerId: "public" }), null);

console.log("Guest routing, safe single-use auth intent, and account generation tests passed.");
