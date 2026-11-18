require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DataSource } = require('typeorm');
const {
  isPaused,
  listControls,
  ProviderPausedError,
  setControl,
} = require('../src/operating-controls');
const { collectOpsMetrics } = require('../src/ops-metrics');
const {
  createExportJob,
  getExportJob,
  runExportPass,
} = require('../src/export-job');
const { reserveProviderBudget } = require('../src/provider-budget');
const { runTaxonomyBatch } = require('../src/taxonomy-reclassification');
const { beginRun, classifyStageError } = require('../src/acquisition-run');

// Disposable, loopback-only database named s9_scratch_*. Data is committed there; the caller drops the database.
const url = process.env.S9_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s9_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S9_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s9_scratch_* database required');
}

test(
  'operating controls: versioning, audit, enforcement points and ops metrics',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    // Rerunnable on the same scratch database.
    await ds.query(
      'TRUNCATE directory_operating_control, directory_operating_control_event, directory_export_job, directory_provider_budget_attempt, directory_acquisition_run CASCADE'
    );
    const dir = mkdtempSync(join(tmpdir(), 's9-ops-'));
    const actor = randomUUID();
    const set = (
      key,
      paused,
      expectedVersion,
      reason = paused ? 'maintenance' : null
    ) =>
      setControl(ds, { key, paused, reason, actorId: actor, expectedVersion });
    try {
      // Absent rows read as running at version 0, in a fixed order.
      const initial = await listControls(ds);
      assert.deepEqual(
        initial.map((c) => [c.key, c.paused, c.version]),
        [
          ['provider_acquisition', false, 0],
          ['export_worker', false, 0],
          ['taxonomy_worker', false, 0],
        ]
      );

      // Optimistic versioning.
      const first = await set('export_worker', true, 0);
      assert.equal(first.ok, true);
      assert.equal(first.control.version, 1);
      assert.equal(first.control.paused, true);
      assert.deepEqual(await set('export_worker', false, 0), {
        ok: false,
        code: 'stale_version',
      });
      assert.deepEqual(await set('export_worker', false, 5), {
        ok: false,
        code: 'stale_version',
      });
      assert.equal((await listControls(ds))[1].version, 1);
      // Invalid input never reaches the database.
      await assert.rejects(
        set('export_worker', true, 1, ''),
        /Invalid operating control/
      );
      await assert.rejects(
        set('withdrawal_worker', true, 0),
        /Invalid operating control/
      );
      await assert.rejects(
        set('export_worker', true, 1, 'x'.repeat(501)),
        /Invalid operating control/
      );

      // Audit: only successful changes write an event, with the version they replaced.
      const events = await ds.query(
        `SELECT "key",paused,reason,"actorId","previousVersion" FROM directory_operating_control_event ORDER BY "at"`
      );
      assert.deepEqual(events, [
        {
          key: 'export_worker',
          paused: true,
          reason: 'maintenance',
          actorId: actor,
          previousVersion: 0,
        },
      ]);

      // Export worker: a paused pass claims nothing; unpausing resumes the queued job.
      const job = (
        await createExportJob(ds, {
          id: randomUUID(),
          actorId: actor,
          releaseId: 'rel-1',
        })
      ).job;
      const pass = () => runExportPass(ds, { dir, policyFor: () => undefined });
      assert.equal(await isPaused(ds, 'export_worker'), true);
      assert.equal(await pass(), 0);
      assert.equal((await getExportJob(ds, job.id)).status, 'queued');
      assert.equal((await set('export_worker', false, 1)).ok, true);
      assert.equal(await pass(), 1);
      assert.notEqual((await getExportJob(ds, job.id)).status, 'queued');
      assert.equal(
        (
          await ds.query(
            `SELECT count(*)::int AS n FROM directory_operating_control_event`
          )
        )[0].n,
        2
      );

      // Taxonomy worker: a paused batch claims no run; unpaused it claims the oldest (and fails on the missing mapping).
      const runId = randomUUID();
      await ds.query(
        `INSERT INTO directory_taxonomy_run (id,"mappingVersion",scope,mode,reason) VALUES ($1,'s9-missing','all','dry_run','s9')`,
        [runId]
      );
      assert.equal((await set('taxonomy_worker', true, 0)).ok, true);
      assert.equal(await runTaxonomyBatch(ds), false);
      assert.equal(
        (
          await ds.query(
            `SELECT status,attempts FROM directory_taxonomy_run WHERE id=$1`,
            [runId]
          )
        )[0].attempts,
        0
      );
      assert.equal((await set('taxonomy_worker', false, 1)).ok, true);
      await assert.rejects(
        runTaxonomyBatch(ds),
        /Mapping version is not installed/
      );
      await ds.query(`DELETE FROM directory_taxonomy_run WHERE id=$1`, [runId]);

      // Provider acquisition: budget reservation and run start fail closed while paused.
      const attempt = () => ({
        attemptId: randomUUID(),
        provider: 'overture',
        operation: 'range.get',
        maxCostCents: 1,
      });
      assert.equal((await set('provider_acquisition', true, 0)).ok, true);
      const blocked = attempt();
      await assert.rejects(
        reserveProviderBudget(ds, blocked),
        (e) =>
          e instanceof ProviderPausedError && e.reason === 'provider_paused'
      );
      assert.equal(
        (
          await ds.query(
            `SELECT 1 FROM directory_provider_budget_attempt WHERE "attemptId"=$1`,
            [blocked.attemptId]
          )
        ).length,
        0
      );
      const runBlocked = randomUUID();
      await assert.rejects(
        beginRun(ds, {
          id: runBlocked,
          provider: 'overture',
          kind: 'overture-stage',
        }),
        ProviderPausedError
      );
      const [ledger] = await ds.query(
        `SELECT status,"blockedReason","finishedAt" IS NOT NULL AS done FROM directory_acquisition_run WHERE id=$1`,
        [runBlocked]
      );
      assert.deepEqual(ledger, {
        status: 'blocked',
        blockedReason: 'provider_paused',
        done: true,
      });
      assert.deepEqual(
        {
          s: classifyStageError(new ProviderPausedError()).status,
          r: classifyStageError(new ProviderPausedError()).blockedReason,
        },
        { s: 'blocked', r: 'provider_paused' }
      );
      assert.equal((await set('provider_acquisition', false, 1)).ok, true);
      assert.equal(
        (await reserveProviderBudget(ds, attempt())).state,
        'reserved'
      );
      const runOk = await beginRun(ds, {
        provider: 'overture',
        kind: 'overture-stage',
      });
      assert.equal(
        (
          await ds.query(
            `SELECT status FROM directory_acquisition_run WHERE id=$1`,
            [runOk]
          )
        )[0].status,
        'running'
      );

      // Metrics: every section answers on a migrated database.
      const m = await collectOpsMetrics(ds, { DIRECTORY_EXPORT_DIR: dir });
      assert.deepEqual(m.errors, []);
      for (const k of [
        'infrastructure',
        'towns',
        'coverage',
        'freshness',
        'policy',
        'spend',
        'queues',
        'controls',
      ])
        assert.notEqual(m[k], null, k);
      assert.equal(m.infrastructure.database, 'ok');
      assert.equal(m.infrastructure.postgis, true);
      assert.equal(m.infrastructure.exportStorage, 'configured');
      assert.ok(m.infrastructure.migrationsApplied > 0);
      // The newest migration on disk, so later slices do not break this check.
      const newest = require('node:fs')
        .readdirSync(require('node:path').join(__dirname, '../migrations'))
        .map((f) => /^(\d+)-(\w+)\.ts$/.exec(f))
        .filter(Boolean)
        .sort((a, b) => Number(b[1]) - Number(a[1]))[0];
      assert.equal(
        m.infrastructure.latestMigration,
        `${newest[2]}${newest[1]}`
      );
      assert.equal(m.spend.reservedCents, 1);
      assert.equal(m.spend.alertCents, 2000);
      assert.equal(m.spend.alert, false);
      assert.equal(m.queues.export.queued, 0);
      assert.equal(m.queues.export.oldestQueuedSeconds, null);
      assert.equal(m.controls.length, 3);
      assert.equal(m.policy.publicationPaused, true);
      assert.equal(
        (await collectOpsMetrics(ds, { DIRECTORY_SPEND_ALERT_CENTS: '1' }))
          .spend.alert,
        true
      );

      // A queued export shows in the queue and ages.
      await ds.query(
        `INSERT INTO directory_export_job (id,"actorId","releaseId",scope,format,"requestHash","createdAt","updatedAt")
         VALUES ($1,$2,'rel-q','{}'::jsonb,'jsonl',$3,now() - interval '30 seconds',now())`,
        [randomUUID(), actor, 'a'.repeat(64)]
      );
      const q = (await collectOpsMetrics(ds, {})).queues.export;
      assert.equal(q.queued, 1);
      assert.ok(q.oldestQueuedSeconds >= 30);

      // A failing section is null and named, and the rest still answers.
      const flaky = {
        query: (sql, params) =>
          /directory_rights_case/.test(sql)
            ? Promise.reject(
                new Error('canceling statement due to statement timeout')
              )
            : ds.query(sql, params),
      };
      const partial = await collectOpsMetrics(flaky, {});
      assert.deepEqual(partial.errors, ['policy']);
      assert.equal(partial.policy, null);
      assert.notEqual(partial.towns, null);
      assert.notEqual(partial.spend, null);
    } finally {
      await ds.destroy();
      rmSync(dir, { recursive: true, force: true });
    }
  }
);
