import type { SessionWithUser, UserRecord } from './types.js';

export type CreateSessionInput = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceName: string | null;
  expiresAt: Date;
};

export interface AuthRepository {
  upsertUser(phoneNumber: string): Promise<UserRecord>;
  createSession(input: CreateSessionInput): Promise<SessionWithUser>;
  rotateSession(
    currentTokenHash: string,
    nextTokenHash: string,
    nextExpiresAt: Date,
    now: Date,
  ): Promise<SessionWithUser | null>;
  findActiveSession(id: string, now: Date): Promise<SessionWithUser | null>;
  revokeSession(refreshTokenHash: string, now: Date): Promise<string | null>;
}
