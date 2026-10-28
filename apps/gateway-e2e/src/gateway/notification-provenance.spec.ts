import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { JwtService } from '@nestjs/jwt';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import {
  AuthCommands,
  NotificationCommands,
  ServiceTokens,
  SocialRealtimeCommands,
} from '@optimistic-tanuki/constants';
import { Client as PgClient } from 'pg';
import { firstValueFrom, timeout } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { MicroserviceExceptionFilter } from '../../../gateway/src/filters/microservice-exception.filter';
import { AuthGuard } from '../../../gateway/src/auth/auth.guard';
import { SocketSessionAuthService } from '../../../gateway/src/auth/socket-session-auth.service';
import { SocialGateway } from '../../../gateway/src/app/social-gateway/social.gateway';
import { NotificationController } from '../../../gateway/src/controllers/social/notification/notification.controller';
import { GatewayNotificationRecipientService } from '../../../gateway/src/controllers/social/notification/gateway-notification-recipient.service';
import { PerformanceTelemetryController } from '../../../gateway/src/performance/performance-telemetry.controller';
import { GATEWAY_APP_REGISTRY } from '../../../gateway/src/controllers/registry/registry.tokens';

jest.setTimeout(90000);

describe('J21 Notification recipient and provenance against private services', () => {
  type AccountFixture = {
    id: string;
    email: string;
    profileId: string;
    token?: string;
  };
  const accounts: AccountFixture[] = [];
  const tokens: string[] = [];
  const profileIds: string[] = [];
  const clients: ClientProxy[] = [];
  const sockets: Socket[] = [];
  const notificationIds: string[] = [];
  let auth: ClientProxy;
  let social: ClientProxy;
  let profile: ClientProxy;
  let app: INestApplication | undefined;
  let authDb: PgClient | undefined;
  let profileDb: PgClient | undefined;
  let socialDb: PgClient | undefined;
  let origin: string;

  const rpc = <T = any>(client: ClientProxy, cmd: string, payload: unknown) =>
    firstValueFrom(
      client.send<T>({ cmd }, payload).pipe(timeout({ first: 5000 }))
    );
  const proxy = (port: number) => {
    const client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port },
    });
    clients.push(client);
    return client;
  };
  const request = (
    path: string,
    options: RequestInit = {},
    token?: string,
    cookie = false
  ) =>
    fetch(`${origin}/api/notifications${path}`, {
      ...options,
      headers: {
        origin: 'http://127.0.0.1:8080',
        'x-ot-app-id': 'client-interface',
        'x-ot-appscope': 'client-interface',
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(token
          ? cookie
            ? { cookie: `ot_session=${token}` }
            : { authorization: `Bearer ${token}` }
          : {}),
        ...options.headers,
      },
    });
  const once = (socket: Socket, event: string) =>
    new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`J21 socket event timeout: ${event}`));
      }, 5000);
      const handler = (data: unknown) => {
        clearTimeout(timer);
        resolve(data);
      };
      socket.once(event, handler);
    });
  const connectSocket = async (account: AccountFixture, cookie = false) => {
    const socket = io('http://127.0.0.1:3301/social', {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: {
        origin: 'http://127.0.0.1:8080',
        ...(cookie ? { cookie: `ot_session=${account.token}` } : {}),
      },
      ...(cookie ? {} : { auth: { token: account.token } }),
    });
    sockets.push(socket);
    const ready = once(socket, 'social_content_invalidated');
    socket.connect();
    await ready;
    const subscribed = once(socket, 'subscribed');
    socket.emit(SocialRealtimeCommands.SUBSCRIBE_NOTIFICATIONS, {
      profileId: account.profileId,
    });
    expect(await subscribed).toMatchObject({
      type: 'notifications',
      profileId: account.profileId,
    });
    return socket;
  };
  beforeAll(async () => {
    if (
      process.env.NOTIFICATION_J21_MARKER !== 'private-notification-j21-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-forum-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15548' ||
      !process.env.PRESENCE_J17_JWT_SECRET
    )
      throw new Error('J21 private fixture markers required');
    auth = proxy(3001);
    social = proxy(3003);
    profile = proxy(3002);
    const db = (database: string) =>
      new PgClient({
        host: '127.0.0.1',
        port: 15548,
        user: 'postgres',
        password: 'postgres',
        database,
      });
    authDb = db('ot_authentication');
    profileDb = db('ot_profile');
    socialDb = db('ot_social');
    await Promise.all([
      authDb.connect(),
      profileDb.connect(),
      socialDb.connect(),
    ]);
    const registry = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      apps: [
        {
          appId: 'client-interface',
          name: 'J21 private notification app',
          domain: '127.0.0.1',
          uiBaseUrl: 'http://127.0.0.1:8080',
          apiBaseUrl: 'http://127.0.0.1:3300',
          appType: 'client',
          visibility: 'public',
        },
      ],
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        AuthGuard,
        Reflector,
        SocialGateway,
        SocketSessionAuthService,
        GatewayNotificationRecipientService,
        { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: auth },
        { provide: ServiceTokens.PROFILE_SERVICE, useValue: profile },
        { provide: ServiceTokens.SOCIAL_SERVICE, useValue: social },
        { provide: ServiceTokens.PERMISSIONS_SERVICE, useValue: proxy(3012) },
        { provide: GATEWAY_APP_REGISTRY, useValue: registry },
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: process.env.PRESENCE_J17_JWT_SECRET,
          }),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(require('cookie-parser')());
    app.useGlobalFilters(new MicroserviceExceptionFilter());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    origin = `http://127.0.0.1:${
      (app.getHttpServer().address() as AddressInfo).port
    }`;
  });

  it('rejects forged creation and stale recipients, projects legacy rows and isolates authenticated rooms', async () => {
    const password = 'NotificationJ21!Fixture123';
    for (const label of ['owner', 'counterpart']) {
      const email = `notification-j21-${label}-${randomUUID().slice(
        0,
        12
      )}@example.test`;
      const registered = await rpc<any>(auth, AuthCommands.Register, {
        email,
        fn: 'J21',
        ln: label,
        password,
        confirm: password,
        ageEligibilityStatus: 'adult',
      });
      const account = {
        id: registered.data.user.id,
        email,
        profileId: randomUUID(),
        token: undefined as string | undefined,
      };
      accounts.push(account);
      profileIds.push(account.profileId);
      await profileDb!.query(
        `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills)
        VALUES ($1,$2,'client-interface','J21 fixture','','','','','','','')`,
        [account.profileId, account.id]
      );
      const login = await rpc<any>(auth, AuthCommands.Login, {
        email,
        password,
        appId: 'client-interface',
        profileId: account.profileId,
      });
      account.token = login.data.newToken;
      tokens.push(account.token!);
    }
    const [owner, other] = accounts;
    const marker = `private-j21-${randomUUID()}`;
    const forged = {
      recipientId: other.profileId,
      type: 'mention',
      title: marker,
      body: marker,
      senderId: owner.profileId,
      actionUrl: `https://example.test/${marker}`,
    };
    for (const recipientId of [owner.profileId, other.profileId]) {
      const response = await request(
        '',
        { method: 'POST', body: JSON.stringify({ ...forged, recipientId }) },
        owner.token
      );
      expect(response.status).toBe(403);
    }
    expect(
      Number(
        (await socialDb!.query('SELECT count(*) FROM notification')).rows[0]
          .count
      )
    ).toBe(0);
    const created = await rpc<any>(social, NotificationCommands.CREATE, {
      ...forged,
      recipientId: owner.profileId,
    });
    notificationIds.push(created.id);
    const legacyId = randomUUID();
    notificationIds.push(legacyId);
    await socialDb!.query(
      `INSERT INTO notification(id,"recipientId",type,title,body,"senderId","resourceType","resourceId","actionUrl","isRead")
      VALUES($1,$2,'mention',$3,$3,$4,'post',$5,$6,false)`,
      [
        legacyId,
        owner.profileId,
        marker,
        other.profileId,
        randomUUID(),
        `https://example.test/${marker}`,
      ]
    );
    const foreign = await rpc<any>(social, NotificationCommands.CREATE, {
      recipientId: other.profileId,
      type: 'follow',
      title: marker,
      body: marker,
    });
    notificationIds.push(foreign.id);
    const exactKeys = [
      'body',
      'createdAt',
      'id',
      'isRead',
      'recipientId',
      'title',
      'type',
    ];
    const assertSafe = (row: any) => {
      expect(Object.keys(row).sort()).toEqual(exactKeys);
      expect(JSON.stringify(row)).not.toContain(marker);
      expect(row.recipientId).toBe(owner.profileId);
    };
    const response = await request(
      `/${owner.profileId.toUpperCase()}`,
      {},
      owner.token,
      true
    );
    expect(response.status).toBe(200);
    const rows = await response.json();
    expect(rows).toHaveLength(2);
    rows.forEach(assertSafe);
    const direct = await rpc<any[]>(
      social,
      NotificationCommands.FIND_BY_RECIPIENT,
      { recipientId: owner.profileId }
    );
    direct.forEach(assertSafe);
    expect((await request(`/${other.profileId}`, {}, owner.token)).status).toBe(
      403
    );
    expect(
      (await request(`/${foreign.id}/read`, { method: 'PUT' }, owner.token))
        .status
    ).toBe(404);
    expect(
      (await request(`/${foreign.id}`, { method: 'DELETE' }, owner.token))
        .status
    ).toBe(404);
    expect(
      (await request(`/${created.id}/read`, { method: 'PUT' }, owner.token))
        .status
    ).toBe(200);
    expect(
      (await request(`/${owner.profileId}/unread-count`, {}, owner.token))
        .status
    ).toBe(200);
    const ownerSocket = await connectSocket(owner, true);
    const otherSocket = await connectSocket(other);
    const ownerEvents: any[] = [];
    const otherEvents: any[] = [];
    ownerSocket.on('notification', (n) => ownerEvents.push(n));
    otherSocket.on('notification', (n) => otherEvents.push(n));
    const gateway = app!.get(SocialGateway);
    const received = once(ownerSocket, 'notification');
    const raw = (
      await socialDb!.query('SELECT * FROM notification WHERE id=$1', [
        legacyId,
      ])
    ).rows[0];
    await gateway.broadcastNotification(raw);
    assertSafe(await received);
    expect(otherEvents).toHaveLength(0);
    const unsubscribed = once(ownerSocket, 'unsubscribed');
    ownerSocket.emit(SocialRealtimeCommands.UNSUBSCRIBE_NOTIFICATIONS, {
      profileId: owner.profileId,
    });
    await unsubscribed;
    await gateway.broadcastNotification(raw);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(ownerEvents).toHaveLength(1);
    const resubscribed = once(ownerSocket, 'subscribed');
    ownerSocket.emit(SocialRealtimeCommands.SUBSCRIBE_NOTIFICATIONS, {
      profileId: owner.profileId,
    });
    await resubscribed;
    // A forged subscription cannot join the other recipient's room.
    otherSocket.emit(SocialRealtimeCommands.SUBSCRIBE_NOTIFICATIONS, {
      profileId: owner.profileId,
    });
    // Changing current ownership invalidates a still-signed HTTP/socket selection.
    await profileDb!.query('UPDATE profile SET "userId"=$1 WHERE id=$2', [
      other.id,
      owner.profileId,
    ]);
    expect((await request(`/${owner.profileId}`, {}, owner.token)).status).toBe(
      403
    );
    expect(
      (await request(`/${created.id}/read`, { method: 'PUT' }, owner.token))
        .status
    ).toBe(403);
    await gateway.broadcastNotification(raw);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(ownerEvents).toHaveLength(1);
    expect(otherEvents).toHaveLength(0);
    await profileDb!.query('UPDATE profile SET "userId"=$1 WHERE id=$2', [
      owner.id,
      owner.profileId,
    ]);
    expect(
      (
        await request(
          `/${owner.profileId}/read-all`,
          { method: 'PUT' },
          owner.token
        )
      ).status
    ).toBe(200);
    const unread = await request(
      `/${owner.profileId}/unread-count`,
      {},
      owner.token
    );
    expect(await unread.json()).toEqual({ count: 0 });
    expect(
      (await request(`/${created.id}`, { method: 'DELETE' }, owner.token, true))
        .status
    ).toBe(200);
    const counterpartRow = (
      await socialDb!.query('SELECT * FROM notification WHERE id=$1', [
        foreign.id,
      ])
    ).rows[0];
    expect(counterpartRow.recipientId).toBe(other.profileId);
    expect(counterpartRow.isRead).toBe(false);
    // Invoke the real trusted producer method with real Profile/Auth/Social RPC;
    // email delivery is a stub and no external email is sent.
    const ownerConsoleIds = [randomUUID(), randomUUID()];
    profileIds.push(...ownerConsoleIds);
    for (const id of ownerConsoleIds)
      await profileDb!.query(
        `INSERT INTO profile
      (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills)
      VALUES($1,$2,'owner-console','J21 console','','','','','','','')`,
        [id, owner.id]
      );
    const email = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    const performance = new PerformanceTelemetryController(
      {} as never,
      { prometheus: jest.fn().mockResolvedValue('') } as never,
      auth,
      profile,
      social,
      email as never
    );
    await (performance as any).notifyOwners({
      id: randomUUID(),
      severity: 'warning',
      appId: 'client-interface',
      metric: 'lcp',
      route: '/fixture',
      observed: 100,
      threshold: 50,
    });
    const performanceRows = (
      await socialDb!.query(
        'SELECT * FROM notification WHERE "recipientId"=ANY($1::varchar[])',
        [ownerConsoleIds]
      )
    ).rows;
    notificationIds.push(...performanceRows.map((row: any) => row.id));
    expect(performanceRows.map((row: any) => row.recipientId).sort()).toEqual(
      ownerConsoleIds.sort()
    );
    expect(
      performanceRows.every((row: any) => row.recipientId !== owner.id)
    ).toBe(true);
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
  });

  afterAll(async () => {
    try {
      for (const socket of sockets) socket.disconnect();
      if (socialDb && notificationIds.length)
        await socialDb.query(
          'DELETE FROM notification WHERE id=ANY($1::uuid[])',
          [notificationIds]
        );
      for (const token of tokens)
        await rpc(auth, AuthCommands.Logout, { token }).catch(() => undefined);
      const userIds = accounts.map((account) => account.id);
      if (authDb && userIds.length) {
        await authDb
          .query(
            'DELETE FROM auth_action_token WHERE "userId" = ANY($1::uuid[])',
            [userIds]
          )
          .catch(() => undefined);
        await authDb
          .query('DELETE FROM token WHERE "userId" = ANY($1::uuid[])', [
            userIds,
          ])
          .catch(() => undefined);
        const keyRows = await authDb
          .query(
            'SELECT "keyDataId" FROM user_entity WHERE id = ANY($1::uuid[])',
            [userIds]
          )
          .catch(() => ({ rows: [] as Array<{ keyDataId?: string }> }));
        const keyIds = keyRows.rows.map((row) => row.keyDataId).filter(Boolean);
        await authDb
          .query(
            'UPDATE user_entity SET "keyDataId" = NULL WHERE id = ANY($1::uuid[])',
            [userIds]
          )
          .catch(() => undefined);
        if (keyIds.length)
          await authDb
            .query(
              'UPDATE key_datum SET "userId" = NULL WHERE id = ANY($1::uuid[])',
              [keyIds]
            )
            .catch(() => undefined);
        await authDb
          .query('DELETE FROM user_entity WHERE id = ANY($1::uuid[])', [
            userIds,
          ])
          .catch(() => undefined);
        if (keyIds.length)
          await authDb
            .query('DELETE FROM key_datum WHERE id = ANY($1::uuid[])', [keyIds])
            .catch(() => undefined);
      }
      if (profileDb && profileIds.length)
        await profileDb
          .query('DELETE FROM profile WHERE id = ANY($1::uuid[])', [profileIds])
          .catch(() => undefined);
    } finally {
      await app?.close().catch(() => undefined);
      await Promise.all(
        clients.map((client) =>
          Promise.resolve()
            .then(() => client.close())
            .catch(() => undefined)
        )
      );
      await Promise.all(
        [authDb, profileDb, socialDb].map((db) =>
          db?.end().catch(() => undefined)
        )
      );
    }
  });
});
