import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/auth/service.js';
import { MemoryAuthRepository } from './memoryRepository.js';

const fixedNow = new Date('2026-07-31T12:00:00.000Z');
const config = {
  accessTokenSecret: 'test-secret-with-at-least-thirty-two-characters',
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
};

function setup() {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(repository, config, () => new Date(fixedNow));
  return { app: createApp(service, '*', undefined, undefined, true), repository };
}

describe('phone authentication', () => {
  it('does not expose development phone login unless explicitly enabled', async () => {
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, config, () => new Date(fixedNow));
    await request(createApp(service)).post('/v1/auth/phone').send({ phoneNumber: '901234567' }).expect(404);
    expect(repository.userCreateCount).toBe(0);
  });
  it('normalizes a local number, creates a user and opens a session', async () => {
    const { app, repository } = setup();
    const response = await request(app)
      .post('/v1/auth/phone')
      .send({ phoneNumber: '90 123-45-67', deviceName: 'Expo test' })
      .expect(201);

    expect(response.body.user.phoneNumber).toBe('+998901234567');
    expect(response.body.tokens.accessToken).toEqual(expect.any(String));
    expect(response.body.tokens.refreshToken).toEqual(expect.any(String));
    expect(repository.userCreateCount).toBe(1);
  });

  it('reuses an existing user while creating a new session', async () => {
    const { app, repository } = setup();
    await request(app).post('/v1/auth/phone').send({ phoneNumber: '+998901234567' }).expect(201);
    await request(app).post('/v1/auth/phone').send({ phoneNumber: '901234567' }).expect(201);
    expect(repository.userCreateCount).toBe(1);
  });

  it('rotates the refresh token and rejects reuse of the old token', async () => {
    const { app } = setup();
    const login = await request(app).post('/v1/auth/phone').send({ phoneNumber: '901234567' }).expect(201);
    const oldRefreshToken = login.body.tokens.refreshToken as string;
    const refreshed = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(200);

    expect(refreshed.body.tokens.refreshToken).not.toBe(oldRefreshToken);
    await request(app).post('/v1/auth/refresh').send({ refreshToken: oldRefreshToken }).expect(401);
  });

  it('authenticates access tokens and invalidates the session on logout', async () => {
    const { app } = setup();
    const login = await request(app).post('/v1/auth/phone').send({ phoneNumber: '901234567' }).expect(201);
    const { accessToken, refreshToken } = login.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };

    await request(app).get('/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    await request(app).post('/v1/auth/logout').send({ refreshToken }).expect(204);
    await request(app).get('/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
  });

  it('rejects invalid phone input', async () => {
    const { app } = setup();
    await request(app).post('/v1/auth/phone').send({ phoneNumber: 'abc' }).expect(400);
  });
});
