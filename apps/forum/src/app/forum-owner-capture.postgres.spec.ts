import 'reflect-metadata';
import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync, readdirSync, readlinkSync, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import { AccountExportOwnerSpoolService } from '@optimistic-tanuki/storage';
import {
  FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  AuthCommands,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import loadDatabase from './loadDatabase';
import { ForumAccountExportOwnerService } from './account-export-owner.service';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const marker = 'private-forum-owner-j27-v1';
const optedIn = process.env.FORUM_OWNER_CAPTURE_J27_MARKER;
if (optedIn !== undefined && optedIn !== marker)
  throw new Error('Invalid J27 fixture marker');
const describePrivate = optedIn === marker ? describe : describe.skip;
const fixture = {
  host: '127.0.0.1',
  port: 15553,
  username: 'forum_owner_capture_fixture',
  password: 'synthetic-j27-only',
  database: 'forum_owner_capture_j27_fixture',
};

describePrivate('J27 actual Forum owner capture', () => {
  it('captures every declared source, pages actual rows, and fails closed without changing counterpart data', async () => {
    if (
      process.env.POSTGRES_HOST !== fixture.host ||
      process.env.POSTGRES_DB !== fixture.database ||
      process.env.POSTGRES_PORT !== String(fixture.port)
    )
      throw new Error('Wrong J27 database');
    const reportPath = process.env.FORUM_OWNER_CAPTURE_J27_REPORT_PATH;
    if (!reportPath) throw new Error('J27 private report path required');
    const config = loadDatabase({ get: () => fixture } as any);
    const writer = new DataSource({
      ...config,
      migrations: [],
      synchronize: false,
    });
    const reader = new DataSource({
      ...config,
      migrations: [],
      synchronize: false,
      extra: { max: 1 },
    });
    const account = randomUUID(),
      otherAccount = randomUUID();
    const profile = randomUUID(),
      secondProfile = randomUUID(),
      otherProfile = randomUUID();
    const ownTopic = randomUUID(),
      foreignTopic = randomUUID(),
      ownThread = randomUUID(),
      foreignThread = randomUUID();
    const ownPosts = Array.from(
      { length: 261 },
      () => '1' + randomUUID().slice(1)
    );
    const latePost = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
    let lateInserted = false;
    const foreignPost = randomUUID(),
      mismatchedPost = randomUUID();
    const ownLink = randomUUID(),
      foreignLink = randomUUID(),
      asset = randomUUID();
    const reports = [randomUUID(), randomUUID(), randomUUID()];
    const actions = [randomUUID(), randomUUID()];
    const root = `/tmp/forum-owner-j27-${randomUUID()}`;
    const grant: AccountExportCaptureGrant = {
      accountId: account,
      token: 'synthetic-j27-capability',
      appId: 'client-interface',
      jobId: randomUUID(),
      attempt: 1,
      leaseOwner: randomUUID(),
    };
    const descriptor: AccountExportSnapshotDescriptor = {
      participantId: 'profile',
      accountId: account,
      handleId: randomUUID(),
      captureId: randomUUID(),
      snapshotAt: '2026-10-22T12:00:00.000Z',
      expiresAt: '2099-01-01T00:00:00.000Z',
      sizeBytes: 1,
      sha256: 'a'.repeat(64),
      rowCount: 2,
      identityCount: 2,
      sources: ['profileIdentity'],
      sourceRowCounts: { profileIdentity: 2 },
      sourceDispositions: { profileIdentity: 'retained' },
    };
    let leaseValid = true;
    const auth = {
      send: (pattern: { cmd: string }) => {
        if (pattern.cmd !== AuthCommands.ValidateAccountExportLease)
          throw new Error('Unexpected Auth command');
        return of({ valid: leaseValid });
      },
    };
    const identities = {
      readIdentities: async (
        _grant: unknown,
        _descriptor: unknown,
        receive: (ids: readonly string[]) => Promise<void>
      ) => {
        await receive([profile, secondProfile]);
        return {
          accountId: account,
          handleId: descriptor.handleId,
          captureId: descriptor.captureId,
          snapshotAt: descriptor.snapshotAt,
          identityCount: 2,
        };
      },
    };
    const handles: Array<{ cleanup(): Promise<void> }> = [];
    const seeded: Record<string, string[]> = {
      topic: [ownTopic, foreignTopic],
      thread: [ownThread, foreignThread],
      forum_post: [...ownPosts, foreignPost, mismatchedPost, latePost],
      forum_link: [ownLink, foreignLink],
      forum_report: reports,
      forum_moderation_action: actions,
    };
    let baseline: Record<string, string> | undefined;
    let failure: unknown;
    const report: Record<string, any> = {
      result: 'RUNNING',
      capabilityReplies:
        'controlled lease/Profile replies; real PostgreSQL and production projections',
      stage: {},
      cleanup: {},
    };
    const counts = async () => {
      const tables = await writer.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
      );
      const result: Record<string, string> = {};
      for (const { tablename } of tables)
        result[tablename] = (
          await writer.query(
            `SELECT count(*)::text AS count FROM public."${String(
              tablename
            ).replace(/"/g, '""')}"`
          )
        )[0].count;
      return result;
    };
    try {
      await writer.initialize();
      await reader.initialize();
      baseline = await counts();
      expect(Object.keys(baseline)).toHaveLength(8);
      for (const [id, userId, profileId, title] of [
        [ownTopic, account, profile, 'Own topic definition'],
        [foreignTopic, otherAccount, otherProfile, 'PRIVATE_FOREIGN_TOPIC'],
      ])
        await writer.query(
          'INSERT INTO topic (id,title,description,"userId","profileId","appScope") VALUES ($1,$4,$4,$2,$3,\'forum-j27\')',
          [id, userId, profileId, title]
        );
      for (const [id, userId, profileId, title] of [
        [ownThread, account, profile, 'Own thread'],
        [foreignThread, otherAccount, otherProfile, 'PRIVATE_FOREIGN_THREAD'],
      ])
        await writer.query(
          'INSERT INTO thread (id,title,description,content,"userId","profileId","topicId","appScope","moderationNotes") VALUES ($1,$4,$4,\'<p>thread body</p>\',$2,$3,$5,\'forum-j27\',\'PRIVATE_MODERATION\')',
          [id, userId, profileId, title, foreignTopic]
        );
      for (let i = 0; i < ownPosts.length; i++)
        await writer.query(
          'INSERT INTO forum_post (id,content,"userId","profileId","threadId","appScope","moderationNotes") VALUES ($1,$2,$3,$4,$5,$6,\'PRIVATE_MODERATION\')',
          [
            ownPosts[i],
            i === 0
              ? `<p>Own 🌱 body<img src="/api/asset/${asset}" alt="local"></p>`
              : `<p>Own body ${i}</p>`,
            account,
            i % 2 ? secondProfile : profile,
            i === 0 ? foreignThread : ownThread,
            i % 2 ? 'another-owned-app' : 'forum-j27',
          ]
        );
      await writer.query(
        'INSERT INTO forum_post (id,content,"userId","profileId","threadId","appScope") VALUES ($1,\'<script>PRIVATE_FOREIGN_POST</script>\',$2,$3,$4,\'forum-j27\'),($5,\'PRIVATE_MISMATCHED\',$6,$3,$4,\'forum-j27\')',
        [
          foreignPost,
          otherAccount,
          otherProfile,
          foreignThread,
          mismatchedPost,
          account,
        ]
      );
      await writer.query(
        "INSERT INTO forum_link (id,url,title,description,\"appScope\") VALUES ($1,'https://example.test/reference','PRIVATE_LINK_TITLE','PRIVATE_LINK_DESCRIPTION','forum-j27'),($2,'file:///private/foreign','PRIVATE_FOREIGN_LINK',NULL,'forum-j27')",
        [ownLink, foreignLink]
      );
      await writer.query(
        'INSERT INTO forum_post_links_forum_link ("forumPostId","forumLinkId") VALUES ($1,$2),($3,$2),($3,$4)',
        [ownPosts[0], ownLink, foreignPost, foreignLink]
      );
      for (let i = 0; i < reports.length; i++)
        await writer.query(
          'INSERT INTO forum_report (id,"reporterId","appScope","contentType","contentId",reason,description,"adminNotes") VALUES ($1,$2,$3,\'post\',$4,\'spam\',\'PRIVATE_REPORT_DESCRIPTION\',\'PRIVATE_ADMIN_NOTES\')',
          [
            reports[i],
            i === 2 ? otherProfile : profile,
            i === 1 ? null : 'forum-j27',
            foreignPost,
          ]
        );
      for (let i = 0; i < actions.length; i++)
        await writer.query(
          'INSERT INTO forum_moderation_action (id,"appScope",action,"subjectType","subjectId","actorProfileId",details) VALUES ($1,\'forum-j27\',\'content_moderation\',\'post\',$2,$3,$4::jsonb)',
          [
            actions[i],
            foreignPost,
            i ? otherProfile : profile,
            JSON.stringify({
              adminNotes: 'PRIVATE_AUDIT_JSON',
              counterpart: otherAccount,
            }),
          ]
        );
      const foreignBefore = await writer.query(
        'SELECT row_to_json(p) AS row FROM forum_post p WHERE id=$1',
        [foreignPost]
      );
      const createRunner = reader.createQueryRunner.bind(reader);
      reader.createQueryRunner = (mode?: 'master' | 'slave') => {
        const runner = createRunner(mode);
        const query = runner.query.bind(runner);
        runner.query = async (...args: any[]) => {
          const result = await (query as any)(...args);
          if (
            !lateInserted &&
            typeof args[0] === 'string' &&
            args[0].includes('FROM "forum_post" r')
          ) {
            lateInserted = true;
            await writer.query(
              'INSERT INTO forum_post (id,content,"userId","profileId","threadId","appScope") VALUES ($1,$2,$3,$4,$5,$6)',
              [
                latePost,
                '<p>Concurrent insert</p>',
                account,
                profile,
                ownThread,
                'forum-j27',
              ]
            );
          }

          if (
            typeof args[0] === 'string' &&
            args[0].startsWith('SELECT transaction_timestamp()')
          ) {
            const state = await query(
              "SELECT current_setting('transaction_read_only') AS readonly, current_setting('transaction_isolation') AS isolation"
            );
            expect(state[0]).toEqual({
              readonly: 'on',
              isolation: 'repeatable read',
            });
            report.stage.actualReadOnlyRepeatableRead = true;
          }
          return result;
        };
        return runner;
      };
      const owner = new ForumAccountExportOwnerService(
        reader,
        identities as any,
        auth as any
      );
      const chunks: any[] = [];
      const capture = async (
        onChunk?: (chunk: any) => Promise<void>,
        signal?: AbortSignal
      ) => {
        const handle =
          await new AccountExportOwnerSpoolService().capture<string>(
            {
              participantId: 'forum',
              accountId: account,
              sources: FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES,
              spoolRoot: root,
              signal,
            },
            (sink, combined) =>
              owner.captureAccount({
                grant,
                profileSnapshot: descriptor,
                signal: combined,
                onChunk: async (chunk) => {
                  await onChunk?.(chunk);
                  await sink(chunk);
                },
              })
          );
        handles.push(handle);
        return handle;
      };
      const handle = await capture(async (chunk) => {
        chunks.push(chunk);
      });
      const buffers: Buffer[] = [];
      for (let offset = 0; offset < handle.metadata.sizeBytes; ) {
        const bytes = await handle.readChunk(
          offset,
          Math.min(65536, handle.metadata.sizeBytes - offset)
        );
        buffers.push(bytes);
        offset += bytes.length;
      }
      const body = Buffer.concat(buffers);
      expect(createHash('sha256').update(body).digest('hex')).toBe(
        handle.metadata.sha256
      );
      const pages = body
        .toString('utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      const records = pages.flatMap((page) => page.records ?? []);
      expect(handle.metadata.sourceRowCounts).toEqual({
        Topic: 1,
        Thread: 1,
        ForumPost: 261,
        ForumLink: 1,
        ForumReport: 2,
        ForumModerationAction: 1,
      });
      expect(handle.metadata.rowCount).toBe(267);
      expect(records).toHaveLength(267);
      const postRows = records.filter(
        (record: any) => record.source === 'ForumPost'
      );
      expect(new Set(postRows.map((r: any) => r.data.id))).toEqual(
        new Set(ownPosts)
      );
      expect(
        pages
          .filter((page) => page.source === 'ForumPost')
          .map((page) => page.records.length)
      ).toEqual([250, 11]);
      const link = records.find((r: any) => r.source === 'ForumLink')!.data;
      expect(link.reference).toMatchObject({
        kind: 'external',
        url: 'https://example.test/reference',
        status: 'referenceOnly-unverified',
      });
      expect(JSON.stringify(link)).toContain(ownLink);
      expect(JSON.stringify(link)).toContain(ownPosts[0]);
      expect(JSON.stringify(records)).toContain(asset);
      expect(JSON.stringify(records)).toContain('referenceOnly-unverified');
      expect(JSON.stringify(records)).toContain('another-owned-app');
      const reportRows = records.filter((r: any) => r.source === 'ForumReport');
      expect(reportRows.some((r: any) => r.data.appScope === null)).toBe(true);
      const serialized = JSON.stringify(records);
      for (const marker of [
        'PRIVATE_',
        otherAccount,
        otherProfile,
        foreignLink,
        mismatchedPost,
      ])
        expect(serialized).not.toContain(marker);
      expect(pages.at(-1)?.complete).toBe(true);
      expect(lateInserted).toBe(true);
      expect(
        (
          await writer.query(
            'SELECT count(*)::int AS count FROM forum_post WHERE id=$1',
            [latePost]
          )
        )[0].count
      ).toBe(1);
      expect(new Set(postRows.map((r: any) => r.data.id)).has(latePost)).toBe(
        false
      );
      await writer.query('DELETE FROM forum_post WHERE id=$1', [latePost]);
      report.stage.concurrentInsertExcluded = true;
      await handle.cleanup();
      report.stage.positiveSources = handle.metadata.sourceRowCounts;
      report.stage.records = 267;
      report.stage.postPages = [250, 11];
      report.stage.digest = true;
      report.stage.crossScope = true;
      const rejects = async (
        change: () => Promise<unknown>,
        restore: () => Promise<unknown>
      ) => {
        const emitted: any[] = [];
        try {
          await change();
          await expect(
            capture(async (chunk) => {
              emitted.push(chunk);
            })
          ).rejects.toBeDefined();
          expect(emitted.some((chunk) => chunk.complete)).toBe(false);
        } finally {
          await restore();
        }
      };
      await rejects(
        () =>
          writer.query('UPDATE forum_post SET content=$2 WHERE id=$1', [
            ownPosts[1],
            '<img src="javascript:alert(1)">',
          ]),
        () =>
          writer.query(
            "UPDATE forum_post SET content='<p>Restored body</p>' WHERE id=$1",
            [ownPosts[1]]
          )
      );
      await rejects(
        () =>
          writer.query(
            'UPDATE forum_link SET "appScope"=\'different-scope\' WHERE id=$1',
            [ownLink]
          ),
        () =>
          writer.query(
            'UPDATE forum_link SET "appScope"=\'forum-j27\' WHERE id=$1',
            [ownLink]
          )
      );
      const controller = new AbortController();
      controller.abort();
      await expect(capture(undefined, controller.signal)).rejects.toBeDefined();
      leaseValid = false;
      await expect(capture()).rejects.toBeDefined();
      leaseValid = true;
      const emitted: any[] = [];
      await expect(
        capture(async (chunk) => {
          emitted.push(chunk);
          leaseValid = false;
        })
      ).rejects.toBeDefined();
      leaseValid = true;
      expect(emitted.some((chunk) => chunk.complete)).toBe(false);
      expect(
        await writer.query(
          'SELECT row_to_json(p) AS row FROM forum_post p WHERE id=$1',
          [foreignPost]
        )
      ).toEqual(foreignBefore);
      expect(
        (
          await reader.query(
            "SELECT count(*)::int AS count FROM pg_class WHERE relpersistence='t'"
          )
        )[0].count
      ).toBe(0);
      report.stage.unsafeReferenceDenied = true;
      report.stage.scopeMismatchDenied = true;
      report.stage.abortDenied = true;
      report.stage.leaseDenials = true;
      report.stage.foreignFingerprint = true;
    } catch (error) {
      failure = error;
      report.error = 'owner_fixture_failed';
    } finally {
      leaseValid = true;
      for (const handle of handles)
        await handle.cleanup().catch((error) => {
          failure ??= error;
        });
      if (writer.isInitialized) {
        const attempt = async (work: () => Promise<unknown>) => {
          try {
            await work();
          } catch (error) {
            failure ??= error;
          }
        };
        await attempt(() =>
          writer.query(
            'DELETE FROM forum_post_links_forum_link WHERE "forumPostId"=ANY($1::uuid[])',
            [seeded.forum_post]
          )
        );
        for (const table of [
          'forum_moderation_action',
          'forum_report',
          'forum_post',
          'forum_link',
          'thread',
          'topic',
        ])
          await attempt(() =>
            writer.query(`DELETE FROM "${table}" WHERE id=ANY($1::uuid[])`, [
              seeded[table],
            ])
          );
        if (baseline) {
          const after = await counts();
          report.cleanup.countsBefore = baseline;
          report.cleanup.countsAfter = after;
          if (JSON.stringify(baseline) !== JSON.stringify(after))
            failure ??= new Error('J27 table counts changed');
        }
      }
      if (reader.isInitialized)
        await reader.destroy().catch((error) => {
          failure ??= error;
        });
      if (writer.isInitialized)
        await writer.destroy().catch((error) => {
          failure ??= error;
        });
      await rm(root, { recursive: true, force: true });
      const liveSpools = readdirSync('/proc/self/fd').filter((fd) => {
        try {
          return readlinkSync('/proc/self/fd/' + fd).includes(
            '/ot-owner-spool-'
          );
        } catch {
          return false;
        }
      });
      if (liveSpools.length)
        failure ??= new Error('J27 owner spool descriptors remain');
      report.cleanup.liveOwnerSpoolDescriptors = liveSpools.length;
      report.cleanup.spoolRootRemoved = !existsSync(root);
      report.result = failure ? 'FAIL' : 'PASS';
      writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    }
    if (failure) throw failure;
  }, 90000);
});
