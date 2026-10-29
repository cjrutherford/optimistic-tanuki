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
  ProfileAnalyticsCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { Client as PgClient } from 'pg';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthGuard } from '../../../gateway/src/auth/auth.guard';
import { ProfileAnalyticsController } from '../../../gateway/src/controllers/social/profile-analytics/profile-analytics.controller';
import { GATEWAY_APP_REGISTRY } from '../../../gateway/src/controllers/registry/registry.tokens';

jest.setTimeout(90000);

type AccountFixture = {
  id: string;
  email: string;
  profileId: string;
  token?: string;
};

type ProfileViewRow = {
  id: string;
  profileId: string;
  viewerId: string;
  source: string;
  viewedAt: Date | string;
};

describe('Gateway profile analytics ownership against private Auth, Profile, and Social services', () => {
  const userIds: string[] = [];
  const tokens: string[] = [];
  const profileIds: string[] = [];
  const seededViewIds: string[] = [];
  const clients: ClientProxy[] = [];
  let auth: ClientProxy;
  let social: ClientProxy;
  let app: INestApplication | undefined;
  let authDb: PgClient | undefined;
  let profileDb: PgClient | undefined;
  let socialDb: PgClient | undefined;
  let apiOrigin: string;

  const assertPrivateFixture = () => {
    if (
      process.env.PROFILE_ANALYTICS_J19_MARKER !==
        'private-profile-analytics-j19-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-forum-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15548' ||
      !process.env.PRESENCE_J17_JWT_SECRET
    ) {
      throw new Error(
        'J19 private Profile Analytics fixture markers are required'
      );
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
    fetch(`${apiOrigin}/api/profile-analytics${path}`, {
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

  const readViews = async (profileId: string): Promise<ProfileViewRow[]> => {
    const result = await socialDb!.query(
      // The legacy column is TIMESTAMP without timezone. Convert it to an
      // absolute UTC instant before node-postgres parses it in the host TZ.
      'SELECT id, "profileId", "viewerId", source, "viewedAt" AT TIME ZONE \'UTC\' AS "viewedAt" FROM profile_view WHERE LOWER("profileId") = LOWER($1) ORDER BY "viewedAt" DESC, id DESC',
      [profileId]
    );
    return result.rows;
  };

  const readProfileFingerprint = async (profileId: string) => {
    const result = await profileDb!.query(
      'SELECT to_jsonb(profile) AS row FROM profile WHERE id = $1::uuid',
      [profileId]
    );
    return result.rows[0]?.row ?? null;
  };

  const viewedAtProjection = (rows: ProfileViewRow[]) =>
    rows.map(({ viewedAt }) => ({
      viewedAt: new Date(viewedAt).toISOString(),
    }));

  beforeAll(async () => {
    assertPrivateFixture();
    const secret = process.env.PRESENCE_J17_JWT_SECRET!;
    auth = connectRpc(3001);
    const profile = connectRpc(3002);
    social = connectRpc(3003);
    const permissions = connectRpc(3012);
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
          name: 'J19 private Profile Analytics test app',
          domain: '127.0.0.1',
          uiBaseUrl: 'http://127.0.0.1:8080',
          apiBaseUrl: 'http://127.0.0.1:3300',
          appType: 'client',
          visibility: 'public',
        },
      ],
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfileAnalyticsController],
      providers: [
        AuthGuard,
        Reflector,
        { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: auth },
        { provide: ServiceTokens.PERMISSIONS_SERVICE, useValue: permissions },
        { provide: ServiceTokens.SOCIAL_SERVICE, useValue: social },
        { provide: ServiceTokens.PROFILE_SERVICE, useValue: profile },
        { provide: GATEWAY_APP_REGISTRY, useValue: registry },
        { provide: JwtService, useValue: new JwtService({ secret }) },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(require('cookie-parser')());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    apiOrigin = `http://127.0.0.1:${address.port}`;
  });

  it('binds view actors to authenticated accounts, allows owned secondary analytics, and protects counterpart data', async () => {
    const password = 'ProfileAnalyticsJ19!AccountPass123';
    const accounts: AccountFixture[] = [];
    for (const label of ['owner', 'counterpart']) {
      const email = `profile-analytics-j19-${label}-${randomUUID().slice(
        0,
        16
      )}@example.test`;
      const registered = await rpc<any>(auth, AuthCommands.Register, {
        email,
        fn: 'ProfileAnalytics',
        ln: label,
        password,
        confirm: password,
        ageEligibilityStatus: 'adult',
      });
      const id = registered.data.user.id as string;
      userIds.push(id);
      accounts.push({ id, email, profileId: randomUUID() });
    }
    const [owner, counterpart] = accounts;
    const secondaryProfileId = randomUUID();
    const profileRows = [
      owner.profileId,
      secondaryProfileId,
      counterpart.profileId,
    ];
    profileIds.push(...profileRows);
    await profileDb!.query(
      `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills)
       VALUES ($1,$2::varchar,'client-interface','J19 owner selected','','','','','','',''),
              ($3,$4::varchar,'client-interface','J19 owner secondary','','','','','','',''),
              ($5,$6::varchar,'client-interface','J19 counterpart','','','','','','','')`,
      [
        owner.profileId,
        owner.id,
        secondaryProfileId,
        owner.id.toUpperCase(),
        counterpart.profileId,
        counterpart.id,
      ]
    );

    for (const account of accounts) {
      const login = await rpc<any>(auth, AuthCommands.Login, {
        email: account.email,
        password,
        appId: 'client-interface',
        profileId: account.profileId,
      });
      const token = login.data.newToken as string;
      account.token = token;
      tokens.push(token);
    }
    if (!owner.token || !counterpart.token) {
      throw new Error('Private Auth login did not return both session tokens');
    }

    const jwt = new JwtService({
      secret: process.env.PRESENCE_J17_JWT_SECRET!,
    });
    const ownerClaims = await jwt.verifyAsync<{
      userId: string;
      profileId: string;
    }>(owner.token);
    const counterpartClaims = await jwt.verifyAsync<{
      userId: string;
      profileId: string;
    }>(counterpart.token);
    expect(ownerClaims).toMatchObject({
      userId: owner.id,
      profileId: owner.profileId,
    });
    expect(counterpartClaims).toMatchObject({
      userId: counterpart.id,
      profileId: counterpart.profileId,
    });

    const legacyIds = [randomUUID(), randomUUID()];
    const foreignId = randomUUID();
    seededViewIds.push(...legacyIds, foreignId);
    const now = Date.now();
    const legacyNewest = new Date(now - 10 * 60 * 1000);
    const legacyOlder = new Date(now - 20 * 60 * 1000);
    const foreignTime = new Date(now - 15 * 60 * 1000);
    await socialDb!.query(
      `INSERT INTO profile_view (id,"profileId","viewerId",source,"viewedAt")
       VALUES ($1,$2,$3,'feed',$4),($5,$6,$7,'privateURL',$8),($9,$10,$11,'search',$12)`,
      [
        legacyIds[0],
        secondaryProfileId.toUpperCase(),
        counterpart.id,
        legacyNewest,
        legacyIds[1],
        secondaryProfileId.toUpperCase(),
        randomUUID(),
        legacyOlder,
        foreignId,
        counterpart.profileId,
        owner.id,
        foreignTime,
      ]
    );
    const seededOwnerRows = await readViews(secondaryProfileId);
    const seededCounterpartRows = await readViews(counterpart.profileId);
    const counterpartProfileBefore = await readProfileFingerprint(
      counterpart.profileId
    );
    expect(seededOwnerRows).toHaveLength(2);
    expect(seededCounterpartRows).toHaveLength(1);
    expect(counterpartProfileBefore).not.toBeNull();

    const anonymousPost = await request('/view', {
      method: 'POST',
      body: JSON.stringify({ profileId: secondaryProfileId, source: 'feed' }),
    });
    expect(anonymousPost.status).toBe(401);

    const malformedPost = await request(
      '/view',
      {
        method: 'POST',
        body: JSON.stringify({ profileId: 'not-a-uuid', source: 'feed' }),
      },
      owner.token
    );
    expect(malformedPost.status).toBe(400);
    expect(await readViews(secondaryProfileId)).toEqual(seededOwnerRows);

    const recorded = await request(
      '/view',
      {
        method: 'POST',
        body: JSON.stringify({
          profileId: secondaryProfileId.toUpperCase(),
          viewerId: owner.id,
          source: 'privateURL',
        }),
      },
      counterpart.token,
      true
    );
    expect(recorded.status).toBe(201);
    expect(await recorded.json()).toEqual({ success: true });
    const afterRecord = await readViews(secondaryProfileId);
    expect(afterRecord).toHaveLength(3);
    expect(afterRecord[0]).toMatchObject({
      profileId: secondaryProfileId,
      viewerId: counterpart.id,
      source: 'other',
    });
    expect(afterRecord[0].id).not.toBe(legacyIds[0]);

    const ownerStatsResponse = await request(
      `/${secondaryProfileId.toUpperCase()}/stats`,
      {},
      owner.token
    );
    expect(ownerStatsResponse.status).toBe(200);
    const ownerStats = await ownerStatsResponse.json();
    expect(Object.keys(ownerStats).sort()).toEqual(
      [
        'totalViews',
        'viewsToday',
        'viewsThisWeek',
        'viewsThisMonth',
        'topSources',
        'recentViews',
      ].sort()
    );
    expect(ownerStats).toMatchObject({
      totalViews: 3,
      topSources: [
        { source: 'other', count: 2 },
        { source: 'feed', count: 1 },
      ],
    });
    for (const windowCount of [
      ownerStats.viewsToday,
      ownerStats.viewsThisWeek,
      ownerStats.viewsThisMonth,
    ]) {
      expect(Number.isInteger(windowCount)).toBe(true);
      expect(windowCount).toBeGreaterThanOrEqual(0);
      expect(windowCount).toBeLessThanOrEqual(3);
    }
    expect(ownerStats.recentViews).toEqual(viewedAtProjection(afterRecord));
    for (const view of ownerStats.recentViews) {
      expect(Object.keys(view)).toEqual(['viewedAt']);
      expect(view).not.toHaveProperty('viewerId');
      expect(view).not.toHaveProperty('profileId');
      expect(view).not.toHaveProperty('id');
      expect(view).not.toHaveProperty('source');
    }

    const ownerViewersResponse = await request(
      `/${secondaryProfileId.toUpperCase()}/viewers?limit=2`,
      {},
      owner.token,
      true
    );
    expect(ownerViewersResponse.status).toBe(200);
    const ownerViewers = await ownerViewersResponse.json();
    expect(ownerViewers).toEqual(viewedAtProjection(afterRecord.slice(0, 2)));
    for (const view of ownerViewers) {
      expect(Object.keys(view)).toEqual(['viewedAt']);
    }

    const directSocialProjection = await rpc<any[]>(
      social,
      ProfileAnalyticsCommands.GET_RECENT_VIEWERS,
      { profileId: secondaryProfileId.toUpperCase(), limit: 2 }
    );
    expect(directSocialProjection).toEqual(
      viewedAtProjection(afterRecord.slice(0, 2))
    );
    for (const view of directSocialProjection) {
      expect(Object.keys(view)).toEqual(['viewedAt']);
    }
    await expect(
      rpc(social, ProfileAnalyticsCommands.GET_RECENT_VIEWERS, {
        profileId: secondaryProfileId,
        limit: 0,
      })
    ).rejects.toBeDefined();

    const counterpartStatsResponse = await request(
      `/${counterpart.profileId}/stats`,
      {},
      counterpart.token
    );
    expect(counterpartStatsResponse.status).toBe(200);
    expect((await counterpartStatsResponse.json()).totalViews).toBe(1);
    const counterpartViewersResponse = await request(
      `/${counterpart.profileId}/viewers`,
      {},
      counterpart.token
    );
    expect(counterpartViewersResponse.status).toBe(200);
    expect(await counterpartViewersResponse.json()).toEqual(
      viewedAtProjection(seededCounterpartRows)
    );

    for (const suffix of ['/stats', '/viewers']) {
      const foreign = await request(
        `/${counterpart.profileId}${suffix}`,
        {},
        owner.token
      );
      expect(foreign.status).toBe(403);
      const missing = await request(
        `/${randomUUID()}${suffix}`,
        {},
        owner.token
      );
      expect(missing.status).toBe(403);
    }
    const invalidProfile = await request('/not-a-uuid/stats', {}, owner.token);
    expect(invalidProfile.status).toBe(400);
    for (const limit of ['0', '-1', '1.5', '101', 'abc']) {
      const invalidLimit = await request(
        `/${secondaryProfileId}/viewers?limit=${encodeURIComponent(limit)}`,
        {},
        owner.token
      );
      expect(invalidLimit.status).toBe(400);
    }

    await profileDb!.query(
      'UPDATE profile SET "userId" = $2 WHERE id = $1::uuid',
      [owner.profileId, counterpart.id]
    );
    try {
      for (const suffix of ['/stats', '/viewers']) {
        const staleSelection = await request(
          `/${owner.profileId}${suffix}`,
          {},
          owner.token
        );
        expect(staleSelection.status).toBe(403);
      }
    } finally {
      await profileDb!.query(
        'UPDATE profile SET "userId" = $2 WHERE id = $1::uuid',
        [owner.profileId, owner.id]
      );
    }

    const allRowsAfter = [
      ...(await readViews(secondaryProfileId)),
      ...(await readViews(counterpart.profileId)),
    ];
    const seededAfter = allRowsAfter.filter((row) =>
      seededViewIds.includes(row.id)
    );
    expect(seededAfter).toEqual(
      expect.arrayContaining([...seededOwnerRows, ...seededCounterpartRows])
    );
    expect(seededAfter).toHaveLength(seededViewIds.length);
    expect(await readProfileFingerprint(counterpart.profileId)).toEqual(
      counterpartProfileBefore
    );
  });

  afterAll(async () => {
    try {
      if (socialDb && seededViewIds.length) {
        await socialDb.query(
          'DELETE FROM profile_view WHERE id = ANY($1::uuid[]) OR LOWER("profileId") = ANY($2::varchar[])',
          [
            seededViewIds,
            profileIds.map((profileId) => profileId.toLowerCase()),
          ]
        );
      }
      for (const token of tokens) {
        await rpc(auth, AuthCommands.Logout, { token }).catch(() => undefined);
      }
      if (authDb && userIds.length) {
        await authDb.query(
          'DELETE FROM auth_action_token WHERE "userId" = ANY($1::uuid[])',
          [userIds]
        );
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
        if (keyIds.length) {
          await authDb.query(
            'UPDATE key_datum SET "userId" = NULL WHERE id = ANY($1::uuid[])',
            [keyIds]
          );
        }
        await authDb.query(
          'DELETE FROM user_entity WHERE id = ANY($1::uuid[])',
          [userIds]
        );
        if (keyIds.length) {
          await authDb.query(
            'DELETE FROM key_datum WHERE id = ANY($1::uuid[])',
            [keyIds]
          );
        }
      }
      if (profileDb && profileIds.length) {
        await profileDb.query(
          'DELETE FROM profile WHERE id = ANY($1::uuid[])',
          [profileIds]
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
        [authDb, profileDb, socialDb].map((db) =>
          db?.end().catch(() => undefined)
        )
      );
    }
  });
});
