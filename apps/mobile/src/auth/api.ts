import { Platform } from 'react-native';
import type { AuthResponse } from './types';
import { resolveApiUrl, resolveWebSocketUrl, type MobilePlatform } from '../config/api';

export const apiUrl = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__, Platform.OS as MobilePlatform);
export const webSocketUrl = resolveWebSocketUrl(apiUrl, __DEV__);

type ApiErrorBody = { error?: { code?: string; message?: string } };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'So‘rov bajarilmadi.',
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function loginWithPhone(phoneNumber: string): Promise<AuthResponse> {
  return apiRequest('/v1/auth/phone', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, deviceName: `${Platform.OS} / Expo` }),
  });
}

export function refreshSession(refreshToken: string): Promise<AuthResponse> {
  return apiRequest('/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export function closeSession(refreshToken: string): Promise<void> {
  return apiRequest('/v1/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
