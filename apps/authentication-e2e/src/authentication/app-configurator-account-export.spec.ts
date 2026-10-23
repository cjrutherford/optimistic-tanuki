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
  AppConfigCommands,
  APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportOwnerCaptureVerifier,
  AccountExportSnapshotDescriptor,
  AppConfiguratorAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

describe('App Configurator account export private TCP integration', () => {
  it('integrates the ninth owner with exact parent, retry, restart and session revocation', async () => {
    if (
      process.env.APP_CONFIGURATOR_JOB_E2E_MARKER !==
        'private-app-configurator-o02-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-app-configurator-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15558' ||
      process.env.AUTH_AUTO_VERIFY_EMAILS !== 'true'
    )
      throw new Error('Private O02 fixture required');
    const reportPath = process.env.APP_CONFIGURATOR_JOB_E2E_REPORT_PATH;
    const container = process.env.APP_CONFIGURATOR_JOB_E2E_CONTAINER_ID || '';
    if (!reportPath || !/^[a-f0-9]{64}$/.test(container))
      throw new Error('Private O02 report and target required');
    const command = promisify(execFile);
    const inspected = JSON.parse(
      (await command('docker', ['inspect', container], { timeout: 10000 }))
        .stdout
    )[0];
    expect(inspected.Config.Labels['com.docker.compose.project']).toBe(
      'ot-df007-app-configurator-integration'
    );
    expect(inspected.Config.Labels['com.docker.compose.service']).toBe(
      'app-configurator'
    );
    expect(
      inspected.Config.Labels[
        'io.optimistic-tanuki.account-rights.private-project'
      ]
    ).toBe('ot-df007-app-configurator-integration');
    const connect = (port: number) =>
      ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port },
      });
    const clients: Record<string, ClientProxy> = {
      auth: connect(14601),
      profile: connect(14602),
      social: connect(14603),
      assets: connect(14605),
      permissions: connect(14612),
      forum: connect(14615),
      workspace: connect(14624),
      appConfigurator: connect(14614),
      videos: connect(14622),
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
          port: 15558,
          user: 'postgres',
          password: 'postgres',
          database: 'ot_' + name.replace(/-/g, '_'),
        })
    );
    const [authDb, profileDb, , , , , , , configDb] = databases;
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
    const foreign = [randomUUID(), randomUUID(), randomUUID()];
    const instanceIds = [...owned, ...foreign];
    const configIds = instanceIds.map(() => randomUUID());
    const membershipIds = instanceIds.map(() => randomUUID());
    const ownMembershipInSharedApp = randomUUID();
    const workspaceIds = instanceIds.map(() => randomUUID());
    const jobs: string[] = [];
    let seededProfiles = false;
    let grant: AccountExportCaptureGrant | undefined;
    let parent: AccountExportSnapshotDescriptor | undefined;
    let child: AppConfiguratorAccountExportSnapshotDescriptor | undefined;
    let failure: unknown;
    let baseline: Record<string, Record<string, string>> | undefined;
    const report: Record<string, any> = {
      result: 'RUNNING',
      participantId: 'app-configurator',
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
        const email = `app-configurator-o02-${label}-${randomUUID().slice(
            0,
            8
          )}@example.test`,
          password = 'AppConfiguratorExportE2E!123';
        const registered = await rpc(clients.auth, AuthCommands.Register, {
          email,
          fn: 'AppConfiguratorExport',
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
        `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'app-configurator-o02','Owner','','','','','','',''),($3,$2,'another-app','Second','','','','','','',''),($4,$5,'app-configurator-o02','Counterpart','','','','','','','')`,
        [profiles[0], users[0].id, profiles[1], profiles[2], users[1].id]
      );
      seededProfiles = true;
      for (let i = 0; i < instanceIds.length; i++) {
        const isOwned = i < owned.length;
        const userId =
          isOwned || i === owned.length ? users[0].id : users[1].id;
        const profileId = isOwned
          ? profiles[i % 2]
          : i === owned.length + 1
          ? profiles[0]
          : profiles[2];
        const scope = i % 2 ? 'other-app' : 'app-configurator-o02';
        await configDb.query(
          `INSERT INTO app_instances (id,"workspaceId","appScope","ownerUserId","ownerProfileId",status) VALUES ($1,$2,$3,$4,$5,'active')`,
          [instanceIds[i], workspaceIds[i], scope, userId, profileId]
        );
        await configDb.query(
          `INSERT INTO app_configuration_entity (id,name,"workspaceId","appInstanceId","ownerUserId","ownerProfileId","appScope",description,domain,"landingPage",routes,features,theme,manifest,release,active,"accessPolicy",revision) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$12::jsonb,$12::jsonb,$12::jsonb,true,'public',1)`,
          [
            configIds[i],
            isOwned ? `Owned app 🌱 ${i}` : 'PRIVATE_FOREIGN_CONFIGURATION',
            workspaceIds[i],
            instanceIds[i],
            userId,
            profileId,
            scope,
            'PRIVATE_SHARED_DESCRIPTION',
            `app-${i}.example.test`,
            JSON.stringify({
              sections: [{ secret: 'PRIVATE_LANDING_SECRET' }],
              layout: 'PRIVATE_LAYOUT',
            }),
            JSON.stringify([{ token: 'PRIVATE_ROUTE_TOKEN' }]),
            JSON.stringify({ credential: 'PRIVATE_CONFIG_TOKEN' }),
          ]
        );
        await configDb.query(
          `INSERT INTO app_memberships (id,"workspaceId","appInstanceId","appScope","userId","profileId",role,status) VALUES ($1,$2,$3,$4,$5,$6,'member','active')`,
          [
            membershipIds[i],
            workspaceIds[i],
            instanceIds[i],
            scope,
            userId,
            profileId,
          ]
        );
      }
      const last = instanceIds.length - 1;
      await configDb.query(
        `INSERT INTO app_memberships (id,"workspaceId","appInstanceId","appScope","userId","profileId",role,status) VALUES ($1,$2,$3,$4,$5,$6,'member','revoked')`,
        [
          ownMembershipInSharedApp,
          workspaceIds[last],
          instanceIds[last],
          last % 2 ? 'other-app' : 'app-configurator-o02',
          users[0].id,
          profiles[0],
        ]
      );
      await configDb.query(
        `UPDATE app_instances SET "createdAt"='2026-10-23 01:02:03.123456',"updatedAt"='2026-10-23 02:02:03.654321' WHERE id=$1`,
        [owned[0]]
      );
      const foreignFingerprint = async () => ({
        instances: (
          await configDb.query(
            'SELECT row_to_json(w) AS row FROM app_instances w WHERE id=ANY($1::uuid[]) ORDER BY id',
            [foreign]
          )
        ).rows,
        configurations: (
          await configDb.query(
            'SELECT row_to_json(w) AS row FROM app_configuration_entity w WHERE id=ANY($1::uuid[]) ORDER BY id',
            [configIds.slice(252)]
          )
        ).rows,
        memberships: (
          await configDb.query(
            'SELECT row_to_json(w) AS row FROM app_memberships w WHERE id=ANY($1::uuid[]) ORDER BY id',
            [membershipIds.slice(252)]
          )
        ).rows,
      });
      const foreignBefore = await foreignFingerprint();
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
      await configDb.query(
        "UPDATE app_configuration_entity SET domain='https://user:PRIVATE_PASSWORD@example.test' WHERE id=$1",
        [configIds[0]]
      );
      const failed = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: created.jobId },
        55000
      );
      expect(failed.state).toBe('failed');
      expect(failed.coverageSummary.blockers).toContain(
        'app-configurator-capture-unavailable'
      );
      expect(failed.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners.slice(0, 8)
      );
      report.stage.failurePrefix =
        failed.coverageSummary.capturedDatabaseOwners;
      await configDb.query(
        "UPDATE app_configuration_entity SET domain='app-0.example.test' WHERE id=$1",
        [configIds[0]]
      );
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
      await configDb.query(
        'UPDATE app_configuration_entity SET "appInstanceId"=$2,"workspaceId"=$3,"appScope"=$4 WHERE id=$1',
        [
          configIds[0],
          instanceIds.at(-1),
          workspaceIds.at(-1),
          'app-configurator-o02',
        ]
      );
      const parentMismatch = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: created.jobId },
        55000
      );
      expect(parentMismatch.state).toBe('failed');
      expect(parentMismatch.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners.slice(0, 8)
      );
      expect(parentMismatch.coverageSummary.blockers).toContain(
        'app-configurator-capture-unavailable'
      );
      await configDb.query(
        'UPDATE app_configuration_entity SET "appInstanceId"=$2,"workspaceId"=$3,"appScope"=$4 WHERE id=$1',
        [configIds[0], instanceIds[0], workspaceIds[0], 'app-configurator-o02']
      );
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
      report.stage.parentOwnerMismatchFailsCapture = true;
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
            clients.appConfigurator,
            AppConfigCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, profileSnapshot: parent, ...override },
            55000
          )
        ).rejects.toBeDefined();
      child = await rpc(
        clients.appConfigurator,
        AppConfigCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child).toMatchObject({
        participantId: 'app-configurator',
        profileHandleId: parent.handleId,
        profileCaptureId: parent.captureId,
        profileSnapshotAt: parent.snapshotAt,
        sources: [...APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES],
      });
      const bytes: Buffer[] = [];
      let reads = 0;
      for (let offset = 0; offset < child.sizeBytes; ) {
        const length = Math.min(65536, child.sizeBytes - offset);
        const read = await rpc(
          clients.appConfigurator,
          AppConfigCommands.READ_ACCOUNT_EXPORT_CAPTURE,
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
        'app-configurator',
        users[0].id,
        APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
        createHash('sha256')
      );
      const verified = pages.map((page) => verifier.accept(page));
      expect(verified.at(-1)).toBe(true);
      expect(verified.slice(0, -1).some(Boolean)).toBe(false);
      const records = pages.flatMap((page) => page.records ?? []);
      const expectedCounts = {
        AppConfigurationEntity: 252,
        AppInstanceEntity: 252,
        AppMembershipEntity: 253,
      };
      expect(child.sourceRowCounts).toEqual(expectedCounts);
      expect(records).toHaveLength(757);
      expect(pages.at(-1)).toMatchObject({
        source: 'end',
        rowCount: 757,
        complete: true,
        sourceRowCounts: expectedCounts,
      });
      for (const source of APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES)
        expect(
          pages.filter((p: any) => p.source === source).length
        ).toBeGreaterThan(1);
      expect(new Set(records.map((r: any) => r.data.id)).size).toBe(757);
      expect(
        records.every((r: any) =>
          r.source === 'AppMembershipEntity'
            ? r.data.userId === users[0].id &&
              profiles.slice(0, 2).includes(r.data.profileId)
            : r.data.ownerUserId === users[0].id &&
              profiles.slice(0, 2).includes(r.data.ownerProfileId)
        )
      ).toBe(true);
      expect(records.some((r: any) => r.data.appScope === 'other-app')).toBe(
        true
      );
      expect(records.some((r: any) => r.data.name?.includes('🌱'))).toBe(true);
      expect(
        records.find((r: any) => r.data.id === owned[0])!.data
      ).toMatchObject({
        createdAt: '2026-10-23T01:02:03.123456Z',
        updatedAt: '2026-10-23T02:02:03.654321Z',
      });
      expect(
        records.find((r: any) => r.data.id === ownMembershipInSharedApp)!.data
      ).toMatchObject({
        status: 'revoked',
        userId: users[0].id,
        profileId: profiles[0],
        appInstanceId: foreign.at(-1),
      });
      const exported = JSON.stringify(records);
      for (const privateValue of [
        'PRIVATE_',
        users[1].id,
        profiles[2],
        ...foreign.slice(0, 2),
        ...configIds.slice(252),
        ...membershipIds.slice(252),
        'landingPage',
        'manifest',
        'description',
        'features',
        'release',
      ])
        expect(exported).not.toContain(privateValue);
      report.stage.verifiedSourceRowCounts = expectedCounts;
      report.stage.verifiedTerminalCount = 757;
      report.stage.sharedAppOwnMembershipReceipt = true;
      report.stage.configurationSecretsExcluded = true;
      report.stage.verifiedTerminalChecksum = true;
      report.stage.parentProfileBinding = true;
      report.stage.privacyAssertions = true;
      report.stage.multipleByteReads = reads;
      await expect(
        rpc(
          clients.appConfigurator,
          AppConfigCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          {
            ...grant,
            handleId: child.handleId,
            offset: child.sizeBytes + 1,
            length: 1,
          }
        )
      ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_INVALID_RANGE' });
      await authDb.query(
        'UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()-interval \'1 second\' WHERE id=$1',
        [grant.jobId]
      );
      await expect(
        rpc(
          clients.appConfigurator,
          AppConfigCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          {
            ...grant,
            handleId: child.handleId,
            offset: 0,
            length: 1,
          }
        )
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      await authDb.query(
        'UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()+interval \'5 minutes\' WHERE id=$1',
        [grant.jobId]
      );
      const previous = { handleId: child.handleId, captureId: child.captureId };
      await clients.appConfigurator.close();
      await command('docker', ['restart', container], { timeout: 120000 });
      const until = Date.now() + 20000;
      for (;;) {
        clients.appConfigurator = connect(14614);
        try {
          await rpc(
            clients.appConfigurator,
            AppConfigCommands.READ_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, handleId: previous.handleId, offset: 0, length: 1 },
            1500
          );
          throw new Error('Restart served stale App Configurator handle');
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
          .then(() => clients.appConfigurator.close())
          .catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      child = await rpc(
        clients.appConfigurator,
        AppConfigCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child.captureId).not.toBe(previous.captureId);
      await rpc(clients.auth, AuthCommands.Logout, { token: users[0].token });
      await expect(
        rpc(
          clients.appConfigurator,
          AppConfigCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          {
            ...grant,
            handleId: child.handleId,
            offset: 0,
            length: 1,
          }
        )
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
          rpc(
            clients.appConfigurator,
            AppConfigCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
            {
              ...grant,
              handleId: child!.handleId,
            }
          )
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
        configDb.query('DELETE FROM app_memberships WHERE id=ANY($1::uuid[])', [
          [...membershipIds, ownMembershipInSharedApp],
        ])
      );
      await attempt(() =>
        configDb.query(
          'DELETE FROM app_configuration_entity WHERE id=ANY($1::uuid[])',
          [configIds]
        )
      );
      await attempt(() =>
        configDb.query('DELETE FROM app_instances WHERE id=ANY($1::uuid[])', [
          instanceIds,
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
        report.cleanup.allNineDatabaseTableCountsRestored =
          JSON.stringify(baseline) === JSON.stringify(after);
        if (!report.cleanup.allNineDatabaseTableCountsRestored)
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
