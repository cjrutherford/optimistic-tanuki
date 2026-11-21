require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  retireSourcelessTownRows,
  swapPendingSourceless: swapPending,
  swapSourcelessAfterRefresh: swapAfter,
} = require('../src/town-retirement');
const auto = require('../src/overture-auto-acquisition');
const atp = require('../src/alltheplaces-acquisition');
const { beginRun, finishRun } = require('../src/acquisition-run');

const url = process.env.TOWN_RETIREMENT_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s10_geom_[a-z0-9_]+$/.test(u.pathname)
  )
    throw Error('Disposable s10_geom_* database required');
}
const RELEASE = '2026-10-21.0';
const config = { limit: 10, maxAssets: 4, retryBackoffMs: 0, maxAttempts: 3 };
const SQUARE = `ST_GeomFromText('MULTIPOLYGON(((-88 31,-87 31,-87 32,-88 32,-88 31)))',4326)`;

async function withDb(fn) {
  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  try {
    await ds.query(
      `TRUNCATE directory_acquisition_run, directory_acquisition_run_job, directory_town_scan_target, directory_town_scan_retirement,
       directory_overture_private_row, directory_overture_private_row_revocation, directory_overture_private_completion,
       directory_overture_private_membership, directory_overture_private_policy, directory_town_geometry, directory_town CASCADE`
    );
    await fn(ds);
  } finally {
    await ds.destroy();
  }
}
async function town(ds, name) {
  const id = randomUUID();
  await ds.query(
    `INSERT INTO directory_town ("communityId",name,eligible,"geometryStatus","geometryVersion") VALUES ($1,$2,true,'ready',1)`,
    [id, name]
  );
  await ds.query(
    `INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights) VALUES ($1,1,${SQUARE},'census','2025','public')`,
    [id]
  );
  return id;
}
/** A completed scan covering the listed towns; each row is [regionId, withSources]. */
async function scan(ds, scanId, targets, rows) {
  await ds.query(
    `INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ('p1',false) ON CONFLICT DO NOTHING`
  );
  await ds.query(
    `INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,'p1')`,
    [scanId]
  );
  await ds.query(
    `INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)`,
    [scanId]
  );
  for (const t of targets)
    await ds.query(
      `INSERT INTO directory_town_scan_target ("communityId","scanId",provenance) VALUES ($1,$2,'backfill-rows')`,
      [t, scanId]
    );
  let n = 0;
  for (const [region, withSources] of rows)
    await ds.query(
      `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)`,
      [
        scanId,
        n++,
        region,
        JSON.stringify(
          withSources
            ? { name: 'x', sources: [{ dataset: 'd', license: 'l' }] }
            : { name: 'x' }
        ),
      ]
    );
}
const dueNames = async (ds, fn) =>
  (await fn(ds, RELEASE, config)).map((t) => t.name).sort();

test(
  'retirement revokes only the town rows without sources, audits them, and makes the town due again',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const pilot = await town(ds, 'Pilot');
      const other = await town(ds, 'Other');
      const sourced = await town(ds, 'Sourced');
      // A scan shared by two towns: only the pilot's rows are retired; the other town keeps its rows live.
      await scan(
        ds,
        'a'.repeat(64),
        [pilot, other],
        [
          [pilot, false],
          [pilot, false],
          [other, false],
        ]
      );
      await scan(ds, 'b'.repeat(64), [sourced], [[sourced, true]]);
      // The pilot's earlier automatic Overture run counts as an attempt until its scan is retired.
      const runId = await beginRun(ds, {
        provider: 'overture',
        release: RELEASE,
        kind: 'overture-stage',
        townIds: [pilot],
        reason: 'auto: Pilot',
      });
      await ds.query(
        `INSERT INTO directory_acquisition_run_job ("runId","townId","unitKey","scanId") VALUES ($1,$2,'u',$3)`,
        [runId, pilot, 'a'.repeat(64)]
      );
      await finishRun(ds, runId, { status: 'succeeded' });
      // A sourceless scan no longer counts as an acquisition, even with a succeeded run behind it: both towns that
      // hold its rows are due, and the town whose rows carry sources is not.
      assert.deepEqual(await dueNames(ds, auto.selectTowns), [
        'Other',
        'Pilot',
      ]);

      const out = await retireSourcelessTownRows(ds, {
        communityId: pilot,
        actor: 'operator:test',
        reason: 'no provenance',
      });
      assert.deepEqual(out.scans, [{ scanId: 'a'.repeat(64), rowsRevoked: 2 }]);
      const revoked = await ds.query(
        `SELECT "sourceFileRowNumber"::int AS n FROM directory_overture_private_row_revocation ORDER BY 1`
      );
      assert.deepEqual(
        revoked.map((r) => r.n),
        [0, 1]
      );
      const [audit] = await ds.query(
        `SELECT actor,reason,"rowsRevoked" FROM directory_town_scan_retirement WHERE "communityId"=$1`,
        [pilot]
      );
      assert.deepEqual(audit, {
        actor: 'operator:test',
        reason: 'no provenance',
        rowsRevoked: 2,
      });
      // The town sharing the scan still holds sourceless rows, so it stays due; the sourced town is not.
      assert.deepEqual(await dueNames(ds, auto.selectTowns), [
        'Other',
        'Pilot',
      ]);
      // A retired town is fetched ahead of towns that were never attempted, however new their geometry.
      const fresh = await town(ds, 'Fresh');
      await ds.query(
        `UPDATE directory_town_geometry SET "createdAt"=now() - interval '90 days' WHERE "communityId"=$1`,
        [pilot]
      );
      const ordered = (await auto.selectTowns(ds, RELEASE, config)).map(
        (t) => t.name
      );
      assert.deepEqual(ordered, ['Other', 'Pilot', 'Fresh']);
      await ds.query(`DELETE FROM directory_town WHERE "communityId"=$1`, [
        fresh,
      ]);
      // Running it again changes nothing.
      const again = await retireSourcelessTownRows(ds, {
        communityId: pilot,
        actor: 'operator:test',
        reason: 'no provenance',
      });
      assert.deepEqual(again.scans, []);
      // Negative: a town whose rows all carry sources has nothing to retire.
      const none = await retireSourcelessTownRows(ds, {
        communityId: sourced,
        actor: 'operator:test',
        reason: 'no provenance',
      });
      assert.deepEqual(none.scans, []);
      assert.equal(
        (await ds.query(`SELECT 1 FROM directory_town_scan_retirement`)).length,
        1
      );
    });
  }
);

test(
  'a retired Overture scan makes the town due for AllThePlaces only after it is acquired again',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const pilot = await town(ds, 'Pilot');
      await scan(ds, 'c'.repeat(64), [pilot], [[pilot, false]]);
      // Overture has not yet replaced the sourceless scan, so AllThePlaces waits.
      assert.deepEqual(await dueNames(ds, atp.selectAtpTowns), []);
      await retireSourcelessTownRows(ds, {
        communityId: pilot,
        actor: 'operator:test',
        reason: 'no provenance',
      });
      assert.deepEqual(await dueNames(ds, atp.selectAtpTowns), []);
      assert.deepEqual(await dueNames(ds, auto.selectTowns), ['Pilot']);
      // Fresh scan with provenance: acquired, nothing due for Overture, due for AllThePlaces.
      await scan(ds, 'd'.repeat(64), [pilot], [[pilot, true]]);
      assert.deepEqual(await dueNames(ds, auto.selectTowns), []);
      assert.deepEqual(await dueNames(ds, atp.selectAtpTowns), ['Pilot']);
    });
  }
);

const retiredRows = (ds) =>
  ds.query(`SELECT "scanId" FROM directory_town_scan_retirement ORDER BY 1`);
const servedRows = async (ds, townId) =>
  (
    await ds.query(
      `SELECT r."scanId" FROM directory_overture_private_row r
        JOIN directory_town_scan_target s ON s."scanId"=r."scanId" AND s."communityId"=$1::uuid
       WHERE r."regionId"=$1::text
         AND NOT EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."scanId"=r."scanId" AND z."communityId"=$1::uuid)
         AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation v
              WHERE v."scanId"=r."scanId" AND v."sourceFileRowNumber"=r."sourceFileRowNumber")`,
      [townId]
    )
  ).length;
async function succeededRun(ds, provider, townId, scanId) {
  const runId = await beginRun(ds, {
    provider,
    release: RELEASE,
    kind: 'overture-stage',
    townIds: [townId],
    reason: 'auto: refresh',
  });
  await ds.query(
    `INSERT INTO directory_acquisition_run_job ("runId","townId","unitKey","scanId") VALUES ($1,$2,'u',$3)`,
    [runId, townId, scanId]
  );
  await finishRun(ds, runId, { status: 'succeeded' });
  return runId;
}

test(
  'refresh first, swap after: sourceless scans serve until the fresh scan completes, then are retired and audited',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const legacy = await town(ds, 'Legacy');
      const sourced = await town(ds, 'Sourced');
      const old = 'e'.repeat(64);
      const fresh = 'f'.repeat(64);
      await scan(
        ds,
        old,
        [legacy],
        [
          [legacy, false],
          [legacy, false],
        ]
      );
      await scan(ds, 'b'.repeat(64), [sourced], [[sourced, true]]);
      await succeededRun(ds, 'overture', legacy, old);
      // Due immediately, and the old rows keep serving: no gap.
      assert.deepEqual(await dueNames(ds, auto.selectTowns), ['Legacy']);
      assert.equal(await servedRows(ds, legacy), 2);
      // Nothing is retired before a fresh scan exists, whether by the sweep-start pass or the per-town hook.
      assert.equal(await swapPending(ds, 'overture'), 0);
      await swapAfter(ds, legacy, 'overture', 'succeeded');
      assert.equal((await retiredRows(ds)).length, 0);
      assert.equal(await servedRows(ds, legacy), 2);

      // The fresh scan completes, but a partial run must not swap.
      await scan(
        ds,
        fresh,
        [legacy],
        [
          [legacy, true],
          [legacy, true],
          [legacy, true],
        ]
      );
      const partial = await beginRun(ds, {
        provider: 'overture',
        release: RELEASE,
        kind: 'overture-stage',
        townIds: [legacy],
        reason: 'auto: refresh',
      });
      await ds.query(
        `INSERT INTO directory_acquisition_run_job ("runId","townId","unitKey","scanId") VALUES ($1,$2,'u2',$3)`,
        [partial, legacy, fresh]
      );
      await finishRun(ds, partial, { status: 'partial' });
      await swapAfter(ds, legacy, 'overture', 'partial');
      assert.equal(await swapPending(ds, 'overture'), 0);
      assert.equal(await servedRows(ds, legacy), 5);

      // The run succeeds: the hook retires only the sourceless predecessor, with an audit row. Rows never dip below 3.
      await ds.query(
        `UPDATE directory_acquisition_run SET status='succeeded' WHERE id=$1`,
        [partial]
      );
      await swapAfter(ds, legacy, 'overture', 'succeeded');
      assert.deepEqual(
        (await retiredRows(ds)).map((r) => r.scanId),
        [old]
      );
      assert.equal(await servedRows(ds, legacy), 3);
      const [audit] = await ds.query(
        `SELECT actor,"rowsRevoked" FROM directory_town_scan_retirement WHERE "scanId"=$1`,
        [old]
      );
      assert.deepEqual(audit, { actor: 'system:refresh-swap', rowsRevoked: 2 });
      assert.deepEqual(await dueNames(ds, auto.selectTowns), []);
      // Negative: the sourced town was never touched, and a second pass does nothing.
      assert.equal(await swapPending(ds, 'overture'), 0);
      assert.equal(await servedRows(ds, sourced), 1);
      assert.equal((await retiredRows(ds)).length, 1);
    });
  }
);

test(
  'the sweep-start pass swaps a town whose refresh finished but whose hook did not, per provider',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const t = await town(ds, 'Both');
      const oldO = '1'.repeat(64);
      const oldA = '2'.repeat(64);
      const newA = '3'.repeat(64);
      await scan(ds, oldO, [t], [[t, false]]);
      await scan(ds, oldA, [t], [[t, false]]);
      await succeededRun(ds, 'alltheplaces', t, oldA);
      // Only AllThePlaces is refreshed: its predecessor goes, Overture's sourceless scan stays in service.
      await scan(ds, newA, [t], [[t, true]]);
      await succeededRun(ds, 'alltheplaces', t, newA);
      assert.equal(await swapPending(ds, 'overture'), 0);
      assert.equal(await swapPending(ds, 'alltheplaces'), 1);
      assert.deepEqual(
        (await retiredRows(ds)).map((r) => r.scanId),
        [oldA]
      );
      assert.equal(await servedRows(ds, t), 2);
    });
  }
);

test('retirement rejects a bad actor or reason', async () => {
  await assert.rejects(
    retireSourcelessTownRows(
      { query: async () => [], transaction: async (f) => f({}) },
      { communityId: randomUUID(), actor: 'Bad Actor!', reason: 'x' }
    ),
    /Invalid actor/
  );
  await assert.rejects(
    retireSourcelessTownRows(
      { query: async () => [], transaction: async (f) => f({}) },
      { communityId: randomUUID(), actor: 'operator:x', reason: '  ' }
    ),
    /Invalid reason/
  );
});
