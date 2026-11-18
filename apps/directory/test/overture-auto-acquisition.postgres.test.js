require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const auto = require('../src/overture-auto-acquisition');
const controls = require('../src/operating-controls');

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
const itemsFor = (...ids) =>
  ids.map((id, i) => ({
    id,
    asset: `https://example.invalid/release/${RELEASE}/theme=places/type=place/${id}.parquet`,
    etag: 'e' + id,
    size: 10,
    rows: 10,
    rowGroups: 1,
    bbox: [-90 + i * 10, 30, -81 + i * 10, 35],
    lastModified: 'Wed, 21 Oct 2026 00:00:00 GMT',
  }));
const inventory = {
  release: RELEASE,
  inventorySha256: 'a'.repeat(64),
  items: itemsFor('00001', '00002', '00003'),
};
const rights = { releaseId: RELEASE, operations: {}, terms: [] };

async function withDb(fn) {
  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  try {
    await ds.query(
      `TRUNCATE directory_acquisition_run, directory_acquisition_run_job, directory_acquisition_run_event, directory_town_scan_target,
       directory_town_geometry, directory_town, directory_provider_budget_attempt, directory_anonymous_overture_attempt, directory_operating_control CASCADE`
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
async function town(ds, name, { eligible = true, ready = true, x = -88 } = {}) {
  const id = randomUUID();
  await ds.query(
    `INSERT INTO directory_town ("communityId",name,eligible,"geometryStatus","geometryVersion") VALUES ($1,$2,$3,$4,$5)`,
    [id, name, eligible, ready ? 'ready' : 'pending', ready ? 1 : 0]
  );
  if (ready)
    await ds.query(
      `INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights) VALUES ($1,1,${square(
        x,
        31
      )},'census','2025','public')`,
      [id]
    );
  return id;
}
/** A fake extractor: rows per town id; records each request. */
function fakeExtractor(rowsByTown = {}, fail = {}) {
  const calls = [];
  const extract = async (request) => {
    const region = request.policy.regions[0];
    calls.push({ town: region.id, item: request.policy.itemId });
    if (fail[region.id]) throw Error(fail[region.id]);
    const n = rowsByTown[region.id] ?? 0;
    const scanId = `scan-${region.id}-${request.policy.itemId}`.slice(0, 64);
    for (let i = 0; i < n; i++)
      await request.sink.commit([{ outcome: { status: 'eligible' } }], {
        scanId,
        sourceFileRowNumber: i,
      });
    return { scanId, sourceFileRowNumber: n };
  };
  return { extract, calls };
}
// The real sink needs the rows' table shape; the fake extractor goes through a stub commit instead.
const stubSink = () => {
  const real = require('../src/overture-private-sink');
  const original = real.OverturePrivateSink.prototype.commit;
  real.OverturePrivateSink.prototype.commit = async () => undefined;
  return () => (real.OverturePrivateSink.prototype.commit = original);
};
const deps = (ds, extract, extra = {}) => ({
  db: ds,
  inventory,
  rights,
  extract,
  heartbeatMs: 60000,
  config: { limit: 2, maxAssets: 4, retryBackoffMs: 60000, maxAttempts: 3 },
  ...extra,
});
const runs = (ds) =>
  ds.query(
    `SELECT status,"blockedReason",reason FROM directory_acquisition_run ORDER BY "createdAt"`
  );

test(
  'sweep: limit per sweep, idempotent per town and release, run ledger rows',
  { skip: !url },
  async () => {
    const restore = stubSink();
    try {
      await withDb(async (ds) => {
        const a = await town(ds, 'Aaa');
        const b = await town(ds, 'Bbb');
        await town(ds, 'Ccc');
        await town(ds, 'Ineligible', { eligible: false });
        const f = fakeExtractor({ [a]: 3, [b]: 0 });
        const out = await auto.runAutoAcquisitionSweep(deps(ds, f.extract));
        assert.equal(out.status, 'ok');
        assert.equal(out.examined, 2);
        assert.equal(out.succeeded + out.empty, 2);
        assert.deepEqual(f.calls.map((c) => c.town).sort(), [a, b].sort());
        const rows = await runs(ds);
        assert.equal(rows.length, 2);
        assert.ok(rows.every((r) => r.reason.startsWith('auto:')));
        // A second sweep takes the remaining town only; the first two are not re-acquired.
        const out2 = await auto.runAutoAcquisitionSweep(deps(ds, f.extract));
        assert.equal(out2.examined, 1);
        const out3 = await auto.runAutoAcquisitionSweep(deps(ds, f.extract));
        assert.equal(out3.examined, 0);
        assert.equal((await runs(ds)).length, 3);
      });
    } finally {
      restore();
    }
  }
);

test(
  'sweep: pending geometry is skipped with a recorded blocked reason, once',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      await town(ds, 'Pending', { ready: false });
      const f = fakeExtractor();
      for (let i = 0; i < 2; i++) {
        const out = await auto.runAutoAcquisitionSweep(deps(ds, f.extract));
        assert.equal(out.examined, 0);
      }
      const rows = await runs(ds);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'blocked');
      assert.equal(rows[0].blockedReason, 'geometry_pending');
      assert.equal(f.calls.length, 0);
    });
  }
);

test(
  'sweep: kill switch does nothing, then resumes when cleared',
  { skip: !url },
  async () => {
    const restore = stubSink();
    try {
      await withDb(async (ds) => {
        await town(ds, 'Aaa');
        await ds.query(
          `INSERT INTO directory_operating_control (key,paused,reason,"updatedAt") VALUES ('provider_acquisition',true,'test',now())
         ON CONFLICT (key) DO UPDATE SET paused=true`
        );
        const f = fakeExtractor();
        const out = await auto.runAutoAcquisitionSweep(deps(ds, f.extract));
        assert.equal(out.status, 'paused');
        assert.equal(f.calls.length, 0);
        assert.equal((await runs(ds)).length, 0);
        assert.equal(await controls.isPaused(ds, 'provider_acquisition'), true);
        await ds.query(
          `UPDATE directory_operating_control SET paused=false WHERE key='provider_acquisition'`
        );
        const out2 = await auto.runAutoAcquisitionSweep(deps(ds, f.extract));
        assert.equal(out2.examined, 1);
      });
    } finally {
      restore();
    }
  }
);

test(
  'sweep: retryable failures back off then retry; permanent stays closed',
  { skip: !url },
  async () => {
    const restore = stubSink();
    try {
      await withDb(async (ds) => {
        const a = await town(ds, 'Aaa');
        const f = fakeExtractor({}, { [a]: 'connect ETIMEDOUT upstream' });
        const out = await auto.runAutoAcquisitionSweep(deps(ds, f.extract));
        assert.equal(out.failed, 1);
        assert.equal((await runs(ds))[0].status, 'failed_retryable');
        // Inside the backoff window: not selected.
        assert.equal(
          (await auto.runAutoAcquisitionSweep(deps(ds, f.extract))).examined,
          0
        );
        await ds.query(
          `UPDATE directory_acquisition_run SET "finishedAt"=now()-interval '1 hour'`
        );
        const ok = fakeExtractor({ [a]: 2 });
        const out3 = await auto.runAutoAcquisitionSweep(deps(ds, ok.extract));
        assert.equal(out3.examined, 1);
        assert.equal(out3.succeeded + out3.empty, 1);
      });
    } finally {
      restore();
    }
  }
);

test(
  'sweep: asset cap records partial and queues the rest',
  { skip: !url },
  async () => {
    const restore = stubSink();
    try {
      await withDb(async (ds) => {
        // A town whose bounds touch all three assets (wide geometry).
        const id = randomUUID();
        await ds.query(
          `INSERT INTO directory_town ("communityId",name,eligible,"geometryStatus","geometryVersion") VALUES ($1,'Wide',true,'ready',1)`,
          [id]
        );
        await ds.query(
          `INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights)
         VALUES ($1,1,ST_GeomFromText('MULTIPOLYGON(((-89 31,-70 31,-70 33,-89 33,-89 31)))',4326),'census','2025','public')`,
          [id]
        );
        const f = fakeExtractor({ [id]: 1 });
        const out = await auto.runAutoAcquisitionSweep(
          deps(ds, f.extract, {
            config: {
              limit: 1,
              maxAssets: 1,
              retryBackoffMs: 60000,
              maxAttempts: 3,
            },
          })
        );
        assert.equal(out.examined, 1);
        assert.equal(f.calls.length, 1);
        const [r] = await runs(ds);
        assert.equal(r.status, 'partial');
        const jobs = await ds.query(
          `SELECT status FROM directory_acquisition_run_job ORDER BY "unitKey"`
        );
        assert.ok(jobs.some((j) => j.status === 'queued'));
      });
    } finally {
      restore();
    }
  }
);

test(
  'sweep: stale running auto run is closed as retryable',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const id = randomUUID();
      await ds.query(
        `INSERT INTO directory_acquisition_run (id,provider,release,kind,"townIds",status,reason,"heartbeatAt","startedAt")
       VALUES ($1,'overture',$2,'overture-stage','[]','running','auto: x',now()-interval '1 hour',now()-interval '1 hour')`,
        [id, RELEASE]
      );
      assert.equal(await auto.closeStaleAutoRuns(ds, RELEASE), 1);
      assert.equal((await runs(ds))[0].status, 'failed_retryable');
    });
  }
);
