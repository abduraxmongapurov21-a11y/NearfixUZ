import { autoCancelExpiredWaitingOrders } from "./order.service.js";
import { ORDER_EXPIRY_INTERVAL_MS } from "./order-timeout.js";

export function startOrderExpiryRunner({
  intervalMs = ORDER_EXPIRY_INTERVAL_MS,
  sweep = () => autoCancelExpiredWaitingOrders(),
  onError = () => console.error("[order-expiry] sweep failed; retrying on next tick")
}: {
  intervalMs?: number;
  sweep?: () => Promise<unknown>;
  onError?: (error: unknown) => void;
} = {}) {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  function tick() {
    if (stopped || inFlight) return;
    inFlight = Promise.resolve().then(sweep).then(() => {}, onError).finally(() => { inFlight = null; });
  }
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick(); // Startup/restart catch-up; no client request is required.
  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    }
  };
}
