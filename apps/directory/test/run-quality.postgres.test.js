require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const run = require('../src/acquisition-run');
const q = require('../src/run-quality');
const { renormalizeScan } = require('../src/renormalize');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const hex = () => randomBytes(32).toString('hex');
const square = `ST_GeomFromText('MULTIPOLYGON(((-88 31,-87 31,-87 32,-88 32,-88 31)))',4326)`;

async function withDb(fn) {
  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  try {
    await ds.query(
      `TRUNCATE directory_acquisition_run, directory_acquisition_run_job, directory_acquisition_run_event,
       directory_town_scan_target, directory_town_scan_retirement, directory_overture_private_row,
       directory_overture_private_row_revocation, directory_overture_private_completion,
       directory_overture_private_membership, directory_overture_private_policy, directory_scan_normalization,
       directory_town_geometry, directory_town CASCADE`
    );
    await fn(ds);
  } finally {
    await ds.destroy();
  }
}

async function town(ds) {
  const id = randomUUID();
  await ds.query(
    `INSERT INTO directory_town ("communityId",name,eligible,"geometryStatus","geometryVersion","registeredAt")
     VALUES ($1,'Quality Town',true,'ready',1,now())`,
    [id]
  );
  await ds.query(
    `INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights,"createdAt")
     VALUES ($1,1,${square},'census','2025','public',now())`,
    [id]
  );
  return id;
}

/** A completed scan of the town with `inside` rows in the boundary and `outside` rows beyond it. */
async function scan(ds, townId, { inside, outside }) {
  const scanId = hex();
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
    `INSERT INTO directory_town_scan_target ("communityId","scanId","provenance") VALUES ($1,$2,'recorded')`,
    [townId, scanId]
  );
  for (let i = 0; i < inside + outside; i++) {
    const lng = i < inside ? -87.5 + i * 0.001 : -86 + i * 0.001;
    await ds.query(
      `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)`,
      [
        scanId,
        i + 1,
        townId,
        JSON.stringify({
          name: `Shop ${i}`,
          category: 'restaurants',
          location: { type: 'Point', coordinates: [lng, 31.5] },
        }),
      ]
    );
  }
  return scanId;
}

async function runOf(ds, townId, scanId) {
  const id = await run.beginRun(ds, {
    provider: 'overture',
    release: '2026-10-21.0',
    kind: 'overture-stage',
    townIds: [townId],
  });
  await run.beginJob(ds, id, { unitKey: 'town', townId, scanId });
  await run.finishJob(ds, id, 'town', { status: 'succeeded' });
  return id;
}

test(
  'a clean run keeps its scan and stores the scorecard',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const t = await town(ds);
      const s = await scan(ds, t, { inside: 40, outside: 0 });
      const id = await runOf(ds, t, s);
      const status = await q.finishRunWithQuality(ds, id, t);
      assert.equal(status, 'succeeded');
      const [r] = await ds.query(
        `SELECT quality FROM directory_acquisition_run WHERE id=$1`,
        [id]
      );
      assert.equal(r.quality.passed, true);
      assert.equal(r.quality.rows, 40);
      assert.equal(r.quality.outOfBoundary.count, 0);
      const ret = await ds.query(
        `SELECT 1 FROM directory_town_scan_retirement WHERE "scanId"=$1`,
        [s]
      );
      assert.equal(ret.length, 0);
      const [n] = await ds.query(
        `SELECT "normalizerVersion" FROM directory_scan_normalization WHERE "scanId"=$1`,
        [s]
      );
      assert.equal(n.normalizerVersion, 'normalize-v1');
    });
  }
);

test(
  'a run past a limit fails with quality_limit, retires its own scan and leaves the live scan alone',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const t = await town(ds);
      const live = await scan(ds, t, { inside: 40, outside: 0 });
      const first = await runOf(ds, t, live);
      assert.equal(await q.finishRunWithQuality(ds, first, t), 'succeeded');

      const bad = await scan(ds, t, { inside: 20, outside: 20 });
      const id = await runOf(ds, t, bad);
      assert.equal(await q.finishRunWithQuality(ds, id, t), 'failed_permanent');
      const [r] = await ds.query(
        `SELECT status,"lastError",quality FROM directory_acquisition_run WHERE id=$1`,
        [id]
      );
      assert.equal(r.status, 'failed_permanent');
      assert.match(r.lastError, /^quality_limit: maxOutOfBoundaryRate/);
      assert.deepEqual(r.quality.breaches, ['maxOutOfBoundaryRate']);
      assert.equal(
        (await run.getAcquisitionRun(ds, id)).failureReason,
        'quality_limit'
      );

      const retired = await ds.query(
        `SELECT "scanId",actor FROM directory_town_scan_retirement WHERE "communityId"=$1`,
        [t]
      );
      assert.deepEqual(
        retired.map((x) => x.scanId),
        [bad]
      );
      assert.equal(retired[0].actor, q.QUALITY_GATE_ACTOR);
      const revoked = await ds.query(
        `SELECT count(*)::int AS n FROM directory_overture_private_row_revocation WHERE "scanId"=$1`,
        [bad]
      );
      assert.equal(revoked[0].n, 40);
      const liveRevoked = await ds.query(
        `SELECT 1 FROM directory_overture_private_row_revocation WHERE "scanId"=$1`,
        [live]
      );
      assert.equal(liveRevoked.length, 0);
    });
  }
);

test(
  'renormalisation backfills the block idempotently and dry-run writes nothing',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const t = await town(ds);
      const s = await scan(ds, t, { inside: 30, outside: 0 });
      const dry = await renormalizeScan(ds, s, { dryRun: true });
      assert.equal(dry.updated, 30);
      assert.equal(
        (
          await ds.query(
            `SELECT count(*)::int AS n FROM directory_overture_private_row WHERE listing ? 'normalized'`
          )
        )[0].n,
        0
      );
      const first = await renormalizeScan(ds, s);
      assert.equal(first.updated, 30);
      const [row] = await ds.query(
        `SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1 ORDER BY "sourceFileRowNumber" LIMIT 1`,
        [s]
      );
      assert.equal(row.listing.normalized.nameKey, 'shop 0');
      assert.equal(row.listing.name, 'Shop 0');
      const again = await renormalizeScan(ds, s);
      assert.equal(again.updated, 0);
    });
  }
);
