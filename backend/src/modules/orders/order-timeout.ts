// Business policy: a worker has one hour to answer a client order.
export const ORDER_RESPONSE_TTL_MS = 60 * 60 * 1000;
export const ORDER_EXPIRY_INTERVAL_MS = 15_000;

export function orderResponseDeadline(now: Date) {
  return new Date(now.getTime() + ORDER_RESPONSE_TTL_MS);
}
