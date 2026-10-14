import { ROUTES, USER_ROLES } from "../constants/routes";
import { CommonActions } from "@react-navigation/native";
import { fetchPublicWorker } from "../services/catalog/catalogService";
import { useAuthStore } from "../store/authStore";
import { useClientStore } from "../store/clientStore";
import { openClientTab } from "./clientTabNavigation";

const protectedTabs = new Set([ROUTES.ORDERS_TAB, ROUTES.CHATS_TAB, ROUTES.PROFILE_TAB]);
const protectedStackRoutes = new Set([ROUTES.NOTIFICATIONS]);

export function requireAuthentication(navigation, intent) {
  useAuthStore.getState().setPendingIntent(intent);
  navigation.navigate(ROUTES.AUTH_FLOW);
}

export function requireRouteAuthentication(navigation, intent) {
  useAuthStore.getState().setPendingIntent(intent);
  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [
        { name: ROUTES.CLIENT_TABS, params: { screen: ROUTES.HOME_TAB } },
        { name: ROUTES.AUTH_FLOW }
      ]
    })
  );
}

export async function resumeAfterAuthentication(navigation, role) {
  const auth = useAuthStore.getState();
  const intent = auth.consumePendingIntent();
  const identity = auth.captureAuthRequest(auth.session?.token);
  if (role === USER_ROLES.WORKER) return { ok: true, destination: "worker" };
  const rootNavigation = navigation.getParent();
  if (!rootNavigation) return { ok: false, message: "Navigation unavailable" };

  if (intent?.kind === "BOOKING") {
    const result = await fetchPublicWorker(intent.workerId);
    if (!useAuthStore.getState().isAuthRequestCurrent(identity)) return { ok: false, stale: true };
    if (!result.ok || result.worker?.id !== intent.workerId || result.worker?.availability !== "available") {
      openClientTab(rootNavigation, ROUTES.HOME_TAB);
      return { ok: false, message: "Worker is no longer available" };
    }
    useClientStore.getState().upsertPublicWorker(result.worker);
    rootNavigation.replace(ROUTES.BOOKING, { workerId: result.worker.id, categoryId: intent.categoryId });
    return { ok: true, destination: ROUTES.BOOKING };
  }

  if (intent?.kind === "BECOME_WORKER") {
    rootNavigation.replace(ROUTES.BECOME_WORKER);
    return { ok: true, destination: ROUTES.BECOME_WORKER };
  }

  if (intent?.kind === "PROTECTED_ROUTE" && intent.routeName === ROUTES.WORKER_PROFILE && intent.workerId) {
    const result = await fetchPublicWorker(intent.workerId);
    if (!useAuthStore.getState().isAuthRequestCurrent(identity)) return { ok: false, stale: true };
    if (result.ok && result.worker?.id === intent.workerId) {
      useClientStore.getState().upsertPublicWorker(result.worker);
      rootNavigation.replace(ROUTES.WORKER_PROFILE, { workerId: result.worker.id, categoryId: intent.categoryId });
      return { ok: true, destination: ROUTES.WORKER_PROFILE };
    }
  }

  if (intent?.kind === "PROTECTED_ROUTE" && protectedTabs.has(intent.routeName)) {
    openClientTab(rootNavigation, intent.routeName);
    return { ok: true, destination: intent.routeName };
  }

  if (intent?.kind === "PROTECTED_ROUTE" && protectedStackRoutes.has(intent.routeName)) {
    rootNavigation.replace(intent.routeName);
    return { ok: true, destination: intent.routeName };
  }

  openClientTab(rootNavigation, ROUTES.HOME_TAB);
  return { ok: true, destination: ROUTES.HOME_TAB };
}
