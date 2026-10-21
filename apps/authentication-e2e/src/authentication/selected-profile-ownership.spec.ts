import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { ProfileCommands } from '@optimistic-tanuki/profile-contracts';
import { Client as PgClient } from 'pg';
import { firstValueFrom, timeout } from 'rxjs';

jest.setTimeout(90000);

describe('selected profile ownership against private Auth and Profile services', () => {
  const clients: ClientProxy[] = [];
  const users: Array<{ id: string; email: string; token?: string }> = [];
  const profileIds: string[] = [];
  let auth: ClientProxy;
  let profile: ClientProxy;
  let authDb: PgClient;
  let profileDb: PgClient;
  const password = 'SelectedProfileJ18!AccountPass123';

  const rpc = <T = any>(client: ClientProxy, cmd: string, payload: unknown) =>
    firstValueFrom(
      client.send<T>({ cmd }, payload).pipe(timeout({ first: 5000 }))
    );

  const assertPrivateFixture = () => {
    if (
      process.env.SELECTED_PROFILE_J18_MARKER !==
        'private-selected-profile-j18-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-forum-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15548' ||
      !process.env.PRESENCE_J17_JWT_SECRET
    ) {
      throw new Error(
        'J18 selected profile private fixture markers are required'
      );
    }
  };

  const tokenRows = async (userId: string) =>
    (
      await authDb.query(
        'SELECT id, "profileId", revoked FROM token WHERE "userId" = $1::uuid ORDER BY id',
        [userId]
      )
    ).rows;

  const counterpartFingerprint = async (userId: string) => ({
    profiles: (
      await profileDb.query(
        'SELECT to_jsonb(p)::text AS row FROM profile p WHERE LOWER(p."userId") = $1 ORDER BY p.id',
        [userId]
      )
    ).rows,
    tokens: await tokenRows(userId),
  });

  beforeAll(async () => {
    assertPrivateFixture();
    auth = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3001 },
    });
    profile = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3002 },
    });
    clients.push(auth, profile);
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
    await Promise.all([
      auth.connect(),
      profile.connect(),
      authDb.connect(),
      profileDb.connect(),
    ]);
  });

  afterAll(async () => {
    try {
      if (profileIds.length) {
        await profileDb.query(
          'DELETE FROM profile WHERE id = ANY($1::uuid[])',
          [profileIds]
        );
      }
      const ids = users.map(({ id }) => id);
      if (ids.length) {
        await authDb.query(
          'DELETE FROM token WHERE "userId" = ANY($1::uuid[])',
          [ids]
        );
        const keyRows = await authDb.query(
          'SELECT "keyDataId" FROM user_entity WHERE id = ANY($1::uuid[])',
          [ids]
        );
        const keyIds = keyRows.rows.map((row) => row.keyDataId).filter(Boolean);
        await authDb.query(
          'UPDATE user_entity SET "keyDataId" = NULL WHERE id = ANY($1::uuid[])',
          [ids]
        );
        if (keyIds.length) {
          await authDb.query(
            'UPDATE key_datum SET "userId" = NULL WHERE id = ANY($1::uuid[])',
            [keyIds]
          );
        }
        await authDb.query(
          'DELETE FROM user_entity WHERE id = ANY($1::uuid[])',
          [ids]
        );
        if (keyIds.length) {
          await authDb.query(
            'DELETE FROM key_datum WHERE id = ANY($1::uuid[])',
            [keyIds]
          );
        }
        await authDb.query(
          'DELETE FROM "auth_action_token" WHERE "userId" = ANY($1::uuid[])',
          [ids]
        );
      }
    } finally {
      await Promise.all(
        clients.map((client) =>
          Promise.resolve()
            .then(() => client.close())
            .catch(() => undefined)
        )
      );
      await Promise.all(
        [authDb, profileDb].map((db) => db?.end().catch(() => undefined))
      );
    }
  });

  it('permits owned selections and rejects foreign, missing, malformed, and non-string selections without creating rows', async () => {
    for (const label of ['owner', 'counterpart']) {
      const email = `selected-profile-j18-${label}-${randomUUID()
        .replace(/-/g, '')
        .slice(0, 16)}@example.test`;
      const registered = await rpc<any>(auth, AuthCommands.Register, {
        email,
        fn: 'Selected Profile',
        ln: label,
        password,
        confirm: password,
        ageEligibilityStatus: 'adult',
      });
      users.push({ id: registered.data.user.id, email });
    }
    const selected = [randomUUID(), randomUUID()];
    const counterpartProfile = randomUUID();
    profileIds.push(...selected, counterpartProfile);
    await profileDb.query(
      `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills)
       VALUES ($1,$2::varchar,'client-interface','Owned uppercase legacy','','','','','','',''),
              ($3,$4::varchar,'client-interface','Owned secondary','','','','','','',''),
              ($5,$6::varchar,'client-interface','Counterpart profile','','','','','','','')`,
      [
        selected[0],
        users[0].id.toUpperCase(),
        selected[1],
        users[1].id,
        counterpartProfile,
        users[1].id,
      ]
    );

    // The first session is issued before any other session exists, proving the
    // ownership lookup does not recurse through Auth.Validate.
    for (let index = 0; index < users.length; index++) {
      const login = await rpc<any>(auth, AuthCommands.Login, {
        email: users[index].email,
        password,
        appId: 'client-interface',
        profileId: selected[index].toUpperCase(),
      });
      expect(login.data.newToken).toEqual(expect.any(String));
      const claims = await new JwtService({
        secret: process.env.PRESENCE_J17_JWT_SECRET!,
      }).verifyAsync(login.data.newToken);
      expect(claims).toMatchObject({
        userId: users[index].id,
        profileId: selected[index],
      });
      users[index].token = login.data.newToken;
      const row = (await tokenRows(users[index].id)).find(
        (candidate) => candidate.profileId === selected[index]
      );
      expect(row).toMatchObject({ profileId: selected[index], revoked: false });
    }

    for (let index = 0; index < users.length; index++) {
      const issued = await rpc<any>(auth, AuthCommands.Issue, {
        userId: users[index].id,
        profileId: selected[index],
        appId: 'client-interface',
      });
      expect(issued.data.newToken).toEqual(expect.any(String));
      const claims = await new JwtService({
        secret: process.env.PRESENCE_J17_JWT_SECRET!,
      }).verifyAsync(issued.data.newToken);
      expect(claims).toMatchObject({
        userId: users[index].id,
        profileId: selected[index],
      });
      expect(
        (await tokenRows(users[index].id)).filter(
          (candidate) => candidate.profileId === selected[index]
        )
      ).toHaveLength(2);
    }

    const ownership = await rpc<any>(
      profile,
      ProfileCommands.CheckAccountProfileOwnership,
      {
        accountId: users[0].id.toUpperCase(),
        profileId: selected[0].toUpperCase(),
      }
    );
    expect(ownership).toEqual({
      accountId: users[0].id,
      profileId: selected[0],
      owned: true,
    });
    await expect(
      rpc(profile, ProfileCommands.CheckAccountProfileOwnership, {
        accountId: users[0].id,
        profileId: counterpartProfile,
      })
    ).resolves.toMatchObject({ owned: false });
    await expect(
      rpc(profile, ProfileCommands.CheckAccountProfileOwnership, {
        accountId: users[0].id,
        profileId: randomUUID(),
      })
    ).resolves.toMatchObject({ owned: false });
    await expect(
      rpc(profile, ProfileCommands.CheckAccountProfileOwnership, {
        accountId: users[0].id,
        profileId: 'invalid-profile-id',
      })
    ).rejects.toBeDefined();

    const ownerRowsBefore = await tokenRows(users[0].id);
    const counterpartBefore = await counterpartFingerprint(users[1].id);
    const deniedSelections: unknown[] = [
      counterpartProfile,
      randomUUID(),
      'invalid-profile-id',
      42,
    ];
    for (const profileId of deniedSelections) {
      await expect(
        rpc(auth, AuthCommands.Login, {
          email: users[0].email,
          password,
          appId: 'client-interface',
          profileId,
        })
      ).rejects.toBeDefined();
      await expect(
        rpc(auth, AuthCommands.Issue, {
          userId: users[0].id,
          appId: 'client-interface',
          profileId,
        })
      ).rejects.toBeDefined();
    }
    expect(await tokenRows(users[0].id)).toEqual(ownerRowsBefore);
    expect(await counterpartFingerprint(users[1].id)).toEqual(
      counterpartBefore
    );

    const profileless = await rpc<any>(auth, AuthCommands.Login, {
      email: users[0].email,
      password,
      appId: 'client-interface',
    });
    expect(profileless.data.newToken).toEqual(expect.any(String));
    const profilelessRow = (await tokenRows(users[0].id)).find(
      (candidate) => candidate.profileId === null
    );
    expect(profilelessRow).toBeDefined();
    const beforeDeferred = await tokenRows(users[0].id);
    await rpc(auth, AuthCommands.Login, {
      email: users[0].email,
      password,
      appId: 'client-interface',
      deferSession: true,
    });
    expect(await tokenRows(users[0].id)).toEqual(beforeDeferred);
  });
});
