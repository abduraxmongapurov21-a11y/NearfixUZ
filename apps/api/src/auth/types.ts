export type UserRecord = {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionRecord = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceName: string | null;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionWithUser = SessionRecord & { user: UserRecord };

export type PublicUser = {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
};

export type AuthResult = {
  user: PublicUser;
  tokens: TokenPair;
};

export type AuthenticatedSession = {
  user: PublicUser;
  sessionId: string;
};
