export type ServerUser = {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type ServerMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  body: string;
  createdAt: string;
};

export type ServerConversation = {
  id: string;
  type: 'DIRECT';
  peer: ServerUser;
  lastMessage: ServerMessage | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthorizedRequest = <T>(path: string, options?: RequestInit) => Promise<T>;

export async function fetchConversations(request: AuthorizedRequest): Promise<ServerConversation[]> {
  const response = await request<{ conversations: ServerConversation[] }>('/v1/conversations');
  return response.conversations;
}

export async function openDirectConversation(
  request: AuthorizedRequest,
  participantPhoneNumber: string,
): Promise<ServerConversation> {
  const response = await request<{ conversation: ServerConversation }>('/v1/conversations/direct', {
    method: 'POST',
    body: JSON.stringify({ participantPhoneNumber }),
  });
  return response.conversation;
}

export function fetchMessages(
  request: AuthorizedRequest,
  conversationId: string,
  cursor?: string,
): Promise<{ items: ServerMessage[]; nextCursor: string | null }> {
  const query = new URLSearchParams({ limit: '50' });
  if (cursor) query.set('cursor', cursor);
  return request(`/v1/conversations/${conversationId}/messages?${query.toString()}`);
}

export async function postMessage(
  request: AuthorizedRequest,
  conversationId: string,
  clientMessageId: string,
  body: string,
): Promise<ServerMessage> {
  const response = await request<{ message: ServerMessage }>(`/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ clientMessageId, body }),
  });
  return response.message;
}
