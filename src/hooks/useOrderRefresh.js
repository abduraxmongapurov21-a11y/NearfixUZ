import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { normalizeExperienceMode } from "../navigation/experienceMode.mjs";
import { useAuthStore } from "../store/authStore";
import { startOrderRefreshLoop } from "../services/orders/orderRefreshLoop.mjs";

export function useOrderRefresh(refresh, mode) {
  const focused = useIsFocused();
  const navigation = useNavigation();
  const session = useAuthStore((state) => state.session);
  const generation = useAuthStore((state) => state.navigationGeneration);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const enabled = Boolean(session?.token && normalizeExperienceMode(session.role, session.experienceMode) === mode);
  const userId = session?.userId;

  useEffect(() => {
    if (!focused || !enabled) return undefined;
    setForeground(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => subscription.remove();
  }, [focused, enabled, userId, generation]);

  useEffect(() => {
    if (!focused || !foreground || !enabled) return undefined;
    const isCurrent = () => {
      const auth = useAuthStore.getState();
      return AppState.currentState === "active" && navigation.isFocused() &&
        Boolean(auth.session?.token) && auth.session.userId === userId &&
        auth.navigationGeneration === generation &&
        normalizeExperienceMode(auth.session.role, auth.session.experienceMode) === mode;
    };
    const loop = startOrderRefreshLoop(refresh, isCurrent);
    // Web reconnect event; native reconnection is covered by the 5s retry loop.
    if (Platform.OS === "web") globalThis.addEventListener?.("online", loop.refreshNow);
    return () => {
      loop.stop();
      if (Platform.OS === "web") globalThis.removeEventListener?.("online", loop.refreshNow);
    };
  }, [focused, foreground, enabled, userId, generation, mode, navigation, refresh]);
}
