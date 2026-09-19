export const ORDER_REFRESH_INTERVAL_MS = 5000;

export function startOrderRefreshLoop(refresh, isActive, {
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
} = {}) {
  let alive = true;
  let pending = false;
  async function refreshNow() {
    if (!alive || !isActive() || pending) return;
    pending = true;
    try {
      await refresh({ isCurrent: () => alive && isActive() });
    } finally {
      pending = false;
    }
  }
  // A failed network request is retried on the next bounded tick. No native
  // connectivity dependency or push registration is required for recovery.
  const tick = () => { void refreshNow().catch(() => {}); };
  const timer = setIntervalFn(tick, ORDER_REFRESH_INTERVAL_MS);
  tick();
  return { refreshNow: tick, stop() { alive = false; clearIntervalFn(timer); } };
}

export function resolveOrderDetail(orders, activeOrder, id) {
  return orders.find((order) => order.id === id) || (activeOrder?.id === id ? activeOrder : null);
}
