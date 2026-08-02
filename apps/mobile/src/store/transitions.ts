import type { Message } from '../types';
import type { AppState } from './reducer';

export function addOptimisticMessage(state: AppState, message: Message): AppState {
  return {
    ...state,
    messages: {
      ...state.messages,
      [message.conversationId]: [...(state.messages[message.conversationId] ?? []), message],
    },
  };
}
