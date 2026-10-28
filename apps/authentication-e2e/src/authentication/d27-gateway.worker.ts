/** D27 private HTTP/Socket.IO boundary using production handlers and real Auth TCP. */
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import {
  Controller,
  Get,
  UseGuards,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { Server } from 'socket.io';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { installPayloadFreeLogging } from '@optimistic-tanuki/logger';
import { readD27WorkerConfig } from './d27-owner.worker';
import { SocketSessionAuthService } from '../../../gateway/src/auth/socket-session-auth.service';
import { PermissionsCacheService } from '../../../gateway/src/auth/permissions-cache.service';
import { MemoryCacheProvider } from '../../../gateway/src/auth/cache/memory-cache.provider';
import { ChatGateway } from '../../../gateway/src/app/chat-gateway/chat.gateway';
import { SocialGateway } from '../../../gateway/src/app/social-gateway/social.gateway';
import { GatewayNotificationRecipientService } from '../../../gateway/src/controllers/social/notification/gateway-notification-recipient.service';
import { CommunityInviteMailer } from '../../../gateway/src/controllers/social/community/community-invite.mailer';
import {
  LocalOAuthStateStore,
  OAUTH_STATE_STORE,
} from '../../../gateway/src/controllers/oauth/oauth-state.store';
import {
  OAuthDeletionController,
  SocketSessionDeletionController,
  PermissionCacheDeletionController,
  GatewayRuntimeDeletionController,
} from '../../../gateway/src/controllers/oauth/oauth-deletion.controller';
import { randomUUID } from 'node:crypto';

import { r4GatewayComposition } from './r4-gateway-composition';
import { MicroserviceExceptionFilter } from '../../../gateway/src/filters/microservice-exception.filter';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../../gateway/src/auth/auth.guard';
import {
  User,
  UserDetails,
} from '../../../gateway/src/decorators/user.decorator';
import { GATEWAY_APP_REGISTRY } from '../../../gateway/src/controllers/registry/registry.tokens';
import { AuthenticationController } from '../../../gateway/src/controllers/authentication/authentication.controller';
import { AccountExportJobsController } from '../../../gateway/src/controllers/authentication/account-export-jobs.controller';
import { AccountExportDownloadController } from '../../../gateway/src/controllers/authentication/account-export-download.controller';
import { AccountDeletionHttpController } from '../../../gateway/src/controllers/authentication/account-deletion.controller';

// Reuse the production session projection and real AuthGuard, without unrelated login providers.
@Controller('authentication')
class PrivateCurrentSessionController {
  @Get('session')
  @UseGuards(AuthGuard)
  current(@User() user: UserDetails) {
    return AuthenticationController.prototype.currentSession(user);
  }
}
async function main() {
  if (
    process.env['D00_PRIVATE_FIXTURE'] !== 'd00-private-fixture' ||
    !process.send
  )
    throw Error('D27_PRIVATE_IPC_REQUIRED');
  const fixture = readD27WorkerConfig(process.env['D27_WORKER_CONFIG'] ?? '');
  installPayloadFreeLogging();
  const clients = Object.fromEntries(
    Object.entries(fixture.endpoints).map(([owner, endpoint]) => [
      owner,
      ClientProxyFactory.create({
        transport: Transport.TCP,
        options: endpoint,
      }),
    ])
  );
  const auth = clients['authentication'];
  const sessions = new SocketSessionAuthService(
    new JwtService({ secret: fixture.jwtSecret }),
    auth,
    {
      apps: [
        { appId: 'client-interface', uiBaseUrl: 'http://127.0.0.1:19080' },
        { appId: 'local-hub', uiBaseUrl: 'http://127.0.0.1:19081' },
      ],
    } as never
  );
  const cache = new PermissionsCacheService(new MemoryCacheProvider());
  const store = new LocalOAuthStateStore();
  const recipients = new GatewayNotificationRecipientService(
    clients['profile']
  );
  const disabled = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 9 },
  });
  const chat = new ChatGateway(
    new Logger('D27PrivateChat'),
    clients['chat-collector'],
    disabled,
    disabled,
    clients['profile'],
    clients['social'],
    sessions
  );
  const social = new SocialGateway(clients['social'], sessions, recipients);
  const r4 =
    process.env['R4_JOURNEYS'] === '1'
      ? r4GatewayComposition(fixture, clients, disabled)
      : undefined;
  const module = await Test.createTestingModule({
    imports: r4?.imports ?? [],
    controllers: [
      ...(r4?.controllers ?? [PrivateCurrentSessionController]),
      AccountExportJobsController,
      AccountExportDownloadController,
      AccountDeletionHttpController,
      OAuthDeletionController,
      SocketSessionDeletionController,
      PermissionCacheDeletionController,
      GatewayRuntimeDeletionController,
    ],
    providers: [
      ...(r4?.providers ?? []),
      AuthGuard,
      Reflector,
      {
        provide: JwtService,
        useValue: new JwtService({ secret: fixture.jwtSecret }),
      },
      {
        provide: ServiceTokens.PERMISSIONS_SERVICE,
        useValue: clients['permissions'],
      },
      {
        provide: GATEWAY_APP_REGISTRY,
        useValue: {
          apps: [
            { appId: 'client-interface', uiBaseUrl: 'http://127.0.0.1:19080' },
            { appId: 'local-hub', uiBaseUrl: 'http://127.0.0.1:19081' },
          ],
        },
      },
      { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: auth },
      { provide: OAUTH_STATE_STORE, useValue: store },
      { provide: SocketSessionAuthService, useValue: sessions },
      {
        provide: SocialGateway,
        useValue: {
          broadcastSocialContentInvalidated:
            social.broadcastSocialContentInvalidated.bind(social),
          broadcastFollowEvent: social.broadcastFollowEvent.bind(social),
        },
      },
      { provide: PermissionsCacheService, useValue: cache },
      { provide: CommunityInviteMailer, useValue: new CommunityInviteMailer() },
      // The source gateways are attached to this explicit loopback Socket.IO server.
      // This facade keeps Nest from also starting their decorator default ports.
      {
        provide: ChatGateway,
        useValue: {
          notifyPersistedMessage: chat.notifyPersistedMessage.bind(chat),
          invalidateConversations: chat.invalidateConversations.bind(chat),
          purgeAccountSecurityState: chat.purgeAccountSecurityState.bind(chat),
          readbackAccountSecurityState:
            chat.readbackAccountSecurityState.bind(chat),
        },
      },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  app.use(cookieParser());
  if (r4) {
    app.useGlobalFilters(new MicroserviceExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    );
  }
  app.setGlobalPrefix('api');
  await app.init();
  const io = new Server(
    app.getHttpServer(),
    process.env['R6_RELEASE'] === '1'
      ? {
          transports: ['polling', 'websocket'],
          cors: {
            origin: ['http://127.0.0.1:19080', 'http://127.0.0.1:19081'],
            credentials: true,
          },
        }
      : { transports: ['websocket'] }
  );
  chat.server = io.of('/chat') as never;
  social.server = io.of('/social') as never;
  for (const [name, gateway] of [
    ['chat', chat],
    ['social', social],
  ] as const) {
    io.of('/' + name).on('connection', (socket) => {
      if (r4 && name === 'chat')
        socket.on('message', (payload, ack) => {
          void chat.handleMessage(payload, socket, ack).catch(() => undefined);
        });
      socket.on('disconnect', () => gateway.handleDisconnect(socket));
      void gateway
        .handleConnection(socket)
        .then(() => {
          if (socket.connected) socket.emit('private-ready');
        })
        .catch(() => socket.disconnect(true));
    });
  }
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await io.close();
    try {
      await app.close();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING')
        throw error;
    }
    for (const client of Object.values(clients)) client.close();
    disabled.close();
    process.send?.({ type: 'closed' });
    if (process.connected) process.disconnect();
  };
  process.once('disconnect', () => {
    void close().finally(() => process.exit(0));
  });
  process.on(
    'message',
    async (message: {
      type?: string;
      requestId?: string;
      accountId?: string;
      profileId?: string;
      sessionId?: string;
      foreignProfileId?: string;
    }) => {
      try {
        if (message.type === 'close') {
          await close();
          return;
        }
        if (
          message.type === 'seed' &&
          message.accountId &&
          message.profileId &&
          message.sessionId
        ) {
          await cache.set(message.profileId, 'read', 'local-hub', true);
          const code = randomUUID();
          await store.createCallbackGrant(code, {
            sessionId: message.sessionId,
            userId: message.accountId,
            profileId: message.profileId,
            appId: 'local-hub',
            returnOrigin: 'http://127.0.0.1:19081',
            redemptionOrigin: 'http://127.0.0.1:19081',
            stateId: randomUUID(),
            nonceHash: 'a'.repeat(64),
            expiresAt: Date.now() + 60000,
          });
          process.send?.({
            type: 'result',
            requestId: message.requestId,
            result: { seeded: true },
          });
        } else if (message.type === 'inspect' && message.profileId) {
          process.send?.({
            type: 'result',
            requestId: message.requestId,
            result: {
              cached: await cache.get(message.profileId, 'read', 'local-hub'),
            },
          });
        }
      } catch {
        process.send?.({ type: 'failed', requestId: message.requestId });
      }
    }
  );
  await app.listen(fixture.listen.port, '127.0.0.1');
  process.send?.({
    type: 'ready',
    port: fixture.listen.port,
    pid: process.pid,
  });
}
if (require.main === module)
  void main().catch(() => {
    process.send?.({ type: 'failed' });
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  });
