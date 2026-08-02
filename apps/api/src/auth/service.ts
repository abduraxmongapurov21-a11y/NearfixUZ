import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import type { AppConfig } from '../config.js';
import { AuthError } from './errors.js';
import type { AuthRepository } from './repository.js';
import type { AuthenticatedSession, AuthResult, PublicUser, SessionWithUser, TokenPair } from './types.js';

const encoder = new TextEncoder();

function publicUser(session: SessionWithUser): PublicUser {
  return {
    id: session.user.id,
    phoneNumber: session.user.phoneNumber,
    displayName: session.user.displayName,
    username: session.user.username,
    avatarUrl: session.user.avatarUrl,
    createdAt: session.user.createdAt.toISOString(),
  };
}

function refreshToken(): string {
  return randomBytes(48).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  private readonly signingKey: Uint8Array;

  constructor(
    private readonly repository: AuthRepository,
    private readonly config: AppConfig,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.signingKey = encoder.encode(config.accessTokenSecret);
  }

  private refreshExpiresAt(now: Date): Date {
    return new Date(now.getTime() + this.config.refreshTokenTtlDays * 86_400_000);
  }

  private async accessToken(session: SessionWithUser, now: Date): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(now.getTime() + this.config.accessTokenTtlSeconds * 1_000);
    const token = await new SignJWT({ sid: session.id, typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(session.userId)
      .setIssuedAt(Math.floor(now.getTime() / 1_000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1_000))
      .sign(this.signingKey);
    return { token, expiresAt };
  }

  private async result(session: SessionWithUser, refresh: string, now: Date): Promise<AuthResult> {
    const access = await this.accessToken(session, now);
    const tokens: TokenPair = {
      accessToken: access.token,
      refreshToken: refresh,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshTokenExpiresAt: session.expiresAt.toISOString(),
    };
    return { user: publicUser(session), tokens };
  }

  async login(phoneNumber: string, deviceName: string | null): Promise<AuthResult> {
    const now = this.now();
    const user = await this.repository.upsertUser(phoneNumber);
    const refresh = refreshToken();
    const session = await this.repository.createSession({
      id: randomUUID(),
      userId: user.id,
      refreshTokenHash: hashToken(refresh),
      deviceName,
      expiresAt: this.refreshExpiresAt(now),
    });
    return this.result(session, refresh, now);
  }

  async refresh(currentRefreshToken: string): Promise<AuthResult> {
    const now = this.now();
    const nextRefreshToken = refreshToken();
    const session = await this.repository.rotateSession(
      hashToken(currentRefreshToken),
      hashToken(nextRefreshToken),
      this.refreshExpiresAt(now),
      now,
    );
    if (!session) throw new AuthError('INVALID_REFRESH_TOKEN');
    return this.result(session, nextRefreshToken, now);
  }

  async authenticateSession(accessToken: string): Promise<AuthenticatedSession> {
    try {
      const now = this.now();
      const { payload } = await jwtVerify(accessToken, this.signingKey, {
        algorithms: ['HS256'],
        currentDate: now,
      });
      if (payload.typ !== 'access' || typeof payload.sid !== 'string' || typeof payload.sub !== 'string') {
        throw new AuthError('INVALID_ACCESS_TOKEN');
      }
      const session = await this.repository.findActiveSession(payload.sid, now);
      if (!session || session.userId !== payload.sub) throw new AuthError('SESSION_EXPIRED');
      return { user: publicUser(session), sessionId: session.id };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('INVALID_ACCESS_TOKEN');
    }
  }

  async authenticate(accessToken: string): Promise<PublicUser> {
    return (await this.authenticateSession(accessToken)).user;
  }

  async logout(currentRefreshToken: string): Promise<string | null> {
    return this.repository.revokeSession(hashToken(currentRefreshToken), this.now());
  }
}
