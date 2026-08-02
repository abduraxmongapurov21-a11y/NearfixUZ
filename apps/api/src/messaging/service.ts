import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { normalizePhoneNumber } from '../auth/phone.js';
import { ApiError } from './errors.js';
import type { ApiConversation, ApiMessage, SendMessageResult } from './types.js';

const conversationInclude = {
  members: { include: { user: true } },
  messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
} as const satisfies Prisma.ConversationInclude;

type ConversationPayload = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function apiMessage(message: {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  body: string;
  createdAt: Date;
}): ApiMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    clientMessageId: message.clientMessageId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

function apiConversation(conversation: ConversationPayload, currentUserId: string): ApiConversation {
  const peer = conversation.members.find((member) => member.userId !== currentUserId)?.user;
  if (!peer) throw new ApiError(500, 'INVALID_DIRECT_CONVERSATION', 'Suhbat ma’lumotlari buzilgan.');
  return {
    id: conversation.id,
    type: 'DIRECT',
    peer: {
      id: peer.id,
      phoneNumber: peer.phoneNumber,
      displayName: peer.displayName,
      username: peer.username,
      avatarUrl: peer.avatarUrl,
    },
    lastMessage: conversation.messages[0] ? apiMessage(conversation.messages[0]) : null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

type MessageCursor = { createdAt: string; id: string };

function encodeCursor(cursor: MessageCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<MessageCursor>;
    const createdAt = new Date(parsed.createdAt ?? '');
    if (!parsed.id || Number.isNaN(createdAt.getTime())) throw new Error('invalid');
    return { createdAt, id: parsed.id };
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'Xabarlar kursori noto‘g‘ri.');
  }
}

export class MessagingService {
  constructor(private readonly prisma: PrismaClient) {}

  private async requireMembership(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, members: { some: { userId } } },
      select: { id: true, members: { select: { userId: true } } },
    });
    if (!conversation) throw new ApiError(403, 'CONVERSATION_FORBIDDEN', 'Bu suhbatga kirish huquqi yo‘q.');
    return conversation;
  }

  async createDirectConversation(currentUserId: string, rawPhoneNumber: string): Promise<ApiConversation> {
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
    if (!phoneNumber) throw new ApiError(400, 'INVALID_PHONE_NUMBER', 'Telefon raqami noto‘g‘ri.');
    const peer = await this.prisma.user.findUnique({ where: { phoneNumber } });
    if (!peer) throw new ApiError(404, 'USER_NOT_FOUND', 'Bu telefon raqamli foydalanuvchi topilmadi.');
    if (peer.id === currentUserId) throw new ApiError(400, 'SELF_CONVERSATION', 'O‘zingiz bilan suhbat ochib bo‘lmaydi.');

    const pair = [currentUserId, peer.id].sort();
    const directUserOneId = pair[0]!;
    const directUserTwoId = pair[1]!;
    let conversation: ConversationPayload | null = null;
    try {
      conversation = await this.prisma.conversation.create({
        data: {
          type: 'DIRECT',
          directUserOneId,
          directUserTwoId,
          members: { create: [{ userId: directUserOneId }, { userId: directUserTwoId }] },
        },
        include: conversationInclude,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      conversation = await this.prisma.conversation.findUnique({
        where: { directUserOneId_directUserTwoId: { directUserOneId, directUserTwoId } },
        include: conversationInclude,
      });
    }
    if (!conversation) throw new ApiError(500, 'CONVERSATION_CREATE_FAILED', 'Suhbatni yaratib bo‘lmadi.');
    return apiConversation(conversation, currentUserId);
  }

  async listConversations(currentUserId: string): Promise<ApiConversation[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { members: { some: { userId: currentUserId } } },
      include: conversationInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return conversations.map((conversation) => apiConversation(conversation, currentUserId));
  }

  async getMessages(conversationId: string, currentUserId: string, limit: number, cursor?: string) {
    await this.requireMembership(conversationId, currentUserId);
    const decoded = cursor ? decodeCursor(cursor) : null;
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                { createdAt: decoded.createdAt, id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const oldest = page.at(-1);
    return {
      items: page.reverse().map(apiMessage),
      nextCursor: hasMore && oldest ? encodeCursor({ createdAt: oldest.createdAt.toISOString(), id: oldest.id }) : null,
    };
  }

  async sendMessage(
    conversationId: string,
    currentUserId: string,
    clientMessageId: string,
    body: string,
  ): Promise<SendMessageResult> {
    const conversation = await this.requireMembership(conversationId, currentUserId);
    const memberIds = conversation.members.map((member) => member.userId);
    try {
      const message = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.message.create({
          data: { conversationId, senderId: currentUserId, clientMessageId, body },
        });
        await transaction.conversation.update({ where: { id: conversationId }, data: { updatedAt: created.createdAt } });
        return created;
      });
      return { message: apiMessage(message), created: true, memberIds };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.prisma.message.findUnique({
        where: {
          conversationId_senderId_clientMessageId: { conversationId, senderId: currentUserId, clientMessageId },
        },
      });
      if (!existing) throw error;
      if (existing.body !== body) {
        throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Bu xabar identifikatori boshqa matn bilan ishlatilgan.');
      }
      return { message: apiMessage(existing), created: false, memberIds };
    }
  }
}
