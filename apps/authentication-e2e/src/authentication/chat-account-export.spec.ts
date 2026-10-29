import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Client as PgClient } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AuthCommands,
  ProfileCommands,
  ChatCommands,
  CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportOwnerCaptureVerifier,
  AccountExportSnapshotDescriptor,
  ChatAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

describe('Chat Collector account export private TCP integration', () => {
  it('integrates the tenth owner with exact parent, retry, restart and session revocation', async () => {
    if (
      process.env.CHAT_JOB_E2E_MARKER !== 'private-chat-o04-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-chat-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15559' ||
      process.env.AUTH_AUTO_VERIFY_EMAILS !== 'true'
    )
      throw new Error('Private O04 fixture required');
    const reportPath = process.env.CHAT_JOB_E2E_REPORT_PATH;
    const container = process.env.CHAT_JOB_E2E_CONTAINER_ID || '';
    if (!reportPath || !/^[a-f0-9]{64}$/.test(container))
      throw new Error('Private O04 report and target required');
    const command = promisify(execFile);
    const inspected = JSON.parse(
      (await command('docker', ['inspect', container], { timeout: 10000 }))
        .stdout
    )[0];
    expect(inspected.Config.Labels['com.docker.compose.project']).toBe(
      'ot-df007-chat-integration'
    );
    expect(inspected.Config.Labels['com.docker.compose.service']).toBe(
      'chat-collector'
    );
    expect(
      inspected.Config.Labels[
        'io.optimistic-tanuki.account-rights.private-project'
      ]
    ).toBe('ot-df007-chat-integration');
    const connect = (port: number) =>
      ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port },
      });
    const clients: Record<string, ClientProxy> = {
      auth: connect(14701),
      profile: connect(14702),
      social: connect(14703),
      assets: connect(14705),
      permissions: connect(14712),
      forum: connect(14715),
      workspace: connect(14724),
      appConfigurator: connect(14714),
      videos: connect(14722),
      chat: connect(14707),
    };
    const databaseNames = [
      'authentication',
      'profile',
      'assets',
      'videos',
      'permissions',
      'social',
      'forum',
      'workspace',
      'app-configurator',
      'chat-collector',
      'classifieds',
    ];
    const databases = databaseNames.map(
      (name) =>
        new PgClient({
          host: '127.0.0.1',
          port: 15559,
          user: 'postgres',
          password: 'postgres',
          database: 'ot_' + name.replace(/-/g, '_'),
        })
    );
    const [authDb, profileDb, , , , , , , , chatDb] = databases;
    const rpc = <T = any>(
      client: ClientProxy,
      cmd: string,
      payload: unknown,
      ms = 5000
    ) =>
      firstValueFrom(
        client.send<T>({ cmd }, payload).pipe(timeout({ first: ms }))
      );
    const users: Array<{ id: string; token: string }> = [];
    const profiles = [randomUUID(), randomUUID(), randomUUID()];
    const owned = Array.from({ length: 252 }, () => randomUUID());
    const foreign = [randomUUID()];
    const historical = randomUUID(),
      stewardship = randomUUID(),
      participation = randomUUID();
    const conversationIds = [
      ...owned,
      historical,
      stewardship,
      participation,
      ...foreign,
    ];
    const ownMessages = [...owned, historical].map(() => randomUUID());
    const counterpartMessages = [...owned, ...foreign].map(() => randomUUID());
    const generatedMessage = randomUUID();
    const ambiguous = randomUUID();
    const allMessageIds = [
      ...ownMessages,
      ...counterpartMessages,
      generatedMessage,
    ];
    const jobs: string[] = [];
    let seededProfiles = false;
    let grant: AccountExportCaptureGrant | undefined;
    let parent: AccountExportSnapshotDescriptor | undefined;
    let child: ChatAccountExportSnapshotDescriptor | undefined;
    let failure: unknown;
    let baseline: Record<string, Record<string, string>> | undefined;
    const report: Record<string, any> = {
      result: 'RUNNING',
      participantId: 'chat-collector',
      mockedCapabilities: [],
      stage: {},
      cleanup: {},
    };
    const counts = async () => {
      const result: Record<string, Record<string, string>> = {};
      for (let i = 0; i < databases.length; i++) {
        const db = databases[i];
        const tables = (
          await db.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
          )
        ).rows;
        const tableCounts: Record<string, string> = {};
        for (const { table_name } of tables)
          tableCounts[table_name] = (
            await db.query(
              `SELECT count(*)::text AS count FROM public."${String(
                table_name
              ).replace(/"/g, '""')}"`
            )
          ).rows[0].count;
        result[databaseNames[i]] = tableCounts;
      }
      return result;
    };
    try {
      await Promise.all(databases.map((db) => db.connect()));
      await Promise.all(
        Object.values(clients).map((client) => client.connect())
      );
      baseline = await counts();
      expect(Object.keys(baseline)).toEqual(databaseNames);
      for (const label of ['owner', 'counterpart']) {
        const email = `chat-o04-${label}-${randomUUID().slice(
            0,
            8
          )}@example.test`,
          password = 'ChatExportE2E!123';
        const registered = await rpc(clients.auth, AuthCommands.Register, {
          email,
          fn: 'ChatExport',
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
        users.at(-1)!.token = login.data.newToken;
      }
      await profileDb.query(
        `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'client-interface','Owner','','','','','','',''),($3,$2,'local-hub','Second','','','','','','',''),($4,$5,'client-interface','Counterpart','','','','','','','')`,
        [profiles[0], users[0].id, profiles[1], profiles[2], users[1].id]
      );
      seededProfiles = true;
      for (let i = 0; i < conversationIds.length; i++) {
        const cid = conversationIds[i];
        const participants =
          cid === stewardship
            ? []
            : cid === historical || foreign.includes(cid)
            ? [profiles[2]]
            : [profiles[i % 2], profiles[2]];
        await chatDb.query(
          `INSERT INTO conversation (id,title,type,participants,"ownerId","isDeleted") VALUES ($1,'PRIVATE_SHARED_TITLE','direct',$2,$3,$4)`,
          [
            cid,
            participants,
            cid === stewardship ? profiles[0] : profiles[2],
            cid === historical,
          ]
        );
      }
      for (let i = 0; i < ownMessages.length; i++) {
        await chatDb.query(
          `INSERT INTO message (id,content,"senderId",type,recipients,"conversationId") VALUES ($1,$2,$3,'chat',$4,$5)`,
          [
            ownMessages[i],
            `Own inert message 🌱 ${i}`,
            profiles[i % 2],
            [profiles[2]],
            [...owned, historical][i],
          ]
        );
      }
      for (let i = 0; i < counterpartMessages.length; i++) {
        await chatDb.query(
          `INSERT INTO message (id,content,"senderId",type,recipients,"conversationId") VALUES ($1,'PRIVATE_COUNTERPART_CONTENT',$2,'chat',$3,$4)`,
          [
            counterpartMessages[i],
            profiles[2],
            [profiles[0]],
            [...owned, ...foreign][i],
          ]
        );
      }
      await chatDb.query(
        `INSERT INTO message (id,content,"senderId",type,recipients,"conversationId") VALUES ($1,'PRIVATE_GENERATED_CONTENT',$2,'info',$3,$4)`,
        [generatedMessage, profiles[0], [profiles[2]], owned[0]]
      );
      await chatDb.query(
        `UPDATE conversation SET "createdAt"='2026-10-23 01:02:03.123456',"updatedAt"='2026-10-23 02:02:03.654321' WHERE id=$1`,
        [owned[0]]
      );
      const foreignFingerprint = async () => ({
        conversations: (
          await chatDb.query(
            'SELECT row_to_json(r) AS row FROM conversation r WHERE id=ANY($1::uuid[]) ORDER BY id',
            [foreign]
          )
        ).rows,
        messages: (
          await chatDb.query(
            'SELECT row_to_json(r) AS row FROM message r WHERE id=ANY($1::uuid[]) ORDER BY id',
            [counterpartMessages]
          )
        ).rows,
      });
      const foreignBefore = await foreignFingerprint();
      for (let i = 0; i < 2; i++) {
        const messages = await rpc(clients.chat, ChatCommands.GET_MESSAGES, {
          conversationId: owned[i],
          requestingProfileId: profiles[i],
        });
        expect(
          messages.some((message: any) => message.id === ownMessages[i])
        ).toBe(true);
        expect(
          messages.some(
            (message: any) =>
              message.id === counterpartMessages[i] &&
              message.content === 'PRIVATE_COUNTERPART_CONTENT'
          )
        ).toBe(true);
      }
      report.stage.bothApplicationProfileMessageReads = true;

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
      jobs.push(created.jobId);
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
        'chat-collector',
        'classifieds',
      ];
      let job = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: created.jobId },
        55000
      );
      report.stage.initialJobState = job.state;
      report.stage.initialCapturedOwners =
        job.coverageSummary.capturedDatabaseOwners ?? [];
      report.stage.initialBlockers = job.coverageSummary.blockers ?? [];
      expect(job.state).toBe('incomplete');
      expect(job.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners
      );
      expect(job.coverageSummary.artifactAvailable).toBe(false);
      expect(job.artifactUrl).toBeNull();
      expect(JSON.stringify(job)).not.toContain(users[0].token);
      report.stage.jobCaptureOwners =
        job.coverageSummary.capturedDatabaseOwners;
      report.stage.globalJobRemainsIncomplete = true;
      await chatDb.query(
        `INSERT INTO conversation (id,title,type,participants,"ownerId") VALUES ($1,'PRIVATE_AMBIGUOUS','direct','{}',$2)`,
        [ambiguous, users[0].id]
      );
      const failed = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: created.jobId },
        55000
      );
      expect(failed.state).toBe('failed');
      expect(failed.coverageSummary.blockers).toContain(
        'chat-collector-capture-unavailable'
      );
      expect(failed.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners.slice(0, 9)
      );
      report.stage.failurePrefix =
        failed.coverageSummary.capturedDatabaseOwners;
      await chatDb.query('DELETE FROM conversation WHERE id=$1', [ambiguous]);
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
      await chatDb.query(
        'UPDATE message SET "conversationId"=NULL WHERE id=$1',
        [ownMessages[0]]
      );
      const parentMismatch = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: created.jobId },
        55000
      );
      expect(parentMismatch.state).toBe('failed');
      expect(parentMismatch.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners.slice(0, 9)
      );
      expect(parentMismatch.coverageSummary.blockers).toContain(
        'chat-collector-capture-unavailable'
      );
      await chatDb.query('UPDATE message SET "conversationId"=$2 WHERE id=$1', [
        ownMessages[0],
        owned[0],
      ]);
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
      report.stage.orphanMessageFailsCapture = true;
      report.stage.retryRestoresAllOwners = true;
      const durable = (
        await authDb.query(
          'SELECT "coverageSummary"::text AS summary FROM account_export_jobs WHERE id=$1',
          [created.jobId]
        )
      ).rows[0];
      expect(durable.summary).not.toContain(users[0].token);
      grant = {
        accountId: users[0].id,
        token: users[0].token,
        appId: 'client-interface',
        jobId: created.jobId,
        attempt: job.attempt + 1,
        leaseOwner: randomUUID(),
      };
      await authDb.query(
        'UPDATE account_export_jobs SET state=\'running\',attempt=$2,"leaseOwner"=$3,"leaseExpiresAt"=clock_timestamp()+interval \'5 minutes\' WHERE id=$1',
        [grant.jobId, grant.attempt, grant.leaseOwner]
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
        { token: users[1].token },
        { appId: 'forgeofwill' },
        { attempt: grant.attempt + 1 },
        { leaseOwner: randomUUID() },
        { profileSnapshot: { ...parent, captureId: randomUUID() } },
      ])
        await expect(
          rpc(
            clients.chat,
            ChatCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, profileSnapshot: parent, ...override },
            55000
          )
        ).rejects.toBeDefined();
      child = await rpc(
        clients.chat,
        ChatCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child).toMatchObject({
        participantId: 'chat-collector',
        profileHandleId: parent.handleId,
        profileCaptureId: parent.captureId,
        profileSnapshotAt: parent.snapshotAt,
        sources: [...CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES],
      });
      const bytes: Buffer[] = [];
      let reads = 0;
      for (let offset = 0; offset < child.sizeBytes; ) {
        const length = Math.min(65536, child.sizeBytes - offset);
        const read = await rpc(
          clients.chat,
          ChatCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          { ...grant, handleId: child.handleId, offset, length }
        );
        const chunk = Buffer.from(read.bytesBase64, 'base64');
        expect(chunk.length).toBe(length);
        expect(read.eof).toBe(offset + length === child.sizeBytes);
        bytes.push(chunk);
        offset += length;
        reads++;
      }
      expect(reads).toBeGreaterThan(1);
      const body = Buffer.concat(bytes);
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
        'chat-collector',
        users[0].id,
        CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES,
        createHash('sha256')
      );
      const verified = pages.map((page) => verifier.accept(page));
      expect(verified.at(-1)).toBe(true);
      expect(verified.slice(0, -1).some(Boolean)).toBe(false);
      const records = pages.flatMap((page) => page.records ?? []);
      const expectedCounts = { Conversation: 255, Message: 254 };
      expect(pages.at(-1).sourceRowCounts).toEqual(expectedCounts);
      expect(pages.at(-1).rowCount).toBe(509);
      expect(child.sourceRowCounts).toEqual(expectedCounts);
      expect(records.length).toBe(509);
      for (const source of CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES)
        expect(
          pages.filter((page) => page.source === source).length
        ).toBeGreaterThan(1);
      for (const [source, expected] of Object.entries(expectedCounts))
        expect(records.filter((row) => row.source === source)).toHaveLength(
          expected
        );
      const first = records.find(
        (row) => row.source === 'Conversation' && row.data.id === owned[0]
      )!.data;
      expect(first.createdAt).toBe('2026-10-23T01:02:03.123456Z');
      expect(first.updatedAt).toBe('2026-10-23T02:02:03.654321Z');
      expect(
        records.find(
          (row) => row.source === 'Conversation' && row.data.id === historical
        )!.data
      ).toMatchObject({
        isDeleted: true,
        recordedParticipation: false,
        hasRecordedSentMessages: true,
      });
      expect(
        records.find(
          (row) => row.source === 'Conversation' && row.data.id === stewardship
        )!.data
      ).toMatchObject({
        recordedStewardship: true,
        recordedParticipation: false,
      });
      expect(
        records.find(
          (row) => row.source === 'Message' && row.data.id === generatedMessage
        )!.data
      ).toMatchObject({
        contentDisposition: 'excluded-generated-or-unverified-type',
      });
      expect(
        records.find(
          (row) => row.source === 'Message' && row.data.id === ownMessages[0]
        )!.data.content
      ).toContain('🌱');
      const exported = JSON.stringify(records);
      for (const value of [
        'PRIVATE_',
        users[1].id,
        profiles[2],
        ...foreign,
        ...counterpartMessages,
        'recipients',
        'participants',
        'ownerId',
        'communityId',
        'projectId',
      ])
        expect(exported).not.toContain(value);
      report.stage.verifiedSourceRowCounts = expectedCounts;
      report.stage.verifiedTerminalCount = 509;
      report.stage.generatedContentExcluded = true;
      report.stage.counterpartMessagesExcluded = true;
      report.stage.historicalSentMessageContextRetained = true;
      report.stage.verifiedTerminalChecksum = true;
      report.stage.parentProfileBinding = true;
      report.stage.privacyAssertions = true;
      report.stage.multipleByteReads = reads;
      await expect(
        rpc(clients.chat, ChatCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
          offset: child.sizeBytes + 1,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_INVALID_RANGE' });
      await authDb.query(
        'UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()-interval \'1 second\' WHERE id=$1',
        [grant.jobId]
      );
      await expect(
        rpc(clients.chat, ChatCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      await authDb.query(
        'UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()+interval \'5 minutes\' WHERE id=$1',
        [grant.jobId]
      );
      const previous = { handleId: child.handleId, captureId: child.captureId };
      await clients.chat.close();
      await command('docker', ['restart', container], { timeout: 120000 });
      const until = Date.now() + 20000;
      for (;;) {
        clients.chat = connect(14707);
        try {
          await rpc(
            clients.chat,
            ChatCommands.READ_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, handleId: previous.handleId, offset: 0, length: 1 },
            1500
          );
          throw new Error('Restart served stale Chat Collector handle');
        } catch (error) {
          const e = error as { code?: string; name?: string; message?: string };
          if (e.code === 'OWNER_SNAPSHOT_NOT_FOUND') break;
          if (
            Date.now() > until ||
            !(
              e.name === 'TimeoutError' ||
              ['ECONNREFUSED', 'ECONNRESET'].includes(e.code || '') ||
              e.message === 'Connection closed'
            )
          )
            throw error;
        }
        await Promise.resolve()
          .then(() => clients.chat.close())
          .catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      child = await rpc(
        clients.chat,
        ChatCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child.captureId).not.toBe(previous.captureId);
      await rpc(clients.auth, AuthCommands.Logout, { token: users[0].token });
      await expect(
        rpc(clients.chat, ChatCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      expect(await foreignFingerprint()).toEqual(foreignBefore);
      Object.assign(report.stage, {
        invalidRangeDenied: true,
        expiredLeaseDenied: true,
        restartInvalidatedHandle: true,
        recapturedWithNewId: true,
        logoutDeniedRead: true,
        foreignFingerprintPreserved: true,
      });
    } catch (error) {
      failure = error;
      report.error = 'fixture_failed';
    } finally {
      const attempt = async (work: () => Promise<unknown>) => {
        try {
          await work();
        } catch (error) {
          failure ??= error;
        }
      };
      if (child && grant)
        await attempt(() =>
          rpc(clients.chat, ChatCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE, {
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
      for (const user of users)
        if (user.token)
          await attempt(() =>
            rpc(clients.auth, AuthCommands.Logout, { token: user.token })
          );
      await attempt(() =>
        chatDb.query('DELETE FROM message WHERE id=ANY($1::uuid[])', [
          allMessageIds,
        ])
      );
      await attempt(() =>
        chatDb.query('DELETE FROM conversation WHERE id=ANY($1::uuid[])', [
          [...conversationIds, ambiguous],
        ])
      );
      if (seededProfiles)
        await attempt(() =>
          profileDb.query('DELETE FROM profile WHERE id=ANY($1::uuid[])', [
            profiles,
          ])
        );
      if (jobs.length)
        await attempt(() =>
          authDb.query(
            'DELETE FROM account_export_jobs WHERE id=ANY($1::uuid[])',
            [jobs]
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
            failure ??= error;
            return { rows: [] };
          });
        const keys = keyRows.rows
          .map((row: any) => row.keyDataId)
          .filter(Boolean);
        await attempt(() =>
          authDb.query(
            'UPDATE user_entity SET "keyDataId"=NULL WHERE id=ANY($1::uuid[])',
            [userIds]
          )
        );
        if (keys.length)
          await attempt(() =>
            authDb.query(
              'UPDATE key_datum SET "userId"=NULL WHERE id=ANY($1::uuid[])',
              [keys]
            )
          );
        await attempt(() =>
          authDb.query('DELETE FROM user_entity WHERE id=ANY($1::uuid[])', [
            userIds,
          ])
        );
        if (keys.length)
          await attempt(() =>
            authDb.query('DELETE FROM key_datum WHERE id=ANY($1::uuid[])', [
              keys,
            ])
          );
      }
      if (baseline) {
        const after = await counts().catch((error) => {
          failure ??= error;
          return {};
        });
        report.cleanup.countsBefore = baseline;
        report.cleanup.countsAfter = after;
        report.cleanup.allTenDatabaseTableCountsRestored =
          JSON.stringify(baseline) === JSON.stringify(after);
        if (!report.cleanup.allTenDatabaseTableCountsRestored)
          failure ??= new Error(
            'Account export fixture database counts differ'
          );
      }
      report.result = failure ? 'FAIL' : 'PASS';
      writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
      await Promise.all(databases.map((db) => db.end().catch(() => undefined)));
      await Promise.all(
        Object.values(clients).map((client) =>
          Promise.resolve()
            .then(() => client.close())
            .catch(() => undefined)
        )
      );
    }
    if (failure) throw failure;
  }, 240000);
});
