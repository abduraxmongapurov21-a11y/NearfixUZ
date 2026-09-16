import { normalizeExperienceMode } from "../../navigation/experienceMode.mjs";

export function resolveNotificationTarget(data, experienceMode) {
  const payload = data && typeof data === "object" ? data : {};
  const notificationType = typeof payload.notificationType === "string" ? payload.notificationType : "";
  const orderId = typeof payload.orderId === "string" ? payload.orderId : undefined;
  const roomId = typeof payload.roomId === "string" ? payload.roomId : undefined;
  const workerExperience = experienceMode === "worker";

  if (notificationType === "CHAT_MESSAGE") {
    return workerExperience
      ? { root: "WorkerTabs", screen: "WorkerChatsTab", params: { roomId } }
      : { root: "ClientTabs", screen: "ChatsTab", params: { roomId } };
  }

  if (notificationType.startsWith("ORDER_")) {
    return workerExperience
      ? { root: "WorkerTabs", screen: "WorkerJobsTab", params: { orderId } }
      : {
          root: "ClientTabs",
          screen: "OrdersTab",
          params: { orderId, openRating: notificationType === "ORDER_COMPLETED" }
        };
  }

  if (notificationType.startsWith("WORKER_APPLICATION_")) {
    return workerExperience
      ? { root: "WorkerTabs", screen: "WorkerProfileTab" }
      : { root: "ClientTabs", screen: "ProfileTab" };
  }

  return workerExperience
    ? { root: "WorkerTabs", screen: "WorkerDashboardTab" }
    : { root: "ClientTabs", screen: "HomeTab" };
}

function navigationStateContainsRoute(state, routeName) {
  if (!state || typeof state !== "object") return false;
  if (Array.isArray(state.routeNames) && state.routeNames.includes(routeName)) return true;
  return Array.isArray(state.routes)
    ? state.routes.some((route) => navigationStateContainsRoute(route?.state, routeName))
    : false;
}

export function canNavigateToNotificationTarget(navigation, target) {
  if (!navigation || typeof navigation.navigate !== "function" || !target?.root) return false;

  try {
    const state = typeof navigation.getRootState === "function"
      ? navigation.getRootState()
      : typeof navigation.getState === "function"
        ? navigation.getState()
        : null;
    return navigationStateContainsRoute(state, target.root);
  } catch {
    return false;
  }
}

export function navigateToNotificationTarget(navigation, data, experienceMode) {
  const target = resolveNotificationTarget(data, experienceMode);
  if (!canNavigateToNotificationTarget(navigation, target)) {
    return { ok: false, code: "NAVIGATOR_NOT_READY", target };
  }

  try {
    navigation.navigate(target.root, {
      screen: target.screen,
      ...(target.params ? { params: target.params } : {})
    });
    return { ok: true, target };
  } catch {
    return { ok: false, code: "NAVIGATION_FAILED", target };
  }
}

export function processNotificationResponse({ navigation, response, session, handledIdentifier }) {
  const identifier = response?.notification?.request?.identifier;
  if (!identifier) return { status: "ignored", reason: "missing_identifier" };
  if (identifier === handledIdentifier) return { status: "ignored", reason: "already_handled", identifier };
  if (!session || typeof navigation?.isReady !== "function" || !navigation.isReady()) {
    return { status: "pending", identifier, response };
  }

  const experienceMode = normalizeExperienceMode(session.role, session.experienceMode);
  const result = navigateToNotificationTarget(
    navigation,
    response.notification.request.content?.data,
    experienceMode
  );
  if (!result.ok) {
    return { status: "pending", identifier, response, target: result.target, code: result.code };
  }

  return { status: "handled", identifier, target: result.target };
}
