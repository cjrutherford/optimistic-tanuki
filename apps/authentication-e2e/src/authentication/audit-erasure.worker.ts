/** N04 disposable PostgreSQL owner/DI proof; never an account-deletion endpoint. */
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import profileDatabase from '../../../profile/src/app/loadDatabase';
import assetsDatabase from '../../../assets/src/app/loadDatabase';
import socialDatabase from '../../../social/src/app/loadDatabase';
import forumDatabase from '../../../forum/src/app/loadDatabase';
import { ProfileAuditErasureService } from '../../../profile/src/app/audit-erasure.service';
import { AssetsAuditErasureService } from '../../../assets/src/app/audit-erasure.service';
import { SocialAuditErasureService } from '../../../social/src/app/audit-erasure.service';
import { ForumAuditErasureService } from '../../../forum/src/app/audit-erasure.service';
import { ProfileAccountExportOwnerService } from '../../../profile/src/app/account-export-owner.service';
import { AssetsAccountExportOwnerService } from '../../../assets/src/app/account-export-owner.service';
import { createSocialAccountExportSources } from '../../../social/src/app/account-export-sources';
import { createForumAccountExportSources } from '../../../forum/src/app/account-export-sources';
import {
  installPayloadFreeLogging,
  AuditErasureReceipt,
} from '@optimistic-tanuki/logger';

type Owner = 'profile' | 'assets' | 'social' | 'forum';
type Row = Record<string, any>;
type Eraser = {
  eraseParticipation(subject: {
    accountId: string;
    profileIds: string[];
  }): Promise<AuditErasureReceipt>;
};
const owners: Owner[] = ['profile', 'assets', 'social', 'forum'];
const factories = {
  profile: profileDatabase,
  assets: assetsDatabase,
  social: socialDatabase,
  forum: forumDatabase,
};
const services = {
  profile: ProfileAuditErasureService,
  assets: AssetsAuditErasureService,
  social: SocialAuditErasureService,
  forum: ForumAuditErasureService,
};
const tables = {
  profile: ['guardian_profile_activity'],
  assets: ['guardian_asset_activity'],
  social: [
    'activity',
    'community_membership_audit',
    'content_moderation_action',
    'guardian_content_audit',
    'profile_view',
  ],
  forum: ['forum_moderation_action'],
};
const A = randomUUID(),
  B = randomUUID(),
  C = randomUUID(),
  PA = randomUUID(),
  PB = randomUUID(),
  HISTORICAL = randomUUID();
const marker = 'N04_PRIVATE_ERASED_AUDIT_PAYLOAD';
const assert = (condition: unknown, code: string) => {
  if (!condition) throw new Error(code);
};
let step = 'setup';
async function run() {
  if (process.env['OT_N04_PRIVATE_FIXTURE'] !== '1')
    throw new Error('PRIVATE_FIXTURE_REQUIRED');
  const port = Number(process.env['OT_N04_PORT']);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
    throw new Error('PRIVATE_PORT_REQUIRED');
  installPayloadFreeLogging();
  const databases = {} as Record<Owner, DataSource>,
    contexts: TestingModule[] = [];
  const erasers = {} as Record<Owner, Eraser>,
    inserted: { owner: Owner; table: string; id: string }[] = [];
  const baseline = {} as Record<Owner, Row>,
    unrelated: { owner: Owner; table: string; id: string; before: string }[] =
      [];
  const hashes = (data: unknown) =>
    createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const rows = async (owner: Owner, table: string) =>
    databases[owner].query(
      `SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY t."id"::text`
    );
  const snapshot = async (owner: Owner) => {
    const result: Row = {};
    for (const { tablename } of await databases[owner].query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    ))
      result[tablename] = hashes(
        await databases[owner].query(
          `SELECT to_jsonb(t) AS row FROM "${tablename}" t ORDER BY to_jsonb(t)::text`
        )
      );
    return result;
  };
  const seed = async (owner: Owner, table: string, overrides: Row) => {
    const ds = databases[owner];
    const values: Row = { id: randomUUID(), ...overrides };
    const columns: Row[] = await ds.query(
      "SELECT column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [table]
    );
    assert(columns.length, 'UNKNOWN_FIXTURE_TABLE');
    for (const column of columns) {
      const key = column.column_name;
      if (
        !(key in values) &&
        column.is_nullable === 'NO' &&
        column.column_default === null
      ) {
        if (column.data_type === 'USER-DEFINED')
          values[key] = (
            await ds.query(
              'SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 ORDER BY enumsortorder LIMIT 1',
              [column.udt_name]
            )
          )[0].enumlabel;
        else if (column.data_type === 'uuid') values[key] = randomUUID();
        else if (column.data_type === 'boolean') values[key] = false;
        else if (/int|numeric|double|real/.test(column.data_type))
          values[key] = 0;
        else if (/timestamp|date/.test(column.data_type))
          values[key] = new Date();
        else if (column.data_type === 'ARRAY') values[key] = [];
        else if (/json/.test(column.data_type)) values[key] = {};
        else values[key] = 'fixture';
      }
      if (
        key in values &&
        /json/.test(column.data_type) &&
        typeof values[key] !== 'string'
      )
        values[key] = JSON.stringify(values[key]);
      if (
        key in values &&
        !/json|ARRAY/.test(column.data_type) &&
        Array.isArray(values[key])
      )
        values[key] = JSON.stringify(values[key]);
    }
    const fields = Object.keys(values);
    assert(
      fields.every((key) => columns.some((c) => c.column_name === key)),
      'UNKNOWN_FIXTURE_COLUMN'
    );
    await ds.query(
      `INSERT INTO "${table}" (${fields
        .map((key) => `"${key}"`)
        .join(',')}) VALUES (${fields.map((_, i) => '$' + (i + 1)).join(',')})`,
      fields.map((key) => values[key])
    );
    inserted.push({ owner, table, id: values.id });
    return values.id as string;
  };
  const remember = async (owner: Owner, table: string, id: string) =>
    unrelated.push({
      owner,
      table,
      id,
      before: hashes(
        (await rows(owner, table)).filter((x: Row) => x.row.id === id)
      ),
    });
  const guardian = async (
    owner: Owner,
    accountA: string,
    dependent: string,
    profile: string
  ) =>
    seed(owner, tables[owner].find((t) => t.includes('guardian'))!, {
      actorUserId: accountA,
      dependentUserId: dependent,
      [owner === 'social' ? 'dependentProfileId' : 'profileId']: profile,
      appId: 'client-interface',
      operation:
        owner === 'profile'
          ? 'profile.manage'
          : owner === 'assets'
          ? 'read'
          : 'update',
      [owner === 'social' ? 'changedFields' : 'changedFieldNames']:
        accountA === A || dependent === A ? [marker] : ['name'],
      ...(owner === 'assets'
        ? { assetId: randomUUID() }
        : owner === 'social'
        ? { resourceId: randomUUID(), resourceType: 'post' }
        : {}),
    });
  const report: Row = {
    status: 'FAIL',
    owners: {},
    policy:
      'Preserve minimal history; erase selected identifying fields and unreviewed payload',
    limits: [
      'Internal owner primitives with production named-connection DI; no public RPC or account deletion authority',
      'Future producer fencing and authenticated durable deletion job remain D00',
      'Current SQL writers are serialized within each owner transaction; independent writes after acknowledgement are not a permanent fence',
      'Active authorization grants and underlying content are not passive audit data and are not mutated',
    ],
  };
  try {
    for (const owner of owners) {
      step = owner + '.initialize';
      const config = new ConfigService({
        database: {
          host: '127.0.0.1',
          port,
          username: 'postgres',
          password: '',
          database: 'n04_' + owner,
        },
      });
      const ds = new DataSource({
        ...factories[owner](config),
        synchronize: false,
        migrationsRun: false,
        migrations: [resolve('apps', owner, 'migrations/*.ts')],
      });
      databases[owner] = ds;
      await ds.initialize();
      baseline[owner] = await snapshot(owner);
      const module = await Test.createTestingModule({
        providers: [
          services[owner],
          { provide: owner.toUpperCase() + '_CONNECTION', useValue: ds },
        ],
      }).compile();
      contexts.push(module);
      erasers[owner] = module.get(services[owner] as any) as Eraser;
    }
    step = 'seed-content';
    for (const [id, userId] of [
      [PA, A],
      [PB, B],
    ])
      await seed('profile', 'profile', {
        id,
        userId,
        appScope: 'client-interface',
      });
    for (const owner of owners) {
      if (owner === 'profile')
        for (const id of [PA, PB]) await remember(owner, 'profile', id);
      if (owner === 'assets')
        for (const profileId of [PA, PB]) {
          const id = await seed(owner, 'asset_entity', {
            profileId,
            name: 'kept-image.png',
            storagePath: 'private-fixture-no-physical-file',
          });
          await remember(owner, 'asset_entity', id);
        }
      if (owner === 'social')
        for (const [userId, profileId] of [
          [A, PA],
          [B, PB],
        ]) {
          const id = await seed(owner, 'post', {
            userId,
            profileId,
            content: 'Underlying content remains intact',
            appScope: 'client-interface',
          });
          await remember(owner, 'post', id);
        }
      if (owner === 'forum') {
        const topic = await seed(owner, 'topic', {
          userId: B,
          profileId: PB,
          appScope: 'client-interface',
        });
        const thread = await seed(owner, 'thread', {
          userId: B,
          profileId: PB,
          appScope: 'client-interface',
          topicId: topic,
        });
        const post = await seed(owner, 'forum_post', {
          userId: B,
          profileId: PB,
          appScope: 'client-interface',
          threadId: thread,
          content: 'Kept counterpart conversation',
        });
        for (const [table, id] of [
          ['topic', topic],
          ['thread', thread],
          ['forum_post', post],
        ])
          await remember(owner, table, id);
      }
    }
    const beforeCounts: Row = {};
    const historyBefore: Record<string, Row[]> = {};
    for (const owner of ['profile', 'assets', 'social'] as Owner[]) {
      await guardian(owner, A, B, PB);
      await guardian(owner, B, A, PA);
      await guardian(owner, B, A, HISTORICAL);
      // A retained historical profile reference can now belong to the deleting account.
      await guardian(owner, C, B, PA);
      const foreign = await guardian(owner, C, B, PB);
      await remember(
        owner,
        tables[owner].find((t) => t.includes('guardian'))!,
        foreign
      );
    }
    await seed('social', 'activity', {
      profileId: PA.toUpperCase(),
      description: marker,
      resourceId: randomUUID(),
      resourceType: 'post',
    });
    const ownActivity = await seed('social', 'activity', {
      profileId: PB,
      description: 'Kept foreign activity',
    });
    await remember('social', 'activity', ownActivity);
    for (const [actorId, subjectId] of [
      ['  ' + A.toUpperCase() + '  ', PB],
      [B, '  ' + PA.toUpperCase() + '  '],
      [B, PB],
    ]) {
      const id = await seed('social', 'community_membership_audit', {
        actorId,
        subjectId,
        workspaceId: randomUUID(),
        actor: 'member',
        action: 'join',
        from: 'none',
        to: 'active',
      });
      if (actorId === B && subjectId === PB)
        await remember('social', 'community_membership_audit', id);
    }
    for (const [viewerId, profileId] of [
      [A, PB],
      [B, PA],
      [B, PB],
    ]) {
      const id = await seed('social', 'profile_view', {
        viewerId,
        profileId,
        source:
          viewerId === A || profileId === PA ? marker : 'kept-private-source',
      });
      if (viewerId === B && profileId === PB)
        await remember('social', 'profile_view', id);
    }
    for (const [owner, table] of [
      ['social', 'content_moderation_action'],
      ['forum', 'forum_moderation_action'],
    ] as [Owner, string][]) {
      for (const actorProfileId of [PA, PB]) {
        const id = await seed(owner, table, {
          actorProfileId,
          subjectId: randomUUID(),
          appScope: 'client-interface',
          action: 'content_moderation',
          subjectType: 'post',
          details: {
            private: actorProfileId === PA ? marker : 'counterpart-data',
          },
        });
        if (actorProfileId === PB) await remember(owner, table, id);
      }
    }
    for (const owner of owners) {
      step = owner + '.erase';
      beforeCounts[owner] = {};
      for (const table of tables[owner]) {
        const snapshot = await rows(owner, table);
        beforeCounts[owner][table] = snapshot.length;
        historyBefore[owner + '.' + table] = snapshot;
      }
      const receipt = await erasers[owner].eraseParticipation({
        accountId: A.toUpperCase(),
        profileIds: [PA.toUpperCase()],
      });
      assert(receipt.allDeclaredSourcesVerified, 'ERASURE_NOT_VERIFIED');
      for (const table of tables[owner]) {
        const after = await rows(owner, table);
        assert(
          after.length ===
            beforeCounts[owner][table] - (table === 'activity' ? 1 : 0),
          'HISTORY_ROW_COUNT_CHANGED'
        );
        for (const { row } of after) {
          const old = historyBefore[owner + '.' + table].find(
            (item) => item.row.id === row.id
          )?.row;
          assert(old, 'HISTORY_ID_CHANGED');
          for (const key of [
            'createdAt',
            'viewedAt',
            'operation',
            'action',
            'type',
            'appId',
            'appScope',
            'from',
            'to',
          ])
            if (old[key] !== undefined)
              assert(
                JSON.stringify(row[key]) === JSON.stringify(old[key]),
                'HISTORY_CONTEXT_CHANGED'
              );
        }
        assert(
          !JSON.stringify(after).includes(marker),
          'PRIVATE_PAYLOAD_REMAINS'
        );
        assert(
          !JSON.stringify(after).toLowerCase().includes(A),
          'ACCOUNT_ID_REMAINS'
        );
        assert(
          !JSON.stringify(after).toLowerCase().includes(PA),
          'PROFILE_ID_REMAINS'
        );
        assert(
          !JSON.stringify(after).toLowerCase().includes(HISTORICAL),
          'HISTORICAL_DEPENDENT_PROFILE_REMAINS'
        );
      }
      const retry = await erasers[owner].eraseParticipation({
        accountId: A,
        profileIds: [PA],
      });
      assert(
        retry.sources.every((source) => source.changed === 0),
        'IDEMPOTENCY_FAILED'
      );
      report.owners[owner] = { receipt, idempotent: true };
    }
    // Account-only input must not reinterpret a counterpart profile as an account.
    const accountOnlyId = await guardian('profile', A, B, PB);
    await erasers.profile.eraseParticipation({ accountId: A, profileIds: [] });
    const accountOnly = (
      await rows('profile', 'guardian_profile_activity')
    ).find((item: Row) => item.row.id === accountOnlyId).row;
    assert(
      accountOnly.actorUserId === null &&
        accountOnly.dependentUserId === B &&
        accountOnly.profileId === PB,
      'ACCOUNT_PROFILE_DOMAINS_MIXED'
    );
    report.accountOnlyInputPreservesCounterpartProfile = true;
    for (const row of unrelated)
      assert(
        hashes(
          (await rows(row.owner, row.table)).filter(
            (x: Row) => x.row.id === row.id
          )
        ) === row.before,
        'COUNTERPART_OR_CONTENT_CHANGED'
      );
    for (const owner of owners) {
      step = owner + '.faults';
      const table =
        owner === 'forum'
          ? 'forum_moderation_action'
          : owner === 'social'
          ? 'guardian_content_audit'
          : tables[owner][0];
      const failId =
        owner === 'forum'
          ? await seed(owner, table, {
              actorProfileId: PA,
              subjectId: randomUUID(),
              details: { private: marker },
              appScope: 'client-interface',
              action: 'content_moderation',
              subjectType: 'post',
            })
          : await guardian(owner, A, B, PB);
      if (owner === 'social')
        await seed(owner, 'activity', { profileId: PA, description: marker });
      const before = await snapshot(owner);
      const field =
        owner === 'forum'
          ? 'details'
          : owner === 'social'
          ? 'changedFields'
          : 'changedFieldNames';
      const value =
        owner === 'profile'
          ? "ARRAY['private-trigger-payload']::text[]"
          : owner === 'social'
          ? '\'["private-trigger-payload"]\''
          : '\'["private-trigger-payload"]\'::jsonb';
      const definition =
        owner === 'forum' ? '\'{"private":true}\'::jsonb' : value;
      await databases[owner].query(
        `CREATE FUNCTION ot_n04_payload_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${failId}'::uuid THEN NEW."${field}" := ${definition}; END IF; RETURN NEW; END $$`
      );
      await databases[owner].query(
        `CREATE TRIGGER ot_n04_payload_fault BEFORE UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION ot_n04_payload_fault()`
      );
      let rejected = false;
      try {
        await erasers[owner].eraseParticipation({
          accountId: A,
          profileIds: [PA],
        });
      } catch {
        rejected = true;
      }
      assert(
        rejected && hashes(await snapshot(owner)) === hashes(before),
        'FAILED_READBACK_DID_NOT_ROLL_BACK'
      );
      await databases[owner].query(
        `DROP TRIGGER ot_n04_payload_fault ON "${table}"`
      );
      await databases[owner].query('DROP FUNCTION ot_n04_payload_fault()');
      await erasers[owner].eraseParticipation({
        accountId: A,
        profileIds: [PA],
      });
      report.owners[owner].payloadFaultRollbackAndRetry = true;
    }
    // A writer already in flight must finish before erasure's table lock, and
    // its committed row must be included before acknowledgement.
    step = 'profile.queued-writer';
    const writer = databases.profile.createQueryRunner();
    await writer.connect();
    await writer.startTransaction();
    const lateId = randomUUID();
    inserted.push({
      owner: 'profile',
      table: 'guardian_profile_activity',
      id: lateId,
    });
    await writer.query(
      'INSERT INTO guardian_profile_activity (id,"actorUserId","dependentUserId","profileId","appId",operation,"changedFieldNames") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7)',
      [lateId, A, B, PB, 'client-interface', 'profile.manage', [marker]]
    );
    const erasure = erasers.profile.eraseParticipation({
      accountId: A,
      profileIds: [PA],
    });
    try {
      const until = Date.now() + 3000;
      let waiting = false;
      while (Date.now() < until) {
        waiting = (
          await databases.profile.query(
            "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'LOCK TABLE%') AS waiting"
          )
        )[0].waiting;
        if (waiting) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert(waiting, 'ERASER_DID_NOT_WAIT_FOR_WRITER');
      await writer.commitTransaction();
      await erasure;
      const late = (await rows('profile', 'guardian_profile_activity')).find(
        (item: Row) => item.row.id === lateId
      ).row;
      assert(
        late.actorUserId === null && late.dependentUserId === B,
        'LATE_SQL_WRITER_ESCAPED_ERASURE'
      );
      report.inFlightWriterDrainedBeforeAcknowledgement = true;
    } finally {
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      await writer.release();
      await erasure.catch(() => undefined);
    }
    // Direct production receipt projectors, backed by the real migrated rows.
    step = 'counterpart-receipts';
    const profileReader = new ProfileAccountExportOwnerService(
      databases.profile,
      {} as never
    ) as any;
    const runner = databases.profile.createQueryRunner();
    await runner.connect();
    const profileReceipts = [];
    for await (const row of profileReader.guardianActivityRows(
      runner,
      B,
      new AbortController().signal,
      Date.now() + 20_000,
      () => false
    ))
      profileReceipts.push(row);
    await runner.release();
    assert(profileReceipts.length >= 3, 'PROFILE_COUNTERPART_RECEIPTS_MISSING');
    const assetReader = new AssetsAccountExportOwnerService(
      databases.assets,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    ) as any;
    assetReader.profileLookup = async (id: string) =>
      (
        await databases.profile.query(
          'SELECT "userId","appScope" FROM profile WHERE id=$1::uuid',
          [id]
        )
      )[0];
    assetReader.scopeHas = async (_r: unknown, _t: string, id: string) =>
      id === PB;
    const assetRunner = databases.assets.createQueryRunner();
    await assetRunner.connect();
    for (const { row } of await rows('assets', 'guardian_asset_activity'))
      if (row.actorUserId === B || row.dependentUserId === B) {
        const result = await assetReader.validateActivity(
          {
            ...row,
            createdAt: new Date(row.createdAt).toISOString(),
            changedFieldNames: JSON.stringify(row.changedFieldNames),
          },
          'unused',
          B,
          assetRunner,
          new AbortController().signal,
          Date.now() + 20_000
        );
        assert(
          !JSON.stringify(result).includes(A),
          'ASSET_COUNTERPART_RECEIPT_LEAK'
        );
      }
    await assetRunner.release();
    for (const owner of ['social', 'forum'] as Owner[]) {
      const qr = databases[owner].createQueryRunner();
      await qr.connect();
      await qr.query(
        'CREATE TEMP TABLE n04_owned_profiles (id uuid PRIMARY KEY)'
      );
      await qr.query('INSERT INTO n04_owned_profiles VALUES ($1::uuid)', [PB]);
      const sources =
        owner === 'social'
          ? createSocialAccountExportSources('n04_owned_profiles')
          : createForumAccountExportSources('n04_owned_profiles');
      for (const source of sources)
        if (
          [
            'CommunityMembershipAudit',
            'GuardianContentAudit',
            'ContentModerationAction',
            'ProfileView',
            'ForumModerationAction',
          ].includes(source.source)
        ) {
          const data = await qr.query(source.sql, [B, null, 1000]);
          for (const row of data)
            assert(
              !JSON.stringify(source.project(row, B)).toLowerCase().includes(A),
              'COUNTERPART_PROJECTOR_LEAK'
            );
        }
      await qr.query('DROP TABLE n04_owned_profiles');
      await qr.release();
    }
    report.counterpartProjectorsPassed = true;
    for (const owner of owners) {
      step = owner + '.erased-receipt-reconnect';
      const erasedSnapshot = await snapshot(owner);
      await databases[owner].destroy();
      await databases[owner].initialize();
      assert(
        hashes(erasedSnapshot) === hashes(await snapshot(owner)),
        'ERASED_RECEIPTS_CHANGED_AFTER_RECONNECT'
      );
      report.owners[owner].erasedReceiptsSurviveReconnect = true;
      step = owner + '.rollback-refusal';
      const before = await snapshot(owner);
      let refused = false;
      try {
        await databases[owner].undoLastMigration({ transaction: 'all' });
      } catch {
        refused = true;
      }
      assert(
        refused && hashes(before) === hashes(await snapshot(owner)),
        'POST_ERASURE_ROLLBACK_DID_NOT_PRESERVE_HISTORY'
      );
      report.owners[owner].unsafeRollbackRefused = true;
    }
    report.status = 'PASS';
  } finally {
    step = 'cleanup';
    for (const owner of owners)
      if (databases[owner]?.isInitialized) {
        for (const table of tables[owner]) {
          await databases[owner].query(
            `DROP TRIGGER IF EXISTS ot_n04_payload_fault ON "${table}"`
          );
        }
        await databases[owner].query(
          'DROP FUNCTION IF EXISTS ot_n04_payload_fault()'
        );
      }
    for (const row of inserted.reverse())
      if (databases[row.owner]?.isInitialized)
        await databases[row.owner].query(
          `DELETE FROM "${row.table}" WHERE id=$1::uuid`,
          [row.id]
        );
    for (const owner of owners)
      if (databases[owner]?.isInitialized) {
        const restored =
          hashes(baseline[owner]) === hashes(await snapshot(owner));
        assert(restored, 'BASELINE_NOT_RESTORED');
        await databases[owner].destroy();
        await databases[owner].initialize();
        assert(
          hashes(baseline[owner]) === hashes(await snapshot(owner)),
          'RESTART_READBACK_FAILED'
        );
        report.owners[owner] = {
          ...report.owners[owner],
          baselineRestored: true,
          restartReadback: true,
        };
        await databases[owner].destroy();
      }
    for (const context of contexts) await context.close();
    await writeFile(
      process.env['OT_N04_REPORT'] || '/tmp/ot-n04-report.json',
      JSON.stringify(report, null, 2) + '\n'
    );
  }
}
run().catch((error) => {
  process.stderr.write(
    `N04_PRIVATE_PROOF_FAILED ${step} ${String(error?.message).slice(0, 180)}\n`
  );
  process.exitCode = 1;
});
