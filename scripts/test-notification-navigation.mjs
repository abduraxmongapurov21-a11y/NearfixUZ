import assert from "node:assert/strict";
import { resolveNotificationTarget } from "../src/services/notifications/notificationNavigation.mjs";
import {
  enqueuePushRegistration,
  waitForPendingPushRegistration
} from "../src/services/notifications/pushRegistrationQueue.mjs";

assert.deepEqual(
  resolveNotificationTarget({ notificationType: "ORDER_COMPLETED", orderId: "order-a" }, "client"),
  { root: "ClientTabs", screen: "OrdersTab", params: { orderId: "order-a", openRating: true } }
);
assert.deepEqual(
  resolveNotificationTarget({ notificationType: "ORDER_CREATED", orderId: "order-b" }, "provider"),
  { root: "WorkerTabs", screen: "WorkerJobsTab", params: { orderId: "order-b" } }
);
assert.deepEqual(
  resolveNotificationTarget({ notificationType: "CHAT_MESSAGE", roomId: "room-a" }, "client"),
  { root: "ClientTabs", screen: "ChatsTab", params: { roomId: "room-a" } }
);
assert.deepEqual(
  resolveNotificationTarget({ notificationType: "CHAT_MESSAGE", roomId: "room-b" }, "provider"),
  { root: "WorkerTabs", screen: "WorkerChatsTab", params: { roomId: "room-b" } }
);
assert.deepEqual(
  resolveNotificationTarget({ notificationType: "WORKER_APPLICATION_APPROVED" }, "provider"),
  { root: "WorkerTabs", screen: "WorkerProfileTab" }
);

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
