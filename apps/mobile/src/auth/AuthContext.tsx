import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError, apiRequest, closeSession, loginWithPhone, refreshSession } from './api';
import { clearTokens, loadTokens, saveTokens } from './storage';
import type { AuthTokens, AuthUser } from './types';

type AuthStatus = 'restoring' | 'authenticated' | 'unauthenticated' | 'error';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  accessToken: string | null;
  login: (phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
  refreshAccessToken: () => Promise<string>;
  authorizedRequest: <T>(path: string, options?: RequestInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isRejectedSession(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokensRef = useRef<AuthTokens | null>(null);
  const refreshInFlight = useRef<Promise<string> | null>(null);

  const updateTokens = useCallback((nextTokens: AuthTokens | null) => {
    tokensRef.current = nextTokens;
    setTokens(nextTokens);
  }, []);

  const acceptSession = useCallback(async (session: { user: AuthUser; tokens: AuthTokens }) => {
    await saveTokens(session.tokens);
    updateTokens(session.tokens);
    setUser(session.user);
    setError(null);
    setStatus('authenticated');
  }, [updateTokens]);

  const restore = useCallback(async () => {
    setStatus('restoring');
    setError(null);
    try {
      const storedTokens = await loadTokens();
      if (!storedTokens) {
        updateTokens(null);
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      await acceptSession(await refreshSession(storedTokens.refreshToken));
    } catch (restoreError) {
      if (isRejectedSession(restoreError)) {
        await clearTokens();
        updateTokens(null);
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      setError('Server bilan bog‘lanib bo‘lmadi. Internet va API manzilini tekshiring.');
      setStatus('error');
    }
  }, [acceptSession, updateTokens]);

  useEffect(() => {
    void restore();
  }, [restore]);

  const login = useCallback(
    async (phoneNumber: string) => {
      await acceptSession(await loginWithPhone(phoneNumber));
    },
    [acceptSession],
  );

  const refreshAccessToken = useCallback(async (): Promise<string> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const currentTokens = tokensRef.current;
    if (!currentTokens) throw new ApiError(401, 'SESSION_REQUIRED', 'Session mavjud emas.');
    const operation = (async () => {
      try {
        const session = await refreshSession(currentTokens.refreshToken);
        await acceptSession(session);
        return session.tokens.accessToken;
      } catch (refreshError) {
        if (isRejectedSession(refreshError)) {
          await clearTokens();
          updateTokens(null);
          setUser(null);
          setStatus('unauthenticated');
        }
        throw refreshError;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = operation;
    return operation;
  }, [acceptSession, updateTokens]);

  const authorizedRequest = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const send = (accessToken: string) =>
        apiRequest<T>(path, {
          ...options,
          headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
        });
      const accessToken = tokensRef.current?.accessToken;
      if (!accessToken) throw new ApiError(401, 'SESSION_REQUIRED', 'Session mavjud emas.');
      try {
        return await send(accessToken);
      } catch (requestError) {
        if (!(requestError instanceof ApiError) || requestError.status !== 401) throw requestError;
        return send(await refreshAccessToken());
      }
    },
    [refreshAccessToken],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokens?.refreshToken;
    await clearTokens();
    updateTokens(null);
    setUser(null);
    setError(null);
    setStatus('unauthenticated');
    if (refreshToken) await closeSession(refreshToken).catch(() => undefined);
  }, [tokens, updateTokens]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      accessToken: tokens?.accessToken ?? null,
      login,
      logout,
      restore,
      refreshAccessToken,
      authorizedRequest,
    }),
    [authorizedRequest, error, login, logout, refreshAccessToken, restore, status, tokens?.accessToken, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak.');
  return context;
}
