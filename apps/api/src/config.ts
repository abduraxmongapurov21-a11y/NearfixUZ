import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEVELOPMENT_AUTH_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DATABASE_URL: z.string().url(),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('*'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export type AppConfig = {
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
};

export type Environment = AppConfig & {
  nodeEnv: 'development' | 'test' | 'production';
  developmentAuthEnabled: boolean;
  databaseUrl: string;
  port: number;
  corsOrigin: string;
};

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const environment = environmentSchema.parse(source);
  if (environment.NODE_ENV === 'production' && environment.DEVELOPMENT_AUTH_ENABLED) {
    throw new Error('Production DEVELOPMENT_AUTH_ENABLED=true bilan ishga tushmaydi.');
  }
  return {
    nodeEnv: environment.NODE_ENV,
    developmentAuthEnabled: environment.DEVELOPMENT_AUTH_ENABLED,
    databaseUrl: environment.DATABASE_URL,
    accessTokenSecret: environment.ACCESS_TOKEN_SECRET,
    port: environment.PORT,
    corsOrigin: environment.CORS_ORIGIN,
    accessTokenTtlSeconds: environment.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: environment.REFRESH_TOKEN_TTL_DAYS,
  };
}
