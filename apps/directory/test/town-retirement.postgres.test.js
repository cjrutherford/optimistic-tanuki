require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { retireSourcelessTownRows } = require('../src/town-retirement');
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
      assert.deepEqual(await dueNames(ds, auto.selectTowns), []);

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
      // The pilot is acquired again; the town sharing the scan and the town whose rows carry sources are not.
      assert.deepEqual(await dueNames(ds, auto.selectTowns), ['Pilot']);
      // A retired town is fetched ahead of towns that were never attempted, however new their geometry.
      const fresh = await town(ds, 'Fresh');
      await ds.query(
        `UPDATE directory_town_geometry SET "createdAt"=now() - interval '90 days' WHERE "communityId"=$1`,
        [pilot]
      );
      const ordered = (await auto.selectTowns(ds, RELEASE, config)).map(
        (t) => t.name
      );
      assert.deepEqual(ordered, ['Pilot', 'Fresh']);
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
      assert.deepEqual(await dueNames(ds, atp.selectAtpTowns), ['Pilot']);
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
