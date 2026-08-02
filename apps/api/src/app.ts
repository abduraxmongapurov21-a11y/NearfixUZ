import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { AuthError } from './auth/errors.js';
import { normalizePhoneNumber } from './auth/phone.js';
import { AuthService } from './auth/service.js';
import { ApiError } from './messaging/errors.js';
import type { MessagingService } from './messaging/service.js';
import type { RealtimePublisher } from './messaging/types.js';
import type { UserDiscoveryService } from './users/service.js';

const phoneLoginSchema = z.object({
  phoneNumber: z.string().min(1).transform((value, context) => {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) {
      context.addIssue({ code: 'custom', message: 'Telefon raqami noto‘g‘ri formatda.' });
      return z.NEVER;
    }
    return normalized;
  }),
  deviceName: z.string().trim().min(1).max(120).optional(),
});

const refreshSchema = z.object({ refreshToken: z.string().min(32) });
const directConversationSchema = z.object({ participantPhoneNumber: z.string().min(1).max(30) });
const conversationParamsSchema = z.object({ conversationId: z.string().min(1).max(64) });
const messageHistorySchema = z.object({
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
const sendMessageSchema = z.object({
  clientMessageId: z.string().min(1).max(120).regex(/^[A-Za-z0-9._:-]+$/),
  body: z.string().trim().min(1).max(4000),
});
const userDiscoverySchema = z.object({
  q: z.string().trim().min(2).max(80),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

function bearerToken(request: Request): string | null {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice(7).trim() || null;
}

export function createApp(
  authService: AuthService,
  corsOrigin = '*',
  messagingService?: MessagingService,
  realtime?: RealtimePublisher,
  developmentAuthEnabled = false,
  userDiscoveryService?: UserDiscoveryService,
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.post('/v1/auth/phone', async (request, response) => {
    if (!developmentAuthEnabled) {
      response.status(404).json({ error: { code: 'DEVELOPMENT_AUTH_DISABLED', message: 'Endpoint topilmadi.' } });
      return;
    }
    const input = phoneLoginSchema.parse(request.body);
    const result = await authService.login(input.phoneNumber, input.deviceName ?? null);
    response.status(201).json(result);
  });

  app.post('/v1/auth/refresh', async (request, response) => {
    const input = refreshSchema.parse(request.body);
    response.json(await authService.refresh(input.refreshToken));
  });

  app.post('/v1/auth/logout', async (request, response) => {
    const input = refreshSchema.parse(request.body);
    const revokedSessionId = await authService.logout(input.refreshToken);
    if (revokedSessionId) realtime?.revokeSession(revokedSessionId);
    response.status(204).send();
  });

  app.get('/v1/auth/me', async (request, response) => {
    const token = bearerToken(request);
    if (!token) throw new AuthError('INVALID_ACCESS_TOKEN');
    response.json({ user: await authService.authenticate(token) });
  });

  if (userDiscoveryService) {
    app.get('/v1/users/discover', async (request, response) => {
      const token = bearerToken(request);
      if (!token) throw new AuthError('INVALID_ACCESS_TOKEN');
      const principal = await authService.authenticateSession(token);
      const query = userDiscoverySchema.parse(request.query);
      response.json({ users: await userDiscoveryService.search(principal.user.id, query.q, query.limit) });
    });
  }

  if (messagingService) {
    const authenticate = async (request: Request) => {
      const token = bearerToken(request);
      if (!token) throw new AuthError('INVALID_ACCESS_TOKEN');
      return authService.authenticateSession(token);
    };

    app.post('/v1/conversations/direct', async (request, response) => {
      const principal = await authenticate(request);
      const input = directConversationSchema.parse(request.body);
      const conversation = await messagingService.createDirectConversation(
        principal.user.id,
        input.participantPhoneNumber,
      );
      response.json({ conversation });
    });

    app.get('/v1/conversations', async (request, response) => {
      const principal = await authenticate(request);
      response.json({ conversations: await messagingService.listConversations(principal.user.id) });
    });

    app.get('/v1/conversations/:conversationId/messages', async (request, response) => {
      const principal = await authenticate(request);
      const { conversationId } = conversationParamsSchema.parse(request.params);
      const query = messageHistorySchema.parse(request.query);
      response.json(await messagingService.getMessages(conversationId, principal.user.id, query.limit, query.cursor));
    });

    app.post('/v1/conversations/:conversationId/messages', async (request, response) => {
      const principal = await authenticate(request);
      const { conversationId } = conversationParamsSchema.parse(request.params);
      const input = sendMessageSchema.parse(request.body);
      const result = await messagingService.sendMessage(
        conversationId,
        principal.user.id,
        input.clientMessageId,
        input.body,
      );
      if (result.created) realtime?.broadcastMessage(result.message, result.memberIds);
      response.status(result.created ? 201 : 200).json({ message: result.message, created: result.created });
    });
  }

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint topilmadi.' } });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'So‘rov ma’lumotlari noto‘g‘ri.',
          details: z.treeifyError(error),
        },
      });
      return;
    }
    if (error instanceof AuthError) {
      response.status(error.status).json({ error: { code: error.code, message: 'Session yaroqsiz.' } });
      return;
    }
    if (error instanceof ApiError) {
      response.status(error.status).json({ error: { code: error.code, message: error.userMessage } });
      return;
    }
    console.error(error);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server xatosi.' } });
  });

  return app;
}
