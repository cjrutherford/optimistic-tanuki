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
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { Client as PgClient } from 'pg';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthGuard } from '../../../gateway/src/auth/auth.guard';
import { PresenceController } from '../../../gateway/src/controllers/social/presence/presence.controller';
import { GATEWAY_APP_REGISTRY } from '../../../gateway/src/controllers/registry/registry.tokens';

jest.setTimeout(90000);

describe('Gateway Presence actor binding against private Auth and Social services', () => {
  const userIds: string[] = [];
  const tokens: string[] = [];
  const clients: ClientProxy[] = [];
  let auth: ClientProxy;
  let app: INestApplication | undefined;
  let authDb: PgClient | undefined;
  let socialDb: PgClient | undefined;
  let socialOrigin: string;
  let foreignId: string;

  const assertPrivateFixture = () => {
    if (
      process.env.PRESENCE_J17_MARKER !== 'private-presence-j17-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-forum-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15548' ||
      !process.env.PRESENCE_J17_JWT_SECRET
    ) {
      throw new Error('J17 private Presence fixture markers are required');
    }
  };

  const connectRpc = (port: number) => {
    const client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port },
    });
    clients.push(client);
    return client;
  };

  const rpc = <T = any>(client: ClientProxy, cmd: string, payload: unknown) =>
    firstValueFrom(
      client.send<T>({ cmd }, payload).pipe(timeout({ first: 5000 }))
    );

  const request = (
    path: string,
    options: RequestInit = {},
    token?: string,
    cookie = false
  ) =>
    fetch(`${socialOrigin}/api/presence${path}`, {
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

  const readPresenceRows = async (ids: string[]) => {
    const result = await socialDb!.query(
      'SELECT "id", "userId", "status", "lastSeen", "createdAt", "isExplicit" FROM "user_presence" WHERE "userId" = ANY($1::varchar[]) ORDER BY "userId"',
      [ids]
    );
    return result.rows;
  };

  beforeAll(async () => {
    assertPrivateFixture();
    const secret = process.env.PRESENCE_J17_JWT_SECRET!;
    auth = connectRpc(3001);
    const social = connectRpc(3003);
    authDb = new PgClient({
      host: '127.0.0.1',
      port: 15548,
      user: 'postgres',
      password: 'postgres',
      database: 'ot_authentication',
    });
    socialDb = new PgClient({
      host: '127.0.0.1',
      port: 15548,
      user: 'postgres',
      password: 'postgres',
      database: 'ot_social',
    });
    await Promise.all([authDb.connect(), socialDb.connect()]);

    const registry = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      apps: [
        {
          appId: 'client-interface',
          name: 'J17 private test app',
          domain: '127.0.0.1',
          uiBaseUrl: 'http://127.0.0.1:8080',
          apiBaseUrl: 'http://127.0.0.1:3300',
          appType: 'client',
          visibility: 'public',
        },
      ],
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [PresenceController],
      providers: [
        AuthGuard,
        Reflector,
        { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: auth },
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: connectRpc(3012),
        },
        { provide: ServiceTokens.SOCIAL_SERVICE, useValue: social },
        { provide: GATEWAY_APP_REGISTRY, useValue: registry },
        { provide: JwtService, useValue: new JwtService({ secret }) },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(require('cookie-parser')());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    socialOrigin = `http://127.0.0.1:${address.port}`;
  });

  it('binds authenticated HTTP presence mutations to the account and rejects revoked or foreign actors', async () => {
    const password = 'PresenceJ17!AccountPass123';
    const accounts: Array<{ id: string; email: string; token?: string }> = [];
    for (const label of ['owner', 'counterpart']) {
      const email = `presence-j17-${label}-${randomUUID()}@example.test`;
      const registered = await rpc<any>(auth, AuthCommands.Register, {
        email,
        fn: 'Presence',
        ln: label,
        password,
        confirm: password,
        ageEligibilityStatus: 'adult',
      });
      const id = registered.data.user.id as string;
      userIds.push(id);
      accounts.push({ id, email });
    }
    const [owner, counterpart] = accounts;
    for (const account of accounts) {
      const login = await rpc<any>(auth, AuthCommands.Login, {
        email: account.email,
        password,
        appId: 'client-interface',
        // Each valid session deliberately carries the other account as its
        // profile claim so the authenticated account id is unambiguous.
        profileId: account === owner ? counterpart.id : owner.id,
      });
      const token = login.data.newToken as string;
      tokens.push(token);
      account.token = token;
    }
    const ownerToken = owner.token;
    const counterpartToken = counterpart.token;
    if (
      typeof ownerToken !== 'string' ||
      ownerToken.length === 0 ||
      typeof counterpartToken !== 'string' ||
      counterpartToken.length === 0
    ) {
      throw new Error('Private Auth login did not return both session tokens');
    }
    foreignId = counterpart.id;

    const ownerTokenClaims = await new JwtService({
      secret: process.env.PRESENCE_J17_JWT_SECRET!,
    }).verifyAsync<{ userId: string; profileId?: string }>(ownerToken);
    expect(ownerTokenClaims.userId).toBe(owner.id);
    expect(ownerTokenClaims.profileId).toBe(counterpart.id);
    const counterpartClaims = await new JwtService({
      secret: process.env.PRESENCE_J17_JWT_SECRET!,
    }).verifyAsync<{ userId: string; profileId?: string }>(counterpartToken);
    expect(counterpartClaims.userId).toBe(counterpart.id);
    expect(counterpartClaims.profileId).toBe(owner.id);
    expect(owner.id).not.toBe(counterpart.id);
    expect(owner.id).toMatch(/[a-f]/i);

    const seedStatus = await socialDb!.query(
      'INSERT INTO "user_presence" ("userId", "status", "lastSeen", "isExplicit") VALUES ($1, $2::user_presence_status_enum, now(), true) RETURNING "userId"',
      [counterpart.id, 'away']
    );
    expect(seedStatus.rows[0].userId).toBe(counterpart.id);
    const counterpartBefore = await readPresenceRows([counterpart.id]);
    const ownerBefore = await readPresenceRows([owner.id]);
    expect(ownerBefore).toHaveLength(0);
    expect(counterpartBefore).toHaveLength(1);

    const anonymous = await request('', {
      method: 'POST',
      body: JSON.stringify({ userId: owner.id, status: 'online' }),
    });
    expect(anonymous.status).toBe(401);
    expect(await readPresenceRows([owner.id])).toEqual(ownerBefore);

    const spoofed = await request(
      '',
      {
        method: 'POST',
        body: JSON.stringify({ userId: counterpart.id, status: 'online' }),
      },
      ownerToken
    );
    expect(spoofed.status).toBe(201);
    const ownerAfterPost = await readPresenceRows([owner.id]);
    expect(ownerAfterPost).toHaveLength(1);
    expect(ownerAfterPost[0].userId).toBe(owner.id);
    expect(ownerAfterPost[0].status).toBe('online');
    expect(await readPresenceRows([counterpart.id])).toEqual(counterpartBefore);

    const cookiePost = await request(
      '',
      {
        method: 'POST',
        body: JSON.stringify({ userId: owner.id, status: 'busy' }),
      },
      counterpartToken,
      true
    );
    expect(cookiePost.status).toBe(201);
    expect((await readPresenceRows([counterpart.id]))[0].status).toBe('busy');
    expect((await readPresenceRows([owner.id]))[0].status).toBe('online');

    const counterpartAfterCookie = await readPresenceRows([counterpart.id]);
    for (const suffix of ['last-seen', 'offline']) {
      const ownPath = await request(`/${owner.id.toUpperCase()}/${suffix}`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(ownPath.status).toBe(200);
      const ownerAfterOwnPath = await readPresenceRows([owner.id]);
      expect(ownerAfterOwnPath).toHaveLength(1);
      expect(ownerAfterOwnPath[0].status).toBe(
        suffix === 'last-seen' ? 'online' : 'offline'
      );
      const foreignPath = await request(`/${counterpart.id}/${suffix}`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(foreignPath.status).toBe(403);
      expect(await readPresenceRows([counterpart.id])).toEqual(
        counterpartAfterCookie
      );
    }

    const counterpartRead = await request(`/${counterpart.id}`, {}, ownerToken);
    expect(counterpartRead.status).toBe(200);
    expect(await counterpartRead.json()).toMatchObject({
      userId: counterpart.id,
    });
    const batchRead = await request(
      '/batch',
      {
        method: 'POST',
        body: JSON.stringify({ userIds: [owner.id, counterpart.id] }),
      },
      ownerToken
    );
    expect(batchRead.status).toBe(201);
    expect(await batchRead.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: owner.id }),
        expect.objectContaining({ userId: counterpart.id }),
      ])
    );

    const stableCounterpart = await readPresenceRows([counterpart.id]);
    const stableOwner = await readPresenceRows([owner.id]);
    await rpc(auth, AuthCommands.Logout, { token: ownerToken });
    const staleRequest = await request(
      '',
      {
        method: 'POST',
        body: JSON.stringify({ userId: owner.id, status: 'away' }),
      },
      ownerToken
    );
    expect(staleRequest.status).toBe(401);
    expect(await readPresenceRows([counterpart.id])).toEqual(stableCounterpart);
    expect(await readPresenceRows([owner.id])).toEqual(stableOwner);
  });

  afterAll(async () => {
    try {
      if (foreignId && socialDb) {
        await socialDb.query(
          'DELETE FROM "user_presence" WHERE "userId" = ANY($1::varchar[])',
          [[...userIds, foreignId]]
        );
      }
      for (const token of tokens)
        await rpc(auth, AuthCommands.Logout, { token }).catch(() => undefined);
      if (authDb && userIds.length) {
        await authDb.query(
          'DELETE FROM token WHERE "userId" = ANY($1::uuid[])',
          [userIds]
        );
        const keyRows = await authDb.query(
          'SELECT "keyDataId" FROM user_entity WHERE id = ANY($1::uuid[])',
          [userIds]
        );
        const keyIds = keyRows.rows.map((row) => row.keyDataId).filter(Boolean);
        await authDb.query(
          'UPDATE user_entity SET "keyDataId" = NULL WHERE id = ANY($1::uuid[])',
          [userIds]
        );
        if (keyIds.length)
          await authDb.query(
            'UPDATE key_datum SET "userId" = NULL WHERE id = ANY($1::uuid[])',
            [keyIds]
          );
        await authDb.query(
          'DELETE FROM user_entity WHERE id = ANY($1::uuid[])',
          [userIds]
        );
        if (keyIds.length)
          await authDb.query(
            'DELETE FROM key_datum WHERE id = ANY($1::uuid[])',
            [keyIds]
          );
      }
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
        [authDb, socialDb].map((db) => db?.end().catch(() => undefined))
      );
    }
  });
});
