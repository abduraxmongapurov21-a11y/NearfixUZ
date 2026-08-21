import { UserRole, WorkerProfileStatus } from "@prisma/client";
import type { AuthUser } from "../auth/auth-context.js";

export type OrderExperienceMode = "client" | "worker";

type OrderOwnership = {
  clientId: string;
  worker: {
    userId: string;
    status: WorkerProfileStatus;
  };
};

export function isMarketplaceUser(user: AuthUser) {
  return [UserRole.CLIENT.toLowerCase(), UserRole.PROVIDER.toLowerCase()].includes(user.role);
}

export function resolveOrderExperienceMode(user: AuthUser, requestedMode?: string): "admin" | OrderExperienceMode {
  if (user.role === UserRole.ADMIN.toLowerCase()) return "admin";

  if (requestedMode !== undefined && requestedMode !== "client" && requestedMode !== "worker") {
    throw Object.assign(new Error("Order mode must be client or worker"), {
      status: 400,
      code: "ORDER_MODE_INVALID"
    });
  }

  const mode = requestedMode || (user.role === UserRole.PROVIDER.toLowerCase() ? "worker" : "client");
  if (mode === "worker" && user.role !== UserRole.PROVIDER.toLowerCase()) {
    throw Object.assign(new Error("Provider capability is required for worker mode"), {
      status: 403,
      code: "PROVIDER_REQUIRED"
    });
  }

  return mode;
}

export function ownsOrderAsClient(user: AuthUser, order: Pick<OrderOwnership, "clientId">) {
  return order.clientId === user.id;
}

export function ownsOrderAsApprovedProvider(user: AuthUser, order: Pick<OrderOwnership, "worker">) {
  return (
    user.role === UserRole.PROVIDER.toLowerCase() &&
    order.worker.userId === user.id &&
    order.worker.status === WorkerProfileStatus.APPROVED
  );
}

export function canAccessOrder(user: AuthUser, order: OrderOwnership) {
  return user.role === UserRole.ADMIN.toLowerCase() || ownsOrderAsClient(user, order) || ownsOrderAsApprovedProvider(user, order);
}

export function assertApprovedProviderOwnership(user: AuthUser, order: Pick<OrderOwnership, "worker">) {
  if (!ownsOrderAsApprovedProvider(user, order)) {
    throw Object.assign(new Error("Order is not assigned to an approved worker owned by this provider"), {
      status: 403,
      code: "ORDER_NOT_ASSIGNED"
    });
  }
}
