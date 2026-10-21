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
import { GatewayPresenceAudienceService } from '../../../gateway/src/controllers/social/presence/gateway-presence-audience.service';
import { GATEWAY_APP_REGISTRY } from '../../../gateway/src/controllers/registry/registry.tokens';

jest.setTimeout(90000);

describe('Gateway conversation presence audience against private services', () => {
  type AccountFixture = {
    id: string;
    email: string;
    profileId: string;
    token?: string;
  };

  const accounts: AccountFixture[] = [];
  const tokens: string[] = [];
  const clients: ClientProxy[] = [];
  const conversationIds: string[] = [];
  const blockIds: string[] = [];
  const profileIds: string[] = [];
  let auth: ClientProxy;
  let app: INestApplication | undefined;
  let authDb: PgClient | undefined;
  let profileDb: PgClient | undefined;
  let socialDb: PgClient | undefined;
  let chatDb: PgClient | undefined;
  let origin: string;

  const assertPrivateFixture = () => {
    if (
      process.env.PRESENCE_J20_MARKER !== 'private-presence-j20-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-forum-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15548' ||
      !process.env.PRESENCE_J17_JWT_SECRET
    ) {
      throw new Error('J20 private Presence fixture markers are required');
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
    fetch(`${origin}/api/presence${path}`, {
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
      'SELECT "id", "userId", "status", "lastSeen", "createdAt", "isExplicit" FROM "user_presence" WHERE LOWER("userId") = ANY($1::varchar[]) ORDER BY LOWER("userId")',
      [ids.map((id) => id.toLowerCase())]
    );
    return result.rows;
  };

  const readProfileRows = async () => {
    const result = await profileDb!.query(
      'SELECT * FROM profile WHERE id = ANY($1::uuid[]) ORDER BY id',
      [profileIds]
    );
    return result.rows;
  };

  const postPresence = (
    conversationId: string,
    requestedProfileIds: string[],
    token: string,
    cookie = false
  ) =>
    request(
      '/conversation',
      {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          profileIds: requestedProfileIds,
        }),
      },
      token,
      cookie
    );

  beforeAll(async () => {
    assertPrivateFixture();
    auth = connectRpc(3001);
    const profile = connectRpc(3002);
    const social = connectRpc(3003);
    const chat = connectRpc(3007);
    authDb = new PgClient({
      host: '127.0.0.1',
      port: 15548,
      user: 'postgres',
      password: 'postgres',
      database: 'ot_authentication',
    });
    profileDb = new PgClient({
      host: '127.0.0.1',
      port: 15548,
      user: 'postgres',
      password: 'postgres',
      database: 'ot_profile',
    });
    socialDb = new PgClient({
      host: '127.0.0.1',
      port: 15548,
      user: 'postgres',
      password: 'postgres',
      database: 'ot_social',
    });
    chatDb = new PgClient({
      host: '127.0.0.1',
      port: 15548,
      user: 'postgres',
      password: 'postgres',
      database: 'ot_chat_collector',
    });
    await Promise.all([
      authDb.connect(),
      profileDb.connect(),
      socialDb.connect(),
      chatDb.connect(),
    ]);

    const registry = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      apps: [
        {
          appId: 'client-interface',
          name: 'J20 private presence test app',
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
        { provide: ServiceTokens.PROFILE_SERVICE, useValue: profile },
        { provide: ServiceTokens.CHAT_COLLECTOR_SERVICE, useValue: chat },
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: connectRpc(3012),
        },
        { provide: ServiceTokens.SOCIAL_SERVICE, useValue: social },
        { provide: GATEWAY_APP_REGISTRY, useValue: registry },
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: process.env.PRESENCE_J17_JWT_SECRET,
          }),
        },
        GatewayPresenceAudienceService,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(require('cookie-parser')());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    origin = `http://127.0.0.1:${address.port}`;
  });

  it('limits account reads to self and conversation presence to verified current participants', async () => {
    const password = 'PresenceJ20!AccountPass123';
    const definitions = [
      { label: 'owner', profileId: randomUUID() },
      { label: 'counterpart', profileId: randomUUID() },
      { label: 'outsider', profileId: randomUUID() },
    ];
    for (const definition of definitions) {
      const email = `presence-j20-${definition.label}-${randomUUID().slice(
        0,
        16
      )}@example.test`;
      const registered = await rpc<any>(auth, AuthCommands.Register, {
        email,
        fn: 'Presence',
        ln: definition.label,
        password,
        confirm: password,
        ageEligibilityStatus: 'adult',
      });
      const account: AccountFixture = {
        id: registered.data.user.id,
        email,
        profileId: definition.profileId,
      };
      accounts.push(account);
      profileIds.push(account.profileId);
    }
    const [owner, counterpart, outsider] = accounts;
    const secondaryProfileId = randomUUID();
    profileIds.push(secondaryProfileId);
    await profileDb!.query(
      `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills)
       VALUES ($1,$2::varchar,'client-interface','J20 owner','','','','','','',''),
              ($3,$4::varchar,'client-interface','J20 counterpart','','','','','','',''),
              ($5,$6::varchar,'client-interface','J20 outsider','','','','','','',''),
              ($7,$2::varchar,'client-interface','J20 owner secondary','','','','','','','')`,
      [
        owner.profileId,
        owner.id.toUpperCase(),
        counterpart.profileId,
        counterpart.id,
        outsider.profileId,
        outsider.id,
        secondaryProfileId,
      ]
    );

    for (const account of accounts) {
      const login = await rpc<any>(auth, AuthCommands.Login, {
        email: account.email,
        password,
        appId: 'client-interface',
        profileId: account.profileId,
      });
      account.token = login.data.newToken;
      tokens.push(account.token!);
    }
    const secondaryLogin = await rpc<any>(auth, AuthCommands.Login, {
      email: owner.email,
      password,
      appId: 'client-interface',
      profileId: secondaryProfileId,
    });
    const secondaryToken = secondaryLogin.data.newToken as string;
    tokens.push(secondaryToken);
    const ownerToken = owner.token!;
    const counterpartToken = counterpart.token!;
    const outsiderToken = outsider.token!;

    const directConversationId = randomUUID();
    const foreignConversationId = randomUUID();
    conversationIds.push(directConversationId, foreignConversationId);
    await chatDb!.query(
      `INSERT INTO "conversation" ("id","title","type","participants","ownerId","isDeleted")
       VALUES ($1,'J20 direct presence','direct',$2::text[],$3,false),
              ($4,'J20 foreign direct','direct',$5::text[],$6,false)`,
      [
        directConversationId,
        [owner.profileId, counterpart.profileId],
        owner.profileId,
        foreignConversationId,
        [counterpart.profileId, outsider.profileId],
        counterpart.profileId,
      ]
    );
    await socialDb!.query(
      'INSERT INTO "user_presence" ("userId","status","lastSeen","isExplicit") VALUES ($1,$2::user_presence_status_enum,now(),true),($3,$4::user_presence_status_enum,now(),true),($5,$6::user_presence_status_enum,now(),true)',
      [owner.id, 'online', counterpart.id, 'busy', outsider.id, 'online']
    );
    const conversationsBefore = await chatDb!.query(
      'SELECT "id", "participants", "isDeleted" FROM "conversation" WHERE "id" = ANY($1::uuid[]) ORDER BY "id"',
      [conversationIds]
    );

    const presenceBefore = await readPresenceRows([
      owner.id,
      counterpart.id,
      outsider.id,
    ]);
    const profilesBefore = await readProfileRows();
    expect(presenceBefore).toHaveLength(3);
    expect(profilesBefore).toHaveLength(4);

    const selfRead = await request(
      `/${owner.id.toUpperCase()}`,
      {},
      ownerToken
    );
    expect(selfRead.status).toBe(200);
    expect(await selfRead.json()).toMatchObject({ userId: owner.id });
    const selfBatch = await request(
      '/batch',
      {
        method: 'POST',
        body: JSON.stringify({ userIds: [owner.id.toUpperCase(), owner.id] }),
      },
      ownerToken
    );
    expect(selfBatch.status).toBe(201);
    expect(await selfBatch.json()).toEqual([
      expect.objectContaining({ userId: owner.id }),
    ]);
    const emptyBatch = await request(
      '/batch',
      { method: 'POST', body: JSON.stringify({ userIds: [] }) },
      ownerToken
    );
    expect(emptyBatch.status).toBe(201);
    expect(await emptyBatch.json()).toEqual([]);
    const online = await request('/online/users', {}, ownerToken);
    expect(online.status).toBe(200);
    expect(await online.json()).toEqual([
      expect.objectContaining({ userId: owner.id, status: 'online' }),
    ]);
    for (const foreign of [counterpart, outsider]) {
      const foreignRead = await request(`/${foreign.id}`, {}, ownerToken);
      expect(foreignRead.status).toBe(403);
    }
    const foreignBatch = await request(
      '/batch',
      { method: 'POST', body: JSON.stringify({ userIds: [counterpart.id] }) },
      ownerToken
    );
    expect(foreignBatch.status).toBe(403);
    const oversizedBatch = await request(
      '/batch',
      {
        method: 'POST',
        body: JSON.stringify({ userIds: Array(101).fill(owner.id) }),
      },
      ownerToken
    );
    expect(oversizedBatch.status).toBe(400);
    const malformedRead = await request('/not-a-uuid', {}, ownerToken);
    expect(malformedRead.status).toBe(400);
    const anonymousRead = await request(`/${owner.id}`);
    expect(anonymousRead.status).toBe(401);

    const direct = await postPresence(
      directConversationId,
      [counterpart.profileId.toUpperCase()],
      ownerToken,
      true
    );
    expect(direct.status).toBe(201);
    expect(await direct.json()).toEqual([
      { profileId: counterpart.profileId, status: 'busy' },
    ]);
    const secondaryActor = await postPresence(
      directConversationId,
      [counterpart.profileId],
      secondaryToken
    );
    expect(secondaryActor.status).toBe(403);
    const foreignContext = await postPresence(
      foreignConversationId,
      [counterpart.profileId],
      ownerToken
    );
    expect(foreignContext.status).toBe(403);
    const nonMemberTarget = await postPresence(
      directConversationId,
      [outsider.profileId],
      ownerToken
    );
    expect(nonMemberTarget.status).toBe(403);
    const unknownConversation = await postPresence(
      randomUUID(),
      [counterpart.profileId],
      ownerToken
    );
    expect(unknownConversation.status).toBe(403);
    const malformedTarget = await postPresence(
      directConversationId,
      ['invalid-profile-id'],
      ownerToken
    );
    expect(malformedTarget.status).toBe(400);

    const blockedProfileId = randomUUID();
    blockIds.push(blockedProfileId);
    await socialDb!.query(
      'INSERT INTO "user_block" ("id","blockerId","blockedId","reason") VALUES ($1,$2,$3,$4)',
      [
        blockedProfileId,
        owner.profileId.toUpperCase(),
        counterpart.profileId,
        'J20 fixture',
      ]
    );
    const outgoingBlock = await postPresence(
      directConversationId,
      [owner.profileId, counterpart.profileId],
      ownerToken
    );
    expect(outgoingBlock.status).toBe(201);
    expect(await outgoingBlock.json()).toEqual([
      { profileId: owner.profileId, status: 'online' },
    ]);
    await socialDb!.query('DELETE FROM "user_block" WHERE "id" = $1', [
      blockedProfileId,
    ]);

    const incomingBlockId = randomUUID();
    blockIds.push(incomingBlockId);
    await socialDb!.query(
      'INSERT INTO "user_block" ("id","blockerId","blockedId","reason") VALUES ($1,$2,$3,$4)',
      [
        incomingBlockId,
        counterpart.profileId,
        owner.profileId.toUpperCase(),
        'J20 fixture',
      ]
    );
    const incomingBlock = await postPresence(
      directConversationId,
      [owner.profileId, counterpart.profileId],
      ownerToken
    );
    expect(incomingBlock.status).toBe(201);
    expect(await incomingBlock.json()).toEqual([
      { profileId: owner.profileId, status: 'online' },
    ]);
    await socialDb!.query('DELETE FROM "user_block" WHERE "id" = $1', [
      incomingBlockId,
    ]);
    const afterUnblock = await postPresence(
      directConversationId,
      [counterpart.profileId],
      ownerToken
    );
    expect(await afterUnblock.json()).toEqual([
      { profileId: counterpart.profileId, status: 'busy' },
    ]);

    const beforeParticipantRemoval = await chatDb!.query(
      'SELECT "participants", "isDeleted" FROM "conversation" WHERE "id" = $1',
      [directConversationId]
    );
    await chatDb!.query(
      'UPDATE "conversation" SET "participants" = $2::text[] WHERE "id" = $1',
      [directConversationId, [counterpart.profileId]]
    );
    const removedActor = await postPresence(
      directConversationId,
      [counterpart.profileId],
      ownerToken
    );
    expect(removedActor.status).toBe(403);
    await chatDb!.query(
      'UPDATE "conversation" SET "participants" = $2::text[] WHERE "id" = $1',
      [directConversationId, beforeParticipantRemoval.rows[0].participants]
    );
    await chatDb!.query(
      'UPDATE "conversation" SET "isDeleted" = true WHERE "id" = $1',
      [directConversationId]
    );
    const deletedConversation = await postPresence(
      directConversationId,
      [counterpart.profileId],
      ownerToken
    );
    expect(deletedConversation.status).toBe(403);
    await chatDb!.query(
      'UPDATE "conversation" SET "isDeleted" = false WHERE "id" = $1',
      [directConversationId]
    );

    await profileDb!.query('UPDATE profile SET "userId" = $2 WHERE id = $1', [
      owner.profileId,
      counterpart.id,
    ]);
    const staleSelectedProfile = await postPresence(
      directConversationId,
      [counterpart.profileId],
      ownerToken
    );
    expect(staleSelectedProfile.status).toBe(403);
    await profileDb!.query('UPDATE profile SET "userId" = $2 WHERE id = $1', [
      owner.profileId,
      owner.id.toUpperCase(),
    ]);

    expect(
      await readPresenceRows([owner.id, counterpart.id, outsider.id])
    ).toEqual(presenceBefore);
    expect(await readProfileRows()).toEqual(profilesBefore);
    const conversationsAfter = await chatDb!.query(
      'SELECT "id", "participants", "isDeleted" FROM "conversation" WHERE "id" = ANY($1::uuid[]) ORDER BY "id"',
      [conversationIds]
    );
    expect(conversationsAfter.rows).toEqual(conversationsBefore.rows);
  });

  afterAll(async () => {
    try {
      if (chatDb && conversationIds.length) {
        await chatDb
          .query(
            'DELETE FROM "message" WHERE "conversationId" = ANY($1::uuid[])',
            [conversationIds]
          )
          .catch(() => undefined);
        await chatDb
          .query('DELETE FROM "conversation" WHERE "id" = ANY($1::uuid[])', [
            conversationIds,
          ])
          .catch(() => undefined);
      }
      if (socialDb) {
        if (blockIds.length)
          await socialDb
            .query('DELETE FROM "user_block" WHERE "id" = ANY($1::uuid[])', [
              blockIds,
            ])
            .catch(() => undefined);
        if (accounts.length)
          await socialDb
            .query(
              'DELETE FROM "user_presence" WHERE LOWER("userId") = ANY($1::varchar[])',
              [accounts.map((account) => account.id.toLowerCase())]
            )
            .catch(() => undefined);
      }
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
        [authDb, profileDb, socialDb, chatDb].map((db) =>
          db?.end().catch(() => undefined)
        )
      );
    }
  });
});
