export type AuthUser = {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  tokens: AuthTokens;
};
