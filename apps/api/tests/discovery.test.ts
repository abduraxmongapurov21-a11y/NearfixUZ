import 'dotenv/config';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { PrismaAuthRepository } from '../src/auth/prismaRepository.js';
import { AuthService } from '../src/auth/service.js';
import { createDatabase } from '../src/db.js';
import { MessagingService } from '../src/messaging/service.js';
import { UserDiscoveryService } from '../src/users/service.js';

const database = createDatabase(process.env.TEST_DATABASE_URL!);
const authService = new AuthService(new PrismaAuthRepository(database.prisma), {
  accessTokenSecret: 'discovery-test-secret-with-at-least-32-characters',
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
});
const app = createApp(
  authService,
  '*',
  new MessagingService(database.prisma),
  undefined,
  true,
  new UserDiscoveryService(database.prisma),
);

type Login = {
  user: { id: string; phoneNumber: string };
  tokens: { accessToken: string };
};

async function login(phoneNumber: string): Promise<Login> {
  return (await request(app).post('/v1/auth/phone').send({ phoneNumber }).expect(201)).body as Login;
}

function get(path: string, token: string) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => database.prisma.$connect());

beforeEach(async () => {
  await database.prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "messages", "conversation_members", "conversations", "sessions", "users" CASCADE',
  );
});

afterAll(async () => database.close());

describe('authenticated user discovery', () => {
  it('finds a registered user by normalized exact phone without creating missing users', async () => {
    const first = await login('+998770801011');
    const second = await login('+998770801012');
    const before = await database.prisma.user.count();

    const found = await get('/v1/users/discover?q=77%20080%2010%2012', first.tokens.accessToken).expect(200);
    expect(found.body.users).toEqual([{
      id: second.user.id,
      phoneNumber: '+998770801012',
      displayName: null,
      username: null,
      avatarUrl: null,
    }]);

    const missing = await get('/v1/users/discover?q=%2B998770809999', first.tokens.accessToken).expect(200);
    expect(missing.body.users).toEqual([]);
    expect(await database.prisma.user.count()).toBe(before);
  });

  it('searches populated names and usernames, excludes self, validates input and caps limits', async () => {
    const first = await login('+998770801021');
    const second = await login('+998770801022');
    await database.prisma.user.update({
      where: { id: second.user.id },
      data: { displayName: 'Real Backend User', username: 'real_user', avatarUrl: 'https://cdn.example.com/real.png' },
    });

    const byName = await get('/v1/users/discover?q=Real&limit=5', first.tokens.accessToken).expect(200);
    expect(byName.body.users[0]).toMatchObject({ id: second.user.id, displayName: 'Real Backend User', username: 'real_user' });
    const byUsername = await get('/v1/users/discover?q=%40real_', first.tokens.accessToken).expect(200);
    expect(byUsername.body.users).toHaveLength(1);
    const self = await get('/v1/users/discover?q=%2B998770801021', first.tokens.accessToken).expect(200);
    expect(self.body.users).toEqual([]);
    await get('/v1/users/discover?q=x', first.tokens.accessToken).expect(400);
    await get('/v1/users/discover?q=real&limit=21', first.tokens.accessToken).expect(400);
    await request(app).get('/v1/users/discover?q=real').expect(401);
  });

  it('lets arbitrary discovered users open one unique direct conversation with real peer identity', async () => {
    const first = await login('+998770801031');
    const second = await login('+998770801032');
    await database.prisma.user.update({ where: { id: second.user.id }, data: { displayName: 'Database Name' } });
    const discovered = await get('/v1/users/discover?q=%2B998770801032', first.tokens.accessToken).expect(200);
    expect(discovered.body.users[0].displayName).toBe('Database Name');

    const firstOpen = await request(app)
      .post('/v1/conversations/direct')
      .set('Authorization', `Bearer ${first.tokens.accessToken}`)
      .send({ participantPhoneNumber: second.user.phoneNumber })
      .expect(200);
    const secondOpen = await request(app)
      .post('/v1/conversations/direct')
      .set('Authorization', `Bearer ${second.tokens.accessToken}`)
      .send({ participantPhoneNumber: first.user.phoneNumber })
      .expect(200);

    expect(secondOpen.body.conversation.id).toBe(firstOpen.body.conversation.id);
    expect(firstOpen.body.conversation.peer).toEqual({
      id: second.user.id,
      phoneNumber: second.user.phoneNumber,
      displayName: 'Database Name',
      username: null,
      avatarUrl: null,
    });
    expect(await database.prisma.conversation.count()).toBe(1);
  });

  it('gives fixture phone numbers no special identity and new users no conversations', async () => {
    const fixturePhoneUser = await login('+998901234567');
    const freshUser = await login('+998770801042');
    const conversations = await get('/v1/conversations', freshUser.tokens.accessToken).expect(200);
    expect(conversations.body.conversations).toEqual([]);

    const opened = await request(app)
      .post('/v1/conversations/direct')
      .set('Authorization', `Bearer ${freshUser.tokens.accessToken}`)
      .send({ participantPhoneNumber: fixturePhoneUser.user.phoneNumber })
      .expect(200);
    expect(opened.body.conversation.peer).toEqual({
      id: fixturePhoneUser.user.id,
      phoneNumber: '+998901234567',
      displayName: null,
      username: null,
      avatarUrl: null,
    });
  });
});
