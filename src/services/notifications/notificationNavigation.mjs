export function resolveNotificationTarget(data, role) {
  const payload = data && typeof data === "object" ? data : {};
  const notificationType = typeof payload.notificationType === "string" ? payload.notificationType : "";
  const orderId = typeof payload.orderId === "string" ? payload.orderId : undefined;
  const roomId = typeof payload.roomId === "string" ? payload.roomId : undefined;

  if (notificationType === "CHAT_MESSAGE") {
    return role === "provider"
      ? { root: "WorkerTabs", screen: "WorkerChatsTab", params: { roomId } }
      : { root: "ClientTabs", screen: "ChatsTab", params: { roomId } };
  }

  if (notificationType.startsWith("ORDER_")) {
    return role === "provider"
      ? { root: "WorkerTabs", screen: "WorkerJobsTab", params: { orderId } }
      : {
          root: "ClientTabs",
          screen: "OrdersTab",
          params: { orderId, openRating: notificationType === "ORDER_COMPLETED" }
        };
  }

  if (notificationType.startsWith("WORKER_APPLICATION_")) {
    return role === "provider"
      ? { root: "WorkerTabs", screen: "WorkerProfileTab" }
      : { root: "ClientTabs", screen: "ProfileTab" };
  }

  return role === "provider"
    ? { root: "WorkerTabs", screen: "WorkerDashboardTab" }
    : { root: "ClientTabs", screen: "HomeTab" };
}

export function navigateToNotificationTarget(navigation, data, role) {
  const target = resolveNotificationTarget(data, role);
  navigation.navigate(target.root, {
    screen: target.screen,
    ...(target.params ? { params: target.params } : {})
  });
  return target;
}
