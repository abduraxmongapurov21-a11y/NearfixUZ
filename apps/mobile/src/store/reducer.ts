import type { Conversation, Message } from '../types';

export type HistoryState = {
  nextCursor: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
};

export type AppState = {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  history: Record<string, HistoryState>;
  conversationsLoading: boolean;
  conversationsError: string | null;
};

export function createInitialState(): AppState {
  return {
    conversations: [],
    messages: {},
    history: {},
    conversationsLoading: true,
    conversationsError: null,
  };
}
