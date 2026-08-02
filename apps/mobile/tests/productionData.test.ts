import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveApiUrl, resolveWebSocketUrl } from '../src/config/api';
import { createInitialState } from '../src/store/reducer';
import { addOptimisticMessage } from '../src/store/transitions';
import type { Conversation, Message, UserIdentity } from '../src/types';
import { identityInitials, identityTitle } from '../src/utils/identity';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : [target];
  });
}

describe('production data boundaries', () => {
  it('has no demo modules or production imports of demo data', () => {
    expect(existsSync(path.join(mobileRoot, 'src/data/contacts.ts'))).toBe(false);
    expect(existsSync(path.join(mobileRoot, 'src/data/conversations.ts'))).toBe(false);
    const productionSource = sourceFiles(path.join(mobileRoot, 'src'))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(productionSource).not.toMatch(/demoContacts|demoConversations|demoMessages/);
  });

  it('creates fresh empty state for new accounts and account switches', () => {
    const first = createInitialState();
    const second = createInitialState();
    first.conversations.push({} as Conversation);
    expect(second.conversations).toEqual([]);
    expect(second.messages).toEqual({});
  });

  it('keeps an optimistic message out of the confirmed Home preview', () => {
    const state = createInitialState();
    const conversation: Conversation = {
      id: 'conversation-1',
      kind: 'direct',
      peer: { id: 'peer', phoneNumber: '+998770000001', displayName: null, username: null, avatarUrl: null },
      title: '+998770000001',
      subtitle: 'Confirmed server message',
      time: '10:00',
      avatarColor: '#667085',
      avatarUrl: null,
      initials: '01',
      updatedAt: 1,
    };
    state.conversations.push(conversation);
    const optimistic: Message = {
      id: 'client:one',
      conversationId: conversation.id,
      senderId: 'self',
      clientMessageId: 'one',
      text: 'Not confirmed',
      createdAt: new Date(0).toISOString(),
      time: '10:01',
      mine: true,
      status: 'sending',
    };
    const next = addOptimisticMessage(state, optimistic);
    expect(next.messages[conversation.id]).toEqual([optimistic]);
    expect(next.conversations[0]?.subtitle).toBe('Confirmed server message');
  });
});

describe('real identity presentation', () => {
  it('uses only backend fields and transparent phone fallback', () => {
    const phoneOnly: UserIdentity = { id: 'one', phoneNumber: '+998770000042', displayName: null, username: null, avatarUrl: null };
    expect(identityTitle(phoneOnly)).toBe('+998770000042');
    expect(identityInitials(phoneOnly)).toBe('42');
    expect(identityTitle({ ...phoneOnly, displayName: 'Database User' })).toBe('Database User');
  });
});

describe('mobile API environment safety', () => {
  it('allows explicit development defaults but requires secure production URLs', () => {
    expect(resolveApiUrl(undefined, true, 'android')).toBe('http://10.0.2.2:4000');
    expect(resolveApiUrl(undefined, true, 'ios')).toBe('http://localhost:4000');
    expect(() => resolveApiUrl(undefined, false, 'android')).toThrow('majburiy');
    expect(() => resolveApiUrl('http://api.example.com', false, 'android')).toThrow('HTTPS');
    expect(resolveApiUrl('https://api.example.com/', false, 'android')).toBe('https://api.example.com');
    expect(resolveWebSocketUrl('https://api.example.com', false)).toBe('wss://api.example.com/v1/ws');
  });
});
