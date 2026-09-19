export const CHAT_REFRESH_INTERVAL_MS = 3000;

export function startChatRefreshLoop(refresh, isActive, {
  setIntervalFn = setInterval, clearIntervalFn = clearInterval
} = {}) {
  let alive = true;
  let pending = null;
  const isCurrent = () => alive && isActive();
  function refreshNow() {
    if (!isCurrent()) return Promise.resolve();
    if (pending) return pending;
    pending = Promise.resolve().then(() => isCurrent() && refresh({ isCurrent }))
      .catch(() => {}).finally(() => { pending = null; });
    return pending;
  }
  const timer = setIntervalFn(refreshNow, CHAT_REFRESH_INTERVAL_MS);
  void refreshNow();
  return { refreshNow, stop() { alive = false; clearIntervalFn(timer); } };
}

// ORDER and DIRECT are the existing private-chat surface. Keep every room ID,
// even when two orders have exactly the same participants.
export function privateChatRooms(rooms) {
  return [...new Map(rooms.filter((room) => ["order", "direct"].includes(room.type))
    .map((room) => [room.id, room])).values()];
}

export function chatUnreadCount(rooms) {
  return privateChatRooms(rooms).reduce((sum, room) => sum + (Number(room.unread) || 0), 0);
}

export function mergeChatMessages(current, incoming, pendingId) {
  const byId = new Map(current.filter((message) => message.id !== pendingId).map((message) => [message.id, message]));
  for (const message of incoming) {
    const previous = byId.get(message.id);
    byId.set(message.id, { ...previous, ...message,
      readByOthers: Boolean(previous?.readByOthers || message.readByOthers) });
  }
  return [...byId.values()].sort((a, b) =>
    (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || String(a.id).localeCompare(String(b.id)));
}

export function keyboardOverlap(y, height, keyboardTop) {
  return keyboardTop == null ? 0 : Math.max(0, y + height - keyboardTop);
}
