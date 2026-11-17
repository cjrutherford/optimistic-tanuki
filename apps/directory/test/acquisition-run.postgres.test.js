require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const run = require('../src/acquisition-run');

// Disposable, loopback-only database named s7e_scratch_*. The caller drops the database afterwards.
const url = process.env.S7E_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s7e_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S7E_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s7e_scratch_* database required');
}
const actor = randomUUID();
const action = (fn, db, id, token, extra = {}) =>
  fn(db, {
    id,
    decisionId: randomUUID(),
    actorId: actor,
    reason: 'operator request',
    expectedVersionToken: token,
    ...extra,
  });
const rejectsWith = (promise, code, reason) =>
  assert.rejects(promise, (e) => {
    assert.equal(e.code, code);
    if (reason) assert.equal(e.detail, reason);
    return true;
  });

async function withDb(fn) {
  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  try {
    await ds.query(
      'TRUNCATE directory_acquisition_run, directory_acquisition_run_job, directory_acquisition_run_event, directory_town_scan_target, directory_provider_budget_attempt, directory_anonymous_overture_attempt'
    );
    await fn(ds);
  } finally {
    await ds.destroy();
  }
}
const start = (ds, extra = {}) =>
  run.beginRun(ds, {
    provider: 'overture',
    release: '2026-10-21.0',
    kind: 'overture-stage',
    townIds: [randomUUID()],
    ...extra,
  });

test(
  'ledger lifecycle: jobs, progress totals, derived status and completeness',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const id = await start(ds);
      const town = randomUUID();
      assert.deepEqual(
        await run.beginJob(ds, id, { unitKey: '00001', townId: town }),
        { attempt: 1, checkpoint: null }
      );
      await run.beginJob(ds, id, { unitKey: '00002' });
      assert.equal(
        (
          await run.progress(ds, id, '00001', {
            checkpoint: { row: 10 },
            observed: 10,
            accepted: 8,
            rejected: 2,
          })
        ).stop,
        false
      );
      await run.finishJob(ds, id, '00001', {
        status: 'succeeded',
        observed: 12,
        accepted: 9,
        rejected: 3,
      });
      await run.finishJob(ds, id, '00002', { status: 'succeeded_empty' });
      let d = await run.getAcquisitionRun(ds, id);
      assert.equal(d.status, 'running');
      assert.deepEqual(d.completeness, { done: 2, total: 2 });
      assert.equal(d.observed, 12);
      assert.equal(d.accepted, 9);
      assert.equal(d.rejected, 3);
      assert.equal(d.stale, false);
      assert.equal(await run.finishRun(ds, id), 'succeeded');
      d = await run.getAcquisitionRun(ds, id);
      assert.equal(d.status, 'succeeded');
      assert.ok(d.finishedAt);

      const empty = await start(ds);
      await run.beginJob(ds, empty, { unitKey: 'a' });
      await run.finishJob(ds, empty, 'a', { status: 'succeeded_empty' });
      assert.equal(await run.finishRun(ds, empty), 'succeeded_empty');

      // Failure is redacted: no host, URL, path or long token survives.
      const bad = await start(ds);
      await run.beginJob(ds, bad, { unitKey: 'a' });
      const err = Error(
        'connect ECONNREFUSED 10.1.2.3:5432 postgres://u:pw@db.internal/x at /home/user/app/file.js token abcdefghijklmnopqrstuvwxyz0123'
      );
      await run.finishJob(ds, bad, 'a', {
        status: 'failed_retryable',
        error: err,
      });
      assert.equal(
        await run.finishRun(ds, bad, { error: err }),
        'failed_retryable'
      );
      const dd = await run.getAcquisitionRun(ds, bad);
      for (const text of [dd.lastError, dd.jobs[0].lastError]) {
        assert.doesNotMatch(
          text,
          /10\.1\.2\.3|postgres:|db\.internal|\/home|abcdefghijklm|pw/
        );
      }
      const list = await run.listAcquisitionRuns(ds, {
        status: 'failed_retryable',
      });
      assert.equal(list.total, 1);
      assert.equal(
        (await run.listAcquisitionRuns(ds, { limit: 2 })).runs.length,
        2
      );
      assert.equal((await run.latestAcquisitionRun(ds)).id, bad);
      await assert.rejects(
        run.listAcquisitionRuns(ds, { status: 'nope' }),
        /Invalid status/
      );
    });
  }
);

test(
  'cancel is honoured by shouldStop; stale tokens and reused decision ids are 409',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const id = await start(ds);
      await run.beginJob(ds, id, { unitKey: 'u1' });
      const before = await run.getAcquisitionRun(ds, id);
      assert.equal(await run.shouldStop(ds, id), false);
      const decisionId = randomUUID();
      const input = {
        id,
        decisionId,
        actorId: actor,
        reason: 'stop it',
        expectedVersionToken: before.versionToken,
      };
      const first = await run.cancelAcquisitionRun(ds, input);
      assert.equal(first.replayed, false);
      assert.equal(first.run.status, 'cancel_requested');
      assert.equal(await run.shouldStop(ds, id), true);
      assert.equal(
        (await run.progress(ds, id, 'u1', { observed: 1 })).stop,
        true
      );
      // A replay of the same decision returns the same state and adds no event.
      const again = await run.cancelAcquisitionRun(ds, input);
      assert.equal(again.replayed, true);
      assert.equal(
        again.run.events.filter((e) => e.action === 'cancel').length,
        1
      );
      // Same id, different content: conflict. Old token on a new decision: stale.
      await rejectsWith(
        run.cancelAcquisitionRun(ds, { ...input, reason: 'other' }),
        'decision_conflict'
      );
      await rejectsWith(
        action(run.cancelAcquisitionRun, ds, id, before.versionToken),
        'stale_decision'
      );
      // The stage honours it: jobs and run end cancelled and a late success cannot overwrite that.
      assert.equal(await run.finishRun(ds, id), 'cancelled');
      const d = await run.getAcquisitionRun(ds, id);
      assert.equal(d.jobs[0].status, 'cancelled');
      assert.equal(d.status, 'cancelled');
      await rejectsWith(
        action(run.cancelAcquisitionRun, ds, id, d.versionToken),
        'invalid_state'
      );
    });
  }
);

test(
  'a run with no recent heartbeat is cancelled directly',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const id = await start(ds);
      await run.beginJob(ds, id, { unitKey: 'u1' });
      await ds.query(
        `UPDATE directory_acquisition_run SET "heartbeatAt"=now()-interval '2 hours' WHERE id=$1`,
        [id]
      );
      const d = await run.getAcquisitionRun(ds, id);
      assert.equal(d.stale, true);
      const out = await action(
        run.cancelAcquisitionRun,
        ds,
        id,
        d.versionToken
      );
      assert.equal(out.run.status, 'cancelled');
      assert.equal(out.run.jobs[0].status, 'cancelled');
      assert.ok(out.run.finishedAt);
    });
  }
);

test(
  'resume is idempotent, hands back a command and the stage resumes from the job checkpoint',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const id = await start(ds);
      await run.beginJob(ds, id, { unitKey: 'A' });
      await run.beginJob(ds, id, { unitKey: 'B' });
      await run.progress(ds, id, 'A', {
        checkpoint: { cursor: 5 },
        observed: 5,
      });
      await run.finishJob(ds, id, 'A', {
        status: 'failed_retryable',
        error: Error('boom'),
      });
      await run.finishJob(ds, id, 'B', {
        status: 'succeeded',
        observed: 3,
        accepted: 3,
      });
      await run.finishRun(ds, id);
      const d = await run.getAcquisitionRun(ds, id);
      assert.equal(d.status, 'failed_retryable');
      assert.equal(d.resumeCommand, null);

      const input = {
        id,
        decisionId: randomUUID(),
        actorId: actor,
        reason: 'try again',
        expectedVersionToken: d.versionToken,
      };
      const one = await run.resumeAcquisitionRun(ds, input);
      assert.equal(one.replayed, false);
      assert.equal(one.run.status, 'queued');
      assert.equal(one.run.pendingRequest, true);
      assert.match(
        one.resumeCommand,
        new RegExp(`--stage-local --resume ${id}$`)
      );
      assert.doesNotMatch(one.resumeCommand, /postgres|\/home|localhost/);
      assert.equal(
        one.run.jobs.find((j) => j.unitKey === 'A').status,
        'queued'
      );
      assert.equal(
        one.run.jobs.find((j) => j.unitKey === 'B').status,
        'succeeded'
      );
      const two = await run.resumeAcquisitionRun(ds, input);
      assert.equal(two.replayed, true);
      assert.equal(
        two.run.events.filter((e) => e.action === 'resume').length,
        1
      );

      // The stage consumes the request once, and resumes the queued job from its checkpoint.
      const resumed = await run.resumeRunFromRequest(ds, id);
      assert.deepEqual(resumed.units, ['A']);
      await assert.rejects(
        run.resumeRunFromRequest(ds, id),
        /No pending resume request/
      );
      const job = await run.beginJob(ds, id, { unitKey: 'A' });
      assert.deepEqual(job, { attempt: 2, checkpoint: { cursor: 5 } });
      await run.finishJob(ds, id, 'A', { status: 'succeeded' });
      assert.equal(await run.finishRun(ds, id), 'succeeded');
      const done = await run.getAcquisitionRun(ds, id);
      assert.equal(done.pendingRequest, false);
      assert.equal(
        done.events.filter((e) => e.action === 'consumed').length,
        1
      );

      // A succeeded run is not resumable; neither is a historical one.
      await rejectsWith(
        action(run.resumeAcquisitionRun, ds, id, done.versionToken),
        'invalid_state'
      );
    });
  }
);

test(
  'a blocked run cannot be resumed until its reason clears; retry targets one job',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      for (const reason of [
        'acquisition_unauthorized',
        'policy_blocked',
        'quota_exhausted',
      ]) {
        const id = await start(ds);
        await run.beginJob(ds, id, { unitKey: 'A' });
        await run.finishJob(ds, id, 'A', {
          status: 'blocked',
          blockedReason: reason,
        });
        assert.equal(await run.finishRun(ds, id), 'blocked');
        const d = await run.getAcquisitionRun(ds, id);
        assert.equal(d.blockedReason, reason);
        await rejectsWith(
          action(run.resumeAcquisitionRun, ds, id, d.versionToken),
          'run_blocked',
          reason
        );
        await rejectsWith(
          action(run.retryAcquisitionJob, ds, id, d.versionToken, {
            unitKey: 'A',
          }),
          'run_blocked',
          reason
        );
      }
      // Budget: blocked while the ceiling is reached, resumable once it is not.
      const id = await start(ds);
      await run.beginJob(ds, id, { unitKey: 'A' });
      await run.finishJob(ds, id, 'A', {
        status: 'blocked',
        blockedReason: 'budget_exhausted',
      });
      await run.finishRun(ds, id);
      await ds.query(
        `INSERT INTO directory_provider_budget_attempt ("attemptId",period,provider,operation,"reservedCents")
         VALUES ($1,to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM'),'p','o',2500)`,
        [randomUUID()]
      );
      let d = await run.getAcquisitionRun(ds, id);
      await rejectsWith(
        action(run.resumeAcquisitionRun, ds, id, d.versionToken),
        'run_blocked',
        'budget_exhausted'
      );
      await ds.query('TRUNCATE directory_provider_budget_attempt');
      const out = await action(
        run.resumeAcquisitionRun,
        ds,
        id,
        d.versionToken
      );
      assert.equal(out.run.status, 'queued');
      assert.equal(out.run.blockedReason, null);

      // Retry: one failed job of two.
      const r = await start(ds);
      await run.beginJob(ds, r, { unitKey: 'A' });
      await run.beginJob(ds, r, { unitKey: 'B' });
      await run.finishJob(ds, r, 'A', {
        status: 'failed_permanent',
        error: Error('bad'),
      });
      await run.finishJob(ds, r, 'B', { status: 'succeeded' });
      await run.finishRun(ds, r);
      d = await run.getAcquisitionRun(ds, r);
      await rejectsWith(
        action(run.retryAcquisitionJob, ds, r, d.versionToken, {
          unitKey: 'B',
        }),
        'invalid_state'
      );
      const retried = await action(
        run.retryAcquisitionJob,
        ds,
        r,
        d.versionToken,
        {
          unitKey: 'A',
        }
      );
      assert.equal(
        retried.run.jobs.find((j) => j.unitKey === 'A').status,
        'queued'
      );
      assert.equal(retried.run.status, 'queued');
      assert.equal(retried.run.pendingRequest, true);
    });
  }
);

test(
  'history import is idempotent and derives status from scan targets',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const [t1, t2, t3] = [randomUUID(), randomUUID(), randomUUID()];
      const full = 'a'.repeat(64),
        open = 'b'.repeat(64),
        empty = 'c'.repeat(64);
      const ins = (town, scan, completed, rows, provenance) =>
        ds.query(
          `INSERT INTO directory_town_scan_target ("communityId","scanId","completedAt","rowCount",provenance) VALUES ($1,$2,$3,$4,$5)`,
          [town, scan, completed, rows, provenance]
        );
      await ins(t1, full, new Date(), 40, 'recorded');
      await ins(t2, full, new Date(), 0, 'recorded');
      await ins(t1, open, null, null, 'recorded');
      await ins(t3, empty, new Date(), 0, 'recorded');
      const input = {
        decisionId: randomUUID(),
        actorId: actor,
        reason: 'seed the page',
      };
      const first = await run.importAcquisitionHistory(ds, input);
      assert.deepEqual(first, { replayed: false, created: 3, existing: 0 });
      const second = await run.importAcquisitionHistory(ds, {
        ...input,
        decisionId: randomUUID(),
      });
      assert.equal(second.created, 0);
      assert.equal(second.existing, 3);
      assert.equal(
        (await run.importAcquisitionHistory(ds, input)).replayed,
        true
      );
      await rejectsWith(
        run.importAcquisitionHistory(ds, { ...input, reason: 'different' }),
        'decision_conflict'
      );
      const list = await run.listAcquisitionRuns(ds, {});
      assert.equal(list.total, 3);
      assert.ok(
        list.runs.every(
          (r) => r.kind === 'historical' && r.startedBy === 'system'
        )
      );
      assert.deepEqual(list.runs.map((r) => r.status).sort(), [
        'partial',
        'succeeded',
        'succeeded_empty',
      ]);
      const byTown = await run.listAcquisitionRuns(ds, { townId: t3 });
      assert.equal(byTown.total, 1);
      const fullRun = list.runs.find((r) => r.status === 'succeeded');
      const d = await run.getAcquisitionRun(ds, fullRun.id);
      assert.equal(d.observed, 40);
      assert.equal(d.jobs.length, 2);
      assert.equal(
        d.jobs.find((j) => j.townId === t2).status,
        'succeeded_empty'
      );
      // Historical runs are read-only.
      await rejectsWith(
        action(run.resumeAcquisitionRun, ds, fullRun.id, d.versionToken),
        'invalid_state'
      );
    });
  }
);

test(
  'budget panel reports month spend against the ceiling',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      let p = await run.acquisitionBudgetPanel(ds);
      assert.equal(p.ceilingCents, 2500);
      assert.equal(p.reservedCents, 0);
      assert.equal(p.hardStop, false);
      assert.equal(p.acquisitionAuthorized, false);
      const period = p.period;
      const add = (cents) =>
        ds.query(
          `INSERT INTO directory_provider_budget_attempt ("attemptId",period,provider,operation,"reservedCents") VALUES ($1,$2,'p','o',$3)`,
          [randomUUID(), period, cents]
        );
      await add(100);
      await add(200);
      await ds.query(
        `INSERT INTO directory_anonymous_overture_attempt ("attemptId",period,"policyId","assetSha256",method) VALUES ($1,$2,$3,$3,'GET')`,
        [randomUUID(), period, 'd'.repeat(64)]
      );
      const id = await start(ds);
      await run.beginJob(ds, id, { unitKey: 'A' });
      await run.progress(ds, id, 'A', {
        budgetReservedCents: 300,
        budgetUsedCents: 120,
      });
      p = await run.acquisitionBudgetPanel(ds);
      assert.equal(p.reservedCents, 300);
      assert.equal(p.usedCents, 120);
      assert.equal(p.remainingCents, 2200);
      assert.equal(p.anonymousAttempts, 1);
      assert.equal(p.hardStop, false);
      await add(2200);
      p = await run.acquisitionBudgetPanel(ds);
      assert.equal(p.hardStop, true);
      assert.equal(p.remainingCents, 0);
      assert.equal((await run.getAcquisitionRun(ds, id)).budgetUsedCents, 120);
    });
  }
);
