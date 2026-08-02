export type ApiUser = {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type ApiMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  body: string;
  createdAt: string;
};

export type ApiConversation = {
  id: string;
  type: 'DIRECT';
  peer: ApiUser;
  lastMessage: ApiMessage | null;
  createdAt: string;
  updatedAt: string;
};

export type SendMessageResult = {
  message: ApiMessage;
  created: boolean;
  memberIds: string[];
};

export interface RealtimePublisher {
  broadcastMessage(message: ApiMessage, memberIds: string[]): void;
  revokeSession(sessionId: string): void;
}
