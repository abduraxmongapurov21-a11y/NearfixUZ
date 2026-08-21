const PRIVATE_ROUTES = new Set([
  "Booking",
  "OrdersTab",
  "ChatsTab",
  "ChatThread",
  "MapPicker",
  "Notifications",
  "BecomeWorker"
]);

export function isPrivateClientRoute(routeName) {
  return PRIVATE_ROUTES.has(routeName);
}

export function pendingIntentForPrivateRoute(routeName, params = {}) {
  if (!isPrivateClientRoute(routeName)) return null;
  if (routeName === "Booking") {
    return typeof params.workerId === "string" && params.workerId.trim()
      ? { kind: "BOOKING", workerId: params.workerId.trim() }
      : null;
  }
  if (routeName === "BecomeWorker") return { kind: "BECOME_WORKER" };
  if (routeName === "ChatThread") return { kind: "PROTECTED_ROUTE", routeName: "ChatsTab" };
  if (routeName === "MapPicker") return { kind: "PROTECTED_ROUTE", routeName: "ProfileTab" };
  return { kind: "PROTECTED_ROUTE", routeName };
}

export function guestRouteDecision(routeName, params = {}) {
  return isPrivateClientRoute(routeName)
    ? { allow: false, requireAuthentication: true, intent: pendingIntentForPrivateRoute(routeName, params) }
    : { allow: true, requireAuthentication: false, intent: null };
}

export const privateClientRoutes = Object.freeze(Array.from(PRIVATE_ROUTES));
