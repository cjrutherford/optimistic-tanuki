import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Client as PgClient } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  AuthCommands,
  ProfileCommands,
  TimelineCommands,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Account export session boundary over TCP', () => {
  let authClient: ClientProxy;
  let profileClient: ClientProxy;
  let accountId: string;
  let otherAccountId: string;
  let sessionToken: string;
  let otherSessionToken: string;
  let ownedProfileIds: string[] = [];
  let ownedTimelineIds: string[] = [];
  let foreignProfileId: string;
  let foreignTimelineId: string;
  let globalProfileBlogRole: string;
  const fixtureEmails: string[] = [];
  const fixtureUserIds: string[] = [];
  const fixtureProfileIds: string[] = [];
  const fixtureTimelineIds: string[] = [];
  const fixtureGuardianPermissionIds = [randomUUID(), randomUUID()].sort();
  const fixtureGuardianNoticeId = randomUUID();
  const fixtureActionTokenId = randomUUID();
  const fixtureActivityIds = [randomUUID(), randomUUID()].sort();

  const registerAndLogin = async (label: string) => {
    const email = `account-export-${label}-${Date.now()}@example.test`;
    fixtureEmails.push(email);
    const password = 'AccountExportE2E!123';
    const registration = await firstValueFrom(
      authClient.send(
        { cmd: AuthCommands.Register },
        {
          email,
          fn: 'Export',
          ln: label,
          password,
          confirm: password,
          ageEligibilityStatus: 'adult',
        }
      )
    );
    const userId = registration?.data?.user?.id as string;
    if (userId) fixtureUserIds.push(userId);
    const login = await firstValueFrom(
      authClient.send(
        { cmd: AuthCommands.Login },
        { email, password, appId: 'client-interface' }
      )
    );
    return { userId, token: login?.data?.newToken as string };
  };

  const expectDenied = async (payload: Record<string, unknown>) => {
    let observedError: unknown;
    try {
      await firstValueFrom(
        profileClient.send(
          { cmd: ProfileCommands.GetAccountExportSnapshot },
          payload
        )
      );
    } catch (error) {
      observedError = error;
    }
    expect(observedError).toBeDefined();
    const serializedError = JSON.stringify(observedError);
    expect((observedError as { message?: string })?.message).toContain(
      'Invalid account export session'
    );
    expect(serializedError).not.toContain(sessionToken);
    expect(serializedError).not.toMatch(/password|postgres|select\s+.+from/i);
  };

  const expectAuthenticationDenied = async (
    payload: Record<string, unknown>
  ) => {
    let observedError: unknown;
    try {
      await firstValueFrom(
        authClient.send({ cmd: AuthCommands.GetAccountExportSnapshot }, payload)
      );
    } catch (error) {
      observedError = error;
    }
    expect(observedError).toBeDefined();
    const serializedError = JSON.stringify(observedError);
    expect((observedError as { message?: string })?.message).toContain(
      'Invalid account export session'
    );
    expect(serializedError).not.toMatch(/password|postgres|select\s+.+from/i);
    expect(serializedError).not.toContain(sessionToken);
  };

  const createProfile = async (userId: string, appScope: string) => {
    const profile = await firstValueFrom(
      profileClient.send(
        { cmd: ProfileCommands.Create },
        {
          userId,
          appScope,
          name: `Export ${appScope}`,
          profilePic: '',
          coverPic: '',
          bio: `Profile for ${appScope}`,
          location: '',
          occupation: '',
          interests: '',
          skills: '',
          copyPermissionsFromGlobalProfile: false,
        }
      )
    );
    if (profile?.id) fixtureProfileIds.push(profile.id);
    return profile;
  };

  const createTimeline = async (
    userId: string,
    profileId: string,
    label: string
  ) => {
    const timeline = await firstValueFrom(
      profileClient.send(
        { cmd: TimelineCommands.Create },
        {
          userId,
          title: `Timeline ${label}`,
          description: `Timeline for ${label}`,
          timeStamp: new Date('2026-01-01T00:00:00Z'),
          eventType: 'Posted',
          related_profile: { id: profileId },
        }
      )
    );
    if (timeline?.id) fixtureTimelineIds.push(timeline.id);
    return timeline;
  };

  const setInlinePng = async (id: string) =>
    firstValueFrom(
      profileClient.send(
        { cmd: ProfileCommands.Update },
        {
          id,
          profilePic:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pXcAAAAASUVORK5CYII=',
          coverPic:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pXcAAAAASUVORK5CYII=',
        }
      )
    );

  const getFixtureDatabaseOptions = (database: string) => {
    const host = process.env.ACCOUNT_EXPORT_E2E_DB_HOST;
    const configuredPort = process.env.E2E_DB_PORT;
    const port = Number(configuredPort);
    if (
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-export-fixture-v1' ||
      host !== '127.0.0.1' ||
      !configuredPort ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new Error('Account export E2E database fixture is not configured');
    }
    return { host, port, user: 'postgres', password: 'postgres', database };
  };

  const insertOAuthProviderFixtures = async () => {
    const database = new PgClient(
      getFixtureDatabaseOptions('ot_authentication')
    );
    await database.connect();
    try {
      await database.query(
        `INSERT INTO oauth_provider
          (id, provider, "providerUserId", "providerEmail", "providerDisplayName", "userId", "createdAt", "updatedAt")
         VALUES
          ($1::uuid, 'google', $2, $3, $4, $5::uuid, now(), now()),
          ($6::uuid, 'github', $7, $8, $9, $10::uuid, now(), now())`,
        [
          randomUUID(),
          `fixture-owned-${accountId}`,
          'owned-link@example.test',
          'Owned fixture link',
          accountId,
          randomUUID(),
          `fixture-foreign-${otherAccountId}`,
          'foreign-link@example.test',
          'Foreign fixture link',
          otherAccountId,
        ]
      );
    } finally {
      await database.end();
    }
  };

  const insertGuardianExportFixtures = async (
    dependentProfileId: string,
    foreignProfileId: string
  ) => {
    const authDatabase = new PgClient(
      getFixtureDatabaseOptions('ot_authentication')
    );
    await authDatabase.connect();
    try {
      await authDatabase.query('BEGIN');
      await authDatabase.query(
        `INSERT INTO guardian_permission
          (id, "applicantEmail", "guardianEmail", "dateOfBirth", "userId", "guardianUserId", "status",
           "attestationVersion", "attestationText", "createdAt", "expiresAt", "attestedAt", "deleteAfter", "appId", "appName", "uiBaseUrl", "emailFrom")
         VALUES
          ($1::uuid, 'dependent@example.test', 'guardian@example.test', '2010-01-01', $2::uuid, $3::uuid, 'revoked', 'fixture-v1', 'private fixture statement', now(), now() + interval '1 year', now(), now() + interval '1 day', 'client-interface', 'Fixture App', 'http://127.0.0.1:8080', 'fixture@example.test'),
          ($4::uuid, 'other-dependent@example.test', 'owner@example.test', '2011-01-01', $3::uuid, $2::uuid, 'revoked', 'fixture-v2', 'other private statement', now(), now() + interval '1 year', now(), now() + interval '1 day', 'client-interface', 'Fixture App', 'http://127.0.0.1:8080', 'fixture@example.test')`,
        [
          fixtureGuardianPermissionIds[0],
          accountId,
          otherAccountId,
          fixtureGuardianPermissionIds[1],
        ]
      );
      await authDatabase.query(
        `INSERT INTO guardian_policy_notice
          (id, "policyVersion", "policyUrl", "guardianUserId", status, "acceptedAt", "createdAt", "updatedAt", "nextAttemptAt")
         VALUES ($1::uuid, 'fixture-policy-v1', 'https://example.test/policy', $2::uuid, 'accepted', now(), now(), now(), now())`,
        [fixtureGuardianNoticeId, accountId]
      );
      await authDatabase.query(
        `INSERT INTO auth_action_token
          (id, "tokenHash", purpose, "appId", "returnPath", "expiresAt", "consumedAt", "createdAt", "userId")
         VALUES ($1::uuid, $2, 'verification', 'client-interface', '/private-fixture-return', now() + interval '1 hour', NULL, now(), $3::uuid)`,
        [fixtureActionTokenId, 'a'.repeat(64), accountId]
      );
      await authDatabase.query('COMMIT');
    } catch (error) {
      await authDatabase.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await authDatabase.end();
    }

    const profileDatabase = new PgClient(
      getFixtureDatabaseOptions('ot_profile')
    );
    await profileDatabase.connect();
    try {
      await profileDatabase.query('BEGIN');
      await profileDatabase.query(
        `INSERT INTO guardian_profile_activity
          (id, "actorUserId", "dependentUserId", "profileId", "appId", operation, "changedFieldNames", "createdAt")
         VALUES
          ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'client-interface', 'profile.manage', ARRAY['bio','location'], now()),
          ($5::uuid, $3::uuid, $2::uuid, $6::uuid, 'client-interface', 'profile.view', ARRAY['email'], now())`,
        [
          fixtureActivityIds[0],
          otherAccountId,
          accountId,
          dependentProfileId,
          fixtureActivityIds[1],
          foreignProfileId,
        ]
      );
      await profileDatabase.query('COMMIT');
    } catch (error) {
      await profileDatabase.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await profileDatabase.end();
    }
  };

  const cleanupFixtures = async () => {
    const authDatabase = new PgClient(
      getFixtureDatabaseOptions('ot_authentication')
    );
    await authDatabase.connect();
    let userIds = [...new Set(fixtureUserIds)];
    try {
      await authDatabase.query('BEGIN');
      if (fixtureEmails.length > 0) {
        const users = await authDatabase.query<{ id: string }>(
          'SELECT id FROM user_entity WHERE email = ANY($1::varchar[])',
          [fixtureEmails]
        );
        userIds = [...new Set([...userIds, ...users.rows.map(({ id }) => id)])];
      }
      if (userIds.length > 0) {
        const keys = await authDatabase.query<{ id: string | null }>(
          `SELECT id FROM key_datum WHERE "userId" = ANY($1::uuid[])
           UNION
           SELECT "keyDataId" AS id FROM user_entity
           WHERE id = ANY($1::uuid[]) AND "keyDataId" IS NOT NULL`,
          [userIds]
        );
        const keyIds = keys.rows
          .map(({ id }) => id)
          .filter((id): id is string => Boolean(id));
        await authDatabase.query(
          'DELETE FROM guardian_policy_notice WHERE "guardianUserId" = ANY($1::uuid[])',
          [userIds]
        );
        await authDatabase.query(
          'DELETE FROM guardian_permission WHERE "userId" = ANY($1::uuid[]) OR "guardianUserId" = ANY($1::uuid[])',
          [userIds]
        );
        await authDatabase.query(
          'DELETE FROM token WHERE "userId" = ANY($1::uuid[])',
          [userIds]
        );
        await authDatabase.query(
          'DELETE FROM auth_action_token WHERE "userId" = ANY($1::uuid[])',
          [userIds]
        );
        await authDatabase.query(
          'DELETE FROM oauth_provider WHERE "userId" = ANY($1::uuid[])',
          [userIds]
        );
        await authDatabase.query(
          'UPDATE user_entity SET "keyDataId" = NULL WHERE id = ANY($1::uuid[])',
          [userIds]
        );
        if (keyIds.length > 0) {
          await authDatabase.query(
            'UPDATE key_datum SET "userId" = NULL WHERE id = ANY($1::uuid[])',
            [keyIds]
          );
        }
        await authDatabase.query(
          'DELETE FROM user_entity WHERE id = ANY($1::uuid[])',
          [userIds]
        );
        if (keyIds.length > 0) {
          await authDatabase.query(
            'DELETE FROM key_datum WHERE id = ANY($1::uuid[])',
            [keyIds]
          );
        }
      }
      await authDatabase.query('COMMIT');
      const guardianRows = await authDatabase.query(
        'SELECT id FROM guardian_permission WHERE id = ANY($1::uuid[])',
        [fixtureGuardianPermissionIds]
      );
      const noticeRows = await authDatabase.query(
        'SELECT id FROM guardian_policy_notice WHERE id = $1::uuid',
        [fixtureGuardianNoticeId]
      );
      const actionRows = await authDatabase.query(
        'SELECT id FROM auth_action_token WHERE id = $1::uuid',
        [fixtureActionTokenId]
      );
      expect(guardianRows.rowCount).toBe(0);
      expect(noticeRows.rowCount).toBe(0);
      expect(actionRows.rowCount).toBe(0);
    } catch (error) {
      await authDatabase.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await authDatabase.end();
    }

    const profileDatabase = new PgClient(
      getFixtureDatabaseOptions('ot_profile')
    );
    await profileDatabase.connect();
    try {
      await profileDatabase.query('BEGIN');
      if (userIds.length > 0) {
        await profileDatabase.query(
          'DELETE FROM guardian_profile_activity WHERE "actorUserId" = ANY($1::uuid[]) OR "dependentUserId" = ANY($1::uuid[]) OR "profileId" = ANY($2::uuid[])',
          [userIds, fixtureProfileIds]
        );
        await profileDatabase.query(
          'DELETE FROM timeline WHERE id = ANY($1::uuid[]) OR "userId" = ANY($2::varchar[])',
          [fixtureTimelineIds, userIds]
        );
        await profileDatabase.query(
          'DELETE FROM profile WHERE id = ANY($1::uuid[]) OR "userId" = ANY($2::varchar[])',
          [fixtureProfileIds, userIds]
        );
      }
      await profileDatabase.query('COMMIT');
      const activityRows = await profileDatabase.query(
        'SELECT id FROM guardian_profile_activity WHERE id = ANY($1::uuid[])',
        [fixtureActivityIds]
      );
      expect(activityRows.rowCount).toBe(0);
    } catch (error) {
      await profileDatabase.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await profileDatabase.end();
    }
  };

  beforeAll(async () => {
    const host = globalThis.socketConnectionOptions?.host || '127.0.0.1';
    authClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host, port: 3001 },
    });
    profileClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host, port: 3002 },
    });
    try {
      await Promise.all([authClient.connect(), profileClient.connect()]);
      const first = await registerAndLogin('one');
      const second = await registerAndLogin('two');
      accountId = first.userId;
      otherAccountId = second.userId;
      sessionToken = first.token;
      otherSessionToken = second.token;
      await insertOAuthProviderFixtures();

      const firstProfile = await createProfile(accountId, 'account-export-a');
      globalProfileBlogRole = firstProfile.blogRole;
      const secondProfile = await createProfile(accountId, 'account-export-b');
      await setInlinePng(firstProfile.id);
      const foreignProfile = await createProfile(
        otherAccountId,
        'account-export-b'
      );
      await insertGuardianExportFixtures(firstProfile.id, foreignProfile.id);
      const firstTimeline = await createTimeline(
        accountId,
        firstProfile.id,
        'owned-a'
      );
      const secondTimeline = await createTimeline(
        accountId,
        secondProfile.id,
        'owned-b'
      );
      const foreignTimeline = await createTimeline(
        otherAccountId,
        foreignProfile.id,
        'foreign'
      );
      ownedProfileIds = [firstProfile.id, secondProfile.id];
      ownedTimelineIds = [firstTimeline.id, secondTimeline.id];
      foreignProfileId = foreignProfile.id;
      foreignTimelineId = foreignTimeline.id;
    } catch (error) {
      await cleanupFixtures().catch(() => undefined);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await Promise.all(
        [sessionToken, otherSessionToken]
          .filter(Boolean)
          .map((token) =>
            firstValueFrom(
              authClient.send({ cmd: AuthCommands.Logout }, { token })
            ).catch(() => undefined)
          )
      );
      await cleanupFixtures();
    } finally {
      await Promise.all([authClient?.close(), profileClient?.close()]);
    }
  });

  it('returns a partial internal snapshot for the authenticated account without returning its token', async () => {
    const preview = await firstValueFrom(
      authClient.send(
        { cmd: AuthCommands.PreviewAccountExport },
        {
          accountId,
          token: sessionToken,
          appId: 'client-interface',
        }
      )
    );

    expect(preview.accountId).toBe(accountId);
    expect(preview.complete).toBe(false);
    expect(preview.status).toBe('EXPORT_INCOMPLETE');
    expect(JSON.stringify(preview)).not.toContain(sessionToken);

    const profileParticipant = preview.participants.find(
      ({ participantId }) => participantId === 'profile'
    );
    expect(
      profileParticipant.data.profiles.find(
        ({ id }) => id === ownedProfileIds[0]
      ).blogRole
    ).toBe(globalProfileBlogRole);
    expect(
      profileParticipant.data.profiles.find(({ id }) => id === foreignProfileId)
    ).toBeUndefined();
    expect(profileParticipant.data.profiles.map(({ id }) => id)).toEqual(
      expect.arrayContaining(ownedProfileIds)
    );
    expect(profileParticipant.data.profiles).toHaveLength(
      ownedProfileIds.length
    );
    expect(profileParticipant.data.timelines.map(({ id }) => id)).toEqual(
      expect.arrayContaining(ownedTimelineIds)
    );
    expect(profileParticipant.data.timelines).toHaveLength(
      ownedTimelineIds.length
    );
    expect(profileParticipant.data.media).toMatchObject({
      referencesIncluded: false,
      inlineMediaExcluded: true,
      portableBytesIncluded: false,
    });
    const authenticationParticipant = preview.participants.find(
      ({ participantId }) => participantId === 'authentication'
    );
    expect(authenticationParticipant.data.identity).toMatchObject({
      id: accountId,
      ageEligibilityStatus: 'adult',
    });
    expect(authenticationParticipant.data.identity).not.toHaveProperty(
      'password'
    );
    expect(authenticationParticipant.data.identity).not.toHaveProperty(
      'totpSecret'
    );
    expect(authenticationParticipant.data.oauthProviders).toEqual([
      expect.objectContaining({
        provider: 'google',
        providerUserId: `fixture-owned-${accountId}`,
        providerEmail: 'owned-link@example.test',
        providerDisplayName: 'Owned fixture link',
      }),
    ]);
    expect(
      authenticationParticipant.data.guardianPermissions.map(({ role }) => role)
    ).toEqual(['dependent', 'guardian']);
    const dependentPermission =
      authenticationParticipant.data.guardianPermissions.find(
        ({ role }) => role === 'dependent'
      );
    const guardianPermission =
      authenticationParticipant.data.guardianPermissions.find(
        ({ role }) => role === 'guardian'
      );
    expect(dependentPermission.dateOfBirth).toBe('2010-01-01');
    expect(guardianPermission).not.toHaveProperty('dateOfBirth');
    for (const permission of authenticationParticipant.data
      .guardianPermissions) {
      expect(permission).not.toHaveProperty('id');
      expect(permission).not.toHaveProperty('userId');
      expect(permission).not.toHaveProperty('guardianUserId');
    }
    expect(authenticationParticipant.data.guardianPolicyNotices).toEqual([
      expect.objectContaining({
        policyVersion: 'fixture-policy-v1',
        acceptanceMeaning: 'provider-accepted-not-delivered',
      }),
    ]);
    expect(authenticationParticipant.data.authActionMetadata).toEqual([
      expect.objectContaining({
        purpose: 'verification',
        appId: 'client-interface',
      }),
    ]);
    expect(JSON.stringify(authenticationParticipant)).not.toMatch(
      /dependent@example\.test|guardian@example\.test|private fixture statement|private-fixture-return|a{64}/
    );
    const activities = profileParticipant.data.guardianActivity;
    expect(activities.map(({ role }) => role)).toEqual([
      'dependent',
      'guardian',
    ]);
    expect(activities[0]).toMatchObject({
      profileId: ownedProfileIds[0],
      changedFieldNames: ['bio', 'location'],
    });
    expect(activities[1]).not.toHaveProperty('profileId');
    expect(activities[1]).not.toHaveProperty('changedFieldNames');
    expect(JSON.stringify(preview)).not.toContain(
      `fixture-foreign-${otherAccountId}`
    );
    expect(JSON.stringify(preview)).not.toContain(otherAccountId);
    expect(profileParticipant.uncovered).toContain(
      'inline-profile-media-excluded'
    );
    expect(
      profileParticipant.data.profiles.map(({ appScope }) => appScope)
    ).toEqual(expect.arrayContaining(['account-export-a', 'account-export-b']));
    expect(profileParticipant.data.profiles.map(({ id }) => id)).not.toContain(
      foreignProfileId
    );
    expect(profileParticipant.data.timelines.map(({ id }) => id)).not.toContain(
      foreignTimelineId
    );

    const directProfileSnapshot = await firstValueFrom(
      profileClient.send(
        { cmd: ProfileCommands.GetAccountExportSnapshot },
        { accountId, token: sessionToken, appId: 'client-interface' }
      )
    );
    expect(directProfileSnapshot.data.profiles.map(({ id }) => id)).toEqual(
      expect.arrayContaining(ownedProfileIds)
    );
    expect(directProfileSnapshot.data.timelines.map(({ id }) => id)).toEqual(
      expect.arrayContaining(ownedTimelineIds)
    );
    expect(
      directProfileSnapshot.data.profiles.find(
        ({ id }) => id === ownedProfileIds[0]
      ).blogRole
    ).toBe(globalProfileBlogRole);
    const directAuthenticationSnapshot = await firstValueFrom(
      authClient.send(
        { cmd: AuthCommands.GetAccountExportSnapshot },
        { accountId, token: sessionToken, appId: 'client-interface' }
      )
    );
    expect(directAuthenticationSnapshot.data.oauthProviders).toEqual([
      expect.objectContaining({
        provider: 'google',
        providerUserId: `fixture-owned-${accountId}`,
        providerEmail: 'owned-link@example.test',
      }),
    ]);
    expect(JSON.stringify(directAuthenticationSnapshot)).not.toContain(
      `fixture-foreign-${otherAccountId}`
    );
  });

  it('binds the direct Authentication snapshot command to a validated session subject', async () => {
    const snapshot = await firstValueFrom(
      authClient.send(
        { cmd: AuthCommands.GetAccountExportSnapshot },
        { accountId, token: sessionToken, appId: 'client-interface' }
      )
    );

    expect(snapshot.accountId).toBe(accountId);
    expect(snapshot.status).toBe('partial');
    expect(JSON.stringify(snapshot)).not.toContain(sessionToken);
    await expectAuthenticationDenied({
      accountId,
      appId: 'client-interface',
    });
    await expectAuthenticationDenied({
      accountId,
      token: 'invalid-session-token',
      appId: 'client-interface',
    });
    await expectAuthenticationDenied({ accountId, token: sessionToken });
    await expectAuthenticationDenied({
      accountId: otherAccountId,
      token: sessionToken,
      appId: 'client-interface',
    });
  });

  it('rejects missing credentials, missing scope, invalid sessions, and a different account subject', async () => {
    await expectDenied({ accountId, appId: 'client-interface' });
    await expectDenied({ accountId, token: sessionToken });
    await expectDenied({
      accountId,
      token: 'invalid-session-token',
      appId: 'client-interface',
    });
    await expectDenied({
      accountId: otherAccountId,
      token: sessionToken,
      appId: 'client-interface',
    });
  });

  it('rejects the session after Authentication revokes it', async () => {
    await firstValueFrom(
      authClient.send({ cmd: AuthCommands.Logout }, { token: sessionToken })
    );
    await expectDenied({
      accountId,
      token: sessionToken,
      appId: 'client-interface',
    });
    await expectAuthenticationDenied({
      accountId,
      token: sessionToken,
      appId: 'client-interface',
    });
  });
});
