const INTENT_KINDS = new Set(["BOOKING", "BECOME_WORKER", "PROTECTED_ROUTE"]);
const SAFE_PROTECTED_ROUTES = new Set(["OrdersTab", "ChatsTab", "ProfileTab", "Notifications", "WorkerProfile"]);

function stablePublicId(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 191 ? normalized : null;
}

export function sanitizePendingIntent(intent) {
  if (!intent || !INTENT_KINDS.has(intent.kind)) return null;
  if (intent.kind === "BOOKING") {
    const workerId = stablePublicId(intent.workerId);
    if (!workerId) return null;
    return { kind: "BOOKING", workerId };
  }
  if (intent.kind === "PROTECTED_ROUTE") {
    const routeName = String(intent.routeName || "");
    if (!SAFE_PROTECTED_ROUTES.has(routeName)) return null;
    const workerId = stablePublicId(intent.workerId);
    if (routeName === "WorkerProfile" && !workerId) return null;
    return {
      kind: "PROTECTED_ROUTE",
      routeName,
      ...(routeName === "WorkerProfile" ? { workerId } : {})
    };
  }
  return { kind: "BECOME_WORKER" };
}

export function createPendingIntentMemory() {
  let pending = null;
  return {
    set(intent) { pending = sanitizePendingIntent(intent); return pending; },
    peek() { return pending; },
    consume() { const intent = pending; pending = null; return intent; },
    clear() { pending = null; }
  };
}

export function rootExperienceForRole(role) {
  return role === "provider" ? "worker" : "discovery";
}

export function discoveryNavigatorKey(invalidation, navigationGeneration = 0) {
  return `${invalidation ? "invalidated" : "discovery"}-${navigationGeneration}`;
}
