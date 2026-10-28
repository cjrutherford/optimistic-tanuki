import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { ForumCommands, WorkspaceCommands } from '@optimistic-tanuki/constants';
import {
  ACCOUNT_DELETION_OWNERS,
  DELETED_ACCOUNT_ID as nil,
  isResolvedWorkspace,
} from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
import { AccountDeletionOperationEntity } from '../../../authentication/src/account-deletion/account-deletion-operation.entity';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';
import { AccountDeletionController } from '../../../authentication/src/account-deletion/account-deletion.controller';
import { AppService } from '../../../authentication/src/app/app.service';
import forumLoad from '../../../forum/src/app/loadDatabase';
import workspaceLoad from '../../../workspace/src/app/loadDatabase';
import { ForumAccountDeletionOwnerService } from '../../../forum/src/app/account-deletion-owner.service';
import { ForumAccountDeletionOwnerController } from '../../../forum/src/app/account-deletion-owner.controller';
import { ForumAuditErasureService } from '../../../forum/src/app/audit-erasure.service';
import { WorkspaceAccountDeletionOwnerService } from '../../../workspace/src/app/account-deletion-owner.service';
import { WorkspaceAccountDeletionOwnerController } from '../../../workspace/src/app/account-deletion-owner.controller';
import { AppController as WorkspaceController } from '../../../workspace/src/app/app.controller';
import { WorkspaceService } from '../../../workspace/src/app/services/workspace.service';
import { Workspace } from '../../../workspace/src/entities/workspace.entity';
import { validateForumDispositions } from '../../../forum/src/app/forum-account-export-dispositions';
import forumInventory from '../../../forum/src/app/forum-account-export-dispositions.json';
import { validateWorkspaceDispositions } from '../../../workspace/src/app/workspace-account-export-dispositions';
import workspaceInventory from '../../../workspace/src/app/workspace-account-export-dispositions.json';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const gated = process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture';
(gated ? describe : describe.skip)(
  'D07/D08 real Auth, Forum and Workspace TCP with three migrated PostgreSQL databases',
  () => {
    const account = randomUUID(),
      profile = randomUUID(),
      profile2 = randomUUID(),
      other = randomUUID(),
      otherProfile = randomUUID(),
      ids: Record<string, any> = {};
    const pair = { userId: account, profileId: profile },
      foreign = { userId: other, profileId: otherProfile };
    const created: {
      db: DataSource;
      table: string;
      keys: Record<string, unknown>;
    }[] = [];
    let authDb: DataSource,
      forum: DataSource,
      workspace: DataSource,
      authority: AccountDeletionAuthorityService,
      operation = '',
      authApp: any,
      forumApp: any,
      workspaceApp: any,
      authClient: any,
      forumClient: any,
      workspaceClient: any;
    let authBefore: Record<string, number>,
      forumBefore: Record<string, number>,
      workspaceBefore: Record<string, number>,
      foreignThread: any,
      foreignPost: any,
      foreignWorkspace: any;
    const oldKey = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    async function port() {
      const s = createServer();
      await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
      const p = (s.address() as any).port;
      await new Promise<void>((r, j) => s.close((e) => (e ? j(e) : r())));
      return p;
    }
    const call = (client: any, cmd: string, value: unknown, raw = false) =>
      firstValueFrom(
        client.send(raw ? cmd : { cmd }, value).pipe(timeout(20000))
      ) as Promise<any>;
    const names = (db: DataSource) =>
      db.entityMetadatas.map((m) => m.tableName).sort();
    const counts = async (db: DataSource, tables: string[]) =>
      Object.fromEntries(
        await Promise.all(
          tables.map(async (t) => [
            t,
            Number((await db.query(`SELECT count(*) AS n FROM "${t}"`))[0].n),
          ])
        )
      );
    const row = async (db: DataSource, table: string, id: any) =>
      (
        await db.query(
          `SELECT to_jsonb(t) AS row FROM "${table}" t WHERE id=$1`,
          [id]
        )
      )[0]?.row;
    async function seed(
      db: DataSource,
      table: string,
      overrides: Record<string, unknown>
    ) {
      const meta = db.entityMetadatas.find((m) => m.tableName === table);
      if (!meta) throw Error('FIXTURE_METADATA');
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
          : t === Number || ['int', 'integer'].includes(String(t))
          ? 0
          : t === Date || ['timestamp', 'timestamptz'].includes(String(t))
          ? new Date('2026-01-01')
          : t === 'jsonb'
          ? '{}'
          : 'fixture';
      }
      const cols = Object.keys(data);
      const result = (
        await db.query(
          `INSERT INTO "${table}" (${cols
            .map((c) => `"${c}"`)
            .join(',')}) VALUES (${cols
            .map((_, i) => `$${i + 1}`)
            .join(',')}) RETURNING *`,
          Object.values(data)
        )
      )[0];
      created.push({
        db,
        table,
        keys: Object.fromEntries(
          meta.primaryColumns.map((c) => [
            c.databaseName,
            result[c.databaseName],
          ])
        ),
      });
      return result.id ?? result;
    }
    async function serve(controllers: any[], providers: any[]) {
      const m = await Test.createTestingModule({
        controllers,
        providers,
      }).compile();
      const p = await port();
      const app = m.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: p },
        logger: false,
      });
      await app.listen();
      const client = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: p },
      });
      return { app, client };
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
      authDb = new DataSource({
        ...common,
        database: 'd00',
        entities: [AccountDeletionOperationEntity],
      });
      forum = new DataSource({
        ...forumLoad({ get: () => ({}) } as never),
        ...common,
        database: 'd07_forum',
      });
      workspace = new DataSource({
        ...workspaceLoad({ get: () => ({}) } as never),
        ...common,
        database: 'd08_workspace',
      });
      await Promise.all([
        authDb.initialize(),
        forum.initialize(),
        workspace.initialize(),
      ]);
      for (const [db, validate, inventory] of [
        [forum, validateForumDispositions, forumInventory],
        [workspace, validateWorkspaceDispositions, workspaceInventory],
      ] as const) {
        const physical = await db.query(
          `SELECT table_name AS "table",array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name`
        );
        expect(validate(db.entityMetadatas, inventory, physical)).toEqual([]);
      }
      authBefore = await counts(authDb, [
        'account_deletion_operations',
        'account_deletion_write_fence',
      ]);
      forumBefore = await counts(forum, names(forum));
      workspaceBefore = await counts(workspace, names(workspace));
      expect(
        Object.values({ ...forumBefore, ...workspaceBefore }).every(
          (n) => n === 0
        )
      ).toBe(true);
      authority = new AccountDeletionAuthorityService(
        authDb.getRepository(AccountDeletionOperationEntity),
        authDb
      );
      const a = await serve(
        [AccountDeletionController],
        [
          { provide: AccountDeletionAuthorityService, useValue: authority },
          {
            provide: AppService,
            useValue: {
              validateToken: () => {
                throw Error('NO_SESSION_ALLOWED');
              },
            },
          },
        ]
      );
      authApp = a.app;
      authClient = a.client;
      const authorityClient = new AccountDeletionAuthorityClient(authClient);
      const forumOwner = new ForumAccountDeletionOwnerService(
        forum,
        authorityClient,
        new ForumAuditErasureService(forum)
      );
      const workspaceOwner = new WorkspaceAccountDeletionOwnerService(
        workspace,
        authorityClient
      );
      for (const owner of [forumOwner, workspaceOwner]) {
        const execute = owner.execute.bind(owner);
        owner.execute = async (value, action) => {
          try {
            return await execute(value, action);
          } catch (error) {
            console.error(
              'D07/D08 private owner diagnostic',
              action,
              error instanceof Error ? error.message : 'unknown'
            );
            throw error;
          }
        };
      }
      const f = await serve(
        [ForumAccountDeletionOwnerController],
        [{ provide: ForumAccountDeletionOwnerService, useValue: forumOwner }]
      );
      forumApp = f.app;
      forumClient = f.client;
      const w = await serve(
        [WorkspaceAccountDeletionOwnerController, WorkspaceController],
        [
          {
            provide: WorkspaceAccountDeletionOwnerService,
            useValue: workspaceOwner,
          },
          {
            provide: WorkspaceService,
            useValue: new WorkspaceService(workspace.getRepository(Workspace)),
          },
        ]
      );
      workspaceApp = w.app;
      workspaceClient = w.client;
      operation = (
        await authority.accept(account, 'client-interface', randomUUID())
      ).id;
      await authority.claim(operation);
      await authority.recordProfileScope(
        await authority.issueGrant(operation, 'profile', 'fence'),
        { currentProfileIds: [profile, profile2].sort(), legacyProfileIds: [] }
      );
      ids['topic'] = await seed(forum, 'topic', {
        ...pair,
        title: 'PRIVATE-TOPIC',
        description: 'PRIVATE-TOPIC-DESCRIPTION',
        appScope: 'client-interface',
        visibility: 'private',
      });
      ids['foreignTopic'] = await seed(forum, 'topic', {
        ...foreign,
        title: 'Counterpart topic',
        description: 'Counterpart description',
        appScope: 'local-hub',
      });
      ids['thread'] = await seed(forum, 'thread', {
        ...pair,
        topicId: ids['topic'],
        title: 'PRIVATE-THREAD',
        description: 'PRIVATE-DESCRIPTION',
        content: 'PRIVATE-BODY',
        visibility: 'private',
        appScope: 'client-interface',
      });
      ids['foreignThread'] = await seed(forum, 'thread', {
        ...foreign,
        topicId: ids['topic'],
        title: 'Counterpart thread',
        content: 'Counterpart thread body',
        description: 'Counterpart thread description',
        appScope: 'local-hub',
      });
      ids['ownPost'] = await seed(forum, 'forum_post', {
        ...pair,
        threadId: ids['foreignThread'],
        content: 'PRIVATE-POST',
        appScope: 'client-interface',
      });
      ids['secondOwnPost'] = await seed(forum, 'forum_post', {
        userId: account,
        profileId: profile2,
        threadId: ids['foreignThread'],
        content: 'SECOND-PRIVATE-POST',
        appScope: 'local-hub',
      });
      ids['foreignPost'] = await seed(forum, 'forum_post', {
        ...foreign,
        threadId: ids['thread'],
        content: 'Counterpart reply',
        appScope: 'local-hub',
      });
      ids['ownLink'] = await seed(forum, 'forum_link', {
        url: 'https://own.example/private',
        title: 'PRIVATE-LINK-TITLE',
      });
      ids['sharedLink'] = await seed(forum, 'forum_link', {
        url: 'https://shared.example/resource',
        title: 'Shared link metadata',
      });
      await seed(forum, 'forum_post_links_forum_link', {
        forumPostId: ids['ownPost'],
        forumLinkId: ids['ownLink'],
      });
      await seed(forum, 'forum_post_links_forum_link', {
        forumPostId: ids['ownPost'],
        forumLinkId: ids['sharedLink'],
      });
      await seed(forum, 'forum_post_links_forum_link', {
        forumPostId: ids['foreignPost'],
        forumLinkId: ids['sharedLink'],
      });
      ids['ownReport'] = await seed(forum, 'forum_report', {
        reporterId: profile,
        contentType: 'post',
        contentId: ids['foreignPost'],
        reason: 'spam',
        description: 'PRIVATE-REPORT',
        adminNotes: 'PRIVATE-ADMIN',
      });
      ids['targetReport'] = await seed(forum, 'forum_report', {
        reporterId: otherProfile,
        contentType: 'post',
        contentId: ids['ownPost'],
        reason: 'spam',
        description: 'PRIVATE-CONTEXT',
        adminNotes: 'PRIVATE-CONTEXT',
      });
      ids['ownAudit'] = await seed(forum, 'forum_moderation_action', {
        actorProfileId: profile,
        action: 'content_moderation',
        subjectType: 'thread',
        subjectId: ids['foreignThread'],
        details: '{"private":"actor-context"}',
        appScope: 'local-hub',
      });
      ids['foreignAudit'] = await seed(forum, 'forum_moderation_action', {
        actorProfileId: otherProfile,
        action: 'content_moderation',
        subjectType: 'thread',
        subjectId: ids['thread'],
        details: '{"private":"subject-context"}',
        appScope: 'local-hub',
      });
      ids['reportAudit'] = await seed(forum, 'forum_moderation_action', {
        actorProfileId: otherProfile,
        action: 'report_status',
        subjectType: 'post',
        subjectId: ids['foreignPost'],
        details: JSON.stringify({
          reportId: ids['ownReport'],
          private: 'report-context',
        }),
        appScope: 'local-hub',
      });
      ids['workspace'] = await seed(workspace, 'workspaces', {
        kind: 'community',
        slug: `owner-${profile}`,
        displayName: 'PRIVATE-STEWARD-LABEL',
        appScope: 'local-hub',
        ownerUserId: account,
        ownerProfileId: profile,
        status: 'active',
        sourceService: 'social',
        sourceId: ids['foreignTopic'],
      });
      for (const [name, p] of [
        ['config', profile],
        ['config2', profile2],
      ])
        ids[name] = await seed(workspace, 'workspaces', {
          kind: 'business-site',
          slug: `config-${p}`,
          displayName: 'PRIVATE-CONFIG-LABEL',
          appScope: 'local-hub',
          ownerUserId: account,
          ownerProfileId: p,
          status: 'active',
          sourceService: 'app-configurator',
          sourceId: p,
        });
      // This Social source ID is an opaque resource UUID even though it equals the deleting profile UUID.
      ids['foreignWorkspace'] = await seed(workspace, 'workspaces', {
        kind: 'community',
        slug: 'counterpart-community',
        displayName: 'Counterpart community',
        appScope: 'local-hub',
        ownerUserId: other,
        ownerProfileId: otherProfile,
        status: 'active',
        sourceService: 'social',
        sourceId: profile,
      });
      foreignThread = await row(forum, 'thread', ids['foreignThread']);
      foreignPost = await row(forum, 'forum_post', ids['foreignPost']);
      foreignWorkspace = await row(
        workspace,
        'workspaces',
        ids['foreignWorkspace']
      );
    }, 30000);
    afterAll(async () => {
      try {
        for (const db of [forum, workspace])
          if (db?.isInitialized) {
            await db
              .query('DROP TRIGGER IF EXISTS d07_fault ON forum_post')
              .catch(() => {});
            await db
              .query('DROP TRIGGER IF EXISTS d08_fault ON workspaces')
              .catch(() => {});
            await db.query('DROP FUNCTION IF EXISTS d07_fault()');
            await db.query('DROP FUNCTION IF EXISTS d08_fault()');
            await db.transaction(async (m) => {
              if (operation)
                await m.query(
                  "SELECT set_config('ot.deletion_operation',$1,true)",
                  [operation]
                );
              for (const item of [...created]
                .reverse()
                .filter((x) => x.db === db)) {
                const fields = Object.keys(item.keys);
                await m.query(
                  `DELETE FROM "${item.table}" WHERE ${fields
                    .map((c, i) => `"${c}"=$${i + 1}`)
                    .join(' AND ')}`,
                  Object.values(item.keys)
                );
              }
              await m.query(
                'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
                [operation]
              );
            });
            expect(await counts(db, names(db))).toEqual(
              db === forum ? forumBefore : workspaceBefore
            );
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
          expect(await counts(authDb, Object.keys(authBefore))).toEqual(
            authBefore
          );
        }
      } finally {
        forumClient?.close();
        workspaceClient?.close();
        authClient?.close();
        await forumApp?.close();
        await workspaceApp?.close();
        await authApp?.close();
        for (const db of [forum, workspace, authDb])
          if (db?.isInitialized) await db.destroy();
        if (oldKey === undefined)
          delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
        else process.env['ACCOUNT_DELETION_PROOF_KEY'] = oldKey;
      }
    }, 30000);
    it('drains both owners, preserves counterpart containers, retries failures and proves independent readback', async () => {
      await expect(
        call(
          forumClient,
          ForumCommands.FENCE_ACCOUNT_DELETION,
          await authority.issueGrant(operation, 'workspace', 'fence')
        )
      ).rejects.toBeTruthy();
      await expect(
        call(
          workspaceClient,
          WorkspaceCommands.FENCE_ACCOUNT_DELETION,
          await authority.issueGrant(operation, 'forum', 'fence')
        )
      ).rejects.toBeTruthy();
      for (const [db, client, cmd, owner, table, id] of [
        [
          forum,
          forumClient,
          ForumCommands.FENCE_ACCOUNT_DELETION,
          'forum',
          'forum_post',
          ids['ownPost'],
        ],
        [
          workspace,
          workspaceClient,
          WorkspaceCommands.FENCE_ACCOUNT_DELETION,
          'workspace',
          'workspaces',
          ids['workspace'],
        ],
      ] as const) {
        const writer = db.createQueryRunner();
        await writer.connect();
        await writer.startTransaction();
        await writer.query(
          `UPDATE "${table}" SET "updatedAt"="updatedAt" WHERE id=$1`,
          [id]
        );
        const grant = await authority.issueGrant(operation, owner, 'fence');
        let finished = false;
        const pending = call(client, cmd, grant).finally(() => {
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
        await authority.acknowledge(grant);
      }
      for (const [sql, args] of [
        [
          'UPDATE forum_post SET "profileId"=$2,"userId"=$3 WHERE id=$1',
          [ids['ownPost'], otherProfile, other],
        ],
        [
          'UPDATE forum_post SET "profileId"=$2,"userId"=$3 WHERE id=$1',
          [ids['foreignPost'], profile, account],
        ],
        [
          'INSERT INTO forum_post(content,"userId","profileId","threadId") VALUES(\'late\',$1,$2,$3)',
          [other, otherProfile, ids['thread']],
        ],
        [
          "UPDATE forum_link SET title='late cache' WHERE id=$1",
          [ids['sharedLink']],
        ],
      ] as [string, unknown[]][])
        await expect(forum.query(sql, args)).rejects.toThrow(
          'ACCOUNT_DELETION_FENCED'
        );
      for (const [id, a, p] of [
        [ids['workspace'], other, otherProfile],
        [ids['foreignWorkspace'], account, profile],
      ])
        await expect(
          workspace.query(
            'UPDATE workspaces SET "ownerUserId"=$2,"ownerProfileId"=$3 WHERE id=$1',
            [id, a, p]
          )
        ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      // Other owners are declared fixture premises; this test does not execute their fences.
      await authDb.query(
        'UPDATE account_deletion_operations SET "ownerProgress"=$2::jsonb WHERE id=$1',
        [
          operation,
          JSON.stringify(
            Object.fromEntries(
              ACCOUNT_DELETION_OWNERS.map((o) => [o, { fence: true }])
            )
          ),
        ]
      );
      for (const [db, client, cmd, owner, table, fault] of [
        [forum, forumClient, ForumCommands, 'forum', 'forum_post', 'd07_fault'],
        [
          workspace,
          workspaceClient,
          WorkspaceCommands,
          'workspace',
          'workspaces',
          'd08_fault',
        ],
      ] as const) {
        const grant = await authority.issueGrant(operation, owner, 'erase');
        await db.query(
          `CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_DELETION_FAILURE';END $$`
        );
        await db.query(
          `CREATE TRIGGER ${fault} AFTER ${
            owner === 'forum' ? 'DELETE' : 'UPDATE'
          } ON "${table}" FOR EACH ROW EXECUTE FUNCTION ${fault}()`
        );
        await expect(
          call(client, cmd.ERASE_ACCOUNT_DELETION, grant)
        ).rejects.toBeTruthy();
        if (owner === 'forum')
          expect((await row(db, 'forum_post', ids['ownPost'])).content).toBe(
            'PRIVATE-POST'
          );
        else
          expect(
            (await row(db, 'workspaces', ids['workspace'])).ownerUserId
          ).toBe(account);
        await db.query(`DROP TRIGGER ${fault} ON "${table}"`);
        await db.query(`DROP FUNCTION ${fault}()`);
        expect(await call(client, cmd.ERASE_ACCOUNT_DELETION, grant)).toEqual({
          verified: true,
          remaining: 0,
        });
        expect(await call(client, cmd.ERASE_ACCOUNT_DELETION, grant)).toEqual({
          verified: true,
          remaining: 0,
        });
        await authority.acknowledge(grant);
        expect(
          await call(
            client,
            cmd.READBACK_ACCOUNT_DELETION,
            await authority.issueGrant(operation, owner, 'readback')
          )
        ).toEqual({ verified: true, remaining: 0 });
      }
      expect(await row(forum, 'thread', ids['foreignThread'])).toEqual(
        foreignThread
      );
      expect(await row(forum, 'forum_post', ids['foreignPost'])).toEqual(
        foreignPost
      );
      expect(
        await row(workspace, 'workspaces', ids['foreignWorkspace'])
      ).toEqual(foreignWorkspace);
      expect(await row(forum, 'thread', ids['thread'])).toMatchObject({
        userId: nil,
        profileId: nil,
        title: 'Deleted account',
        content: 'Deleted account',
        visibility: 'private',
      });
      expect(await row(forum, 'topic', ids['topic'])).toMatchObject({
        userId: nil,
        profileId: nil,
        title: 'Deleted account',
        visibility: 'private',
      });
      expect(await row(forum, 'forum_post', ids['ownPost'])).toBeUndefined();
      expect(
        await row(forum, 'forum_post', ids['secondOwnPost'])
      ).toBeUndefined();
      expect(await row(forum, 'forum_link', ids['ownLink'])).toBeUndefined();
      expect(await row(forum, 'forum_link', ids['sharedLink'])).toMatchObject({
        url: 'https://shared.example/resource',
        title: 'Shared link metadata',
      });
      expect(await row(forum, 'forum_report', ids['ownReport'])).toMatchObject({
        reporterId: nil,
        contentId: ids['foreignPost'],
        description: null,
        adminNotes: null,
      });
      expect(
        await row(forum, 'forum_report', ids['targetReport'])
      ).toMatchObject({
        reporterId: otherProfile,
        contentId: nil,
        description: null,
        adminNotes: null,
      });
      expect(
        await row(forum, 'forum_moderation_action', ids['ownAudit'])
      ).toMatchObject({ actorProfileId: null, subjectId: null, details: {} });
      expect(
        await row(forum, 'forum_moderation_action', ids['foreignAudit'])
      ).toMatchObject({
        actorProfileId: otherProfile,
        subjectId: null,
        details: {},
      });
      expect(
        await row(forum, 'forum_moderation_action', ids['reportAudit'])
      ).toMatchObject({
        actorProfileId: otherProfile,
        subjectId: ids['foreignPost'],
        details: {},
      });
      const resolved = await call(
        workspaceClient,
        WorkspaceCommands.RESOLVE_BY_SOURCE,
        {
          appScope: 'local-hub',
          source: { service: 'social', sourceId: ids['foreignTopic'] },
          requireActive: true,
        },
        true
      );
      expect(resolved).toMatchObject({
        workspaceId: ids['workspace'],
        ownerUserId: nil,
        ownerProfileId: nil,
        status: 'active',
        displayName: 'Deleted account workspace',
        slug: `deleted-${ids['workspace']}`,
      });
      expect(isResolvedWorkspace(resolved)).toBe(true);
      for (const name of ['config', 'config2']) {
        const item = await row(workspace, 'workspaces', ids[name]);
        expect(item).toMatchObject({
          ownerUserId: nil,
          ownerProfileId: nil,
          sourceId: nil,
          displayName: 'Deleted account workspace',
        });
        expect(
          isResolvedWorkspace({
            ...item,
            workspaceId: item.id,
            source: { service: item.sourceService, sourceId: item.sourceId },
          })
        ).toBe(true);
      }
      expect(
        await call(
          workspaceClient,
          WorkspaceCommands.LIST_OWNED,
          { ownerUserId: account, ownerProfileId: profile },
          true
        )
      ).toEqual([]);
      await expect(
        forum.query("UPDATE thread SET content='resurrected' WHERE id=$1", [
          ids['thread'],
        ])
      ).rejects.toThrow('FORUM_DELETED_CONTAINER');
      await expect(
        workspace.query(
          'UPDATE workspaces SET "ownerUserId"=$2,"ownerProfileId"=$3 WHERE id=$1',
          [ids['workspace'], other, otherProfile]
        )
      ).rejects.toThrow('WORKSPACE_DELETED_STEWARDSHIP');
      await expect(
        workspace.query('UPDATE workspaces SET "sourceId"=$2 WHERE id=$1', [
          ids['config'],
          profile,
        ])
      ).rejects.toThrow();
      for (const table of ['forum_report', 'forum_moderation_action']) {
        const id = randomUUID();
        created.push({ db: forum, table, keys: { id } });
        if (table === 'forum_report')
          await expect(
            forum.query(
              'INSERT INTO forum_report(id,"reporterId","contentType","contentId",reason,description) VALUES($1,$2,\'thread\',$3,\'spam\',\'STALE_PRIVATE_CONTEXT\')',
              [id, otherProfile, ids['thread']]
            )
          ).rejects.toThrow('FORUM_DELETED_CONTAINER');
        else
          await expect(
            forum.query(
              'INSERT INTO forum_moderation_action(id,"actorProfileId",action,"subjectType","subjectId",details,"appScope") VALUES($1,$2,\'content_moderation\',\'thread\',$3,\'{"private":"STALE_CONTEXT"}\'::jsonb,\'local-hub\')',
              [id, otherProfile, ids['thread']]
            )
          ).rejects.toThrow('FORUM_DELETED_CONTAINER');
      }
      await forum.query(
        'UPDATE thread SET "viewCount"="viewCount"+1 WHERE id=$1',
        [ids['thread']]
      );
      await forum.query(
        "UPDATE forum_post SET content='Counterpart edited' WHERE id=$1",
        [ids['foreignPost']]
      );
      await forum.query(
        "UPDATE forum_link SET title='Counterpart shared metadata' WHERE id=$1",
        [ids['sharedLink']]
      );
    }, 60000);
  }
);
