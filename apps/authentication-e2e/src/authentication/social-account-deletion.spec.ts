import inventory from '../../../social/src/app/social-account-export-dispositions.json';
import { validateSocialDispositions } from '../../../social/src/app/social-account-export-dispositions';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { SocialCommands } from '@optimistic-tanuki/constants';
import {
  ACCOUNT_DELETION_OWNERS,
  DELETED_ACCOUNT_ID,
} from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
import { AccountDeletionOperationEntity } from '../../../authentication/src/account-deletion/account-deletion-operation.entity';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';
import { AccountDeletionController } from '../../../authentication/src/account-deletion/account-deletion.controller';
import { AppService } from '../../../authentication/src/app/app.service';
import loadDatabase from '../../../social/src/app/loadDatabase';
import { SocialAccountDeletionOwnerService } from '../../../social/src/app/account-deletion-owner.service';
import { SocialAccountDeletionOwnerController } from '../../../social/src/app/account-deletion-owner.controller';
import { SocialAccountDeletionContentService } from '../../../social/src/app/account-deletion-content.service';
import { SocialAccountDeletionStateService } from '../../../social/src/app/account-deletion-state.service';
import { SocialAccountDeletionRelatedService } from '../../../social/src/app/account-deletion-related.service';
import { SocialAuditErasureService } from '../../../social/src/app/audit-erasure.service';
import { NotificationService } from '../../../social/src/app/services/notification.service';
import { Notification } from '../../../social/src/entities/notification.entity';
import { SOCIAL_DELETION_COLUMNS } from '../../../social/src/app/account-deletion-columns';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const gated = process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture';
(gated ? describe : describe.skip)(
  'D06 Social deletion: real Auth/Social TCP and two migrated databases',
  () => {
    const account = randomUUID(),
      profile = randomUUID(),
      profile2 = randomUUID(),
      other = randomUUID(),
      otherProfile = randomUUID();
    let db: DataSource,
      authDb: DataSource,
      authority: AccountDeletionAuthorityService,
      notifications: NotificationService,
      authApp: any,
      socialApp: any,
      authClient: any,
      client: any,
      operation = '';
    const oldKey = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    const created: { table: string; keys: Record<string, unknown> }[] = [];
    const ids: Record<string, any> = {};
    const tables = Object.keys(SOCIAL_DELETION_COLUMNS);
    const call = (cmd: string, value: unknown) =>
      firstValueFrom(
        client.send({ cmd }, value).pipe(timeout(20000))
      ) as Promise<any>;
    const counts = async (source: DataSource, names: string[]) =>
      Object.fromEntries(
        await Promise.all(
          names.map(async (t) => [
            t,
            Number(
              (
                await source.query(`SELECT count(*) AS n FROM "${t}"`)
              )[0].n
            ),
          ])
        )
      );
    const read = async (table: string, id: any) =>
      (
        await db.query(
          `SELECT to_jsonb(t) AS row FROM "${table}" t WHERE id=$1`,
          [id]
        )
      )[0]?.row;
    const pair = { userId: account, profileId: profile };
    const foreign = { userId: other, profileId: otherProfile };
    let baseline: Record<string, number>,
      authBaseline: Record<string, number>,
      foreignPost: any,
      foreignReply: any;
    async function port() {
      const server = createServer();
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      const p = (server.address() as any).port;
      await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
      return p;
    }
    async function seed(
      table: string,
      overrides: Record<string, unknown> = {}
    ) {
      const meta = db.entityMetadatas.find((m) => m.tableName === table);
      if (!meta) throw Error('MISSING_METADATA');
      const data = { ...overrides };
      for (const c of meta.columns) {
        if (
          Object.prototype.hasOwnProperty.call(data, c.databaseName) ||
          c.isNullable ||
          c.default !== undefined ||
          c.isGenerated ||
          c.isCreateDate ||
          c.isUpdateDate
        )
          continue;
        const t = c.type;
        data[c.databaseName] = c.enum
          ? c.enum[0]
          : t === 'uuid'
          ? randomUUID()
          : t === Boolean || t === 'boolean'
          ? false
          : t === Number ||
            ['integer', 'int', 'numeric', 'float', 'double precision'].includes(
              String(t)
            )
          ? 0
          : t === Date ||
            ['timestamp', 'timestamptz', 'date'].includes(String(t))
          ? new Date('2026-01-01')
          : t === 'jsonb' || t === 'json'
          ? '{}'
          : t === 'simple-json'
          ? '[]'
          : t === 'simple-array'
          ? 'one,two'
          : 'fixture';
      }
      const names = Object.keys(data);
      const row = (
        await db.query(
          `INSERT INTO "${table}" (${names
            .map((n) => `"${n}"`)
            .join(',')}) VALUES (${names
            .map((_, i) => `$${i + 1}`)
            .join(',')}) RETURNING *`,
          Object.values(data)
        )
      )[0];
      const keys = Object.fromEntries(
        meta.primaryColumns.map((c) => [c.databaseName, row[c.databaseName]])
      );
      created.push({ table, keys });
      return row.id ?? row;
    }
    beforeAll(async () => {
      process.env['ACCOUNT_DELETION_PROOF_KEY'] =
        randomBytes(48).toString('base64url');
      const common = {
        type: 'postgres' as const,
        host: '127.0.0.1',
        port: Number(process.env['POSTGRES_PORT']),
        username: process.env['POSTGRES_USER'],
        password: process.env['POSTGRES_PASSWORD'],
        synchronize: false,
        migrationsRun: false,
        extra: { statement_timeout: 15000, lock_timeout: 5000 },
      };
      db = new DataSource({
        ...loadDatabase({
          get: () => ({ ...common, database: 'd06_social' }),
        } as never),
        ...common,
        database: 'd06_social',
      });
      authDb = new DataSource({
        ...common,
        database: 'd00',
        entities: [AccountDeletionOperationEntity],
      });
      await db.initialize();
      await authDb.initialize();
      const physical = await db.query(
        `SELECT table_name AS "table",array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name`
      );
      expect(
        validateSocialDispositions(db.entityMetadatas, inventory, physical)
      ).toEqual([]);
      baseline = await counts(db, tables);
      expect(Object.values(baseline).every((n) => n === 0)).toBe(true);
      authBaseline = await counts(authDb, [
        'account_deletion_operations',
        'account_deletion_write_fence',
      ]);
      authority = new AccountDeletionAuthorityService(
        authDb.getRepository(AccountDeletionOperationEntity),
        authDb
      );
      const authModule = await Test.createTestingModule({
        controllers: [AccountDeletionController],
        providers: [
          { provide: AccountDeletionAuthorityService, useValue: authority },
          {
            provide: AppService,
            useValue: {
              validateToken: () => {
                throw Error('NO_USER_SESSION');
              },
            },
          },
        ],
      }).compile();
      const authPort = await port();
      authApp = authModule.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: authPort },
        logger: false,
      });
      await authApp.listen();
      authClient = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: authPort },
      });
      notifications = new NotificationService(db.getRepository(Notification));
      const owner = new SocialAccountDeletionOwnerService(
        db,
        new AccountDeletionAuthorityClient(authClient),
        new SocialAccountDeletionContentService(),
        new SocialAccountDeletionStateService(),
        new SocialAccountDeletionRelatedService(),
        new SocialAuditErasureService(db),
        notifications
      );
      const execute = owner.execute.bind(owner);
      owner.execute = async (value, action) => {
        try {
          return await execute(value, action);
        } catch (error) {
          console.error(
            'D06 private owner diagnostic',
            action,
            error instanceof Error ? error.message : 'unknown'
          );
          throw error;
        }
      };
      const module = await Test.createTestingModule({
        controllers: [SocialAccountDeletionOwnerController],
        providers: [
          { provide: SocialAccountDeletionOwnerService, useValue: owner },
        ],
      }).compile();
      const socialPort = await port();
      socialApp = module.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: socialPort },
        logger: false,
      });
      await socialApp.listen();
      client = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: socialPort },
      });
      operation = (await authority.accept(account, 'local-hub', randomUUID()))
        .id;
      await authority.claim(operation);
      await authority.recordProfileScope(
        await authority.issueGrant(operation, 'profile', 'fence'),
        { currentProfileIds: [profile, profile2].sort(), legacyProfileIds: [] }
      );
      ids['community'] = await seed('community', {
        ownerId: account,
        ownerProfileId: profile,
        name: 'Shared community',
        description: 'Counterpart public community',
        isPrivate: true,
      });
      ids['ownPost'] = await seed('post', {
        ...pair,
        title: 'PRIVATE-OWN-TITLE',
        content: 'PRIVATE-OWN-CONTENT',
        appScope: 'client-interface',
        visibility: 'private',
        communityId: ids['community'],
      });
      ids['otherPost'] = await seed('post', {
        ...foreign,
        title: 'Counterpart title',
        content: 'Counterpart body',
        appScope: 'local-hub',
      });
      ids['ownComment'] = await seed('comment', {
        ...pair,
        postId: ids['ownPost'],
        content: 'PRIVATE-OWN-COMMENT',
      });
      ids['otherReply'] = await seed('comment', {
        ...foreign,
        postId: ids['ownPost'],
        parentId: ids['ownComment'],
        content: 'Counterpart reply',
      });
      ids['ownForeignComment'] = await seed('comment', {
        ...pair,
        postId: ids['otherPost'],
        content: 'PRIVATE-OWN-REPLY',
      });
      ids['ownVote'] = await seed('vote', {
        ...pair,
        postId: ids['otherPost'],
        value: 1,
      });
      ids['otherVote'] = await seed('vote', {
        ...foreign,
        commentId: ids['ownComment'],
        value: 1,
      });
      ids['ownReaction'] = await seed('reaction', {
        ...pair,
        postId: ids['otherPost'],
        value: 1,
      });
      ids['otherReaction'] = await seed('reaction', {
        ...foreign,
        postId: ids['ownPost'],
        value: 1,
      });
      await seed('attachment', {
        postId: ids['ownPost'],
        name: 'PRIVATE-ASSET-NAME',
        filePath: 'private-owned-path',
      });
      await seed('social_components', {
        postId: ids['ownPost'],
        componentData: JSON.stringify({ text: 'PRIVATE-OWN-COMPONENT' }),
      });
      ids['link'] = await seed('link', {
        url: 'https://counterpart.example/shared',
      });
      await seed('post_link', { postId: ids['ownPost'], linkId: ids['link'] });
      await seed('post_link', {
        postId: ids['otherPost'],
        linkId: ids['link'],
      });
      ids['poll'] = await seed('poll', {
        ...pair,
        question: 'PRIVATE-POLL',
        options: 'one,two,three',
        votes: [
          { userId: account, optionIndices: [0, 2] },
          { userId: other, optionIndices: [1] },
        ]
          .map((v) => JSON.stringify(v))
          .join(','),
      });
      ids['foreignPoll'] = await seed('poll', {
        ...foreign,
        question: 'Counterpart poll',
        options: 'one,two',
        votes: JSON.stringify({ userId: account, optionIndices: [0] }),
      });
      ids['event'] = await seed('event', {
        ...pair,
        title: 'PRIVATE-EVENT',
        privacy: 'private',
        attendeeIds: [profile, otherProfile].join(','),
        attendeeCount: 2,
      });
      ids['foreignEvent'] = await seed('event', {
        ...foreign,
        title: 'Counterpart event',
        attendeeIds: [profile2, otherProfile].join(','),
        attendeeCount: 2,
      });
      await seed('saved_item', {
        profileId: profile,
        itemType: 'post',
        itemId: ids['otherPost'],
        itemTitle: 'own cache',
      });
      ids['otherSaved'] = await seed('saved_item', {
        profileId: otherProfile,
        itemType: 'post',
        itemId: ids['ownPost'],
        itemTitle: 'PRIVATE-OWN-TITLE',
      });
      await seed('post_share', {
        sharedById: profile,
        originalPostId: ids['otherPost'],
      });
      ids['otherShare'] = await seed('post_share', {
        sharedById: otherProfile,
        originalPostId: ids['ownPost'],
        comment: 'Counterpart share text',
      });
      for (const [table, actor, target] of [
        ['follow_entity', 'followerId', 'followeeId'],
        ['user_block', 'blockerId', 'blockedId'],
        ['user_mute', 'muterId', 'mutedId'],
      ]) {
        await seed(table, { [actor]: profile, [target]: otherProfile });
        for (const p of [profile, profile2])
          await seed(table, { [actor]: otherProfile, [target]: p });
      }
      await seed('user_presence', { userId: account });
      await seed('search_history', {
        profileId: profile,
        query: 'PRIVATE-QUERY',
      });
      ids['member'] = await seed('community_member', {
        communityId: ids['community'],
        ...pair,
        status: 'approved',
      });
      ids['foreignMember'] = await seed('community_member', {
        communityId: ids['community'],
        ...foreign,
        status: 'approved',
      });
      await seed('community_invite', {
        communityId: ids['community'],
        inviterId: account,
        inviteeId: other,
        inviteeEmail: 'private@example.test',
        token: 'private-token',
      });
      await seed('notification', {
        recipientId: profile,
        type: 'mention',
        title: 'private',
        body: 'private',
      });
      ids['foreignNotification'] = await seed('notification', {
        recipientId: otherProfile,
        senderId: profile,
        type: 'mention',
        title: 'PRIVATE-IDENTITY',
        body: 'PRIVATE-IDENTITY',
        resourceType: 'profile',
        resourceId: profile,
        actionUrl: '/private',
      });
      ids['business'] = await seed('business_page_contents', {
        communityId: ids['community'],
        ownerId: account,
        name: 'Shared public business',
        phone: 'PRIVATE-PHONE',
        email: 'private@example.test',
        address: 'PRIVATE-ADDRESS',
      });
      ids['theme'] = await seed('business_theme_contents', {
        businessPageId: ids['business'],
        customCss: 'PRIVATE-CSS',
        customFontFamily: 'PRIVATE-FONT',
      });
      await seed('community_sponsorship_contents', {
        communityId: ids['community'],
        userId: account,
        adContent: 'PRIVATE-AD',
      });
      ids['audit'] = await seed('community_membership_audit', {
        actorId: other,
        subjectId: profile,
        workspaceId: ids['community'],
      });
      ids['guardian'] = await seed('guardian_content_audit', {
        actorUserId: other,
        dependentUserId: account,
        dependentProfileId: profile,
        appId: 'local-hub',
        resourceId: ids['ownPost'],
        changedFields: '["PRIVATE-FIELD"]',
      });
      await seed('guardian_published_asset_grant', {
        actorUserId: account,
        dependentProfileId: otherProfile,
        assetId: randomUUID(),
        resourceId: ids['otherPost'],
        appId: 'local-hub',
      });
      ids['activity'] = await seed('activity', {
        profileId: profile,
        description: 'PRIVATE-ACTIVITY',
      });
      ids['view'] = await seed('profile_view', {
        viewerId: other,
        profileId: profile,
        source: 'PRIVATE-PATH',
      });
      ids['report'] = await seed('content_report', {
        reporterId: otherProfile,
        contentType: 'post',
        contentId: ids['ownPost'],
        reason: 'spam',
        description: 'PRIVATE-CONTEXT',
        adminNotes: 'PRIVATE-NOTES',
      });
      ids['moderation'] = await seed('content_moderation_action', {
        actorProfileId: otherProfile,
        subjectType: 'post',
        subjectId: ids['ownPost'],
        reportId: ids['report'],
        details: '{"private":"context"}',
      });
      ids['election'] = await seed('community_election', {
        communityId: ids['community'],
        initiatedBy: account,
        winnerId: account,
        winnerProfileId: profile,
      });
      ids['candidate'] = await seed('election_candidate', {
        electionId: ids['election'],
        ...pair,
        voteCount: 1,
      });
      ids['otherCandidate'] = await seed('election_candidate', {
        electionId: ids['election'],
        ...foreign,
        voteCount: 1,
      });
      await seed('election_vote', {
        electionId: ids['election'],
        voterId: account,
        voterProfileId: profile,
        candidateId: ids['otherCandidate'],
        candidateUserId: other,
      });
      ids['foreignBallot'] = await seed('election_vote', {
        electionId: ids['election'],
        voterId: other,
        voterProfileId: otherProfile,
        candidateId: ids['candidate'],
        candidateUserId: account,
      });
      foreignPost = await read('post', ids['otherPost']);
      foreignReply = await read('comment', ids['otherReply']);
      await notifications.queueNotification({
        recipientId: profile,
        type: 'mention',
        title: 'private',
        body: 'private',
      });
      await notifications.queueNotification({
        recipientId: otherProfile,
        type: 'mention',
        title: 'private',
        body: 'private',
        resourceType: 'profile',
        resourceId: profile,
      });
    }, 30000);
    afterAll(async () => {
      try {
        await notifications?.onModuleDestroy();
        if (db?.isInitialized) {
          await db.query('DROP TRIGGER IF EXISTS d06_failure ON vote');
          await db.query('DROP FUNCTION IF EXISTS d06_failure()');
          await db.transaction(async (m) => {
            if (operation)
              await m.query(
                "SELECT set_config('ot.deletion_operation',$1,true)",
                [operation]
              );
            for (const entry of [...created].reverse()) {
              const fields = Object.keys(entry.keys);
              await m.query(
                `DELETE FROM "${entry.table}" WHERE ${fields
                  .map((k, i) => `"${k}"=$${i + 1}`)
                  .join(' AND ')}`,
                Object.values(entry.keys)
              );
            }
            await m.query(
              'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
              [operation]
            );
          });
          expect(await counts(db, tables)).toEqual(baseline);
        }
        if (authDb?.isInitialized && operation) {
          await authDb.query(
            'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
            [operation]
          );
          await authDb.query(
            'DELETE FROM account_deletion_operations WHERE id=$1',
            [operation]
          );
          expect(await counts(authDb, Object.keys(authBaseline))).toEqual(
            authBaseline
          );
        }
      } finally {
        client?.close();
        authClient?.close();
        await socialApp?.close();
        await authApp?.close();
        if (db?.isInitialized) await db.destroy();
        if (authDb?.isInitialized) await authDb.destroy();
        if (oldKey === undefined)
          delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
        else process.env['ACCOUNT_DELETION_PROOF_KEY'] = oldKey;
      }
    }, 30000);
    it('drains writers and erases only owned contributions, references and audit participation', async () => {
      await expect(
        call(
          SocialCommands.FENCE_ACCOUNT_DELETION,
          await authority.issueGrant(operation, 'permissions', 'fence')
        )
      ).rejects.toBeTruthy();
      const writer = db.createQueryRunner();
      await writer.connect();
      await writer.startTransaction();
      const lateId = randomUUID();
      await writer.query(
        'INSERT INTO post(id,title,content,"userId","profileId") VALUES($1,\'late\',\'late\',$2,$3)',
        [lateId, account, profile]
      );
      created.push({ table: 'post', keys: { id: lateId } });
      const fence = await authority.issueGrant(operation, 'social', 'fence');
      let finished = false;
      const pending = call(
        SocialCommands.FENCE_ACCOUNT_DELETION,
        fence
      ).finally(() => {
        finished = true;
      });
      try {
        let waiting = false;
        for (let i = 0; i < 80; i++) {
          if (
            Number(
              (
                await db.query(
                  "SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'"
                )
              )[0].n
            )
          ) {
            waiting = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 20));
        }
        expect(waiting).toBe(true);
        expect(finished).toBe(false);
        await writer.commitTransaction();
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
      }
      expect(await pending).toMatchObject({ verified: true });
      await authority.acknowledge(fence);
      expect((notifications as any).pendingNotifications.size).toBe(0);
      await notifications.queueNotification({
        recipientId: profile,
        type: 'mention',
        title: 'late',
        body: 'late',
      });
      expect((notifications as any).pendingNotifications.size).toBe(0);
      for (const [sql, args] of [
        [
          'UPDATE post SET "userId"=$2,"profileId"=$3 WHERE id=$1',
          [ids['ownPost'], other, otherProfile],
        ],
        [
          'UPDATE post SET "userId"=$2,"profileId"=$3 WHERE id=$1',
          [ids['otherPost'], account, profile],
        ],
        [
          'INSERT INTO comment(content,"userId","profileId","postId") VALUES(\'late\',$1,$2,$3)',
          [other, otherProfile, ids['ownPost']],
        ],
      ] as [string, unknown[]][])
        await expect(db.query(sql, args)).rejects.toThrow(
          'ACCOUNT_DELETION_FENCED'
        );
      // These are explicit control preconditions. This fixture does not run the other eleven owners.
      await authDb.query(
        'UPDATE account_deletion_operations SET "ownerProgress"=$2::jsonb WHERE id=$1',
        [
          operation,
          JSON.stringify(
            Object.fromEntries(
              ACCOUNT_DELETION_OWNERS.map((owner) => [owner, { fence: true }])
            )
          ),
        ]
      );
      const erase = await authority.issueGrant(operation, 'social', 'erase');
      await db.query(
        "CREATE FUNCTION d06_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'D06_INJECTED'; END $$"
      );
      await db.query(
        'CREATE TRIGGER d06_failure AFTER DELETE ON vote FOR EACH ROW EXECUTE FUNCTION d06_failure()'
      );
      await expect(
        call(SocialCommands.ERASE_ACCOUNT_DELETION, erase)
      ).rejects.toBeTruthy();
      expect((await read('post', ids['ownPost'])).content).toBe(
        'PRIVATE-OWN-CONTENT'
      );
      await db.query('DROP TRIGGER d06_failure ON vote');
      await db.query('DROP FUNCTION d06_failure()');
      expect(await call(SocialCommands.ERASE_ACCOUNT_DELETION, erase)).toEqual({
        verified: true,
        remaining: 0,
      });
      expect(await call(SocialCommands.ERASE_ACCOUNT_DELETION, erase)).toEqual({
        verified: true,
        remaining: 0,
      });
      await authority.acknowledge(erase);
      expect(
        await call(
          SocialCommands.READBACK_ACCOUNT_DELETION,
          await authority.issueGrant(operation, 'social', 'readback')
        )
      ).toEqual({ verified: true, remaining: 0 });
      expect(await read('post', ids['otherPost'])).toEqual(foreignPost);
      expect(await read('comment', ids['otherReply'])).toEqual(foreignReply);
      expect(await read('post', ids['ownPost'])).toMatchObject({
        userId: DELETED_ACCOUNT_ID,
        profileId: DELETED_ACCOUNT_ID,
        content: 'Deleted account',
        visibility: 'private',
      });
      expect(await read('comment', ids['ownComment'])).toMatchObject({
        content: 'Deleted account',
        userId: DELETED_ACCOUNT_ID,
      });
      expect(await read('link', ids['link'])).toMatchObject({
        url: 'https://counterpart.example/shared',
      });
      expect(await read('post_share', ids['otherShare'])).toMatchObject({
        sharedById: otherProfile,
        comment: 'Counterpart share text',
      });
      expect(await read('saved_item', ids['otherSaved'])).toMatchObject({
        profileId: otherProfile,
        itemTitle: null,
      });
      expect(await read('poll', ids['poll'])).toMatchObject({
        userId: DELETED_ACCOUNT_ID,
        votes: JSON.stringify({ userId: other, optionIndices: [1] }),
        isActive: false,
      });
      expect(await read('poll', ids['foreignPoll'])).toMatchObject({
        userId: other,
        votes: null,
      });
      expect(await read('event', ids['event'])).toMatchObject({
        userId: DELETED_ACCOUNT_ID,
        privacy: 'private',
        attendeeIds: otherProfile,
        attendeeCount: 1,
      });
      expect(await read('event', ids['foreignEvent'])).toMatchObject({
        userId: other,
        attendeeIds: otherProfile,
        attendeeCount: 1,
      });
      expect(await read('community', ids['community'])).toMatchObject({
        ownerId: DELETED_ACCOUNT_ID,
        ownerProfileId: DELETED_ACCOUNT_ID,
        isPrivate: true,
        memberCount: 1,
        name: 'Shared community',
      });
      expect(
        await read('community_member', ids['foreignMember'])
      ).toMatchObject(foreign);
      expect(await read('election_candidate', ids['candidate'])).toMatchObject({
        userId: DELETED_ACCOUNT_ID,
        profileId: DELETED_ACCOUNT_ID,
        isWithdrawn: true,
        voteCount: 1,
      });
      expect(
        await read('election_candidate', ids['otherCandidate'])
      ).toMatchObject({ ...foreign, voteCount: 0 });
      expect(await read('election_vote', ids['foreignBallot'])).toMatchObject({
        voterId: other,
        voterProfileId: otherProfile,
        candidateId: ids['candidate'],
        candidateUserId: DELETED_ACCOUNT_ID,
      });
      expect(
        await read('community_membership_audit', ids['audit'])
      ).toMatchObject({ actorId: other, subjectId: null, workspaceId: null });
      expect(
        await read('guardian_content_audit', ids['guardian'])
      ).toMatchObject({
        actorUserId: other,
        dependentUserId: null,
        dependentProfileId: null,
        resourceId: null,
        changedFields: '[]',
      });
      expect(await read('profile_view', ids['view'])).toMatchObject({
        viewerId: other,
        profileId: null,
        source: '',
      });
      expect(await read('content_report', ids['report'])).toMatchObject({
        reporterId: otherProfile,
        contentId: DELETED_ACCOUNT_ID,
        description: null,
        adminNotes: null,
      });
      expect(
        await read('content_moderation_action', ids['moderation'])
      ).toMatchObject({
        actorProfileId: otherProfile,
        subjectId: null,
        reportId: null,
        details: {},
      });
      expect(
        await read('business_page_contents', ids['business'])
      ).toMatchObject({
        ownerId: DELETED_ACCOUNT_ID,
        name: 'Shared public business',
        phone: null,
        email: null,
        address: null,
      });
      expect(await read('business_theme_contents', ids['theme'])).toMatchObject(
        { customCss: null, customFontFamily: null }
      );
      expect(
        await read('notification', ids['foreignNotification'])
      ).toMatchObject({
        recipientId: otherProfile,
        senderId: null,
        body: '',
        actionUrl: null,
      });
      for (const [sql, args] of [
        ["UPDATE post SET content='resurrected' WHERE id=$1", [ids['ownPost']]],
        [
          'UPDATE poll SET votes=$2 WHERE id=$1',
          [
            ids['foreignPoll'],
            JSON.stringify({ userId: account, optionIndices: [0] }),
          ],
        ],
        [
          'UPDATE event SET "attendeeIds"=$2 WHERE id=$1',
          [ids['foreignEvent'], [otherProfile, profile].join(',')],
        ],
      ] as [string, unknown[]][])
        await expect(db.query(sql, args)).rejects.toThrow();
      // Counterparts may still update their own content and withdraw their own remaining participation.
      await db.query(
        "UPDATE post SET content='Counterpart edited' WHERE id=$1",
        [ids['otherPost']]
      );
      await db.query('UPDATE poll SET votes=NULL WHERE id=$1', [ids['poll']]);
      await db.query(
        'UPDATE event SET "attendeeIds"=NULL,"attendeeCount"=0 WHERE id=$1',
        [ids['event']]
      );
    }, 60000);
  }
);
