import 'dotenv/config';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createApp } from '../src/app.js';
import { PrismaAuthRepository } from '../src/auth/prismaRepository.js';
import { AuthService } from '../src/auth/service.js';
import { createDatabase } from '../src/db.js';
import { MessagingService } from '../src/messaging/service.js';
import { WebSocketHub } from '../src/realtime/WebSocketHub.js';
import { UserDiscoveryService } from '../src/users/service.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL!;
const config = {
  accessTokenSecret: 'integration-test-secret-with-at-least-32-characters',
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
};

type Runtime = Awaited<ReturnType<typeof createRuntime>>;
let runtime: Runtime;

async function createRuntime() {
  const database = createDatabase(testDatabaseUrl);
  const authService = new AuthService(new PrismaAuthRepository(database.prisma), config);
  const messagingService = new MessagingService(database.prisma);
  const userDiscoveryService = new UserDiscoveryService(database.prisma);
  const server = createServer();
  const realtime = new WebSocketHub(server, authService);
  server.on('request', createApp(authService, '*', messagingService, realtime, true, userDiscoveryService));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    database,
    server,
    realtime,
    baseUrl: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}/v1/ws`,
  };
}

async function closeRuntime(value: Runtime) {
  value.realtime.close();
  await new Promise<void>((resolve) => value.server.close(() => resolve()));
  await value.database.close();
}

async function login(phoneNumber: string) {
  const response = await request(runtime.server)
    .post('/v1/auth/phone')
    .send({ phoneNumber, deviceName: 'integration-test' })
    .expect(201);
  return response.body as {
    user: { id: string; phoneNumber: string };
    tokens: { accessToken: string; refreshToken: string };
  };
}

function authenticated(method: 'get' | 'post', path: string, accessToken: string) {
  return request(runtime.server)[method](path).set('Authorization', `Bearer ${accessToken}`);
}

async function createConversation(accessToken: string, participantPhoneNumber: string) {
  const response = await authenticated('post', '/v1/conversations/direct', accessToken)
    .send({ participantPhoneNumber })
    .expect(200);
  return response.body.conversation as { id: string };
}

function socketEvent(socket: WebSocket, expectedType: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Socket event timeout: ${expectedType}`)), 5_000);
    const listener = (data: WebSocket.RawData) => {
      const event = JSON.parse(data.toString()) as Record<string, unknown>;
      if (event.type !== expectedType) return;
      clearTimeout(timeout);
      socket.off('message', listener);
      resolve(event);
    };
    socket.on('message', listener);
  });
}

async function openAuthenticatedSocket(accessToken: string) {
  const socket = new WebSocket(runtime.wsUrl);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  const authenticatedEvent = socketEvent(socket, 'auth.ok');
  socket.send(JSON.stringify({ type: 'auth', accessToken }));
  await authenticatedEvent;
  return socket;
}

beforeAll(async () => {
  runtime = await createRuntime();
});

beforeEach(async () => {
  await runtime.database.prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "messages", "conversation_members", "conversations", "sessions", "users" CASCADE',
  );
});

afterAll(async () => {
  await closeRuntime(runtime);
});

describe('direct messaging against PostgreSQL', () => {
  it('does not create duplicate conversations under parallel requests', async () => {
    const first = await login('+998901000001');
    const second = await login('+998901000002');
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        createConversation(index % 2 === 0 ? first.tokens.accessToken : second.tokens.accessToken,
          index % 2 === 0 ? second.user.phoneNumber : first.user.phoneNumber),
      ),
    );
    expect(new Set(responses.map((item) => item.id)).size).toBe(1);
    expect(await runtime.database.prisma.conversation.count()).toBe(1);
    expect(await runtime.database.prisma.conversationMember.count()).toBe(2);
  });

  it('forbids a non-member from reading or sending', async () => {
    const first = await login('+998902000001');
    const second = await login('+998902000002');
    const outsider = await login('+998902000003');
    const conversation = await createConversation(first.tokens.accessToken, second.user.phoneNumber);

    await authenticated('get', `/v1/conversations/${conversation.id}/messages`, outsider.tokens.accessToken).expect(403);
    await authenticated('post', `/v1/conversations/${conversation.id}/messages`, outsider.tokens.accessToken)
      .send({ clientMessageId: 'outsider-1', body: 'Unauthorized' })
      .expect(403);
    expect(await runtime.database.prisma.message.count()).toBe(0);
  });

  it('persists messages and reads them through a new service instance', async () => {
    const first = await login('+998903000001');
    const second = await login('+998903000002');
    const conversation = await createConversation(first.tokens.accessToken, second.user.phoneNumber);
    const sent = await authenticated('post', `/v1/conversations/${conversation.id}/messages`, first.tokens.accessToken)
      .send({ clientMessageId: 'persist-1', body: 'Persisted message' })
      .expect(201);

    const restartedService = new MessagingService(runtime.database.prisma);
    const history = await restartedService.getMessages(conversation.id, second.user.id, 30);
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toMatchObject({ id: sent.body.message.id, body: 'Persisted message' });
  });

  it('paginates history with stable opaque cursors', async () => {
    const first = await login('+998904000001');
    const second = await login('+998904000002');
    const conversation = await createConversation(first.tokens.accessToken, second.user.phoneNumber);
    for (let index = 1; index <= 5; index += 1) {
      await authenticated('post', `/v1/conversations/${conversation.id}/messages`, first.tokens.accessToken)
        .send({ clientMessageId: `page-${index}`, body: `Message ${index}` })
        .expect(201);
    }

    const firstPage = await authenticated(
      'get', `/v1/conversations/${conversation.id}/messages?limit=2`, first.tokens.accessToken,
    ).expect(200);
    const secondPage = await authenticated(
      'get', `/v1/conversations/${conversation.id}/messages?limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`,
      first.tokens.accessToken,
    ).expect(200);
    const thirdPage = await authenticated(
      'get', `/v1/conversations/${conversation.id}/messages?limit=2&cursor=${encodeURIComponent(secondPage.body.nextCursor)}`,
      first.tokens.accessToken,
    ).expect(200);
    const ids = [...firstPage.body.items, ...secondPage.body.items, ...thirdPage.body.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(5);
    expect(thirdPage.body.nextCursor).toBeNull();
  });

  it('deduplicates parallel sends by client message id', async () => {
    const first = await login('+998905000001');
    const second = await login('+998905000002');
    const conversation = await createConversation(first.tokens.accessToken, second.user.phoneNumber);
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        authenticated('post', `/v1/conversations/${conversation.id}/messages`, first.tokens.accessToken)
          .send({ clientMessageId: 'same-client-id', body: 'Exactly once' }),
      ),
    );
    expect(responses.every((response) => response.status === 200 || response.status === 201)).toBe(true);
    expect(new Set(responses.map((response) => response.body.message.id)).size).toBe(1);
    expect(await runtime.database.prisma.message.count()).toBe(1);
  });

  it('authenticates WebSockets and delivers message.created only to members', async () => {
    const first = await login('+998906000001');
    const second = await login('+998906000002');
    const outsider = await login('+998906000003');
    const conversation = await createConversation(first.tokens.accessToken, second.user.phoneNumber);
    const recipientSocket = await openAuthenticatedSocket(second.tokens.accessToken);
    const outsiderSocket = await openAuthenticatedSocket(outsider.tokens.accessToken);
    const eventPromise = socketEvent(recipientSocket, 'message.created');
    let outsiderReceived = false;
    outsiderSocket.on('message', (data) => {
      if ((JSON.parse(data.toString()) as { type?: string }).type === 'message.created') outsiderReceived = true;
    });

    const sent = await authenticated('post', `/v1/conversations/${conversation.id}/messages`, first.tokens.accessToken)
      .send({ clientMessageId: 'socket-1', body: 'Real time' })
      .expect(201);
    const event = await eventPromise;
    expect(event.message).toMatchObject({ id: sent.body.message.id, body: 'Real time' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(outsiderReceived).toBe(false);
    recipientSocket.close();
    outsiderSocket.close();
  });

  it('rejects invalid socket auth and closes an active socket after logout', async () => {
    const invalidSocket = new WebSocket(runtime.wsUrl);
    await new Promise<void>((resolve, reject) => {
      invalidSocket.once('open', resolve);
      invalidSocket.once('error', reject);
    });
    const invalidClose = new Promise<number>((resolve) => invalidSocket.once('close', resolve));
    invalidSocket.send(JSON.stringify({ type: 'auth', accessToken: 'invalid' }));
    expect(await invalidClose).toBe(4401);

    const user = await login('+998907000001');
    const socket = await openAuthenticatedSocket(user.tokens.accessToken);
    const closeCode = new Promise<number>((resolve) => socket.once('close', resolve));
    await request(runtime.server).post('/v1/auth/logout').send({ refreshToken: user.tokens.refreshToken }).expect(204);
    expect(await closeCode).toBe(4401);
    await authenticated('get', '/v1/conversations', user.tokens.accessToken).expect(401);
  });
});
