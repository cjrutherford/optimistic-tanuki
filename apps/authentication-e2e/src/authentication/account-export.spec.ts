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
  SocialCommands,
  TimelineCommands,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Account export session boundary over TCP', () => {
  let authClient: ClientProxy;
  let profileClient: ClientProxy;
  let permissionsClient: ClientProxy;
  let socialClient: ClientProxy;
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
  const socialPostIds = [randomUUID(), randomUUID(), randomUUID()];
  const socialCommentIds = [randomUUID(), randomUUID()];
  const socialReactionIds = [randomUUID(), randomUUID()];
  const socialAttachmentId = randomUUID();
  const socialPollIds = [randomUUID(), randomUUID(), randomUUID()];
  const socialComponentId = randomUUID();
  const fixtureVoteIds: number[] = [];
  const fixtureLinkIds: number[] = [];
  const fixtureActivityIds = [randomUUID(), randomUUID()].sort();
  const fixtureRoleAssignmentIds = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ].sort();
  const fixtureRoleId = randomUUID();
  const fixtureAppScopeId = randomUUID();

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
      ![
        'ot_authentication',
        'ot_profile',
        'ot_permissions',
        'ot_social',
      ].includes(database) ||
      !configuredPort ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new Error('Account export E2E database fixture is not configured');
    }
    return { host, port, user: 'postgres', password: 'postgres', database };
  };

  const insertPermissionFixtures = async (
    ownProfileIds: string[],
    foreignProfile: string
  ) => {
    const database = new PgClient(getFixtureDatabaseOptions('ot_permissions'));
    await database.connect();
    try {
      await database.query('BEGIN');
      await database.query(
        'INSERT INTO app_scope (id, name, description, active, created_at) VALUES ($1::uuid, $2, $3, true, now())',
        [
          fixtureAppScopeId,
          `account-export-${fixtureAppScopeId}`,
          'Generated account export fixture',
        ]
      );
      await database.query(
        'INSERT INTO role (id, name, description, "appScopeId", created_at) VALUES ($1::uuid, $2, $3, $4::uuid, now())',
        [
          fixtureRoleId,
          `account-export-${fixtureRoleId}`,
          'Generated account export fixture role',
          fixtureAppScopeId,
        ]
      );
      await database.query(
        `INSERT INTO role_assignment (id, "profileId", "targetId", "roleId", "appScopeId", created_at)
         VALUES ($1::uuid, $2, NULL, $4::uuid, $5::uuid, now()),
                ($3::uuid, $6, NULL, $4::uuid, $5::uuid, now()),
                ($7::uuid, $8, NULL, $4::uuid, $5::uuid, now())`,
        [
          fixtureRoleAssignmentIds[0],
          ownProfileIds[0],
          fixtureRoleAssignmentIds[1],
          fixtureRoleId,
          fixtureAppScopeId,
          ownProfileIds[1],
          fixtureRoleAssignmentIds[2],
          foreignProfile,
        ]
      );
      await database.query('COMMIT');
    } catch (error) {
      await database.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await database.end();
    }
  };

  const insertSocialFixtures = async (
    ownProfiles: string[],
    foreignProfile: string
  ) => {
    const database = new PgClient(getFixtureDatabaseOptions('ot_social'));
    await database.connect();
    try {
      await database.query('BEGIN');
      await database.query(
        `INSERT INTO post (id, title, content, "profileId", "userId", "appScope", visibility, "publicAudienceExplicit")
         VALUES ($1::uuid, 'owned social fixture', 'owned body', $2, $3, 'social', 'public', true),
                ($4::uuid, 'foreign social fixture', 'foreign body', $5, $6, 'social', 'public', true),
                ($7::uuid, 'second owned social fixture', 'second owned body', $8, $9, 'social', 'public', true)`,
        [
          socialPostIds[0],
          ownProfiles[0],
          accountId,
          socialPostIds[1],
          foreignProfile,
          otherAccountId,
          socialPostIds[2],
          ownProfiles[1],
          accountId,
        ]
      );
      await database.query(
        `INSERT INTO comment (id, content, "userId", "profileId", "appScope", "postId")
         VALUES ($1::uuid, 'foreign comment under own post', $2, $3, 'social', $4::uuid),
                ($5::uuid, 'own comment on foreign post', $6, $7, 'social', $8::uuid)`,
        [
          socialCommentIds[0],
          otherAccountId,
          foreignProfile,
          socialPostIds[0],
          socialCommentIds[1],
          accountId,
          ownProfiles[0],
          socialPostIds[1],
        ]
      );
      await database.query(
        `INSERT INTO reaction (id, value, "userId", "profileId", "appScope", "postId")
         VALUES ($1::uuid, 1, $3, $4, 'social', $5::uuid),
                ($2::uuid, 1, $3, $6, 'social', $5::uuid)`,
        [
          socialReactionIds[0],
          socialReactionIds[1],
          accountId,
          ownProfiles[0],
          socialPostIds[1],
          ownProfiles[1],
        ]
      );
      const vote = await database.query<{ id: number }>(
        `INSERT INTO vote (value, "userId", "profileId", "appScope", "postId") VALUES (1, $1, $2, 'social', $3::uuid) RETURNING id`,
        [accountId, ownProfiles[0], socialPostIds[1]]
      );
      fixtureVoteIds.push(vote.rows[0].id);
      await database.query(
        `INSERT INTO attachment (id, name, "filePath", type, "appScope", "postId") VALUES ($1::uuid, 'fixture image', 'https://private.invalid/?secret=omit', 'IMAGE', 'social', $2::uuid)`,
        [socialAttachmentId, socialPostIds[0]]
      );
      await database.query(
        `INSERT INTO poll (id, question, options, votes, "isMultipleChoice", "showResultsBeforeVote", "isAnonymous", "profileId", "userId")
         VALUES ($1::uuid, 'fixture poll', 'yes,no', 'foreign-vote-must-not-export', false, true, false, $2, $3),
                ($4::uuid, 'second profile fixture poll', 'one,two', NULL, false, true, false, $5, $6),
                ($7::uuid, 'foreign fixture poll', 'foreign,no', NULL, false, true, false, $8, $9)`,
        [
          socialPollIds[0],
          ownProfiles[0],
          accountId,
          socialPollIds[1],
          ownProfiles[1],
          accountId,
          socialPollIds[2],
          foreignProfile,
          otherAccountId,
        ]
      );
      await database.query(
        `INSERT INTO social_components (id, "postId", "instanceId", "componentType", "componentData", position) VALUES ($1::uuid, $2::uuid, $3, 'fixture', '{"secret":"arbitrary-json-must-not-export"}'::jsonb, 0)`,
        [socialComponentId, socialPostIds[0], `fixture-${socialComponentId}`]
      );
      const link = await database.query<{ id: number }>(
        `INSERT INTO link (url, "appScope") VALUES ($1, 'social') RETURNING id`,
        ['https://fixture.invalid/?credential=link-url-must-not-export']
      );
      fixtureLinkIds.push(link.rows[0].id);
      await database.query('COMMIT');
    } catch (error) {
      await database.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await database.end();
    }
  };

  const expectSocialFixturesPersisted = async () => {
    const database = new PgClient(getFixtureDatabaseOptions('ot_social'));
    await database.connect();
    try {
      const rows = await database.query(
        'SELECT id, "userId", "profileId" FROM post WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialPostIds]
      );
      expect(rows.rowCount).toBe(3);
      expect(rows.rows.map(({ id }) => id)).toEqual(
        expect.arrayContaining(socialPostIds)
      );
      expect(rows.rows.find(({ id }) => id === socialPostIds[0])).toMatchObject(
        { userId: accountId, profileId: ownedProfileIds[0] }
      );
      expect(rows.rows.find(({ id }) => id === socialPostIds[1])).toMatchObject(
        { userId: otherAccountId, profileId: foreignProfileId }
      );
      expect(rows.rows.find(({ id }) => id === socialPostIds[2])).toMatchObject(
        { userId: accountId, profileId: ownedProfileIds[1] }
      );
      const pollRows = await database.query<{
        id: string;
        userId: string;
        profileId: string;
      }>(
        'SELECT id, "userId", "profileId" FROM poll WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialPollIds]
      );
      expect(pollRows.rowCount).toBe(socialPollIds.length);
      expect(
        pollRows.rows.find(({ id }) => id === socialPollIds[0])
      ).toMatchObject({ userId: accountId, profileId: ownedProfileIds[0] });
      expect(
        pollRows.rows.find(({ id }) => id === socialPollIds[1])
      ).toMatchObject({ userId: accountId, profileId: ownedProfileIds[1] });
      expect(
        pollRows.rows.find(({ id }) => id === socialPollIds[2])
      ).toMatchObject({ userId: otherAccountId, profileId: foreignProfileId });
      const fixtureRows = await database.query<{ id: string }>(
        `SELECT id::text AS id FROM comment WHERE id = ANY($1::uuid[])
         UNION ALL SELECT id::text FROM attachment WHERE id = $2::uuid
         UNION ALL SELECT id::text FROM poll WHERE id = ANY($3::uuid[])
         UNION ALL SELECT id::text FROM reaction WHERE id = ANY($4::uuid[])
         UNION ALL SELECT id::text FROM social_components WHERE id = $5::uuid
         UNION ALL SELECT id::text FROM vote WHERE id = ANY($6::integer[])
         UNION ALL SELECT id::text FROM link WHERE id = ANY($7::integer[])`,
        [
          socialCommentIds,
          socialAttachmentId,
          socialPollIds,
          socialReactionIds,
          socialComponentId,
          fixtureVoteIds,
          fixtureLinkIds,
        ]
      );
      const expectedIds = [
        ...socialCommentIds,
        socialAttachmentId,
        ...socialPollIds,
        ...socialReactionIds,
        socialComponentId,
        ...fixtureVoteIds.map(String),
        ...fixtureLinkIds.map(String),
      ];
      expect(fixtureRows.rowCount).toBe(expectedIds.length);
      expect(fixtureRows.rows.map(({ id }) => id)).toEqual(
        expect.arrayContaining(expectedIds)
      );
      const reactionRows = await database.query<{
        id: string;
        userId: string;
        profileId: string;
        postId: string;
      }>(
        'SELECT id, "userId", "profileId", "postId" FROM reaction WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialReactionIds]
      );
      expect(reactionRows.rowCount).toBe(socialReactionIds.length);
      expect(reactionRows.rows.map(({ profileId }) => profileId)).toEqual(
        expect.arrayContaining(ownedProfileIds)
      );
      expect(
        reactionRows.rows.every(({ userId }) => userId === accountId)
      ).toBe(true);
    } finally {
      await database.end();
    }
  };

  const expectPermissionFixturesPersisted = async () => {
    const database = new PgClient(getFixtureDatabaseOptions('ot_permissions'));
    await database.connect();
    try {
      const assignments = await database.query<{
        id: string;
        profileId: string;
      }>(
        'SELECT id, "profileId" FROM role_assignment WHERE id = ANY($1::uuid[]) ORDER BY id',
        [fixtureRoleAssignmentIds]
      );
      expect(assignments.rowCount).toBe(3);
      expect(
        assignments.rows.some(({ profileId }) => profileId === foreignProfileId)
      ).toBe(true);
      const definitions = await database.query(
        'SELECT id FROM role WHERE id = $1::uuid UNION ALL SELECT id FROM app_scope WHERE id = $2::uuid',
        [fixtureRoleId, fixtureAppScopeId]
      );
      expect(definitions.rowCount).toBe(2);
    } finally {
      await database.end();
    }
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
    const socialDatabase = new PgClient(getFixtureDatabaseOptions('ot_social'));
    await socialDatabase.connect();
    try {
      await socialDatabase.query('BEGIN');
      if (fixtureVoteIds.length)
        await socialDatabase.query(
          'DELETE FROM vote WHERE id = ANY($1::integer[])',
          [fixtureVoteIds]
        );
      await socialDatabase.query(
        'DELETE FROM social_components WHERE id = $1::uuid',
        [socialComponentId]
      );
      if (fixtureLinkIds.length) {
        await socialDatabase.query(
          'DELETE FROM link WHERE id = ANY($1::integer[])',
          [fixtureLinkIds]
        );
      }
      await socialDatabase.query('DELETE FROM attachment WHERE id = $1::uuid', [
        socialAttachmentId,
      ]);
      await socialDatabase.query(
        'DELETE FROM poll WHERE id = ANY($1::uuid[])',
        [socialPollIds]
      );
      await socialDatabase.query(
        'DELETE FROM reaction WHERE id = ANY($1::uuid[])',
        [socialReactionIds]
      );
      await socialDatabase.query(
        'DELETE FROM comment WHERE id = ANY($1::uuid[])',
        [socialCommentIds]
      );
      await socialDatabase.query(
        'DELETE FROM post WHERE id = ANY($1::uuid[])',
        [socialPostIds]
      );
      await socialDatabase.query('COMMIT');
      const leftovers = await socialDatabase.query(
        'SELECT id::text FROM post WHERE id = ANY($1::uuid[]) UNION ALL SELECT id::text FROM comment WHERE id = ANY($2::uuid[]) UNION ALL SELECT id::text FROM attachment WHERE id = $3::uuid UNION ALL SELECT id::text FROM poll WHERE id = ANY($4::uuid[]) UNION ALL SELECT id::text FROM reaction WHERE id = ANY($5::uuid[]) UNION ALL SELECT id::text FROM social_components WHERE id = $6::uuid UNION ALL SELECT id::text FROM vote WHERE id = ANY($7::integer[]) UNION ALL SELECT id::text FROM link WHERE id = ANY($8::integer[])',
        [
          socialPostIds,
          socialCommentIds,
          socialAttachmentId,
          socialPollIds,
          socialReactionIds,
          socialComponentId,
          fixtureVoteIds,
          fixtureLinkIds,
        ]
      );
      expect(leftovers.rowCount).toBe(0);
    } catch (error) {
      await socialDatabase.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await socialDatabase.end();
    }

    const permissionsDatabase = new PgClient(
      getFixtureDatabaseOptions('ot_permissions')
    );
    await permissionsDatabase.connect();
    try {
      await permissionsDatabase.query('BEGIN');
      await permissionsDatabase.query(
        'DELETE FROM role_assignment WHERE id = ANY($1::uuid[])',
        [fixtureRoleAssignmentIds]
      );
      await permissionsDatabase.query('DELETE FROM role WHERE id = $1::uuid', [
        fixtureRoleId,
      ]);
      await permissionsDatabase.query(
        'DELETE FROM app_scope WHERE id = $1::uuid',
        [fixtureAppScopeId]
      );
      await permissionsDatabase.query('COMMIT');
      const rows = await permissionsDatabase.query(
        'SELECT id FROM role_assignment WHERE id = ANY($1::uuid[]) UNION ALL SELECT id FROM role WHERE id = $2::uuid UNION ALL SELECT id FROM app_scope WHERE id = $3::uuid',
        [fixtureRoleAssignmentIds, fixtureRoleId, fixtureAppScopeId]
      );
      expect(rows.rowCount).toBe(0);
    } catch (error) {
      await permissionsDatabase.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await permissionsDatabase.end();
    }

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
    permissionsClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host, port: 3012 },
    });
    socialClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host, port: 3003 },
    });
    try {
      await Promise.all([
        authClient.connect(),
        profileClient.connect(),
        permissionsClient.connect(),
        socialClient.connect(),
      ]);
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
      foreignProfileId = foreignProfile.id;
      await insertPermissionFixtures(
        [firstProfile.id, secondProfile.id],
        foreignProfile.id
      );
      ownedProfileIds = [firstProfile.id, secondProfile.id];
      await insertSocialFixtures(ownedProfileIds, foreignProfile.id);
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
      ownedTimelineIds = [firstTimeline.id, secondTimeline.id];
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
      await Promise.all([
        authClient?.close(),
        profileClient?.close(),
        permissionsClient?.close(),
        socialClient?.close(),
      ]);
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
    const permissionsParticipant = preview.participants.find(
      ({ participantId }) => participantId === 'permissions'
    );
    expect(permissionsParticipant.status).toBe('partial');
    expect(permissionsParticipant.uncovered).toContain(
      'profile-id-pages-unfenced'
    );
    expect(
      permissionsParticipant.data.assignments.map(({ profileId }) => profileId)
    ).toEqual(expect.arrayContaining(ownedProfileIds));
    expect(permissionsParticipant.data.assignments).toHaveLength(2);
    expect(
      permissionsParticipant.data.assignments.map(({ id }) => id)
    ).not.toContain(fixtureRoleAssignmentIds[2]);
    expect(JSON.stringify(permissionsParticipant)).not.toContain(
      foreignProfileId
    );
    const socialParticipant = preview.participants.find(
      ({ participantId }) => participantId === 'social'
    );
    expect(socialParticipant.status).toBe('partial');
    expect(socialParticipant.uncovered).toContain('social-preview-unfenced');
    const exportedPostIds = socialParticipant.data.posts.map(({ id }) => id);
    expect(
      exportedPostIds.filter((id) => id === socialPostIds[0])
    ).toHaveLength(1);
    expect(
      exportedPostIds.filter((id) => id === socialPostIds[2])
    ).toHaveLength(1);
    expect(
      socialParticipant.data.posts.find(({ id }) => id === socialPostIds[0])
        ?.profileId
    ).toBe(ownedProfileIds[0]);
    expect(
      socialParticipant.data.posts.find(({ id }) => id === socialPostIds[2])
        ?.profileId
    ).toBe(ownedProfileIds[1]);
    expect(socialParticipant.data.posts.map(({ id }) => id)).not.toContain(
      socialPostIds[1]
    );
    expect(socialParticipant.data.comments.map(({ id }) => id)).toEqual([
      socialCommentIds[1],
    ]);
    expect(socialParticipant.data.comments[0].postId).toBe(socialPostIds[1]);
    expect(socialParticipant.data.attachments).toEqual([
      expect.objectContaining({
        id: socialAttachmentId,
        name: 'fixture image',
      }),
    ]);
    expect(JSON.stringify(socialParticipant)).not.toContain('private.invalid');
    expect(JSON.stringify(socialParticipant)).not.toContain(
      'foreign-vote-must-not-export'
    );
    const exportedPollIds = socialParticipant.data.polls.map(({ id }) => id);
    expect(
      exportedPollIds.filter((id) => id === socialPollIds[0])
    ).toHaveLength(1);
    expect(
      exportedPollIds.filter((id) => id === socialPollIds[1])
    ).toHaveLength(1);
    expect(exportedPollIds).not.toContain(socialPollIds[2]);
    expect(
      socialParticipant.data.polls.find(({ id }) => id === socialPollIds[0])
        ?.profileId
    ).toBe(ownedProfileIds[0]);
    expect(
      socialParticipant.data.polls.find(({ id }) => id === socialPollIds[1])
        ?.profileId
    ).toBe(ownedProfileIds[1]);
    expect(socialParticipant.data.polls.every((row) => !('votes' in row))).toBe(
      true
    );
    expect(socialParticipant.uncovered).toContain(
      'poll-post-association-unverified'
    );
    expect(socialParticipant.data.reactions).toHaveLength(2);
    expect(
      socialParticipant.data.reactions.filter(
        ({ profileId }) => profileId === ownedProfileIds[0]
      )
    ).toEqual([
      expect.objectContaining({
        targetType: 'post',
        targetId: socialPostIds[1],
      }),
    ]);
    expect(
      socialParticipant.data.reactions.filter(
        ({ profileId }) => profileId === ownedProfileIds[1]
      )
    ).toEqual([
      expect.objectContaining({
        targetType: 'post',
        targetId: socialPostIds[1],
      }),
    ]);
    expect(socialParticipant.data.votes).toEqual([
      expect.objectContaining({
        profileId: ownedProfileIds[0],
        targetType: 'post',
        targetId: socialPostIds[1],
      }),
    ]);
    expect(JSON.stringify(socialParticipant)).not.toContain(
      'arbitrary-json-must-not-export'
    );
    expect(JSON.stringify(socialParticipant)).not.toContain(
      'link-url-must-not-export'
    );
    expect(socialParticipant.data.portableMediaBytesIncluded).toBe(false);
    expect(socialParticipant.uncovered).toContain(
      'social-components-unreviewed'
    );
    expect(socialParticipant.uncovered).toContain('post-link-urls-omitted');
    await expectPermissionFixturesPersisted();
    await expectSocialFixturesPersisted();
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

  it('rejects a cross-account direct Social participant request', async () => {
    await expect(
      firstValueFrom(
        socialClient.send(
          { cmd: SocialCommands.GetAccountExportSnapshot },
          {
            accountId: otherAccountId,
            token: sessionToken,
            appId: 'client-interface',
          }
        )
      )
    ).rejects.toBeDefined();
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
