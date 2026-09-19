import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import { invalidateChatRooms, refreshChatRooms } from "../store/chatStore";
import { fetchChatMessagesApi, markChatRoomReadApi } from "../services/chats/chatService";
import { createChatThreadState } from "../services/chats/chatThreadState.mjs";
import { useChatRefresh } from "./useChatRefresh";

export function useChatThread(roomId) {
  const navigation = useNavigation();
  const [snapshot, setSnapshot] = useState({ messages: [], sending: false });
  const threadRef = useRef(null);
  useEffect(() => {
    const auth = useAuthStore.getState();
    const identity = auth.captureAuthRequest(auth.session?.token);
    const controller = createChatThreadState({
      isCurrent: () => useAuthStore.getState().isAuthRequestCurrent(identity),
      isActive: () => AppState.currentState === "active" && navigation.isFocused(),
      onChange: setSnapshot,
      load: () => {
        const session = useAuthStore.getState().session;
        return fetchChatMessagesApi(session.token, roomId, session.userId);
      },
      markRead: (id) => markChatRoomReadApi(useAuthStore.getState().session.token, roomId, id),
      onRead: (guard) => { invalidateChatRooms(); return refreshChatRooms(guard); }
    });
    threadRef.current = controller;
    return () => { controller.dispose(); threadRef.current = null; };
  }, [roomId, navigation]);
  const thread = useMemo(() => ({
    refresh: (guard) => threadRef.current?.refresh(guard),
    send: (draft, deliver) => threadRef.current?.send(draft, deliver) || Promise.resolve({ ok: false }),
    setVisible: (ids) => threadRef.current?.setVisible(ids)
  }), []);
  const refresh = useChatRefresh(thread.refresh, roomId, Boolean(roomId));
  return { ...snapshot, thread, refresh };
}
