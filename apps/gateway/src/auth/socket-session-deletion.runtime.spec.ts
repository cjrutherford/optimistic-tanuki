import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { Server, Socket as ServerSocket } from 'socket.io';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { of } from 'rxjs';
import { SocketSessionAuthService } from './socket-session-auth.service';
import { ChatGateway } from '../app/chat-gateway/chat.gateway';
import { SocialGateway } from '../app/social-gateway/social.gateway';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

function nextEvent(
  socket: ClientSocket,
  event: 'private-ready' | 'disconnect'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, done);
      socket.off('connect_error', fail);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const timer = setTimeout(() => fail(Error('SOCKET_EVENT_TIMEOUT')), 4000);
    socket.once(event, done);
    socket.once('connect_error', fail);
  });
}

/** Real transports/gateway maps, mocked JWT/Auth issuer. Not full D27 owner acceptance. */
it('purges real Chat/Social connections and preserves the other account on both namespaces', async () => {
  const account = randomUUID(),
    counterpart = randomUUID();
  const profiles = new Map<string, string>([
    [account, randomUUID()],
    [counterpart, randomUUID()],
  ]);
  const service = new SocketSessionAuthService(
    {
      verifyAsync: async (token: string) => ({
        userId: token,
        profileId: profiles.get(token),
      }),
    } as never,
    { send: () => of({ isValid: true }) } as never,
    { apps: [] } as never
  );
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
  const proxy = { send: jest.fn() };
  const chat = new ChatGateway(
    logger as never,
    proxy as never,
    proxy as never,
    proxy as never,
    proxy as never,
    proxy as never,
    service
  );
  const social = new SocialGateway(proxy as never, service, {} as never);
  const http = createServer();
  const server = new Server(http, { transports: ['websocket'] });
  const connections: ServerSocket[] = [];
  const clients: ClientSocket[] = [];
  const errors: unknown[] = [];
  for (const [name, gateway] of [
    ['chat', chat],
    ['social', social],
  ] as const) {
    server.of('/' + name).on('connection', (socket) => {
      connections.push(socket);
      socket.on('disconnect', () => gateway.handleDisconnect(socket));
      void gateway
        .handleConnection(socket)
        .then(() => {
          if (socket.connected) socket.emit('private-ready');
        })
        .catch((e) => errors.push(e));
    });
  }
  try {
    http.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const address = http.address();
    if (!address || typeof address === 'string')
      throw Error('PRIVATE_SOCKET_PORT');
    for (const namespace of ['chat', 'social']) {
      for (const id of [account, counterpart]) {
        const client = io(`http://127.0.0.1:${address.port}/${namespace}`, {
          transports: ['websocket'],
          reconnection: false,
          auth: { token: id },
          forceNew: true,
        });
        clients.push(client);
        await nextEvent(client, 'private-ready');
      }
    }
    const targetSockets = connections.filter(
      (s) => s.data.user?.userId === account
    );
    expect(targetSockets).toHaveLength(2);
    const disconnected = [
      nextEvent(clients[0], 'disconnect'),
      nextEvent(clients[2], 'disconnect'),
    ];
    expect(await service.purgeAccount(account)).toEqual({ remaining: 0 });
    await Promise.all(disconnected);
    for (const socket of targetSockets) {
      expect(socket.connected).toBe(false);
      expect(socket.data.user).toBeUndefined();
      expect(socket.handshake.auth.token).toBeUndefined();
      expect(socket.data.deletionPurged).toBe(true);
    }
    expect(clients[1].connected && clients[3].connected).toBe(true);
    expect((chat as any).connectedClients.map((s: any) => s.id)).toEqual([
      profiles.get(counterpart),
    ]);
    expect([...(social as any).connectedClients.keys()]).toEqual([
      profiles.get(counterpart),
    ]);
    expect(await service.readbackAccount(account)).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    clients.forEach((client) => client.disconnect());
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (http.listening)
      await new Promise<void>((resolve) => http.close(() => resolve()));
  }
}, 15000);
