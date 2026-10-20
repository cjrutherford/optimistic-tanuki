import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Client as PgClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import {
  AuthCommands,
  ProfileCommands,
  SocialCommands,
  ForumCommands,
  TimelineCommands,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/profile-contracts';
import {
  AccountExportJobRequest,
  AccountExportJobResumeRequest,
  AccountExportJobStatus,
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  AccountExportSnapshotIdentityPage,
  AccountExportOwnerCaptureVerifier,
} from '@optimistic-tanuki/models';

describe('Account export session boundary over TCP', () => {
  let authClient: ClientProxy;
  let profileClient: ClientProxy;
  let permissionsClient: ClientProxy;
  let socialClient: ClientProxy;
  let forumClient: ClientProxy;
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
  const fixtureOAuthProviderIds = [randomUUID(), randomUUID()];
  const fixtureKeyDataIds: string[] = [];
  const fixtureAuthTokenIds: string[] = [];
  const fixtureExportJobIds: string[] = [];
  const socialPostIds = [randomUUID(), randomUUID(), randomUUID()];
  const socialCommentIds = [randomUUID(), randomUUID()];
  const socialReactionIds = [randomUUID(), randomUUID()];
  const socialAttachmentId = randomUUID();
  const socialPollIds = [randomUUID(), randomUUID(), randomUUID()];
  const socialComponentId = randomUUID();
  const socialSavedItemIds = [randomUUID(), randomUUID()];
  const socialSearchHistoryIds = [randomUUID(), randomUUID()];
  const socialFollowIds = [randomUUID(), randomUUID(), randomUUID()];
  const socialBlockIds = [randomUUID(), randomUUID()];
  const socialMuteIds = [randomUUID(), randomUUID()];
  const forumTopicIds = [randomUUID(), randomUUID(), randomUUID()];
  const forumThreadIds = [randomUUID(), randomUUID(), randomUUID()];
  const forumPostIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
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
        'auth-profile-forum-export-fixture-v1' ||
      host !== '127.0.0.1' ||
      ![
        'ot_authentication',
        'ot_profile',
        'ot_permissions',
        'ot_social',
        'ot_forum',
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
        `INSERT INTO saved_item (id, "profileId", "itemType", "itemId", "itemTitle")
         VALUES ($1::uuid, $3, 'post', $4, 'foreign post title must stay private'),
                ($2::uuid, $5, 'comment', $6, 'foreign comment title must stay private')`,
        [
          socialSavedItemIds[0],
          socialSavedItemIds[1],
          ownProfiles[0],
          socialPostIds[1],
          ownProfiles[1],
          socialCommentIds[0],
        ]
      );
      await database.query(
        `INSERT INTO search_history (id, "profileId", query, "searchType", "resultCount")
         VALUES ($1::uuid, $3, 'private account A1 query', 'users', 47),
                ($2::uuid, $4, 'private account A2 query', 'posts', 23)`,
        [
          socialSearchHistoryIds[0],
          socialSearchHistoryIds[1],
          ownProfiles[0],
          ownProfiles[1],
        ]
      );
      await database.query(
        `INSERT INTO follow_entity (id, "followerId", "followeeId", "appScope", "isMutual")
         VALUES ($1::uuid, $4, $5, 'social', true),
                ($2::uuid, $5, $4, 'social', true),
                ($3::uuid, $5, $6, 'social', false)`,
        [
          socialFollowIds[0],
          socialFollowIds[1],
          socialFollowIds[2],
          ownProfiles[0],
          foreignProfile,
          ownProfiles[1],
        ]
      );
      await database.query(
        `INSERT INTO user_block (id, "blockerId", "blockedId", reason)
         VALUES ($1::uuid, $3, $4, 'private actor reason'),
                ($2::uuid, $4, $3, 'foreign actor reason must stay private')`,
        [socialBlockIds[0], socialBlockIds[1], ownProfiles[1], foreignProfile]
      );
      await database.query(
        `INSERT INTO user_mute (id, "muterId", "mutedId", duration)
         VALUES ($1::uuid, $3, $4, 3600),
                ($2::uuid, $4, $3, 7200)`,
        [socialMuteIds[0], socialMuteIds[1], ownProfiles[1], foreignProfile]
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

  const readSocialStateFixtures = async () => {
    const database = new PgClient(getFixtureDatabaseOptions('ot_social'));
    await database.connect();
    try {
      const posts = await database.query(
        'SELECT * FROM post WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialPostIds]
      );
      const comments = await database.query(
        'SELECT * FROM comment WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialCommentIds]
      );
      const reactions = await database.query(
        'SELECT * FROM reaction WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialReactionIds]
      );
      const attachments = await database.query(
        'SELECT * FROM attachment WHERE id = $1::uuid',
        [socialAttachmentId]
      );
      const polls = await database.query(
        'SELECT * FROM poll WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialPollIds]
      );
      const components = await database.query(
        'SELECT * FROM social_components WHERE id = $1::uuid',
        [socialComponentId]
      );
      const links = await database.query(
        'SELECT * FROM link WHERE id = ANY($1::integer[]) ORDER BY id',
        [fixtureLinkIds]
      );
      const votes = await database.query(
        'SELECT * FROM vote WHERE id = ANY($1::integer[]) ORDER BY id',
        [fixtureVoteIds]
      );
      const savedItems = await database.query(
        'SELECT id, "profileId", "itemType", "itemId", "itemTitle", "savedAt" FROM saved_item WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialSavedItemIds]
      );
      const searchHistory = await database.query(
        'SELECT id, "profileId", query, "searchType", "resultCount", "createdAt" FROM search_history WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialSearchHistoryIds]
      );
      const follows = await database.query(
        'SELECT id, "followerId", "followeeId", "appScope", "isMutual", "createdAt", "updatedAt" FROM follow_entity WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialFollowIds]
      );
      const blocks = await database.query(
        'SELECT id, "blockerId", "blockedId", reason, "createdAt" FROM user_block WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialBlockIds]
      );
      const mutes = await database.query(
        'SELECT id, "muterId", "mutedId", duration, "createdAt" FROM user_mute WHERE id = ANY($1::uuid[]) ORDER BY id',
        [socialMuteIds]
      );
      expect(posts.rowCount).toBe(socialPostIds.length);
      expect(comments.rowCount).toBe(socialCommentIds.length);
      expect(reactions.rowCount).toBe(socialReactionIds.length);
      expect(attachments.rowCount).toBe(1);
      expect(polls.rowCount).toBe(socialPollIds.length);
      expect(components.rowCount).toBe(1);
      expect(links.rowCount).toBe(fixtureLinkIds.length);
      expect(votes.rowCount).toBe(fixtureVoteIds.length);
      expect(savedItems.rowCount).toBe(socialSavedItemIds.length);
      expect(searchHistory.rowCount).toBe(socialSearchHistoryIds.length);
      expect(follows.rowCount).toBe(socialFollowIds.length);
      expect(blocks.rowCount).toBe(socialBlockIds.length);
      expect(mutes.rowCount).toBe(socialMuteIds.length);
      return {
        posts: posts.rows,
        comments: comments.rows,
        reactions: reactions.rows,
        attachments: attachments.rows,
        polls: polls.rows,
        components: components.rows,
        links: links.rows,
        votes: votes.rows,
        savedItems: savedItems.rows,
        searchHistory: searchHistory.rows,
        follows: follows.rows,
        blocks: blocks.rows,
        mutes: mutes.rows,
      };
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

  const captureAuthenticationFixtureIds = async () => {
    const database = new PgClient(
      getFixtureDatabaseOptions('ot_authentication')
    );
    await database.connect();
    try {
      const keys = await database.query<{ id: string; userId: string }>(
        'SELECT k.id, u.id AS "userId" FROM user_entity u JOIN key_datum k ON k.id = u."keyDataId" WHERE u.id = ANY($1::uuid[]) ORDER BY k.id',
        [fixtureUserIds]
      );
      expect(keys.rows).toHaveLength(fixtureUserIds.length);
      expect(new Set(keys.rows.map(({ id }) => id)).size).toBe(
        fixtureUserIds.length
      );
      expect(keys.rows.map(({ userId }) => userId).sort()).toEqual(
        [...fixtureUserIds].sort()
      );
      const tokens = await database.query<{ id: string }>(
        'SELECT id FROM token WHERE "userId" = ANY($1::uuid[]) ORDER BY id',
        [fixtureUserIds]
      );
      fixtureKeyDataIds.push(...keys.rows.map(({ id }) => id));
      fixtureAuthTokenIds.push(...tokens.rows.map(({ id }) => id));
      expect(fixtureKeyDataIds).toHaveLength(fixtureUserIds.length);
      expect(fixtureAuthTokenIds.length).toBeGreaterThan(0);
    } finally {
      await database.end();
    }
  };

  const readAuthenticationStateFixtures = async () => {
    const database = new PgClient(
      getFixtureDatabaseOptions('ot_authentication')
    );
    await database.connect();
    try {
      const users = await database.query(
        'SELECT id, email, "firstName", "lastName", "emailVerifiedAt", "ageEligibilityStatus", "ageEligibilityEndsAt", "keyDataId" FROM user_entity WHERE id = ANY($1::uuid[]) ORDER BY id',
        [fixtureUserIds]
      );
      const keys = await database.query<{
        id: string;
        public: Buffer;
        salt: string;
      }>(
        'SELECT id, public, salt FROM key_datum WHERE id = ANY($1::uuid[]) ORDER BY id',
        [fixtureKeyDataIds]
      );
      const tokens = await database.query<{
        id: string;
        userId: string | null;
        revoked: boolean;
        tokenData: string;
        profileId: string | null;
      }>(
        'SELECT id, "userId", revoked, "tokenData", "profileId" FROM token WHERE id = ANY($1::uuid[]) ORDER BY id',
        [fixtureAuthTokenIds]
      );
      const oauth = await database.query(
        'SELECT id, provider, "providerUserId", "providerEmail", "providerDisplayName", "userId", "createdAt", "updatedAt" FROM oauth_provider WHERE id = ANY($1::uuid[]) ORDER BY id',
        [fixtureOAuthProviderIds]
      );
      const permissions = await database.query(
        'SELECT id, "userId", "guardianUserId", status, "attestationVersion", "attestedAt", "expiresAt" FROM guardian_permission WHERE id = ANY($1::uuid[]) ORDER BY id',
        [fixtureGuardianPermissionIds]
      );
      const notices = await database.query(
        'SELECT id, "policyVersion", "policyUrl", "guardianUserId", status, "acceptedAt", "createdAt", "updatedAt", "nextAttemptAt" FROM guardian_policy_notice WHERE id = $1::uuid',
        [fixtureGuardianNoticeId]
      );
      const actions = await database.query<{
        id: string;
        tokenHash: string;
        purpose: string;
        appId: string;
        returnPath: string;
        expiresAt: Date;
        consumedAt: Date | null;
        createdAt: Date;
        userId: string;
      }>(
        'SELECT id, "tokenHash", purpose, "appId", "returnPath", "expiresAt", "consumedAt", "createdAt", "userId" FROM auth_action_token WHERE id = $1::uuid',
        [fixtureActionTokenId]
      );
      expect(users.rowCount).toBe(fixtureUserIds.length);
      expect(keys.rowCount).toBe(fixtureKeyDataIds.length);
      expect(tokens.rowCount).toBe(fixtureAuthTokenIds.length);
      expect(oauth.rowCount).toBe(fixtureOAuthProviderIds.length);
      return {
        users: users.rows,
        keys: keys.rows.map(({ public: publicKey, salt, ...row }) => ({
          ...row,
          publicDigest: createHash('sha256').update(publicKey).digest('hex'),
          saltDigest: createHash('sha256').update(salt).digest('hex'),
        })),
        tokens: tokens.rows.map(({ tokenData, ...row }) => ({
          ...row,
          tokenDigest: createHash('sha256').update(tokenData).digest('hex'),
        })),
        oauth: oauth.rows,
        permissions: permissions.rows,
        notices: notices.rows,
        actions: actions.rows.map(({ tokenHash, ...row }) => ({
          ...row,
          tokenHashDigest: createHash('sha256').update(tokenHash).digest('hex'),
        })),
      };
    } finally {
      await database.end();
    }
  };

  const readProfileStateFixtures = async () => {
    const database = new PgClient(getFixtureDatabaseOptions('ot_profile'));
    await database.connect();
    try {
      const profiles = await database.query(
        'SELECT id, "userId", "appScope", "profileName", "profilePic", "coverPic", bio, location, occupation, interests, skills, "blogRole" FROM profile WHERE id = ANY($1::uuid[]) ORDER BY id',
        [fixtureProfileIds]
      );
      const timelines = await database.query(
        'SELECT id, "userId", title, description, "timeStamp", "eventType", "relatedProfileId" FROM timeline WHERE id = ANY($1::uuid[]) ORDER BY id',
        [fixtureTimelineIds]
      );
      const activities = await database.query(
        'SELECT id, "actorUserId", "dependentUserId", "profileId", "appId", operation, "changedFieldNames", "createdAt" FROM guardian_profile_activity WHERE id = ANY($1::uuid[]) ORDER BY id',
        [fixtureActivityIds]
      );
      expect(profiles.rowCount).toBe(fixtureProfileIds.length);
      expect(timelines.rowCount).toBe(fixtureTimelineIds.length);
      expect(activities.rowCount).toBe(fixtureActivityIds.length);
      return {
        profiles: profiles.rows,
        timelines: timelines.rows,
        activities: activities.rows,
      };
    } finally {
      await database.end();
    }
  };

  const readPermissionStateFixtures = async () => {
    const database = new PgClient(getFixtureDatabaseOptions('ot_permissions'));
    await database.connect();
    try {
      const assignments = await database.query(
        'SELECT id, "profileId", "roleId", "appScopeId", "targetId", created_at FROM role_assignment WHERE id = ANY($1::uuid[]) ORDER BY id',
        [fixtureRoleAssignmentIds]
      );
      const roles = await database.query(
        'SELECT id, name, description, "appScopeId", created_at FROM role WHERE id = $1::uuid',
        [fixtureRoleId]
      );
      const scopes = await database.query(
        'SELECT id, name, description, active, created_at, updated_at FROM app_scope WHERE id = $1::uuid',
        [fixtureAppScopeId]
      );
      expect(assignments.rowCount).toBe(fixtureRoleAssignmentIds.length);
      expect(roles.rowCount).toBe(1);
      expect(scopes.rowCount).toBe(1);
      return {
        assignments: assignments.rows,
        roles: roles.rows,
        scopes: scopes.rows,
      };
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
          fixtureOAuthProviderIds[0],
          `fixture-owned-${accountId}`,
          'owned-link@example.test',
          'Owned fixture link',
          accountId,
          fixtureOAuthProviderIds[1],
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

  const insertForumFixtures = async (
    ownProfiles: string[],
    foreignProfile: string
  ) => {
    const database = new PgClient(getFixtureDatabaseOptions('ot_forum'));
    await database.connect();
    try {
      await database.query('BEGIN');
      await database.query(
        `INSERT INTO topic (id, title, description, "userId", "profileId", "appScope", visibility)
         VALUES ($1::uuid, $2, $3, $4, $5, 'forum', 'public'),
                ($6::uuid, 'foreign forum topic sentinel', 'foreign topic description sentinel', $7, $8, 'forum', 'public'),
                ($9::uuid, 'second owned topic sentinel', 'second profile topic description sentinel', $10, $11, 'forum', 'public')`,
        [
          forumTopicIds[0],
          '<a href="https://example.test/topic">owned topic sentinel</a>',
          '<img src="https://example.test/topic.png">',
          accountId,
          ownProfiles[0],
          forumTopicIds[1],
          otherAccountId,
          foreignProfile,
          forumTopicIds[2],
          accountId,
          ownProfiles[1],
        ]
      );
      await database.query(
        `INSERT INTO thread (id, title, description, content, "userId", "profileId", "appScope", "topicId", visibility, "viewCount", "moderationStatus", "moderationNotes")
         VALUES ($1::uuid, 'owned thread sentinel', 'owned description sentinel', '<img src="https://example.test/thread.png">', $2, $3, 'forum', $4::uuid, 'public', 17, 'hidden', 'private moderation sentinel'),
                ($5::uuid, 'foreign parent thread sentinel', 'foreign parent description sentinel', 'foreign parent content sentinel', $6, $7, 'forum', $8::uuid, 'public', 29, 'visible', 'foreign ops sentinel'),
                ($9::uuid, 'second owned thread sentinel', 'second profile description sentinel', 'second profile thread body sentinel', $10, $11, 'forum', $12::uuid, 'private', 31, 'visible', NULL)`,
        [
          forumThreadIds[0],
          accountId,
          ownProfiles[0],
          forumTopicIds[0],
          forumThreadIds[1],
          otherAccountId,
          foreignProfile,
          forumTopicIds[1],
          forumThreadIds[2],
          accountId,
          ownProfiles[1],
          forumTopicIds[2],
        ]
      );
      await database.query(
        `INSERT INTO forum_post (id, content, "userId", "profileId", "appScope", "threadId", "moderationStatus", "moderationNotes")
         VALUES ($1::uuid, '<a href="https://example.test/post">owned post sentinel</a>', $2, $3, 'forum', $4::uuid, 'visible', 'private post ops sentinel'),
                ($5::uuid, 'owned reply in foreign thread sentinel', $2, $6, 'forum', $7::uuid, 'visible', NULL),
                ($8::uuid, 'foreign reply sentinel must not be included', $9, $10, 'forum', $11::uuid, 'visible', NULL),
                ($12::uuid, 'foreign reply under owned thread must stay hidden', $9, $10, 'forum', $13::uuid, 'hidden', 'foreign reply ops sentinel')`,
        [
          forumPostIds[0],
          accountId,
          ownProfiles[0],
          forumThreadIds[0],
          forumPostIds[1],
          ownProfiles[1],
          forumThreadIds[1],
          forumPostIds[2],
          otherAccountId,
          foreignProfile,
          forumThreadIds[1],
          forumPostIds[3],
          forumThreadIds[2],
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

  const readForumStateFixtures = async () => {
    const database = new PgClient(getFixtureDatabaseOptions('ot_forum'));
    await database.connect();
    try {
      const topics = await database.query(
        `SELECT id, title, description, "userId", "profileId", "appScope", "createdAt", "updatedAt", visibility, "isPinned", "isLocked" FROM topic WHERE id = ANY($1::uuid[]) ORDER BY id`,
        [forumTopicIds]
      );
      const threads = await database.query(
        `SELECT id, title, description, content, "userId", "profileId", "appScope", "topicId", "createdAt", "updatedAt", visibility, "isPinned", "isLocked", "viewCount", "moderationStatus", "moderationNotes", "moderatedBy", "moderatedAt" FROM thread WHERE id = ANY($1::uuid[]) ORDER BY id`,
        [forumThreadIds]
      );
      const posts = await database.query(
        `SELECT id, content, "userId", "profileId", "appScope", "threadId", "createdAt", "updatedAt", "isEdited", "moderationStatus", "moderationNotes", "moderatedBy", "moderatedAt" FROM forum_post WHERE id = ANY($1::uuid[]) ORDER BY id`,
        [forumPostIds]
      );
      return { topics: topics.rows, threads: threads.rows, posts: posts.rows };
    } finally {
      await database.end();
    }
  };

  const expectForumFixturesPersisted = async () => {
    const state = await readForumStateFixtures();
    expect(state.topics).toHaveLength(forumTopicIds.length);
    expect(state.threads).toHaveLength(forumThreadIds.length);
    expect(state.posts).toHaveLength(forumPostIds.length);
    expect(state.posts.find(({ id }) => id === forumPostIds[1])).toMatchObject({
      userId: accountId,
      profileId: ownedProfileIds[1],
      threadId: forumThreadIds[1],
    });
    expect(
      state.threads.find(({ id }) => id === forumThreadIds[1])
    ).toMatchObject({
      userId: otherAccountId,
      profileId: foreignProfileId,
    });
  };

  const readAllFixtureState = async () => ({
    authentication: await readAuthenticationStateFixtures(),
    profile: await readProfileStateFixtures(),
    permissions: await readPermissionStateFixtures(),
    social: await readSocialStateFixtures(),
    forum: await readForumStateFixtures(),
  });

  const cleanupFixtures = async () => {
    const forumDatabase = new PgClient(getFixtureDatabaseOptions('ot_forum'));
    await forumDatabase.connect();
    try {
      await forumDatabase.query('BEGIN');
      await forumDatabase.query(
        'DELETE FROM forum_post WHERE id = ANY($1::uuid[])',
        [forumPostIds]
      );
      await forumDatabase.query(
        'DELETE FROM thread WHERE id = ANY($1::uuid[])',
        [forumThreadIds]
      );
      await forumDatabase.query(
        'DELETE FROM topic WHERE id = ANY($1::uuid[])',
        [forumTopicIds]
      );
      await forumDatabase.query('COMMIT');
      const leftovers = await forumDatabase.query(
        'SELECT id::text FROM forum_post WHERE id = ANY($1::uuid[]) UNION ALL SELECT id::text FROM thread WHERE id = ANY($2::uuid[]) UNION ALL SELECT id::text FROM topic WHERE id = ANY($3::uuid[])',
        [forumPostIds, forumThreadIds, forumTopicIds]
      );
      expect(leftovers.rowCount).toBe(0);
    } catch (error) {
      await forumDatabase.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await forumDatabase.end();
    }

    const socialDatabase = new PgClient(getFixtureDatabaseOptions('ot_social'));
    await socialDatabase.connect();
    try {
      await socialDatabase.query('BEGIN');
      await socialDatabase.query(
        'DELETE FROM user_mute WHERE id = ANY($1::uuid[])',
        [socialMuteIds]
      );
      await socialDatabase.query(
        'DELETE FROM user_block WHERE id = ANY($1::uuid[])',
        [socialBlockIds]
      );
      await socialDatabase.query(
        'DELETE FROM follow_entity WHERE id = ANY($1::uuid[])',
        [socialFollowIds]
      );
      await socialDatabase.query(
        'DELETE FROM search_history WHERE id = ANY($1::uuid[])',
        [socialSearchHistoryIds]
      );
      await socialDatabase.query(
        'DELETE FROM saved_item WHERE id = ANY($1::uuid[])',
        [socialSavedItemIds]
      );
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
        'SELECT id::text FROM post WHERE id = ANY($1::uuid[]) UNION ALL SELECT id::text FROM comment WHERE id = ANY($2::uuid[]) UNION ALL SELECT id::text FROM attachment WHERE id = $3::uuid UNION ALL SELECT id::text FROM poll WHERE id = ANY($4::uuid[]) UNION ALL SELECT id::text FROM reaction WHERE id = ANY($5::uuid[]) UNION ALL SELECT id::text FROM social_components WHERE id = $6::uuid UNION ALL SELECT id::text FROM vote WHERE id = ANY($7::integer[]) UNION ALL SELECT id::text FROM link WHERE id = ANY($8::integer[]) UNION ALL SELECT id::text FROM saved_item WHERE id = ANY($9::uuid[]) UNION ALL SELECT id::text FROM search_history WHERE id = ANY($10::uuid[]) UNION ALL SELECT id::text FROM follow_entity WHERE id = ANY($11::uuid[]) UNION ALL SELECT id::text FROM user_block WHERE id = ANY($12::uuid[]) UNION ALL SELECT id::text FROM user_mute WHERE id = ANY($13::uuid[])',
        [
          socialPostIds,
          socialCommentIds,
          socialAttachmentId,
          socialPollIds,
          socialReactionIds,
          socialComponentId,
          fixtureVoteIds,
          fixtureLinkIds,
          socialSavedItemIds,
          socialSearchHistoryIds,
          socialFollowIds,
          socialBlockIds,
          socialMuteIds,
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
    const userIds = [...new Set(fixtureUserIds)];
    const keyIds = [...new Set(fixtureKeyDataIds)];
    try {
      await authDatabase.query('BEGIN');
      if (fixtureExportJobIds.length > 0) {
        await authDatabase.query(
          'DELETE FROM account_export_jobs WHERE id = ANY($1::uuid[])',
          [fixtureExportJobIds]
        );
      }
      if (userIds.length > 0) {
        await authDatabase.query(
          'DELETE FROM guardian_policy_notice WHERE id = $1::uuid',
          [fixtureGuardianNoticeId]
        );
        await authDatabase.query(
          'DELETE FROM guardian_permission WHERE id = ANY($1::uuid[])',
          [fixtureGuardianPermissionIds]
        );
        await authDatabase.query(
          'DELETE FROM token WHERE id = ANY($1::uuid[])',
          [fixtureAuthTokenIds]
        );
        await authDatabase.query(
          'DELETE FROM auth_action_token WHERE id = $1::uuid',
          [fixtureActionTokenId]
        );
        await authDatabase.query(
          'DELETE FROM oauth_provider WHERE id = ANY($1::uuid[])',
          [fixtureOAuthProviderIds]
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
      const oauthRows = await authDatabase.query(
        'SELECT id FROM oauth_provider WHERE id = ANY($1::uuid[])',
        [fixtureOAuthProviderIds]
      );
      const tokenRows = await authDatabase.query(
        'SELECT id FROM token WHERE id = ANY($1::uuid[])',
        [fixtureAuthTokenIds]
      );
      const keyRows = await authDatabase.query(
        'SELECT id FROM key_datum WHERE id = ANY($1::uuid[])',
        [fixtureKeyDataIds]
      );
      const userRows = await authDatabase.query(
        'SELECT id FROM user_entity WHERE id = ANY($1::uuid[])',
        [fixtureUserIds]
      );
      const exportJobRows = await authDatabase.query(
        'SELECT id FROM account_export_jobs WHERE id = ANY($1::uuid[])',
        [fixtureExportJobIds]
      );
      expect(guardianRows.rowCount).toBe(0);
      expect(noticeRows.rowCount).toBe(0);
      expect(actionRows.rowCount).toBe(0);
      expect(oauthRows.rowCount).toBe(0);
      expect(tokenRows.rowCount).toBe(0);
      expect(keyRows.rowCount).toBe(0);
      expect(userRows.rowCount).toBe(0);
      expect(exportJobRows.rowCount).toBe(0);
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
    forumClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host, port: 3015 },
    });
    try {
      await Promise.all([
        authClient.connect(),
        profileClient.connect(),
        permissionsClient.connect(),
        socialClient.connect(),
        forumClient.connect(),
      ]);
      const first = await registerAndLogin('one');
      const second = await registerAndLogin('two');
      accountId = first.userId;
      otherAccountId = second.userId;
      sessionToken = first.token;
      otherSessionToken = second.token;
      await captureAuthenticationFixtureIds();
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
      await insertForumFixtures(ownedProfileIds, foreignProfile.id);
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
        forumClient?.close(),
      ]);
    }
  });

  it('returns a partial internal snapshot for the authenticated account without returning its token', async () => {
    const fixtureStateBefore = await readAllFixtureState();
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
    expect(socialParticipant.data.savedItems.map(({ id }) => id)).toEqual(
      expect.arrayContaining(socialSavedItemIds)
    );
    expect(socialParticipant.data.savedItems).toHaveLength(2);
    expect(
      socialParticipant.data.savedItems.find(
        ({ id }) => id === socialSavedItemIds[0]
      )
    ).toMatchObject({
      profileId: ownedProfileIds[0],
      itemType: 'post',
      itemId: socialPostIds[1],
    });
    expect(
      socialParticipant.data.savedItems.find(
        ({ id }) => id === socialSavedItemIds[1]
      )
    ).toMatchObject({
      profileId: ownedProfileIds[1],
      itemType: 'comment',
      itemId: socialCommentIds[0],
    });
    expect(socialParticipant.data.savedItems[0]).not.toHaveProperty(
      'itemTitle'
    );
    expect(socialParticipant.data.searchHistory.map(({ id }) => id)).toEqual(
      expect.arrayContaining(socialSearchHistoryIds)
    );
    expect(socialParticipant.data.searchHistory).toHaveLength(2);
    expect(
      socialParticipant.data.searchHistory.find(
        ({ id }) => id === socialSearchHistoryIds[0]
      )?.profileId
    ).toBe(ownedProfileIds[0]);
    expect(
      socialParticipant.data.searchHistory.find(
        ({ id }) => id === socialSearchHistoryIds[1]
      )?.profileId
    ).toBe(ownedProfileIds[1]);
    expect(
      socialParticipant.data.searchHistory.every(
        (row) => !('resultCount' in row)
      )
    ).toBe(true);
    expect(socialParticipant.data.follows.map(({ id }) => id)).toEqual([
      socialFollowIds[0],
    ]);
    expect(socialParticipant.data.follows[0]).toMatchObject({
      followerId: ownedProfileIds[0],
      followeeId: foreignProfileId,
    });
    expect(socialParticipant.data.follows[0]).not.toHaveProperty('isMutual');
    expect(socialParticipant.data.blocks.map(({ id }) => id)).toEqual([
      socialBlockIds[0],
    ]);
    expect(socialParticipant.data.blocks[0]).toMatchObject({
      blockerId: ownedProfileIds[1],
      blockedId: foreignProfileId,
    });
    expect(socialParticipant.data.blocks[0].reason).toBe(
      'private actor reason'
    );
    expect(socialParticipant.data.mutes.map(({ id }) => id)).toEqual([
      socialMuteIds[0],
    ]);
    expect(socialParticipant.data.mutes[0]).toMatchObject({
      muterId: ownedProfileIds[1],
      mutedId: foreignProfileId,
    });
    const expectExactKeys = (rows: object[], keys: string[]) => {
      rows.forEach((row) =>
        expect(Object.keys(row).sort()).toEqual([...keys].sort())
      );
    };
    expectExactKeys(socialParticipant.data.savedItems, [
      'id',
      'profileId',
      'itemType',
      'itemId',
      'savedAt',
    ]);
    expectExactKeys(socialParticipant.data.searchHistory, [
      'id',
      'profileId',
      'query',
      'searchType',
      'createdAt',
    ]);
    expectExactKeys(socialParticipant.data.follows, [
      'id',
      'followerId',
      'followeeId',
      'appScope',
      'createdAt',
      'updatedAt',
    ]);
    expectExactKeys(socialParticipant.data.blocks, [
      'id',
      'blockerId',
      'blockedId',
      'reason',
      'createdAt',
    ]);
    expectExactKeys(socialParticipant.data.mutes, [
      'id',
      'muterId',
      'mutedId',
      'duration',
      'createdAt',
    ]);
    expect(JSON.stringify(socialParticipant)).not.toMatch(
      /foreign post title must stay private|foreign comment title must stay private|foreign actor reason must stay private|resultCount|isMutual/
    );
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
    const forumParticipant = preview.participants.find(
      ({ participantId }) => participantId === 'forum'
    );
    expect(forumParticipant.status).toBe('partial');
    expect(forumParticipant.uncovered).toContain(
      'embedded-media-and-link-references-unresolved'
    );
    expect(forumParticipant.data.topics.map(({ id }) => id)).toEqual(
      expect.arrayContaining([forumTopicIds[0], forumTopicIds[2]])
    );
    expect(forumParticipant.data.topics).toHaveLength(2);
    expect(forumParticipant.data.threads.map(({ id }) => id)).toEqual(
      expect.arrayContaining([forumThreadIds[0], forumThreadIds[2]])
    );
    expect(forumParticipant.data.threads).toHaveLength(2);
    expect(forumParticipant.data.posts.map(({ id }) => id)).toEqual(
      expect.arrayContaining(forumPostIds.slice(0, 2))
    );
    expect(forumParticipant.data.posts).toHaveLength(2);
    expect(
      forumParticipant.data.posts.find(({ id }) => id === forumPostIds[1])
        .threadId
    ).toBe(forumThreadIds[1]);
    for (const row of [
      ...forumParticipant.data.topics,
      ...forumParticipant.data.threads,
      ...forumParticipant.data.posts,
    ]) {
      expect(row).not.toHaveProperty('viewCount');
      expect(row).not.toHaveProperty('moderationNotes');
      expect(row).not.toHaveProperty('moderatedBy');
      expect(row).not.toHaveProperty('moderatedAt');
    }
    expect(
      forumParticipant.data.topics.find(({ id }) => id === forumTopicIds[0])
        .title
    ).toBe('<a href="https://example.test/topic">owned topic sentinel</a>');
    expect(JSON.stringify(forumParticipant)).not.toContain(
      'foreign parent thread sentinel'
    );
    expect(JSON.stringify(forumParticipant)).not.toContain(
      'foreign reply sentinel'
    );
    expect(JSON.stringify(forumParticipant)).not.toContain(
      'private moderation sentinel'
    );
    expect(JSON.stringify(forumParticipant)).not.toContain(
      'private post ops sentinel'
    );
    expect(JSON.stringify(forumParticipant)).not.toContain(
      'foreign reply ops sentinel'
    );
    await expectPermissionFixturesPersisted();
    await expectSocialFixturesPersisted();
    await expectForumFixturesPersisted();
    expect(await readAllFixtureState()).toEqual(fixtureStateBefore);
    const otherPreview = await firstValueFrom(
      authClient.send(
        { cmd: AuthCommands.PreviewAccountExport },
        {
          accountId: otherAccountId,
          token: otherSessionToken,
          appId: 'client-interface',
        }
      )
    );
    expect(await readAllFixtureState()).toEqual(fixtureStateBefore);
    const otherForum = otherPreview.participants.find(
      ({ participantId }) => participantId === 'forum'
    );
    expect(otherForum.status).toBe('partial');
    expect(otherForum.data.topics.map(({ id }) => id)).toEqual([
      forumTopicIds[1],
    ]);
    expect(otherForum.data.threads.map(({ id }) => id)).toEqual([
      forumThreadIds[1],
    ]);
    expect(otherForum.data.posts.map(({ id }) => id)).toEqual(
      expect.arrayContaining([forumPostIds[2], forumPostIds[3]])
    );
    expect(otherForum.data.posts).toHaveLength(2);
    expect(JSON.stringify(otherForum)).not.toContain('owned thread sentinel');
    expect(JSON.stringify(otherForum)).not.toContain(
      'owned reply in foreign thread sentinel'
    );
    expect(JSON.stringify(otherForum)).not.toContain('owned topic sentinel');
    const otherSocial = otherPreview.participants.find(
      ({ participantId }) => participantId === 'social'
    );
    expect(otherSocial.status).toBe('partial');
    expect(otherSocial.data.savedItems).toEqual([]);
    expect(otherSocial.data.searchHistory).toEqual([]);
    expect(otherSocial.data.follows.map(({ id }) => id)).toEqual(
      expect.arrayContaining([socialFollowIds[1], socialFollowIds[2]])
    );
    expect(otherSocial.data.follows).toHaveLength(2);
    expect(
      otherSocial.data.follows.every(
        ({ followerId }) => followerId === foreignProfileId
      )
    ).toBe(true);
    expect(
      otherSocial.data.follows.map(({ followeeId }) => followeeId)
    ).toEqual(expect.arrayContaining(ownedProfileIds));
    expect(otherSocial.data.blocks.map(({ id }) => id)).toEqual([
      socialBlockIds[1],
    ]);
    expect(otherSocial.data.blocks[0]).toMatchObject({
      blockerId: foreignProfileId,
      blockedId: ownedProfileIds[1],
    });
    expect(otherSocial.data.mutes.map(({ id }) => id)).toEqual([
      socialMuteIds[1],
    ]);
    expect(otherSocial.data.mutes[0]).toMatchObject({
      muterId: foreignProfileId,
      mutedId: ownedProfileIds[1],
    });
    expect(JSON.stringify(otherSocial)).not.toContain('private actor reason');
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

  it('stores resumable export job status without tokens or preview content and keeps idempotency stable', async () => {
    const stateBefore = await readAllFixtureState();
    const candidateKeys = [randomUUID(), randomUUID()];
    const attempts = await Promise.allSettled(
      candidateKeys.map((idempotencyKey) =>
        firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.CreateAccountExportJob },
            {
              accountId,
              token: sessionToken,
              appId: 'client-interface',
              idempotencyKey,
            }
          )
        )
      )
    );
    const accepted = attempts.filter(
      (attempt) => attempt.status === 'fulfilled'
    );
    const refused = attempts.filter((attempt) => attempt.status === 'rejected');
    for (const attempt of accepted) {
      fixtureExportJobIds.push(
        (attempt as PromiseFulfilledResult<AccountExportJobStatus>).value.jobId
      );
    }
    expect(accepted).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(
      JSON.stringify((refused[0] as PromiseRejectedResult).reason)
    ).toContain('EXPORT_JOB_BUSY');
    const idempotencyKey =
      candidateKeys[
        attempts.findIndex((attempt) => attempt.status === 'fulfilled')
      ];
    const first = (
      accepted[0] as PromiseFulfilledResult<AccountExportJobStatus>
    ).value;
    const repeated = await firstValueFrom(
      authClient.send(
        { cmd: AuthCommands.CreateAccountExportJob },
        {
          accountId,
          token: sessionToken,
          appId: 'client-interface',
          idempotencyKey,
        }
      )
    );
    expect(first).toMatchObject({
      state: 'incomplete',
      artifactUrl: null,
      accountId,
      appId: 'client-interface',
    });
    expect(repeated.jobId).toBe(first.jobId);
    expect(repeated.attempt).toBe(first.attempt);
    expect(JSON.stringify(first)).not.toContain(sessionToken);
    expect(JSON.stringify(first)).not.toContain('owned-a');
    expect(first.coverageSummary.artifactAvailable).toBe(false);
    expect(first.coverageSummary.capturedDatabaseOwners).toEqual([
      'authentication',
      'profile',
      'assets',
    ]);
    expect(repeated.coverageSummary.capturedDatabaseOwners).toEqual([
      'authentication',
      'profile',
      'assets',
    ]);
    const laterKey = randomUUID();
    const laterJob = await firstValueFrom(
      authClient.send(
        { cmd: AuthCommands.CreateAccountExportJob },
        {
          accountId,
          token: sessionToken,
          appId: 'client-interface',
          idempotencyKey: laterKey,
        }
      )
    );
    fixtureExportJobIds.push(laterJob.jobId);
    expect(laterJob.state).toBe('incomplete');

    const database = new PgClient(
      getFixtureDatabaseOptions('ot_authentication')
    );
    await database.connect();
    try {
      const rows = await database.query<{
        id: string;
        coverageSummary: unknown;
        leaseOwner: string | null;
      }>(
        'SELECT id, "coverageSummary", "leaseOwner" FROM account_export_jobs WHERE "accountId" = $1 AND "appId" = $2 AND kind = $3 AND "idempotencyKey" = $4',
        [accountId, 'client-interface', 'export', idempotencyKey]
      );
      expect(rows.rowCount).toBe(1);
      expect(JSON.stringify(rows.rows[0])).not.toContain(sessionToken);
      await expect(
        firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.GetAccountExportJob },
            {
              accountId: otherAccountId,
              token: otherSessionToken,
              appId: 'client-interface',
              jobId: first.jobId,
            }
          )
        )
      ).rejects.toMatchObject({
        code: 'EXPORT_JOB_NOT_FOUND',
        statusCode: 404,
      });
    } finally {
      await database.end();
    }
    expect(await readAllFixtureState()).toEqual(stateBefore);
  });

  it('recovers an expired job lease and preserves incomplete status', async () => {
    const stateBefore = await readAllFixtureState();
    const idempotencyKey = randomUUID();
    const request: AccountExportJobRequest = {
      accountId: otherAccountId,
      token: otherSessionToken,
      appId: 'client-interface',
      idempotencyKey,
    };
    const created = await firstValueFrom(
      authClient.send({ cmd: AuthCommands.CreateAccountExportJob }, request)
    );
    fixtureExportJobIds.push(created.jobId);
    const resumeRequest: AccountExportJobResumeRequest = {
      accountId: otherAccountId,
      token: otherSessionToken,
      appId: 'client-interface',
      jobId: created.jobId,
    };
    const database = new PgClient(
      getFixtureDatabaseOptions('ot_authentication')
    );
    await database.connect();
    try {
      await database.query(
        `UPDATE account_export_jobs SET state = $1, attempt = $2, "leaseOwner" = $3, "leaseExpiresAt" = now() + interval '1 minute' WHERE id = $4`,
        ['running', 17, 'stale-worker', created.jobId]
      );
      await expect(
        firstValueFrom(
          authClient.send(
            { cmd: AuthCommands.ResumeAccountExportJob },
            resumeRequest
          )
        )
      ).rejects.toMatchObject({ code: 'EXPORT_JOB_BUSY', statusCode: 409 });
      await database.query(
        `UPDATE account_export_jobs SET "leaseExpiresAt" = now() - interval '1 second' WHERE id = $1`,
        [created.jobId]
      );
      const resumed = await firstValueFrom(
        authClient.send(
          { cmd: AuthCommands.ResumeAccountExportJob },
          resumeRequest
        )
      );
      expect(resumed.state).toBe('incomplete');
      expect(resumed.attempt).toBe(18);
      const row = await database.query(
        'SELECT state, attempt, "leaseOwner", "leaseExpiresAt", "coverageSummary" FROM account_export_jobs WHERE id = $1',
        [created.jobId]
      );
      expect(row.rows[0]).toMatchObject({
        state: 'incomplete',
        attempt: 18,
        leaseOwner: null,
        leaseExpiresAt: null,
      });
      expect(row.rows[0].coverageSummary.artifactAvailable).toBe(false);
      expect(resumed.coverageSummary.capturedDatabaseOwners).toEqual([
        'authentication',
        'profile',
        'assets',
      ]);
      expect(row.rows[0].coverageSummary.capturedDatabaseOwners).toEqual([
        'authentication',
        'profile',
        'assets',
      ]);
    } finally {
      await database.end();
    }
    expect(await readAllFixtureState()).toEqual(stateBefore);
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

  it('fences secure snapshots, preserves captured identities, and recaptures when private restart is enabled', async () => {
    const authDb = new PgClient(getFixtureDatabaseOptions('ot_authentication'));
    const profileDb = new PgClient(getFixtureDatabaseOptions('ot_profile'));
    await authDb.connect();
    await profileDb.connect();
    const jobId = randomUUID();
    const nonce = randomUUID();
    const extraIds = Array.from({ length: 1005 }, () => randomUUID());
    const lateId = randomUUID();
    const allExtraIds = [...extraIds, lateId];
    let descriptor: AccountExportSnapshotDescriptor | undefined;
    const grant: AccountExportCaptureGrant = {
      accountId: otherAccountId,
      token: otherSessionToken,
      appId: 'client-interface',
      jobId,
      attempt: 1,
      leaseOwner: nonce,
    };
    const rpc = <T = unknown>(
      client: ClientProxy,
      command: string,
      input: unknown,
      ms = 5000
    ) =>
      firstValueFrom(
        client.send<T>({ cmd: command }, input).pipe(timeout({ first: ms }))
      );
    const open = () =>
      rpc<AccountExportSnapshotDescriptor>(
        profileClient,
        ProfileCommands.OpenAccountExportCapture,
        grant,
        55000
      );
    fixtureExportJobIds.push(jobId);
    try {
      await authDb.query(
        `INSERT INTO account_export_jobs (id,"accountId","appId","kind","idempotencyKey","state","attempt","leaseOwner","leaseExpiresAt","coverageSummary") VALUES ($1,$2,$3,'export',$4,'running',1,$5,clock_timestamp()+interval '5 minutes',$6::jsonb)`,
        [
          jobId,
          otherAccountId,
          grant.appId,
          randomUUID(),
          nonce,
          JSON.stringify({
            blockers: ['snapshot-fixture'],
            artifactAvailable: false,
          }),
        ]
      );
      for (let start = 0; start < extraIds.length; start += 100) {
        const batch = extraIds.slice(start, start + 100);
        await profileDb.query(
          `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) SELECT x,$2,'snapshot-'||x::text,'snapshot fixture','','','','','','','' FROM unnest($1::uuid[]) x`,
          [batch, otherAccountId]
        );
      }
      for (const changed of [
        { ...grant, accountId, token: sessionToken },
        { ...grant, appId: 'forgeofwill' },
        { ...grant, attempt: 2 },
        { ...grant, leaseOwner: randomUUID() },
      ])
        await expect(
          rpc(profileClient, ProfileCommands.OpenAccountExportCapture, changed)
        ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      descriptor = await open();
      expect(descriptor.identityCount).toBe(1006);
      expect(descriptor.sources).toEqual(
        PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES
      );
      expect(JSON.stringify(descriptor)).not.toContain(otherSessionToken);
      expect(JSON.stringify(descriptor)).not.toContain(nonce);
      await profileDb.query(
        `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'snapshot-late','late snapshot fixture','','','','','','','')`,
        [lateId, otherAccountId]
      );
      const expectedIds = [foreignProfileId, ...extraIds].sort();
      const capturedIds: string[] = [];
      let offset = 0;
      while (true) {
        const page = await rpc<AccountExportSnapshotIdentityPage>(
          profileClient,
          ProfileCommands.ReadAccountExportCaptureIdentities,
          { ...grant, handleId: descriptor.handleId, offset, limit: 100 }
        );
        expect(page.captureId).toBe(descriptor.captureId);
        expect(page.snapshotAt).toBe(descriptor.snapshotAt);
        expect(page.total).toBe(expectedIds.length);
        capturedIds.push(...page.profileIds);
        if (page.nextOffset === null) break;
        expect(page.nextOffset).toBeGreaterThan(offset);
        offset = page.nextOffset;
      }
      expect(capturedIds).toEqual(expectedIds);
      expect(capturedIds).not.toContain(lateId);
      await expect(
        rpc(profileClient, ProfileCommands.ReleaseAccountExportCapture, {
          ...grant,
          leaseOwner: randomUUID(),
          handleId: descriptor.handleId,
        })
      ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_NOT_FOUND' });
      await expect(
        rpc(profileClient, ProfileCommands.ReadAccountExportCapture, {
          ...grant,
          handleId: descriptor.handleId,
          offset: 0,
          length: 65537,
        })
      ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_INVALID_RANGE' });
      const blocks: Buffer[] = [];
      offset = 0;
      while (offset < descriptor.sizeBytes) {
        const result = await rpc<AccountExportSnapshotReadResult>(
          profileClient,
          ProfileCommands.ReadAccountExportCapture,
          { ...grant, handleId: descriptor.handleId, offset, length: 65536 }
        );
        expect(result.captureId).toBe(descriptor.captureId);
        expect(result.offset).toBe(offset);
        const bytes = Buffer.from(result.bytesBase64, 'base64');
        expect(bytes.length).toBe(
          Math.min(65536, descriptor.sizeBytes - offset)
        );
        blocks.push(bytes);
        offset += bytes.length;
        expect(result.eof).toBe(offset === descriptor.sizeBytes);
      }
      const bytes = Buffer.concat(blocks);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        descriptor.sha256
      );
      const verifier = new AccountExportOwnerCaptureVerifier(
        'profile',
        otherAccountId,
        PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
        createHash('sha256')
      );
      const pages = bytes
        .toString('utf8')
        .trimEnd()
        .split('\n')
        .map((line) => JSON.parse(line));
      expect(pages.map((page) => verifier.accept(page)).at(-1)).toBe(true);
      expect(
        pages
          .flatMap((page) => page.records)
          .filter((row) => row.source === 'profileIdentity')
          .map((row) => row.data.id)
      ).toEqual(expectedIds);
      expect(bytes.toString('utf8')).not.toContain(accountId);
      await authDb.query(
        `UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE id=$1`,
        [jobId]
      );
      await expect(
        rpc(profileClient, ProfileCommands.ReadAccountExportCapture, {
          ...grant,
          handleId: descriptor.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      await authDb.query(
        `UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()+interval '5 minutes' WHERE id=$1`,
        [jobId]
      );
      const containerId = process.env.ACCOUNT_EXPORT_SNAPSHOT_PROFILE_ID;
      if (containerId) {
        if (!/^[a-f0-9]{64}$/.test(containerId))
          throw Error('Invalid private Profile container');
        const run = promisify(execFile);
        const labels = JSON.parse(
          (
            await run(
              'docker',
              ['inspect', '--format', '{{json .Config.Labels}}', containerId],
              { timeout: 10000 }
            )
          ).stdout
        );
        expect(labels['com.docker.compose.project']).toBe('ot-df007-snapshot');
        expect(labels['com.docker.compose.service']).toBe('profile');
        expect(
          labels['io.optimistic-tanuki.account-rights.private-project']
        ).toBe('ot-df007-snapshot');
        const old = descriptor;
        await profileClient.close();
        await run('docker', ['restart', '--time', '5', containerId], {
          timeout: 20000,
        });
        const host = globalThis.socketConnectionOptions?.host || '127.0.0.1';
        const until = Date.now() + 20000;
        while (true) {
          profileClient = ClientProxyFactory.create({
            transport: Transport.TCP,
            options: { host, port: 3002 },
          });
          try {
            await rpc(
              profileClient,
              ProfileCommands.ReadAccountExportCapture,
              {
                ...grant,
                handleId: old.handleId,
                offset: 0,
                length: 1,
              },
              1500
            );
            throw Error('Restarted Profile accepted an old snapshot handle');
          } catch (error) {
            const failure = error as {
              code?: string;
              name?: string;
              message?: string;
            };
            if (failure.code === 'OWNER_SNAPSHOT_NOT_FOUND') break;
            const transient =
              failure.name === 'TimeoutError' ||
              ['ECONNREFUSED', 'ECONNRESET'].includes(failure.code || '') ||
              failure.message === 'Connection closed';
            if (!transient || Date.now() >= until) throw error;
          }
          await profileClient.close();
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        descriptor = await open();
        expect(descriptor.handleId).not.toBe(old.handleId);
        expect(descriptor.captureId).not.toBe(old.captureId);
        expect(descriptor.identityCount).toBe(expectedIds.length + 1);
      }
      await rpc(authClient, AuthCommands.Logout, { token: otherSessionToken });
      await expect(
        rpc(profileClient, ProfileCommands.ReadAccountExportCapture, {
          ...grant,
          handleId: descriptor.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      await rpc(profileClient, ProfileCommands.ReleaseAccountExportCapture, {
        ...grant,
        handleId: descriptor.handleId,
      });
      await rpc(profileClient, ProfileCommands.ReleaseAccountExportCapture, {
        ...grant,
        handleId: descriptor.handleId,
      });
      descriptor = undefined;
    } finally {
      if (descriptor)
        await rpc(profileClient, ProfileCommands.ReleaseAccountExportCapture, {
          ...grant,
          handleId: descriptor.handleId,
        }).catch(() => undefined);
      await profileDb.query(
        'DELETE FROM profile WHERE id=ANY($1::uuid[]) AND "userId"=$2',
        [allExtraIds, otherAccountId]
      );
      await authDb.query(
        'DELETE FROM account_export_jobs WHERE id=$1 AND "accountId"=$2',
        [jobId, otherAccountId]
      );
      await profileDb.end();
      await authDb.end();
    }
  }, 120000);

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
