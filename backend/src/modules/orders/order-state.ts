import { OrderEventType, OrderStatus, type Prisma } from "@prisma/client";

export const allowedOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [],
  [OrderStatus.WAITING_RESPONSE]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.ON_THE_WAY, OrderStatus.CANCELLED],
  [OrderStatus.ON_THE_WAY]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
  [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: []
};

export const eventByTransition: Partial<Record<OrderStatus, OrderEventType>> = {
  [OrderStatus.ACCEPTED]: OrderEventType.WORKER_ACCEPTED,
  [OrderStatus.ON_THE_WAY]: OrderEventType.WORKER_ON_THE_WAY,
  [OrderStatus.IN_PROGRESS]: OrderEventType.WORK_STARTED,
  [OrderStatus.COMPLETED]: OrderEventType.WORK_COMPLETED,
  [OrderStatus.CANCELLED]: OrderEventType.ORDER_CANCELLED
};

export function isTransitionAllowed(from: OrderStatus, to: OrderStatus) {
  return allowedOrderTransitions[from].includes(to);
}

export function assertTransitionAllowed(from: OrderStatus, to: OrderStatus) {
  if (!isTransitionAllowed(from, to)) {
    throw Object.assign(new Error(`Invalid order transition: ${from} -> ${to}`), {
      status: 409,
      code: "INVALID_STATUS_TRANSITION"
    });
  }
}

export function isTerminalOrderStatus(status: OrderStatus) {
  return status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED;
}

export async function transitionOrderStatus(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    data?: Prisma.OrderUpdateManyMutationInput;
    conflictCode?: string;
  }
) {
  assertTransitionAllowed(input.fromStatus, input.toStatus);

  const result = await tx.order.updateMany({
    where: {
      id: input.orderId,
      status: input.fromStatus
    },
    data: {
      ...input.data,
      status: input.toStatus
    }
  });

  if (result.count !== 1) {
    throw Object.assign(new Error("Order status changed before this request was completed"), {
      status: 409,
      code: input.conflictCode || "ORDER_STATUS_CONFLICT"
    });
  }
}
