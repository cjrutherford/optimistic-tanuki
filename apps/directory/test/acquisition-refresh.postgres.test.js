require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const auto = require('../src/overture-auto-acquisition');
const refresh = require('../src/acquisition-refresh');
const retire = require('../src/town-retirement');

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
const RELEASE = '2026-10-21.0';
const CONFIG = {
  limit: 10,
  maxAssets: 4,
  retryBackoffMs: 60000,
  maxAttempts: 3,
};

async function withDb(fn) {
  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  try {
    await ds.query(
      `TRUNCATE directory_acquisition_run, directory_acquisition_run_job, directory_acquisition_run_event, directory_acquisition_town_request,
       directory_town_scan_target, directory_town_scan_retirement, directory_overture_private_row, directory_overture_private_row_revocation,
       directory_overture_private_completion, directory_overture_private_membership, directory_overture_private_policy,
       directory_town_geometry, directory_town, directory_operating_control CASCADE`
    );
    await fn(ds);
  } finally {
    await ds.destroy();
  }
}
const square = (x, y) =>
  `ST_GeomFromText('MULTIPOLYGON(((${x} ${y},${x + 1} ${y},${x + 1} ${
    y + 1
  },${x} ${y + 1},${x} ${y})))',4326)`;
const ago = (days) => `now() - interval '${days} days'`;

/** A ready town; `registered` and `geometryAt` are ages in days. */
async function town(
  ds,
  name,
  { registered = 1, geometryAt = registered } = {}
) {
  const id = randomUUID();
  await ds.query(
    `INSERT INTO directory_town ("communityId",name,eligible,"geometryStatus","geometryVersion","registeredAt")
     VALUES ($1,$2,true,'ready',1,${ago(registered)})`,
    [id, name]
  );
  await ds.query(
    `INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights,"createdAt")
     VALUES ($1,1,${square(-88, 31)},'census','2025','public',${ago(
      geometryAt
    )})`,
    [id]
  );
  return id;
}
/** The boundary changed: version 2 installed `days` ago. */
async function newBoundary(ds, id, days = 0) {
  await ds.query(
    `INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights,"createdAt")
     VALUES ($1,2,${square(-87, 31)},'census','2026','public',${ago(days)})`,
    [id]
  );
  await ds.query(
    `UPDATE directory_town SET "geometryVersion"=2 WHERE "communityId"=$1`,
    [id]
  );
}
/** A live, completed, sourced scan of the town, completed `days` ago, cut with geometry version `gv`. */
async function liveScan(
  ds,
  id,
  scanId,
  { days, gv = 1, rows = 2, sourced = true } = {}
) {
  await ds.query(
    `INSERT INTO directory_overture_private_policy ("policyId") VALUES ('pol') ON CONFLICT DO NOTHING`
  );
  await ds.query(
    `INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,'pol')`,
    [scanId]
  );
  await ds.query(
    `INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)`,
    [scanId]
  );
  await ds.query(
    `INSERT INTO directory_town_scan_target ("communityId","scanId",provenance,"targetedAt","completedAt","geometryVersion")
     VALUES ($1,$2,'recorded',${ago(days)},${ago(days)},$3)`,
    [id, scanId, gv]
  );
  for (let i = 0; i < rows; i++)
    await ds.query(
      `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4::jsonb)`,
      [
        scanId,
        i,
        id,
        JSON.stringify(
          sourced ? { name: 'x', sources: [{ dataset: 'o' }] } : { name: 'x' }
        ),
      ]
    );
}
/** An automatic Overture run for the town, with the scans its jobs produced. */
async function autoRun(
  ds,
  id,
  status,
  { daysAgo = 0, scans = [], release = RELEASE } = {}
) {
  const runId = randomUUID();
  await ds.query(
    `INSERT INTO directory_acquisition_run (id,provider,release,kind,"townIds",status,reason,"createdAt","startedAt","heartbeatAt","finishedAt")
     VALUES ($1,'overture',$2,'overture-stage',$3::jsonb,$4,'auto: t',${ago(
       daysAgo
     )},${ago(daysAgo)},${ago(daysAgo)},${ago(daysAgo)})`,
    [runId, release, JSON.stringify([id]), status]
  );
  let n = 0;
  for (const scanId of scans)
    await ds.query(
      `INSERT INTO directory_acquisition_run_job ("runId","unitKey","townId","scanId",status) VALUES ($1,$2,$3,$4,'succeeded')`,
      [runId, `u${n++}`, id, scanId]
    );
  return runId;
}
const pick = async (ds) =>
  (await auto.selectTowns(ds, RELEASE, CONFIG)).map((t) => t.name);

test(
  'refresh: eligibility by age, geometry change and never-acquired priority',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const fresh = await town(ds, 'Fresh', { registered: 200 });
      await liveScan(ds, fresh, 'fresh', { days: 10 });
      await autoRun(ds, fresh, 'succeeded', { daysAgo: 10, scans: ['fresh'] });
      const aged = await town(ds, 'Aged', { registered: 200 });
      await liveScan(ds, aged, 'aged', { days: 95 });
      await autoRun(ds, aged, 'succeeded', { daysAgo: 95, scans: ['aged'] });
      const edge = await town(ds, 'Edge', { registered: 200 });
      await liveScan(ds, edge, 'edge', { days: 89 });
      await autoRun(ds, edge, 'succeeded', { daysAgo: 89, scans: ['edge'] });
      const moved = await town(ds, 'Moved', { registered: 200 });
      await liveScan(ds, moved, 'moved', { days: 20, gv: 1 });
      await autoRun(ds, moved, 'succeeded', { daysAgo: 20, scans: ['moved'] });
      await newBoundary(ds, moved, 2);
      const legacy = await town(ds, 'Legacy', { registered: 200 });
      await liveScan(ds, legacy, 'legacy', { days: 20, gv: null });
      await autoRun(ds, legacy, 'succeeded', {
        daysAgo: 20,
        scans: ['legacy'],
      });
      await newBoundary(ds, legacy, 2);
      // Never acquired, registered most recently, must come before every refresh.
      await town(ds, 'NewTown', { registered: 1 });
      await town(ds, 'OldNever', { registered: 150 });

      const picked = await pick(ds);
      assert.deepEqual(picked.slice(0, 2), ['NewTown', 'OldNever']);
      assert.deepEqual(picked.slice(2).sort(), ['Aged', 'Moved']);
      assert.ok(!picked.includes('Fresh') && !picked.includes('Edge'));
      // A null recorded geometry version (backfilled scan) is unknown, never a trigger.
      assert.ok(!picked.includes('Legacy'));
    });
  }
);

test(
  'refresh: a run since the trigger settles the refresh, and a failure backs off',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const aged = await town(ds, 'Aged', { registered: 200 });
      await liveScan(ds, aged, 'aged', { days: 95 });
      await autoRun(ds, aged, 'succeeded', { daysAgo: 95, scans: ['aged'] });
      const moved = await town(ds, 'Moved', { registered: 200 });
      await liveScan(ds, moved, 'moved', { days: 20 });
      await autoRun(ds, moved, 'succeeded', { daysAgo: 20, scans: ['moved'] });
      await newBoundary(ds, moved, 2);
      assert.deepEqual((await pick(ds)).sort(), ['Aged', 'Moved']);
      // A no-op rerun against the same pinned release (same scan) re-stamps the clock; the town is not repeated.
      await autoRun(ds, aged, 'succeeded', { daysAgo: 0, scans: ['aged'] });
      await autoRun(ds, moved, 'succeeded_empty', { daysAgo: 0 });
      assert.deepEqual(await pick(ds), []);
      // A retryable failure after the trigger holds the town back during the backoff.
      const stale = await town(ds, 'Stale', { registered: 200 });
      await liveScan(ds, stale, 'stale', { days: 130 });
      await autoRun(ds, stale, 'succeeded', { daysAgo: 130, scans: ['stale'] });
      assert.deepEqual(await pick(ds), ['Stale']);
      await autoRun(ds, stale, 'failed_retryable', { daysAgo: 0 });
      assert.deepEqual(await pick(ds), []);
    });
  }
);

test(
  'refresh: a manual request goes first, once, and is idempotent per town',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const done = await town(ds, 'Done', { registered: 200 });
      await liveScan(ds, done, 'done', { days: 5 });
      await autoRun(ds, done, 'succeeded', { daysAgo: 5, scans: ['done'] });
      await town(ds, 'Waiting', { registered: 3 });
      const actor = randomUUID();
      const input = {
        communityId: done,
        decisionId: randomUUID(),
        actorId: actor,
        reason: 'owner asked',
      };
      assert.deepEqual(await pick(ds), ['Waiting']);
      const first = await refresh.requestTownAcquisition(ds, input);
      assert.equal(first.replayed, false);
      assert.equal(first.alreadyPending, false);
      assert.deepEqual(first.providers.sort(), ['alltheplaces', 'overture']);
      // Same decision id: replay. A new decision id while one is pending: no second request.
      assert.equal(
        (await refresh.requestTownAcquisition(ds, input)).replayed,
        true
      );
      const other = await refresh.requestTownAcquisition(ds, {
        ...input,
        decisionId: randomUUID(),
      });
      assert.equal(other.alreadyPending, true);
      await assert.rejects(
        refresh.requestTownAcquisition(ds, { ...input, reason: 'different' }),
        (e) => e.code === 'decision_conflict'
      );
      const [{ n }] = await ds.query(
        `SELECT count(*)::int AS n FROM directory_acquisition_town_request`
      );
      assert.equal(n, 2);
      // The fresh, already acquired town now comes before the waiting never-acquired one... the manual ask outranks it.
      assert.deepEqual(await pick(ds), ['Done', 'Waiting']);
      await assert.rejects(
        refresh.requestTownAcquisition(ds, {
          ...input,
          decisionId: randomUUID(),
          communityId: randomUUID(),
        }),
        /Town not found/
      );
      // Starting a run for the town consumes the request, so the next sweep leaves the fresh town alone again.
      await refresh.consumeTownRequest(ds, done, 'overture', randomUUID());
      assert.deepEqual(await pick(ds), ['Waiting']);
      const [pending] = await ds.query(
        `SELECT count(*)::int AS n FROM directory_acquisition_town_request WHERE "consumedAt" IS NULL`
      );
      assert.equal(pending.n, 1);
    });
  }
);

test(
  'refresh: a manual request still honours the kill switch and an authorized provider',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const t = await town(ds, 'Asked', { registered: 5 });
      await refresh.requestTownAcquisition(ds, {
        communityId: t,
        decisionId: randomUUID(),
        actorId: randomUUID(),
        reason: 'now',
      });
      await ds.query(
        `INSERT INTO directory_operating_control (key,paused,reason,"updatedAt") VALUES ('provider_acquisition',true,'t',now())
       ON CONFLICT (key) DO UPDATE SET paused=true`
      );
      const calls = [];
      const out = await auto.runAutoAcquisitionSweep({
        db: ds,
        inventory: {
          release: RELEASE,
          inventorySha256: 'a'.repeat(64),
          items: [],
        },
        rights: { releaseId: RELEASE, operations: {}, terms: [] },
        extract: async (r) => calls.push(r),
        config: CONFIG,
      });
      assert.equal(out.status, 'paused');
      assert.equal(calls.length, 0);
      const [{ n }] = await ds.query(
        `SELECT count(*)::int AS n FROM directory_acquisition_town_request WHERE "consumedAt" IS NULL`
      );
      assert.equal(n, 2);
    });
  }
);

test(
  'refresh: the old scan keeps serving until the new run completes, then is retired once',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const t = await town(ds, 'Swap', { registered: 300 });
      await liveScan(ds, t, 'old', { days: 100, rows: 3 });
      await autoRun(ds, t, 'succeeded', { daysAgo: 100, scans: ['old'] });
      // A refresh is running: nothing is retired yet.
      const running = await autoRun(ds, t, 'running', { daysAgo: 0 });
      assert.equal(await retire.swapSupersededForTown(ds, t, 'overture'), null);
      // Rerun against the same scan: still nothing to retire.
      await autoRun(ds, t, 'succeeded', { daysAgo: 0, scans: ['old'] });
      assert.equal(await retire.swapSupersededForTown(ds, t, 'overture'), null);
      // The refresh finishes with two asset scans (siblings of one run): the old scan goes, the siblings stay.
      await ds.query(`DELETE FROM directory_acquisition_run WHERE id=$1`, [
        running,
      ]);
      await liveScan(ds, t, 'new-a', { days: 0, rows: 2 });
      await liveScan(ds, t, 'new-b', { days: 0, rows: 1 });
      await autoRun(ds, t, 'succeeded', {
        daysAgo: 0,
        scans: ['new-a', 'new-b'],
      });
      const out = await retire.swapSupersededForTown(ds, t, 'overture');
      assert.deepEqual(out.scans, [{ scanId: 'old', rowsRevoked: 3 }]);
      const retired = await ds.query(
        `SELECT "scanId",actor FROM directory_town_scan_retirement`
      );
      assert.deepEqual(retired, [
        { scanId: 'old', actor: 'system:refresh-swap' },
      ]);
      // Idempotent, and the pending pass finds nothing more.
      assert.equal(await retire.swapSupersededForTown(ds, t, 'overture'), null);
      assert.equal(await retire.swapPendingSuperseded(ds, 'overture'), 0);
      const [{ n }] = await ds.query(
        `SELECT count(*)::int AS n FROM directory_overture_private_row_revocation WHERE "scanId" IN ('new-a','new-b')`
      );
      assert.equal(n, 0);
      // The town is acquired again by the newest scan: fresh, not selected.
      assert.deepEqual(await pick(ds), []);
    });
  }
);

test(
  'refresh: a refresh that returned nothing never retires the old scan',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const t = await town(ds, 'Empty', { registered: 300 });
      await liveScan(ds, t, 'old', { days: 100 });
      await autoRun(ds, t, 'succeeded', { daysAgo: 100, scans: ['old'] });
      await liveScan(ds, t, 'empty', { days: 0, rows: 0 });
      await autoRun(ds, t, 'succeeded_empty', { daysAgo: 0, scans: ['empty'] });
      assert.equal(await retire.swapSupersededForTown(ds, t, 'overture'), null);
      const [{ n }] = await ds.query(
        `SELECT count(*)::int AS n FROM directory_town_scan_retirement`
      );
      assert.equal(n, 0);
    });
  }
);

test(
  'fill time: counts towns whose wait to a terminal state passes 7 days',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      // Registered 10 days ago and never tried: waiting over the target.
      await town(ds, 'Stuck', { registered: 10 });
      // Registered 3 days ago, not tried: waiting, within the target.
      await town(ds, 'Young', { registered: 3 });
      // Filled after 2 days: on target.
      const quick = await town(ds, 'Quick', { registered: 10 });
      await liveScan(ds, quick, 'quick', { days: 8 });
      // Filled after 9 days: late.
      const slow = await town(ds, 'Slow', { registered: 20 });
      await liveScan(ds, slow, 'slow', { days: 11 });
      // Blocked after 8 days (permanent): terminal, late.
      const blocked = await town(ds, 'Blocked', { registered: 20 });
      await autoRun(ds, blocked, 'failed_permanent', { daysAgo: 12 });
      // Boundary changed 9 days ago and not refilled: a new clock, waiting over the target.
      const moved = await town(ds, 'Moved', { registered: 100 });
      await liveScan(ds, moved, 'moved', { days: 90, gv: 1 });
      await newBoundary(ds, moved, 9);
      // A geometry-pending block is not a terminal state.
      const pending = await town(ds, 'Pending', { registered: 30 });
      await autoRun(ds, pending, 'blocked', { daysAgo: 29 });
      await ds.query(
        `UPDATE directory_acquisition_run SET "blockedReason"='geometry_pending' WHERE "townIds" @> to_jsonb($1::text)`,
        [pending]
      );
      const m = await refresh.fillTimeMetrics(ds);
      assert.equal(m.targetDays, 7);
      assert.equal(m.waitingOverTarget, 3); // Stuck, Moved, Pending
      assert.equal(m.resolvedLate, 2); // Slow, Blocked
      assert.equal(m.overTargetTowns, 5);
      assert.equal(m.waiting, 4); // plus Young
      assert.equal(m.alert, true);
    });
  }
);
