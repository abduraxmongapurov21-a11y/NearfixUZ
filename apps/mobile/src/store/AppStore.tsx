import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { webSocketUrl } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import {
  fetchConversations,
  fetchMessages,
  openDirectConversation,
  postMessage,
  type ServerConversation,
  type ServerMessage,
} from '../messaging/api';
import type { UserIdentity, Conversation, Message } from '../types';
import { identityInitials, identityTitle } from '../utils/identity';
import { discoverUsers as requestDiscoveredUsers } from '../users/api';
import { createInitialState, type AppState } from './reducer';
import { addOptimisticMessage } from './transitions';

type AppStore = AppState & {
  createDirectConversation: (user: UserIdentity) => Promise<string>;
  discoverUsers: (query: string) => Promise<UserIdentity[]>;
  refreshConversations: () => Promise<void>;
  loadMessages: (conversationId: string, reset?: boolean) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  retryMessage: (conversationId: string, clientMessageId: string) => Promise<void>;
};

const AppStoreContext = createContext<AppStore | null>(null);
let messageSequence = 0;

function conversationFromServer(server: ServerConversation): Conversation {
  return {
    id: server.id,
    kind: 'direct',
    peer: server.peer,
    title: identityTitle(server.peer),
    subtitle: server.lastMessage?.body ?? 'Hali xabarlar yo‘q',
    time: server.lastMessage
      ? new Date(server.lastMessage.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
      : '',
    avatarColor: '#667085',
    avatarUrl: server.peer.avatarUrl,
    initials: identityInitials(server.peer),
    updatedAt: new Date(server.updatedAt).getTime(),
  };
}

function messageFromServer(server: ServerMessage, currentUserId: string): Message {
  return {
    id: server.id,
    conversationId: server.conversationId,
    senderId: server.senderId,
    clientMessageId: server.clientMessageId,
    text: server.body,
    createdAt: server.createdAt,
    time: new Date(server.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
    mine: server.senderId === currentUserId,
    status: 'sent',
  };
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const merged = [...current];
  for (const message of incoming) {
    const index = merged.findIndex(
      (item) =>
        item.id === message.id ||
        (item.clientMessageId === message.clientMessageId && item.senderId === message.senderId),
    );
    if (index >= 0) merged[index] = message;
    else merged.push(message);
  }
  return merged.sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || left.id.localeCompare(right.id),
  );
}

function updateConversationPreview(conversations: Conversation[], message: Message): Conversation[] {
  return conversations.map((conversation) =>
    conversation.id === message.conversationId
      ? {
          ...conversation,
          subtitle: message.text,
          time: message.time,
          updatedAt: new Date(message.createdAt).getTime(),
        }
      : conversation,
  );
}

export function AppStoreProvider({ children }: PropsWithChildren) {
  const { accessToken, authorizedRequest, refreshAccessToken, user } = useAuth();
  const [state, setState] = useState<AppState>(createInitialState);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const upsertServerConversation = useCallback(
    (server: ServerConversation) => {
      const conversation = conversationFromServer(server);
      setState((current) => ({
        ...current,
        conversations: [conversation, ...current.conversations.filter((item) => item.id !== conversation.id)],
      }));
    },
    [],
  );

  const refreshConversations = useCallback(async () => {
    setState((current) => ({ ...current, conversationsLoading: true, conversationsError: null }));
    try {
      const conversations = await fetchConversations(authorizedRequest);
      setState((current) => ({
        ...current,
        conversations: conversations.map(conversationFromServer),
        conversationsLoading: false,
        conversationsError: null,
      }));
    } catch {
      setState((current) => ({
        ...current,
        conversationsLoading: false,
        conversationsError: 'Chatlarni yuklab bo‘lmadi.',
      }));
    }
  }, [authorizedRequest]);

  const createDirectConversation = useCallback(
    async (selectedUser: UserIdentity) => {
      const server = await openDirectConversation(authorizedRequest, selectedUser.phoneNumber);
      upsertServerConversation(server);
      return server.id;
    },
    [authorizedRequest, upsertServerConversation],
  );

  const discoverUsers = useCallback(
    (query: string) => requestDiscoveredUsers(authorizedRequest, query),
    [authorizedRequest],
  );

  const loadMessages = useCallback(
    async (conversationId: string, reset = true) => {
      const existing = stateRef.current.history[conversationId];
      if (existing?.loading) return;
      const cursor = reset ? undefined : existing?.nextCursor ?? undefined;
      if (!reset && existing?.loaded && !existing.nextCursor) return;
      setState((current) => ({
        ...current,
        history: {
          ...current.history,
          [conversationId]: {
            nextCursor: current.history[conversationId]?.nextCursor ?? null,
            loaded: current.history[conversationId]?.loaded ?? false,
            loading: true,
            error: null,
          },
        },
      }));
      try {
        const response = await fetchMessages(authorizedRequest, conversationId, cursor);
        const serverMessages = response.items.map((item) => messageFromServer(item, user!.id));
        setState((current) => {
          const currentMessages = current.messages[conversationId] ?? [];
          const transient = reset ? currentMessages.filter((message) => message.status !== 'sent') : currentMessages;
          return {
            ...current,
            messages: { ...current.messages, [conversationId]: mergeMessages(transient, serverMessages) },
            history: {
              ...current.history,
              [conversationId]: { nextCursor: response.nextCursor, loaded: true, loading: false, error: null },
            },
          };
        });
      } catch {
        setState((current) => ({
          ...current,
          history: {
            ...current.history,
            [conversationId]: {
              nextCursor: current.history[conversationId]?.nextCursor ?? null,
              loaded: current.history[conversationId]?.loaded ?? false,
              loading: false,
              error: 'Xabarlarni yuklab bo‘lmadi.',
            },
          },
        }));
      }
    },
    [authorizedRequest, user],
  );

  const loadOlderMessages = useCallback(
    (conversationId: string) => loadMessages(conversationId, false),
    [loadMessages],
  );

  const reconcileServerMessage = useCallback(
    (server: ServerMessage) => {
      if (!user) return;
      const message = messageFromServer(server, user.id);
      setState((current) => ({
        ...current,
        conversations: updateConversationPreview(current.conversations, message),
        messages: {
          ...current.messages,
          [message.conversationId]: mergeMessages(current.messages[message.conversationId] ?? [], [message]),
        },
      }));
    },
    [user],
  );

  const transmitMessage = useCallback(
    async (conversationId: string, clientMessageId: string, text: string) => {
      try {
        reconcileServerMessage(await postMessage(authorizedRequest, conversationId, clientMessageId, text));
      } catch {
        setState((current) => ({
          ...current,
          messages: {
            ...current.messages,
            [conversationId]: (current.messages[conversationId] ?? []).map((message) =>
              message.clientMessageId === clientMessageId ? { ...message, status: 'failed' } : message,
            ),
          },
        }));
      }
    },
    [authorizedRequest, reconcileServerMessage],
  );

  const sendMessage = useCallback(
    async (conversationId: string, rawText: string) => {
      const text = rawText.trim();
      if (!text || !user) return;
      messageSequence += 1;
      const clientMessageId = `${user.id}:${Date.now()}:${messageSequence}:${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = new Date().toISOString();
      const optimistic: Message = {
        id: `client:${clientMessageId}`,
        conversationId,
        senderId: user.id,
        clientMessageId,
        text,
        createdAt,
        time: new Date(createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
        mine: true,
        status: 'sending',
      };
      setState((current) => addOptimisticMessage(current, optimistic));
      await transmitMessage(conversationId, clientMessageId, text);
    },
    [transmitMessage, user],
  );

  const retryMessage = useCallback(
    async (conversationId: string, clientMessageId: string) => {
      const message = stateRef.current.messages[conversationId]?.find(
        (item) => item.clientMessageId === clientMessageId && item.status === 'failed',
      );
      if (!message) return;
      setState((current) => ({
        ...current,
        messages: {
          ...current.messages,
          [conversationId]: (current.messages[conversationId] ?? []).map((item) =>
            item.clientMessageId === clientMessageId ? { ...item, status: 'sending' } : item,
          ),
        },
      }));
      await transmitMessage(conversationId, clientMessageId, message.text);
    },
    [transmitMessage],
  );

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (!accessToken) return undefined;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;
    let socketToken = accessToken;
    let attempts = 0;

    const scheduleReconnect = () => {
      if (disposed) return;
      const delay = Math.min(1_000 * 2 ** attempts, 15_000);
      attempts += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(webSocketUrl);
      socket.onopen = () => socket?.send(JSON.stringify({ type: 'auth', accessToken: socketToken }));
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as { type?: string; message?: ServerMessage };
          if (payload.type === 'auth.ok') {
            attempts = 0;
            void refreshConversations();
            for (const [conversationId, history] of Object.entries(stateRef.current.history)) {
              if (history.loaded) void loadMessages(conversationId, true);
            }
          }
          if (payload.type === 'message.created' && payload.message) {
            reconcileServerMessage(payload.message);
            if (!stateRef.current.conversations.some((item) => item.id === payload.message!.conversationId)) {
              void refreshConversations();
            }
          }
        } catch {
          // Ignore malformed server events and keep the authenticated socket alive.
        }
      };
      socket.onclose = (event) => {
        if (disposed) return;
        if (event.code === 4401) {
          void refreshAccessToken()
            .then((token) => {
              socketToken = token;
              scheduleReconnect();
            })
            .catch(() => undefined);
          return;
        }
        scheduleReconnect();
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close(1000, 'Provider unmounted');
    };
  }, [accessToken, loadMessages, reconcileServerMessage, refreshAccessToken, refreshConversations]);

  const value = useMemo<AppStore>(
    () => ({
      ...state,
      createDirectConversation,
      discoverUsers,
      refreshConversations,
      loadMessages,
      loadOlderMessages,
      sendMessage,
      retryMessage,
    }),
    [
      createDirectConversation,
      discoverUsers,
      loadMessages,
      loadOlderMessages,
      refreshConversations,
      retryMessage,
      sendMessage,
      state,
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore AppStoreProvider ichida ishlatilishi kerak.');
  return store;
}
