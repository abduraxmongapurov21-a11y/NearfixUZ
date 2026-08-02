import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { PrismaAuthRepository } from './auth/prismaRepository.js';
import { AuthService } from './auth/service.js';
import { loadEnvironment } from './config.js';
import { createDatabase } from './db.js';
import { MessagingService } from './messaging/service.js';
import { WebSocketHub } from './realtime/WebSocketHub.js';
import { UserDiscoveryService } from './users/service.js';

const environment = loadEnvironment();
const database = createDatabase(environment.databaseUrl);
const repository = new PrismaAuthRepository(database.prisma);
const authService = new AuthService(repository, environment);
const messagingService = new MessagingService(database.prisma);
const userDiscoveryService = new UserDiscoveryService(database.prisma);
const httpServer = createServer();
const realtime = new WebSocketHub(httpServer, authService);
const app = createApp(
  authService,
  environment.corsOrigin,
  messagingService,
  realtime,
  environment.developmentAuthEnabled,
  userDiscoveryService,
);
httpServer.on('request', app);

const server = httpServer.listen(environment.port, '0.0.0.0', () => {
  console.log(`Analog API http://0.0.0.0:${environment.port} manzilida ishga tushdi.`);
});

async function shutdown(signal: string) {
  console.log(`${signal} qabul qilindi, server to‘xtatilmoqda.`);
  realtime.close();
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
