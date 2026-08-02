import type { AuthRepository, CreateSessionInput } from '../src/auth/repository.js';
import type { SessionWithUser, UserRecord } from '../src/auth/types.js';

export class MemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, UserRecord>();
  private readonly sessions = new Map<string, SessionWithUser>();
  userCreateCount = 0;

  async upsertUser(phoneNumber: string): Promise<UserRecord> {
    const existing = this.users.get(phoneNumber);
    if (existing) return existing;
    const now = new Date('2026-07-31T12:00:00.000Z');
    const user = {
      id: `user-${this.users.size + 1}`,
      phoneNumber,
      displayName: null,
      username: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(phoneNumber, user);
    this.userCreateCount += 1;
    return user;
  }

  async createSession(input: CreateSessionInput): Promise<SessionWithUser> {
    const user = [...this.users.values()].find((item) => item.id === input.userId);
    if (!user) throw new Error('User topilmadi');
    const now = new Date('2026-07-31T12:00:00.000Z');
    const session: SessionWithUser = {
      ...input,
      user,
      lastUsedAt: now,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async rotateSession(
    currentTokenHash: string,
    nextTokenHash: string,
    nextExpiresAt: Date,
    now: Date,
  ): Promise<SessionWithUser | null> {
    const session = [...this.sessions.values()].find(
      (item) => item.refreshTokenHash === currentTokenHash && !item.revokedAt && item.expiresAt > now,
    );
    if (!session) return null;
    session.refreshTokenHash = nextTokenHash;
    session.expiresAt = nextExpiresAt;
    session.lastUsedAt = now;
    session.updatedAt = now;
    return session;
  }

  async findActiveSession(id: string, now: Date): Promise<SessionWithUser | null> {
    const session = this.sessions.get(id);
    return session && !session.revokedAt && session.expiresAt > now ? session : null;
  }

  async revokeSession(refreshTokenHash: string, now: Date): Promise<string | null> {
    const session = [...this.sessions.values()].find((item) => item.refreshTokenHash === refreshTokenHash);
    if (!session || session.revokedAt) return null;
    session.revokedAt = now;
    return session.id;
  }
}
