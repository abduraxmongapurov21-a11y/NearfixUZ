import assert from "node:assert/strict";
import fs from "node:fs";

process.env.EXPO_PUBLIC_APP_ENV = "development";
process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:4000";
const { useClientStore, configureClientStoreForTests } = await import("../src/store/clientStore.js");
const calls = [];
const restore = configureClientStoreForTests({
  getSession: () => ({ userId: "client-a", token: "test-token" }),
  cancelOrderApi: async (_token, id, reason) => {
    calls.push({ id, reason });
    return { ok: true, order: { id, statusKey: "cancelled" } };
  }
});
try {
  useClientStore.getState().clearUserData();
  // A sheet opened on order A; polling has since selected B as the active order.
  useClientStore.setState({ activeOrder: { id: "order-b", statusKey: "request_sent" } });
  const changed = await useClientStore.getState().cancelActiveOrder("Changed plans", "order-a");
  assert.equal(changed.ok, false, "a cancellation sheet must not cancel a replacement active order");
  assert.equal(changed.code, "ORDER_CHANGED");
  assert.equal(calls.length, 0, "mismatched target must not reach the cancellation API");
  const result = await useClientStore.getState().cancelActiveOrder("Changed plans", "order-b");
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{ id: "order-b", reason: "Changed plans" }]);

  const orders = fs.readFileSync(new URL("../src/screens/orders/OrdersScreen.js", import.meta.url), "utf8");
  assert.match(orders, /cancelActiveOrder\(reason, detailOrder\?\.id\)/, "UI pins the displayed order ID");
  assert.match(orders, /<OrderRatingCard key=\{detailOrder\.id\}/, "each order owns a fresh rating/comment draft");
  const rating = fs.readFileSync(new URL("../src/components/orders/OrderRatingCard.js", import.meta.url), "utf8");
  assert.match(rating, /<Text translate=\{false\} style=\{styles\.reviewText\}>/, "user review text retains its original language");
} finally {
  restore();
  useClientStore.getState().clearUserData();
}
console.log("Actual client-store cancellation target race, correct-target success, rating order identity and raw review text contracts passed.");
