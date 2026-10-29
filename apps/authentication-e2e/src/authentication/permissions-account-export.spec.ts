import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Client as PgClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AuthCommands,
  PermissionCommands,
  ProfileCommands,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  PermissionsAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

describe('Permissions account export private integration', () => {
  it('captures owned assignments and reachable definitions over leased RPC, retries, and recaptures after restart', async () => {
    if (process.env.PERMISSIONS_JOB_E2E_MARKER !== 'private-permissions-j15-v1')
      throw Error('Private Permissions fixture marker required');
    const container = process.env.PERMISSIONS_JOB_E2E_CONTAINER_ID || '';
    if (!/^[a-f0-9]{64}$/.test(container))
      throw Error('Private Permissions container required');
    const command = promisify(execFile);
    const inspected = JSON.parse(
      (await command('docker', ['inspect', container], { timeout: 10000 }))
        .stdout
    )[0];
    expect(inspected.Config.Labels['com.docker.compose.project']).toBe(
      'ot-df007-permissions-integration'
    );
    expect(inspected.Config.Labels['com.docker.compose.service']).toBe(
      'permissions'
    );
    expect(
      inspected.Config.Labels[
        'io.optimistic-tanuki.account-rights.private-project'
      ]
    ).toBe('ot-df007-permissions-integration');
    if (
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-forum-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15548'
    )
      throw Error('Private database fixture required');

    const connect = (port: number) =>
      ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port },
      });
    const auth = connect(3001);
    const profile = connect(3002);
    const assets = connect(3005);
    const videos = connect(3022);
    let permissions = connect(3012);
    const databases = [
      'ot_authentication',
      'ot_profile',
      'ot_assets',
      'ot_videos',
      'ot_permissions',
    ].map(
      (database) =>
        new PgClient({
          host: '127.0.0.1',
          port: 15548,
          user: 'postgres',
          password: 'postgres',
          database,
        })
    );
    const [authDb, profileDb, , , permissionDb] = databases;
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
    const scopeIds = [randomUUID(), randomUUID()];
    const roleIds = [randomUUID(), randomUUID(), randomUUID()];
    const permissionIds = [randomUUID(), randomUUID()];
    const assignmentIds = [randomUUID(), randomUUID(), randomUUID()];
    let parent: AccountExportSnapshotDescriptor | undefined;
    let child: PermissionsAccountExportSnapshotDescriptor | undefined;
    let grant: AccountExportCaptureGrant | undefined;
    let previousCaptureId: string | undefined;
    const profileIds = Array.from({ length: 1006 }, (_, index) =>
      index === 0
        ? '00000000-0000-4000-8000-000000000001'
        : index === 1005
        ? 'ffffffff-ffff-4fff-bfff-ffffffffffff'
        : `10000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
    );
    const ownProfileAt = [profileIds[0], profileIds[1005]];
    const fingerprint = async () => {
      const result = await permissionDb.query(
        `SELECT (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)::text FROM role_assignment a) AS assignments, (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id)::text FROM role r) AS roles, (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id)::text FROM permission p) AS permissions, (SELECT jsonb_agg(to_jsonb(rp) ORDER BY rp.role_id,rp.permission_id)::text FROM role_permissions rp) AS links, (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id)::text FROM app_scope s) AS scopes`
      );
      return result.rows[0];
    };
    let before: Record<string, string | null> | undefined;

    try {
      await Promise.all(databases.map((db) => db.connect()));
      await Promise.all(
        [auth, profile, assets, videos, permissions].map((c) => c.connect())
      );
      const password = 'AccountExportE2E!123';
      for (const label of ['owner', 'counterpart']) {
        const email = `perm-${label}-${randomUUID().slice(0, 8)}@example.test`;
        const registered = await rpc(auth, AuthCommands.Register, {
          email,
          fn: 'Permissions',
          ln: label,
          password,
          confirm: password,
          ageEligibilityStatus: 'adult',
        });
        const id = registered.data.user.id;
        users.push({ id, token: '' });
        const login = await rpc(auth, AuthCommands.Login, {
          email,
          password,
          appId: 'client-interface',
        });
        users[users.length - 1].token = login.data.newToken;
      }
      // Bounded batches keep this fixture's SQL parameter count under PostgreSQL's limit.
      for (let offset = 0; offset < profileIds.length; offset += 400) {
        const ids = profileIds.slice(offset, offset + 400);
        const params = ids.flatMap((id) => [id, users[0].id]);
        const values = ids
          .map(
            (_, i) =>
              `($${i * 2 + 1}::uuid,$${
                i * 2 + 2
              }::uuid,'permissions-j15','Permission fixture','','','','','','','')`
          )
          .join(',');
        await profileDb.query(
          `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ${values}`,
          params
        );
        profiles.push(...ids);
      }
      const foreignProfile = randomUUID();
      await profileDb.query(
        `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'permissions-j15','Foreign fixture','','','','','','','')`,
        [foreignProfile, users[1].id]
      );
      profiles.push(foreignProfile);

      before = await fingerprint();
      const scopeNames = [
        `perm-j15-a-${randomUUID()}`,
        `perm-j15-b-${randomUUID()}`,
      ];
      await permissionDb.query(
        `INSERT INTO app_scope(id,name,description,active) VALUES ($1,$2,'scope A',true),($3,$4,'scope B',true)`,
        [scopeIds[0], scopeNames[0], scopeIds[1], scopeNames[1]]
      );
      // Role B and its permission deliberately use different app scopes; the second permission has NULL scope.
      await permissionDb.query(
        `INSERT INTO role(id,name,description,"appScopeId") VALUES ($1,$2,'owned role description',$3),($4,$5,'cross-scope role',$6),($7,$8,'foreign role',$3)`,
        [
          roleIds[0],
          `owned-${randomUUID()}`,
          scopeIds[0],
          roleIds[1],
          `cross-${randomUUID()}`,
          scopeIds[1],
          roleIds[2],
          `foreign-${randomUUID()}`,
        ]
      );
      await permissionDb.query(
        `INSERT INTO permission(id,name,description,resource,action,"targetId","appScopeId") VALUES ($1,$2,'permission metadata','profile','read','opaque-deleted-target',$3),($4,$5,'null-scope permission','videos','view',NULL,NULL)`,
        [
          permissionIds[0],
          `read-${randomUUID()}`,
          scopeIds[1],
          permissionIds[1],
          `view-${randomUUID()}`,
        ]
      );
      await permissionDb.query(
        `INSERT INTO role_permissions(role_id,permission_id) VALUES ($1,$3),($2,$4)`,
        [roleIds[0], roleIds[1], permissionIds[0], permissionIds[1]]
      );
      await permissionDb.query(
        `INSERT INTO role_assignment(id,"profileId","targetId","roleId","appScopeId") VALUES ($1,$2,'opaque-missing-target',$3,$4),($5,$6,NULL,$7,NULL),($8,$9,'foreign-target',$10,$4)`,
        [
          assignmentIds[0],
          ownProfileAt[0],
          roleIds[0],
          scopeIds[0],
          assignmentIds[1],
          ownProfileAt[1],
          roleIds[1],
          assignmentIds[2],
          foreignProfile,
          roleIds[2],
        ]
      );

      const counterpartState = async () =>
        (
          await permissionDb.query(
            `SELECT to_jsonb(a)::text AS assignment,to_jsonb(r)::text AS role FROM role_assignment a JOIN role r ON r.id=a."roleId" WHERE a.id=$1`,
            [assignmentIds[2]]
          )
        ).rows;
      const counterpartBefore = await counterpartState();
      expect(counterpartBefore).toHaveLength(1);

      const requestValue = {
        accountId: users[0].id,
        token: users[0].token,
        appId: 'client-interface',
        idempotencyKey: randomUUID(),
      };
      const created = await rpc(
        auth,
        AuthCommands.CreateAccountExportJob,
        requestValue
      );
      jobIds.push(created.jobId);
      let job = await rpc(
        auth,
        AuthCommands.ResumeAccountExportJob,
        { ...requestValue, jobId: created.jobId },
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
        'chat-collector',
        'classifieds',
      ];
      expect(job.state).toBe('incomplete');
      expect(job.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners
      );
      expect(job.coverageSummary.artifactAvailable).toBe(false);
      expect(job.artifactUrl).toBeNull();

      await permissionDb.query(
        `UPDATE role SET description=repeat('x',65537) WHERE id=$1`,
        [roleIds[0]]
      );
      const failed = await rpc(
        auth,
        AuthCommands.ResumeAccountExportJob,
        { ...requestValue, jobId: created.jobId },
        55000
      );
      expect(failed.state).toBe('failed');
      expect(failed.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners.slice(0, 4)
      );
      expect(failed.coverageSummary.blockers).toContain(
        'permissions-capture-unavailable'
      );
      await permissionDb.query(
        `UPDATE role SET description='owned role description' WHERE id=$1`,
        [roleIds[0]]
      );
      job = await rpc(
        auth,
        AuthCommands.ResumeAccountExportJob,
        { ...requestValue, jobId: created.jobId },
        55000
      );
      expect(job.state).toBe('incomplete');
      expect(job.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners
      );
      expect(job.coverageSummary.artifactAvailable).toBe(false);
      expect(job.artifactUrl).toBeNull();

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
        profile,
        ProfileCommands.OpenAccountExportCapture,
        grant,
        55000
      );
      expect(parent.identityCount).toBe(1006);
      for (const override of [
        { accountId: users[1].id, token: users[1].token },
        { appId: 'forgeofwill' },
        { attempt: grant.attempt + 1 },
        { leaseOwner: randomUUID() },
        { profileSnapshot: { ...parent, captureId: randomUUID() } },
      ])
        await expect(
          rpc(
            permissions,
            PermissionCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, profileSnapshot: parent, ...override },
            55000
          )
        ).rejects.toBeDefined();
      child = await rpc(
        permissions,
        PermissionCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child).toMatchObject({
        participantId: 'permissions',
        profileHandleId: parent.handleId,
        profileCaptureId: parent.captureId,
        profileSnapshotAt: parent.snapshotAt,
        // The generic child registry reports its own identityCount as zero; the parent proves all profile pages.
        identityCount: 0,
      });
      expect(child.sources).toEqual(['roleAssignment', 'rolePermission']);

      const rows: any[] = [];
      let offset = 0;
      while (offset < child.sizeBytes) {
        const length = Math.min(65536, child.sizeBytes - offset);
        const read = await rpc(
          permissions,
          PermissionCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          { ...grant, handleId: child.handleId, offset, length }
        );
        expect(read.offset).toBe(offset);
        const bytes = Buffer.from(read.bytesBase64, 'base64');
        expect(bytes.length).toBe(length);
        rows.push(bytes);
        offset += bytes.length;
      }
      const body = Buffer.concat(rows);
      expect(createHash('sha256').update(body).digest('hex')).toBe(
        child.sha256
      );
      const pages = body
        .toString('utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      const records = pages.flatMap((page) => page.records);
      const terminal = pages[pages.length - 1];
      expect(terminal).toMatchObject({
        source: 'end',
        complete: true,
        rowCount: 4,
      });
      expect(terminal.checksum).toBe(
        createHash('sha256')
          .update(
            records.map((record) => `${JSON.stringify(record)}\n`).join('')
          )
          .digest('hex')
      );
      expect(child.sourceRowCounts).toEqual({
        roleAssignment: 2,
        rolePermission: 2,
      });
      const assignmentRecords = records
        .filter((record) => record.source === 'roleAssignment')
        .map((record) => record.data);
      const rolePermissionRecords = records
        .filter((record) => record.source === 'rolePermission')
        .map((record) => record.data);
      const expectedAssignments = await permissionDb.query(
        `SELECT id::text,"profileId","targetId","roleId"::text AS "roleId","appScopeId"::text AS "appScopeId" FROM role_assignment WHERE lower("profileId")=ANY($1::text[]) ORDER BY id`,
        [profileIds]
      );
      expect(assignmentRecords.map((r) => r.id).sort()).toEqual(
        expectedAssignments.rows.map((r) => r.id).sort()
      );
      expect(assignmentRecords.map((r) => r.profileId).sort()).toEqual(
        ownProfileAt.slice().sort()
      );
      expect(
        assignmentRecords.find((r) => r.id === assignmentIds[0]).appScope
      ).toMatchObject({ id: scopeIds[0], name: scopeNames[0] });
      expect(
        assignmentRecords.find((r) => r.id === assignmentIds[1]).appScope
      ).toBeNull();
      expect(
        assignmentRecords.find((r) => r.id === assignmentIds[0]).role.appScope
      ).toMatchObject({ id: scopeIds[0], name: scopeNames[0] });
      expect(
        assignmentRecords.find((r) => r.id === assignmentIds[1]).role.appScope
      ).toMatchObject({ id: scopeIds[1], name: scopeNames[1] });
      expect(assignmentRecords.some((r) => r.id === assignmentIds[2])).toBe(
        false
      );
      expect(
        assignmentRecords.find((r) => r.id === assignmentIds[0]).targetId
      ).toBe('opaque-missing-target');
      const expectedLinks = await permissionDb.query(
        `SELECT rp.role_id::text AS "roleId",rp.permission_id::text AS "permissionId" FROM role_permissions rp WHERE EXISTS (SELECT 1 FROM role_assignment a WHERE a."roleId"=rp.role_id AND lower(a."profileId")=ANY($1::text[])) ORDER BY rp.role_id,rp.permission_id`,
        [profileIds]
      );
      expect(
        rolePermissionRecords.map((r) => `${r.roleId}/${r.permissionId}`).sort()
      ).toEqual(
        expectedLinks.rows.map((r) => `${r.roleId}/${r.permissionId}`).sort()
      );
      expect(
        rolePermissionRecords.find((r) => r.permissionId === permissionIds[0])
          .permission.appScope
      ).toMatchObject({ id: scopeIds[1], name: scopeNames[1] });
      expect(
        rolePermissionRecords.find((r) => r.permissionId === permissionIds[0])
          .role.appScope
      ).toMatchObject({ id: scopeIds[0], name: scopeNames[0] });
      expect(
        rolePermissionRecords.find((r) => r.permissionId === permissionIds[1])
          .role.appScope
      ).toMatchObject({ id: scopeIds[1], name: scopeNames[1] });
      expect(
        rolePermissionRecords.find((r) => r.permissionId === permissionIds[1])
          .permission.appScope
      ).toBeNull();

      for (const override of [
        { accountId: users[1].id, token: users[1].token },
        { appId: 'forgeofwill' },
        { attempt: grant.attempt + 1 },
        { leaseOwner: randomUUID() },
      ])
        await expect(
          rpc(permissions, PermissionCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
            ...grant,
            ...override,
            handleId: child.handleId,
            offset: 0,
            length: 1,
          })
        ).rejects.toBeDefined();
      await authDb.query(
        `UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE id=$1`,
        [created.jobId]
      );
      await expect(
        rpc(permissions, PermissionCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
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
      await permissions.close();

      await command('docker', ['restart', container], { timeout: 120000 });
      const deadline = Date.now() + 20000;
      while (true) {
        permissions = connect(3012);
        try {
          await rpc(
            permissions,
            PermissionCommands.READ_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, handleId: previousHandleId, offset: 0, length: 1 },
            1500
          );
          throw Error('Restart unexpectedly served a stale handle');
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
        await permissions.close();
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      child = await rpc(
        permissions,
        PermissionCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child.captureId).not.toBe(previousCaptureId);
      expect(child.profileCaptureId).toBe(parent.captureId);
      await rpc(auth, AuthCommands.Logout, { token: users[0].token });
      await expect(
        rpc(permissions, PermissionCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      expect(await counterpartState()).toEqual(counterpartBefore);
    } finally {
      if (child && grant)
        await rpc(
          permissions,
          PermissionCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
          { ...grant, handleId: child.handleId }
        ).catch(() => undefined);
      if (parent && grant)
        await rpc(profile, ProfileCommands.ReleaseAccountExportCapture, {
          ...grant,
          handleId: parent.handleId,
        }).catch(() => undefined);
      for (const user of users)
        if (user.token)
          await rpc(auth, AuthCommands.Logout, { token: user.token }).catch(
            () => undefined
          );
      {
        await permissionDb.query(
          'DELETE FROM role_assignment WHERE id=ANY($1::uuid[])',
          [assignmentIds]
        );
        await permissionDb.query(
          'DELETE FROM role_permissions WHERE role_id=ANY($1::uuid[])',
          [roleIds]
        );
        await permissionDb.query(
          'DELETE FROM permission WHERE id=ANY($1::uuid[])',
          [permissionIds]
        );
        await permissionDb.query('DELETE FROM role WHERE id=ANY($1::uuid[])', [
          roleIds,
        ]);
        await permissionDb.query(
          'DELETE FROM app_scope WHERE id=ANY($1::uuid[])',
          [scopeIds]
        );
      }
      if (profiles.length)
        await profileDb.query('DELETE FROM profile WHERE id=ANY($1::uuid[])', [
          profiles,
        ]);
      if (jobIds.length)
        await authDb.query(
          'DELETE FROM account_export_jobs WHERE id=ANY($1::uuid[])',
          [jobIds]
        );
      const ids = users.map((user) => user.id);
      if (ids.length) {
        await authDb.query('DELETE FROM token WHERE "userId"=ANY($1::uuid[])', [
          ids,
        ]);
        const keyRows = await authDb.query(
          'SELECT "keyDataId" FROM user_entity WHERE id=ANY($1::uuid[])',
          [ids]
        );
        const keyIds = keyRows.rows.map((row) => row.keyDataId).filter(Boolean);
        await authDb.query(
          'UPDATE user_entity SET "keyDataId"=NULL WHERE id=ANY($1::uuid[])',
          [ids]
        );
        await authDb.query(
          'UPDATE key_datum SET "userId"=NULL WHERE id=ANY($1::uuid[])',
          [keyIds]
        );
        await authDb.query('DELETE FROM user_entity WHERE id=ANY($1::uuid[])', [
          ids,
        ]);
        await authDb.query('DELETE FROM key_datum WHERE id=ANY($1::uuid[])', [
          keyIds,
        ]);
      }
      if (before) expect(await fingerprint()).toEqual(before);
      await Promise.all(databases.map((db) => db.end().catch(() => undefined)));
      await Promise.all(
        [auth, profile, assets, videos, permissions].map((client) =>
          Promise.resolve()
            .then(() => client.close())
            .catch(() => undefined)
        )
      );
    }
  }, 180000);
});
