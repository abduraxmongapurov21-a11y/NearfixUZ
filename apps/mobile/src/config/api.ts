export type MobilePlatform = 'android' | 'ios' | 'web';

export function resolveApiUrl(value: string | undefined, development: boolean, platform: MobilePlatform): string {
  const configured = value?.trim();
  if (!configured && development) {
    return platform === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
  }
  if (!configured) throw new Error('Production build uchun EXPO_PUBLIC_API_URL majburiy.');

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL yaroqli URL bo‘lishi kerak.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('API URL http yoki https bo‘lishi kerak.');
  if (!development && url.protocol !== 'https:') throw new Error('Production API URL HTTPS bo‘lishi kerak.');
  return configured.replace(/\/$/, '');
}

export function resolveWebSocketUrl(httpUrl: string, development: boolean): string {
  const websocketUrl = httpUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  if (!development && !websocketUrl.startsWith('wss://')) {
    throw new Error('Production WebSocket URL WSS bo‘lishi kerak.');
  }
  return `${websocketUrl}/v1/ws`;
}
