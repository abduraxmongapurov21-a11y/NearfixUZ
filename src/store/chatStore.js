import { create } from "zustand";
import { useAuthStore } from "./authStore";
import { fetchChatRoomsApi } from "../services/chats/chatService";
import { privateChatRooms } from "../services/chats/chatSync.mjs";

// A single canonical snapshot backs list/header/client badge/worker badge.
// It is deliberately not persisted and never shares notification-center counts.
export const useChatStore = create(() => ({ rooms: [], identity: null }));
let revision = 0;

export async function refreshChatRooms({ isCurrent = () => true } = {}) {
  const auth = useAuthStore.getState();
  const session = auth.session;
  if (!session?.token || !isCurrent()) return;
  const identity = auth.captureAuthRequest(session.token);
  const ticket = ++revision;
  const result = await fetchChatRoomsApi(session.token, undefined, session.userId);
  if (ticket === revision && isCurrent() && useAuthStore.getState().isAuthRequestCurrent(identity) && result.ok) {
    useChatStore.setState({ rooms: privateChatRooms(result.rooms), identity });
  }
}

export function invalidateChatRooms() { revision += 1; }

// Clear synchronously at logout/account/mode changes, including in-flight loads.
useAuthStore.subscribe(() => {
  const identity = useChatStore.getState().identity;
  if (identity && !useAuthStore.getState().isAuthRequestCurrent(identity)) {
    invalidateChatRooms();
    useChatStore.setState({ rooms: [], identity: null });
  }
});
