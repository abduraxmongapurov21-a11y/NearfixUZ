import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { WorkerProfileStatus } from "@prisma/client";
import type { AuthUser } from "../src/modules/auth/auth-context.js";
import {
  assertApprovedProviderOwnership,
  canAccessOrder,
  isMarketplaceUser,
  ownsOrderAsClient,
  resolveOrderExperienceMode
} from "../src/modules/orders/order-access.js";

function user(id: string, role: string): AuthUser {
  return { id, role, phone: id, name: id, sessionId: `session-${id}`, permissions: [], sessionVersion: 1 };
}

const client = user("client-1", "client");
const provider = user("provider-1", "provider");
const unrelatedProvider = user("provider-2", "provider");
const admin = user("admin-1", "admin");
const superAdmin = user("super-1", "super_admin");
const approvedOrder = {
  clientId: client.id,
  worker: { userId: provider.id, status: WorkerProfileStatus.APPROVED }
};
const suspendedOrder = {
  clientId: client.id,
  worker: { userId: provider.id, status: WorkerProfileStatus.SUSPENDED }
};

assert.equal(isMarketplaceUser(client), true);
assert.equal(isMarketplaceUser(provider), true, "approved providers retain client capability");
assert.equal(isMarketplaceUser(admin), false);
assert.equal(resolveOrderExperienceMode(client), "client");
assert.equal(resolveOrderExperienceMode(provider), "worker", "legacy provider default remains worker");
assert.equal(resolveOrderExperienceMode(provider, "client"), "client");
assert.equal(resolveOrderExperienceMode(provider, "worker"), "worker");
assert.equal(resolveOrderExperienceMode(admin, "client"), "admin", "admin behavior is unchanged");
assert.equal(resolveOrderExperienceMode(superAdmin), "client", "legacy super-admin order behavior is unchanged");
assert.throws(() => resolveOrderExperienceMode(client, "worker"), (error: any) => error?.code === "PROVIDER_REQUIRED");
assert.throws(() => resolveOrderExperienceMode(provider, "invalid"), (error: any) => error?.code === "ORDER_MODE_INVALID");

assert.equal(ownsOrderAsClient(provider, { clientId: provider.id }), true, "provider may own orders as a client");
assert.equal(canAccessOrder(client, approvedOrder), true);
assert.equal(canAccessOrder(provider, approvedOrder), true);
assert.equal(canAccessOrder(unrelatedProvider, approvedOrder), false, "unrelated provider must be denied");
assert.equal(canAccessOrder(provider, suspendedOrder), false, "suspended worker ownership must not grant provider access");
assert.equal(canAccessOrder(admin, suspendedOrder), true);
assert.equal(canAccessOrder(superAdmin, suspendedOrder), false, "legacy super-admin order behavior is unchanged");
assert.throws(
  () => assertApprovedProviderOwnership(unrelatedProvider, approvedOrder),
  (error: any) => error?.code === "ORDER_NOT_ASSIGNED"
);
assert.throws(
  () => assertApprovedProviderOwnership(provider, suspendedOrder),
  (error: any) => error?.code === "ORDER_NOT_ASSIGNED"
);

console.log("Order capability, mode, admin compatibility, and negative authorization tests passed.");
