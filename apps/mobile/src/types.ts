export type ConversationKind = 'direct';

export type UserIdentity = {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type MessageStatus = 'sending' | 'sent' | 'failed';

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  text: string;
  createdAt: string;
  time: string;
  mine: boolean;
  status: MessageStatus;
};

export type Conversation = {
  id: string;
  kind: 'direct';
  peer: UserIdentity;
  title: string;
  subtitle: string;
  time: string;
  avatarColor: string;
  avatarUrl: string | null;
  initials: string;
  updatedAt: number;
};
