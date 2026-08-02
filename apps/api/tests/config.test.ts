import { describe, expect, it } from 'vitest';
import { loadEnvironment } from '../src/config.js';

const base = {
  DATABASE_URL: 'postgresql://analog:analog@localhost:5432/analog',
  ACCESS_TOKEN_SECRET: 'test-secret-with-at-least-thirty-two-characters',
};

describe('environment safety', () => {
  it('keeps development auth disabled unless explicitly enabled', () => {
    expect(loadEnvironment({ ...base, NODE_ENV: 'development' }).developmentAuthEnabled).toBe(false);
    expect(loadEnvironment({ ...base, NODE_ENV: 'development', DEVELOPMENT_AUTH_ENABLED: 'true' }).developmentAuthEnabled).toBe(true);
  });

  it('fails closed when production enables development auth', () => {
    expect(() => loadEnvironment({ ...base, NODE_ENV: 'production', DEVELOPMENT_AUTH_ENABLED: 'true' }))
      .toThrow('Production DEVELOPMENT_AUTH_ENABLED=true bilan ishga tushmaydi.');
  });

  it('allows production only with development auth disabled', () => {
    const environment = loadEnvironment({ ...base, NODE_ENV: 'production', DEVELOPMENT_AUTH_ENABLED: 'false' });
    expect(environment.nodeEnv).toBe('production');
    expect(environment.developmentAuthEnabled).toBe(false);
  });
});
