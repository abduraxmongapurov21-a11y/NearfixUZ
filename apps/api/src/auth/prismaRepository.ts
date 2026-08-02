import type { PrismaClient } from '../generated/prisma/client.js';
import type { AuthRepository, CreateSessionInput } from './repository.js';
import type { SessionWithUser, UserRecord } from './types.js';

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  upsertUser(phoneNumber: string): Promise<UserRecord> {
    return this.prisma.user.upsert({
      where: { phoneNumber },
      create: { phoneNumber },
      update: {},
    });
  }

  createSession(input: CreateSessionInput): Promise<SessionWithUser> {
    return this.prisma.session.create({ data: input, include: { user: true } });
  }

  async rotateSession(
    currentTokenHash: string,
    nextTokenHash: string,
    nextExpiresAt: Date,
    now: Date,
  ): Promise<SessionWithUser | null> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.session.updateMany({
        where: {
          refreshTokenHash: currentTokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          refreshTokenHash: nextTokenHash,
          expiresAt: nextExpiresAt,
          lastUsedAt: now,
        },
      });
      if (updated.count !== 1) return null;
      return transaction.session.findUnique({
        where: { refreshTokenHash: nextTokenHash },
        include: { user: true },
      });
    });
  }

  findActiveSession(id: string, now: Date): Promise<SessionWithUser | null> {
    return this.prisma.session.findFirst({
      where: { id, revokedAt: null, expiresAt: { gt: now } },
      include: { user: true },
    });
  }

  async revokeSession(refreshTokenHash: string, now: Date): Promise<string | null> {
    return this.prisma.$transaction(async (transaction) => {
      const session = await transaction.session.findFirst({
        where: { refreshTokenHash, revokedAt: null },
        select: { id: true },
      });
      if (!session) return null;
      const result = await transaction.session.updateMany({
        where: { id: session.id, refreshTokenHash, revokedAt: null },
        data: { revokedAt: now },
      });
      return result.count === 1 ? session.id : null;
    });
  }
}
