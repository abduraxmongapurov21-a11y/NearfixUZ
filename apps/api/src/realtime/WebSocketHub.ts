import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { AuthService } from '../auth/service.js';
import type { ApiMessage, RealtimePublisher } from '../messaging/types.js';

type AuthenticatedConnection = {
  socket: WebSocket;
  userId: string;
  sessionId: string;
  accessToken: string;
};

function send(socket: WebSocket, payload: object) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

export class WebSocketHub implements RealtimePublisher {
  private readonly server = new WebSocketServer({ noServer: true });
  private readonly connections = new Map<WebSocket, AuthenticatedConnection>();
  private readonly authenticationTimers = new Map<WebSocket, NodeJS.Timeout>();
  private readonly validationTimer: NodeJS.Timeout;

  constructor(httpServer: Server, private readonly authService: AuthService) {
    httpServer.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname !== '/v1/ws') {
        socket.destroy();
        return;
      }
      this.server.handleUpgrade(request, socket, head, (webSocket) => {
        this.server.emit('connection', webSocket, request);
      });
    });
    this.server.on('connection', (socket, request) => this.handleConnection(socket, request));
    this.validationTimer = setInterval(() => void this.validateConnections(), 15_000);
    this.validationTimer.unref();
  }

  private handleConnection(socket: WebSocket, _request: IncomingMessage) {
    const timer = setTimeout(() => socket.close(4401, 'Authentication required'), 5_000);
    this.authenticationTimers.set(socket, timer);
    socket.on('message', (data) => void this.handleMessage(socket, data.toString()));
    socket.on('close', () => this.removeConnection(socket));
    socket.on('error', () => this.removeConnection(socket));
  }

  private async handleMessage(socket: WebSocket, rawMessage: string) {
    if (this.connections.has(socket)) {
      send(socket, { type: 'error', error: { code: 'UNSUPPORTED_EVENT', message: 'Noma’lum socket hodisasi.' } });
      return;
    }
    try {
      const payload = JSON.parse(rawMessage) as { type?: unknown; accessToken?: unknown };
      if (payload.type !== 'auth' || typeof payload.accessToken !== 'string') throw new Error('invalid');
      const principal = await this.authService.authenticateSession(payload.accessToken);
      const timer = this.authenticationTimers.get(socket);
      if (timer) clearTimeout(timer);
      this.authenticationTimers.delete(socket);
      this.connections.set(socket, {
        socket,
        userId: principal.user.id,
        sessionId: principal.sessionId,
        accessToken: payload.accessToken,
      });
      send(socket, { type: 'auth.ok', userId: principal.user.id });
    } catch {
      socket.close(4401, 'Invalid or expired session');
    }
  }

  private removeConnection(socket: WebSocket) {
    const timer = this.authenticationTimers.get(socket);
    if (timer) clearTimeout(timer);
    this.authenticationTimers.delete(socket);
    this.connections.delete(socket);
  }

  private async validateConnections() {
    await Promise.all(
      [...this.connections.values()].map(async (connection) => {
        try {
          const principal = await this.authService.authenticateSession(connection.accessToken);
          if (principal.sessionId !== connection.sessionId) throw new Error('session mismatch');
        } catch {
          connection.socket.close(4401, 'Session expired');
        }
      }),
    );
  }

  broadcastMessage(message: ApiMessage, memberIds: string[]) {
    const members = new Set(memberIds);
    for (const connection of this.connections.values()) {
      if (members.has(connection.userId)) send(connection.socket, { type: 'message.created', message });
    }
  }

  revokeSession(sessionId: string) {
    for (const connection of this.connections.values()) {
      if (connection.sessionId === sessionId) connection.socket.close(4401, 'Session revoked');
    }
  }

  close() {
    clearInterval(this.validationTimer);
    for (const socket of this.authenticationTimers.keys()) socket.close(1001, 'Server shutting down');
    for (const connection of this.connections.values()) connection.socket.close(1001, 'Server shutting down');
    this.server.close();
  }
}
