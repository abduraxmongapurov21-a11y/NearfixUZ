import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import { normalizeExperienceMode } from "../navigation/experienceMode.mjs";
import { startChatRefreshLoop } from "../services/chats/chatSync.mjs";

export function useChatRefresh(refresh, scope = "rooms", enabled = true) {
  const focused = useIsFocused();
  const navigation = useNavigation();
  const session = useAuthStore((state) => state.session);
  const generation = useAuthStore((state) => state.navigationGeneration);
  const mode = normalizeExperienceMode(session?.role, session?.experienceMode);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const loopRef = useRef(null);
  useEffect(() => {
    if (!focused || !enabled || !session?.token) return undefined;
    setForeground(AppState.currentState === "active");
    const listener = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => listener.remove();
  }, [focused, enabled, session?.token]);

  useEffect(() => {
    if (!focused || !foreground || !enabled || !session?.token) return undefined;
    const auth = useAuthStore.getState();
    const identity = auth.captureAuthRequest(session.token);
    const isActive = () => AppState.currentState === "active" && navigation.isFocused() &&
      useAuthStore.getState().isAuthRequestCurrent(identity);
    const loop = startChatRefreshLoop(refresh, isActive);
    loopRef.current = loop;
    if (Platform.OS === "web") globalThis.addEventListener?.("online", loop.refreshNow);
    return () => {
      loop.stop();
      loopRef.current = null;
      if (Platform.OS === "web") globalThis.removeEventListener?.("online", loop.refreshNow);
    };
  }, [focused, foreground, enabled, session?.token, session?.userId, generation, mode, navigation, refresh, scope]);
  return useCallback(() => loopRef.current?.refreshNow() || Promise.resolve(), []);
}
