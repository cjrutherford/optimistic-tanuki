import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Client as PgClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AuthCommands,
  ProfileCommands,
  SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  SocialCommands,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportOwnerCaptureVerifier,
  AccountExportSnapshotDescriptor,
  SocialAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

describe('Social account export private TCP integration', () => {
  it('captures a lease-bound Social snapshot, fails closed, retries, and recaptures after restart', async () => {
    if (process.env.SOCIAL_JOB_E2E_MARKER !== 'private-social-j25-v1')
      throw new Error('Private Social J25 fixture marker required');
    const container = process.env.SOCIAL_JOB_E2E_CONTAINER_ID || '';
    if (!/^[a-f0-9]{64}$/.test(container))
      throw new Error('Private Social J25 container ID required');
    const reportPath = process.env.SOCIAL_JOB_E2E_REPORT_PATH;
    if (!reportPath) throw new Error('Private Social J25 report path required');
    const command = promisify(execFile);
    const inspected = JSON.parse(
      (await command('docker', ['inspect', container], { timeout: 10000 }))
        .stdout
    )[0];
    expect(inspected.Config.Labels['com.docker.compose.project']).toBe(
      'ot-df007-social-integration'
    );
    expect(inspected.Config.Labels['com.docker.compose.service']).toBe(
      'social'
    );
    expect(
      inspected.Config.Labels[
        'io.optimistic-tanuki.account-rights.private-project'
      ]
    ).toBe('ot-df007-social-integration');
    if (
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-forum-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15554' ||
      process.env.AUTH_AUTO_VERIFY_EMAILS !== 'true'
    )
      throw new Error('Private J25 PostgreSQL fixture required');

    const connect = (port: number) =>
      ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port },
      });
    const clients: Record<string, ClientProxy> = {
      auth: connect(13501),
      profile: connect(13502),
      social: connect(13503),
      assets: connect(13505),
      permissions: connect(13512),
      forum: connect(13515),
      videos: connect(13522),
    };
    const databases = [
      'ot_authentication',
      'ot_profile',
      'ot_assets',
      'ot_permissions',
      'ot_social',
      'ot_forum',
      'ot_videos',
    ].map(
      (database) =>
        new PgClient({
          host: '127.0.0.1',
          port: 15554,
          user: 'postgres',
          password: 'postgres',
          database,
        })
    );
    const [authDb, profileDb, , , socialDb] = databases;
    const rpc = <T = any>(
      client: ClientProxy,
      cmd: string,
      payload: unknown,
      ms = 5000
    ) =>
      firstValueFrom(
        client.send<T>({ cmd }, payload).pipe(timeout({ first: ms }))
      );
    const users: { id: string; token: string }[] = [];
    const profiles: string[] = [];
    const jobIds: string[] = [];
    const postIds: string[] = [];
    const searchIds: string[] = [];
    const auditIds: string[] = [];
    const guardianAuditIds: string[] = [];
    const notificationIds: string[] = [];
    const profileIds = [randomUUID(), randomUUID(), randomUUID()];
    let parent: AccountExportSnapshotDescriptor | undefined;
    let child: SocialAccountExportSnapshotDescriptor | undefined;
    let grant: AccountExportCaptureGrant | undefined;
    let previousCaptureId: string | undefined;
    let baselineSocialCounts: Record<string, string> | undefined;
    let foreignFingerprintBefore: any[] | undefined;
    let primaryFailure: unknown;
    const report: Record<string, any> = {
      result: 'RUNNING',
      participantId: 'social',
      declaredSourceCount: SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES.length,
      declaredSources: [...SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES],
      stage: {},
      cleanup: {},
      mockedCapabilities: [],
    };

    const tableCounts = async (): Promise<Record<string, string>> => {
      const tables = await socialDb.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
      );
      const counts: Record<string, string> = {};
      for (const { table_name } of tables.rows) {
        const safe = String(table_name).replace(/"/g, '""');
        const count = await socialDb.query(
          `SELECT count(*)::text AS count FROM public."${safe}"`
        );
        counts[table_name] = count.rows[0].count;
      }
      return counts;
    };
    const sameJson = (left: unknown, right: unknown) =>
      JSON.stringify(left) === JSON.stringify(right);

    try {
      await Promise.all(databases.map((db) => db.connect()));
      await Promise.all(
        Object.values(clients).map((client) => client.connect())
      );
      const password = 'SocialExportE2E!123';
      for (const label of ['owner', 'counterpart']) {
        const email = `social-j25-${label}-${randomUUID().slice(
          0,
          8
        )}@example.test`;
        const registered = await rpc(clients.auth, AuthCommands.Register, {
          email,
          fn: 'SocialExport',
          ln: label,
          password,
          confirm: password,
          ageEligibilityStatus: 'adult',
        });
        users.push({ id: registered.data.user.id, token: '' });
        const login = await rpc(clients.auth, AuthCommands.Login, {
          email,
          password,
          appId: 'client-interface',
        });
        users[users.length - 1].token = login.data.newToken;
      }
      const profilesToInsert = [
        [profileIds[0], users[0].id, 'J25 Social owner'],
        [profileIds[1], users[0].id, 'J25 Social second owner'],
        [profileIds[2], users[1].id, 'J25 Social foreign'],
      ];
      await profileDb.query(
        `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'social-j25',$3,'','','','','','',''),($4,$5,'social-j25',$6,'','','','','','',''),($7,$8,'social-j25',$9,'','','','','','','')`,
        profilesToInsert.flat()
      );
      profiles.push(...profileIds);

      baselineSocialCounts = await tableCounts();
      report.baselineSocialTables = Object.keys(baselineSocialCounts).length;
      expect(Object.keys(baselineSocialCounts)).toHaveLength(35);

      const ownPostId = randomUUID();
      const foreignPostId = randomUUID();
      postIds.push(ownPostId, foreignPostId);
      await socialDb.query(
        `INSERT INTO post (id,title,content,"profileId","userId") VALUES ($1,'J25 owned post','J25 owned body',$2,$3),($4,'J25 foreign post','J25 foreign body',$5,$6)`,
        [
          ownPostId,
          profileIds[0],
          users[0].id,
          foreignPostId,
          profileIds[2],
          users[1].id,
        ]
      );
      for (let start = 0; start < 261; start += 100) {
        const batch = Array.from(
          { length: Math.min(100, 261 - start) },
          (_, index) => start + index
        );
        const values: string[] = [];
        const params: unknown[] = [];
        for (const index of batch) {
          const id = randomUUID();
          searchIds.push(id);
          const position = params.length;
          values.push(
            `($${position + 1},$${position + 2},$${position + 3},$${
              position + 4
            })`
          );
          params.push(
            id,
            profileIds[0],
            index === 0 ? '🌱 J25 owned search' : `J25 owned search ${index}`,
            index
          );
        }
        await socialDb.query(
          `INSERT INTO search_history (id,"profileId",query,"resultCount") VALUES ${values.join(
            ','
          )}`,
          params
        );
      }
      const foreignSearchId = randomUUID();
      searchIds.push(foreignSearchId);
      await socialDb.query(
        `INSERT INTO search_history (id,"profileId",query,"resultCount") VALUES ($1,$2,'J25 foreign search',1)`,
        [foreignSearchId, profileIds[2]]
      );

      const auditId = randomUUID();
      auditIds.push(auditId);
      await socialDb.query(
        `INSERT INTO community_membership_audit (id,"workspaceId","subjectId","actorId",actor,action,"from","to") VALUES ($1,$2,$3,$4,'moderator','activate','pending','active')`,
        [auditId, randomUUID(), profileIds[0], users[1].id]
      );
      const guardianId = randomUUID();
      guardianAuditIds.push(guardianId);
      await socialDb.query(
        `INSERT INTO guardian_content_audit (id,"actorUserId","dependentUserId","dependentProfileId","appId","resourceType","resourceId",operation,"changedFields") VALUES ($1,$2,$3,$4,'client-interface','post',$5,'edit',$6)`,
        [
          guardianId,
          users[0].id,
          users[1].id,
          profileIds[2],
          ownPostId,
          JSON.stringify(['J25_PRIVATE_CHANGED_FIELDS']),
        ]
      );
      const notificationId = randomUUID();
      notificationIds.push(notificationId);
      await socialDb.query(
        `INSERT INTO notification (id,"recipientId",type,title,body,"isRead") VALUES ($1,$2,'system','J25_PRIVATE_LEGACY_TITLE','J25_PRIVATE_LEGACY_BODY',false)`,
        [notificationId, profileIds[0]]
      );
      foreignFingerprintBefore = (
        await socialDb.query(
          `SELECT to_jsonb(p)::text AS row FROM post p WHERE id=$1`,
          [foreignPostId]
        )
      ).rows;
      expect(foreignFingerprintBefore).toHaveLength(1);

      const request = {
        accountId: users[0].id,
        token: users[0].token,
        appId: 'client-interface',
        idempotencyKey: randomUUID(),
      };
      const created = await rpc(
        clients.auth,
        AuthCommands.CreateAccountExportJob,
        request,
        55000
      );
      jobIds.push(created.jobId);
      let job = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: created.jobId },
        55000
      );
      const expectedOwners = [
        'authentication',
        'profile',
        'assets',
        'videos',
        'permissions',
        'social',
        'forum',
        'workspace',
        'app-configurator',
      ];
      expect(job.state).toBe('incomplete');
      expect(job.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners
      );
      expect(job.coverageSummary.artifactAvailable).toBe(false);
      expect(job.artifactUrl).toBeNull();
      expect(JSON.stringify(job)).not.toContain(users[0].token);
      report.stage.jobCaptureOwners =
        job.coverageSummary.capturedDatabaseOwners;
      report.stage.globalJobRemainsIncomplete = job.state === 'incomplete';

      const oversizedPostId = randomUUID();
      postIds.push(oversizedPostId);
      await socialDb.query(
        `INSERT INTO post (id,title,content,"profileId","userId") VALUES ($1,$2,'oversized test row',$3,$4)`,
        [oversizedPostId, 'x'.repeat(65_537), profileIds[0], users[0].id]
      );
      const failed = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: created.jobId },
        55000
      );
      expect(failed.state).toBe('failed');
      expect(failed.coverageSummary.blockers).toContain(
        'social-capture-unavailable'
      );
      expect(failed.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners.slice(0, 5)
      );
      report.stage.oversizedSocialRecordFailsClosed = true;
      report.stage.failurePrefix =
        failed.coverageSummary.capturedDatabaseOwners;
      await socialDb.query('DELETE FROM post WHERE id=$1', [oversizedPostId]);
      postIds.splice(postIds.indexOf(oversizedPostId), 1);
      job = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: created.jobId },
        55000
      );
      expect(job.state).toBe('incomplete');
      expect(job.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners
      );
      report.stage.retryRestoresAllOwners = sameJson(
        job.coverageSummary.capturedDatabaseOwners,
        expectedOwners
      );

      grant = {
        accountId: users[0].id,
        token: users[0].token,
        appId: 'client-interface',
        jobId: created.jobId,
        attempt: job.attempt + 1,
        leaseOwner: randomUUID(),
      };
      await authDb.query(
        `UPDATE account_export_jobs SET state='running',attempt=$2,"leaseOwner"=$3,"leaseExpiresAt"=clock_timestamp()+interval '5 minutes' WHERE id=$1`,
        [created.jobId, grant.attempt, grant.leaseOwner]
      );
      parent = await rpc(
        clients.profile,
        ProfileCommands.OpenAccountExportCapture,
        grant,
        55000
      );
      expect(parent.identityCount).toBe(2);
      for (const override of [
        { accountId: users[1].id, token: users[1].token },
        { appId: 'forgeofwill' },
        { attempt: grant.attempt + 1 },
        { leaseOwner: randomUUID() },
        { profileSnapshot: { ...parent, captureId: randomUUID() } },
      ])
        await expect(
          rpc(
            clients.social,
            SocialCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, profileSnapshot: parent, ...override },
            55000
          )
        ).rejects.toBeDefined();
      child = await rpc(
        clients.social,
        SocialCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child).toMatchObject({
        participantId: 'social',
        profileHandleId: parent.handleId,
        profileCaptureId: parent.captureId,
        profileSnapshotAt: parent.snapshotAt,
        identityCount: 0,
      });
      expect(child.sources).toEqual(SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES);
      report.stage.all33DescriptorSources = sameJson(
        child.sources,
        SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES
      );

      const buffers: Buffer[] = [];
      let offset = 0;
      while (offset < child.sizeBytes) {
        const length = Math.min(65_536, child.sizeBytes - offset);
        const read = await rpc(
          clients.social,
          SocialCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          { ...grant, handleId: child.handleId, offset, length }
        );
        expect(read.offset).toBe(offset);
        const bytes = Buffer.from(read.bytesBase64, 'base64');
        expect(bytes.length).toBeLessThanOrEqual(65_536);
        expect(bytes.length).toBe(length);
        expect(read.eof).toBe(offset + bytes.length === child.sizeBytes);
        buffers.push(bytes);
        offset += bytes.length;
      }
      const body = Buffer.concat(buffers);
      expect(body.length).toBe(child.sizeBytes);
      expect(createHash('sha256').update(body).digest('hex')).toBe(
        child.sha256
      );
      const pages = body
        .toString('utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      const verifier = new AccountExportOwnerCaptureVerifier(
        'social',
        users[0].id,
        SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
        createHash('sha256')
      );
      const verified = pages.map((page) => verifier.accept(page));
      expect(verified.slice(0, -1).every((complete) => !complete)).toBe(true);
      expect(verified.at(-1)).toBe(true);
      const records = pages.flatMap((page) => page.records ?? []);
      const terminal = pages[pages.length - 1];
      expect(terminal).toMatchObject({
        source: 'end',
        complete: true,
        rowCount: 265,
      });
      const expectedCounts = Object.fromEntries(
        SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [source, 0])
      );
      Object.assign(expectedCounts, {
        Post: 1,
        SearchHistory: 261,
        CommunityMembershipAudit: 1,
        GuardianContentAudit: 1,
        Notification: 1,
      });
      expect(child.sourceRowCounts).toEqual(expectedCounts);
      expect(terminal.sourceRowCounts).toEqual(expectedCounts);
      expect(records).toHaveLength(265);
      const bySource = (source: string) =>
        records.filter((record) => record.source === source).map((r) => r.data);
      expect(bySource('Post')).toHaveLength(1);
      expect(bySource('Post')[0]).toMatchObject({
        id: ownPostId,
        userId: users[0].id,
        profileId: profileIds[0],
      });
      const ownedSearch = bySource('SearchHistory');
      expect(ownedSearch).toHaveLength(261);
      expect(
        ownedSearch.some((row) => row.query === '🌱 J25 owned search')
      ).toBe(true);
      expect(
        ownedSearch.some((row) => row.query === 'J25 foreign search')
      ).toBe(false);
      expect(bySource('CommunityMembershipAudit')).toHaveLength(1);
      expect(bySource('CommunityMembershipAudit')[0].participation).toEqual([
        { role: 'subject', profileId: profileIds[0] },
      ]);
      expect(bySource('GuardianContentAudit')).toHaveLength(1);
      expect(bySource('GuardianContentAudit')[0].participation).toEqual([
        { role: 'actor', accountId: users[0].id },
      ]);
      expect(bySource('GuardianContentAudit')[0]).not.toHaveProperty(
        'dependentUserId'
      );
      expect(bySource('GuardianContentAudit')[0]).not.toHaveProperty(
        'dependentProfileId'
      );
      expect(bySource('Notification')).toHaveLength(1);
      expect(bySource('Notification')[0]).toMatchObject({
        title: 'Notification',
        body: 'You have a new notification',
      });
      const serialized = JSON.stringify(records);
      for (const privateValue of [
        users[1].id,
        profileIds[2],
        foreignPostId,
        'J25 foreign post',
        'J25_PRIVATE_CHANGED_FIELDS',
        'J25_PRIVATE_LEGACY_TITLE',
        'J25_PRIVATE_LEGACY_BODY',
      ])
        expect(serialized).not.toContain(privateValue);
      report.stage.verifiedSourceRowCounts = child.sourceRowCounts;
      report.stage.verifiedTerminalCount = terminal.rowCount;
      report.stage.verifiedTerminalChecksum = true;
      report.stage.parentProfileBinding = true;
      report.stage.privacyAssertions = true;

      await expect(
        rpc(clients.social, SocialCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
          offset: child.sizeBytes + 1,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_INVALID_RANGE' });
      await authDb.query(
        `UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE id=$1`,
        [created.jobId]
      );
      await expect(
        rpc(clients.social, SocialCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      await authDb.query(
        `UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()+interval '5 minutes' WHERE id=$1`,
        [created.jobId]
      );
      previousCaptureId = child.captureId;
      const previousHandleId = child.handleId;
      await clients.social.close();
      await command('docker', ['restart', container], { timeout: 120000 });
      const deadline = Date.now() + 20_000;
      while (true) {
        clients.social = connect(13503);
        try {
          await rpc(
            clients.social,
            SocialCommands.READ_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, handleId: previousHandleId, offset: 0, length: 1 },
            1500
          );
          throw new Error('Restart unexpectedly served a stale Social handle');
        } catch (error) {
          const e = error as { code?: string; name?: string; message?: string };
          if (e.code === 'OWNER_SNAPSHOT_NOT_FOUND') break;
          if (
            Date.now() > deadline ||
            !(
              e.name === 'TimeoutError' ||
              ['ECONNREFUSED', 'ECONNRESET'].includes(e.code || '') ||
              e.message === 'Connection closed'
            )
          )
            throw error;
        }
        await Promise.resolve()
          .then(() => clients.social.close())
          .catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      child = await rpc(
        clients.social,
        SocialCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child.captureId).not.toBe(previousCaptureId);
      expect(child.profileCaptureId).toBe(parent.captureId);
      await rpc(clients.auth, AuthCommands.Logout, { token: users[0].token });
      await expect(
        rpc(clients.social, SocialCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      const foreignFingerprintAfter = (
        await socialDb.query(
          `SELECT to_jsonb(p)::text AS row FROM post p WHERE id=$1`,
          [foreignPostId]
        )
      ).rows;
      expect(foreignFingerprintAfter).toEqual(foreignFingerprintBefore);
      report.stage.invalidRangeDenied = true;
      report.stage.expiredLeaseDenied = true;
      report.stage.restartInvalidatedHandle = true;
      report.stage.recapturedWithNewId = true;
      report.stage.logoutDeniedRead = true;
      report.stage.foreignFingerprintPreserved = true;
    } catch (error) {
      primaryFailure = error;
      report.error = 'fixture_failed';
    } finally {
      const attempt = async (work: () => Promise<unknown>) => {
        try {
          await work();
          return true;
        } catch (error) {
          primaryFailure ??= error;
          report.cleanupError ??= 'cleanup_failed';
          return false;
        }
      };
      if (child && grant)
        await attempt(() =>
          rpc(clients.social, SocialCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE, {
            ...grant,
            handleId: child!.handleId,
          })
        );
      if (parent && grant)
        await attempt(() =>
          rpc(clients.profile, ProfileCommands.ReleaseAccountExportCapture, {
            ...grant,
            handleId: parent!.handleId,
          })
        );
      if (grant?.jobId)
        await attempt(() =>
          authDb.query(
            `UPDATE account_export_jobs SET state='incomplete',"leaseOwner"=NULL,"leaseExpiresAt"=NULL WHERE id=$1`,
            [grant!.jobId]
          )
        );
      for (const user of users)
        if (user.token)
          await attempt(() =>
            rpc(clients.auth, AuthCommands.Logout, { token: user.token })
          );
      if (notificationIds.length)
        await attempt(() =>
          socialDb.query('DELETE FROM notification WHERE id=ANY($1::uuid[])', [
            notificationIds,
          ])
        );
      if (guardianAuditIds.length)
        await attempt(() =>
          socialDb.query(
            'DELETE FROM guardian_content_audit WHERE id=ANY($1::uuid[])',
            [guardianAuditIds]
          )
        );
      if (auditIds.length)
        await attempt(() =>
          socialDb.query(
            'DELETE FROM community_membership_audit WHERE id=ANY($1::uuid[])',
            [auditIds]
          )
        );
      if (searchIds.length)
        await attempt(() =>
          socialDb.query(
            'DELETE FROM search_history WHERE id=ANY($1::uuid[])',
            [searchIds]
          )
        );
      if (postIds.length)
        await attempt(() =>
          socialDb.query('DELETE FROM post WHERE id=ANY($1::uuid[])', [postIds])
        );
      if (profiles.length)
        await attempt(() =>
          profileDb.query('DELETE FROM profile WHERE id=ANY($1::uuid[])', [
            profiles,
          ])
        );
      if (jobIds.length)
        await attempt(() =>
          authDb.query(
            'DELETE FROM account_export_jobs WHERE id=ANY($1::uuid[])',
            [jobIds]
          )
        );
      const userIds = users.map((user) => user.id);
      if (userIds.length) {
        await attempt(() =>
          authDb.query('DELETE FROM token WHERE "userId"=ANY($1::uuid[])', [
            userIds,
          ])
        );
        const keyRows = await authDb
          .query(
            'SELECT "keyDataId" FROM user_entity WHERE id=ANY($1::uuid[])',
            [userIds]
          )
          .catch((error) => {
            primaryFailure ??= error;
            return { rows: [] as any[] };
          });
        const keyIds = keyRows.rows
          .map((row: any) => row.keyDataId)
          .filter(Boolean);
        await attempt(() =>
          authDb.query(
            'UPDATE user_entity SET "keyDataId"=NULL WHERE id=ANY($1::uuid[])',
            [userIds]
          )
        );
        if (keyIds.length)
          await attempt(() =>
            authDb.query(
              'UPDATE key_datum SET "userId"=NULL WHERE id=ANY($1::uuid[])',
              [keyIds]
            )
          );
        await attempt(() =>
          authDb.query('DELETE FROM user_entity WHERE id=ANY($1::uuid[])', [
            userIds,
          ])
        );
        if (keyIds.length)
          await attempt(() =>
            authDb.query('DELETE FROM key_datum WHERE id=ANY($1::uuid[])', [
              keyIds,
            ])
          );
      }
      if (baselineSocialCounts) {
        report.cleanup.seedIds = {
          posts: postIds.length,
          searchHistory: searchIds.length,
          communityMembershipAudit: auditIds.length,
          guardianContentAudit: guardianAuditIds.length,
          notifications: notificationIds.length,
          profiles: profiles.length,
          jobs: jobIds.length,
        };
        const restored = await tableCounts()
          .then((counts) => sameJson(counts, baselineSocialCounts))
          .catch((error) => {
            primaryFailure ??= error;
            return false;
          });
        report.cleanup.socialTableCountsRestored = restored;
        if (!restored)
          primaryFailure ??= new Error(
            'Social fixture table counts were not restored'
          );
      }
      report.result = primaryFailure ? 'FAIL' : 'PASS';
      report.mockedCapabilities = [];
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      await Promise.all(databases.map((db) => db.end().catch(() => undefined)));
      await Promise.all(
        Object.values(clients).map((client) =>
          Promise.resolve()
            .then(() => client.close())
            .catch(() => undefined)
        )
      );
    }
    if (primaryFailure) throw primaryFailure;
  }, 240000);
});
