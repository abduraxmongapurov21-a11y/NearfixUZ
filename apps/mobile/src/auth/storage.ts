import * as SecureStore from 'expo-secure-store';
import type { AuthTokens } from './types';

const TOKEN_STORAGE_KEY = 'analog.auth.tokens.v1';

export async function loadTokens(): Promise<AuthTokens | null> {
  const stored = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthTokens;
  } catch {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    return null;
  }
}

export function saveTokens(tokens: AuthTokens): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
}
