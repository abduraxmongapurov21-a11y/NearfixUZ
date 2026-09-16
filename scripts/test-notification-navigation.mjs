import assert from "node:assert/strict";
import {
  navigateToNotificationTarget,
  processNotificationResponse,
  resolveNotificationTarget
} from "../src/services/notifications/notificationNavigation.mjs";
import { normalizeExperienceMode } from "../src/navigation/experienceMode.mjs";
import {
  enqueuePushRegistration,
  waitForPendingPushRegistration
} from "../src/services/notifications/pushRegistrationQueue.mjs";

assert.deepEqual(
  resolveNotificationTarget({ notificationType: "ORDER_COMPLETED", orderId: "order-a" }, "client"),
  { root: "ClientTabs", screen: "OrdersTab", params: { orderId: "order-a", openRating: true } }
);
assert.deepEqual(
  resolveNotificationTarget({ notificationType: "ORDER_CREATED", orderId: "order-b" }, "worker"),
  { root: "WorkerTabs", screen: "WorkerJobsTab", params: { orderId: "order-b" } }
);
assert.deepEqual(
  resolveNotificationTarget({ notificationType: "CHAT_MESSAGE", roomId: "room-a" }, "client"),
  { root: "ClientTabs", screen: "ChatsTab", params: { roomId: "room-a" } }
);
assert.deepEqual(
  resolveNotificationTarget({ notificationType: "CHAT_MESSAGE", roomId: "room-b" }, "worker"),
  { root: "WorkerTabs", screen: "WorkerChatsTab", params: { roomId: "room-b" } }
);
assert.deepEqual(
  resolveNotificationTarget({ notificationType: "WORKER_APPLICATION_APPROVED" }, "worker"),
  { root: "WorkerTabs", screen: "WorkerProfileTab" }
);

const providerClientMode = normalizeExperienceMode("provider", "client");
const providerWorkerMode = normalizeExperienceMode("provider", "worker");
assert.deepEqual(
  resolveNotificationTarget({ notificationType: "ORDER_COMPLETED", orderId: "order-client" }, providerClientMode),
  { root: "ClientTabs", screen: "OrdersTab", params: { orderId: "order-client", openRating: true } }
);
assert.deepEqual(
  resolveNotificationTarget({ notificationType: "ORDER_CREATED", orderId: "order-worker" }, providerWorkerMode),
  { root: "WorkerTabs", screen: "WorkerJobsTab", params: { orderId: "order-worker" } }
);

function createNavigation(routeNames) {
  let state = { routeNames, routes: routeNames.map((name) => ({ name })) };
  const calls = [];
  return {
    calls,
    isReady: () => true,
    getRootState: () => state,
    setRouteNames(nextRouteNames) {
      state = { routeNames: nextRouteNames, routes: nextRouteNames.map((name) => ({ name })) };
    },
    navigate(...args) {
      calls.push(args);
    }
  };
}

const response = {
  notification: {
    request: {
      identifier: "notification-during-switch",
      content: { data: { notificationType: "ORDER_CREATED", orderId: "order-switch" } }
    }
  }
};
const switchingNavigation = createNavigation(["ClientTabs"]);
let handledIdentifier = null;
const pendingResult = processNotificationResponse({
  navigation: switchingNavigation,
  response,
  session: { role: "provider", experienceMode: "worker" },
  handledIdentifier
});
if (pendingResult.status === "handled") handledIdentifier = pendingResult.identifier;
assert.equal(pendingResult.status, "pending", "notification must wait for the active mode navigator");
assert.equal(handledIdentifier, null, "failed navigation must not consume the notification");
assert.equal(switchingNavigation.calls.length, 0);

const throwingNavigation = createNavigation(["WorkerTabs"]);
throwingNavigation.navigate = () => {
  throw new Error("navigation failed");
};
const failedNavigationResult = processNotificationResponse({
  navigation: throwingNavigation,
  response,
  session: { role: "provider", experienceMode: "worker" },
  handledIdentifier
});
assert.equal(failedNavigationResult.status, "pending", "a thrown navigation must remain retryable");
assert.equal(handledIdentifier, null, "a thrown navigation must not consume the notification");

switchingNavigation.setRouteNames(["WorkerTabs"]);
const handledResult = processNotificationResponse({
  navigation: switchingNavigation,
  response,
  session: { role: "provider", experienceMode: "worker" },
  handledIdentifier
});
if (handledResult.status === "handled") handledIdentifier = handledResult.identifier;
assert.equal(handledResult.status, "handled", "notification should navigate after the worker navigator mounts");
assert.equal(handledIdentifier, "notification-during-switch");
assert.deepEqual(switchingNavigation.calls, [["WorkerTabs", { screen: "WorkerJobsTab", params: { orderId: "order-switch" } }]]);

const clientNavigation = createNavigation(["ClientTabs"]);
assert.equal(
  navigateToNotificationTarget(
    clientNavigation,
    { notificationType: "CHAT_MESSAGE", roomId: "room-provider-client" },
    providerClientMode
  ).ok,
  true
);
assert.deepEqual(clientNavigation.calls, [["ClientTabs", { screen: "ChatsTab", params: { roomId: "room-provider-client" } }]]);

const registrationOrder = [];
const first = enqueuePushRegistration(async () => {
  registrationOrder.push("old:start");
  await new Promise((resolve) => setTimeout(resolve, 10));
  registrationOrder.push("old:end");
});
const second = enqueuePushRegistration(async () => {
  registrationOrder.push("new:start");
  registrationOrder.push("new:end");
});
await Promise.all([first, second]);
await waitForPendingPushRegistration();
assert.deepEqual(registrationOrder, ["old:start", "old:end", "new:start", "new:end"]);

console.log("Notification target routing tests passed.");
