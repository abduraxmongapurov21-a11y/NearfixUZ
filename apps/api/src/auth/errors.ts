export class AuthError extends Error {
  constructor(
    public readonly code: 'INVALID_REFRESH_TOKEN' | 'INVALID_ACCESS_TOKEN' | 'SESSION_EXPIRED',
    public readonly status: number = 401,
  ) {
    super(code);
  }
}
