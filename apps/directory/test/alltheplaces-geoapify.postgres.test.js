require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DataSource } = require('typeorm');
const atp = require('../src/alltheplaces');
const acq = require('../src/alltheplaces-acquisition');
const geo = require('../src/geoapify-enrichment');

// Disposable, loopback-only database named s7e_scratch_*; the caller drops it afterwards.
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
const policies = JSON.parse(
  readFileSync(join(__dirname, '../rights-policies/policies.json'), 'utf8')
);
const policy = atp.selectAtpPolicy(policies);
const fixture = JSON.parse(
  readFileSync(
    join(__dirname, 'fixtures/alltheplaces-synthetic.geojson'),
    'utf8'
  )
);

async function withDb(fn) {
  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  try {
    await ds.query(
      `TRUNCATE directory_acquisition_run, directory_acquisition_run_job, directory_acquisition_run_event, directory_town_scan_target,
       directory_town_geometry, directory_town, directory_provider_budget_attempt, directory_anonymous_overture_attempt,
       directory_operating_control, directory_overture_private_row, directory_overture_private_completion,
       directory_overture_private_revocation, directory_provider_status, directory_geoapify_enrichment CASCADE`
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
async function town(ds, name) {
  const id = randomUUID();
  await ds.query(
    `INSERT INTO directory_town ("communityId",name,eligible,"geometryStatus","geometryVersion") VALUES ($1,$2,true,'ready',1)`,
    [id, name]
  );
  await ds.query(
    `INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights) VALUES ($1,1,${square(
      -88,
      31
    )},'census','2025','public')`,
    [id]
  );
  return id;
}
/** Marks Overture as finished for the town, with one staged Overture place the ATP fixture duplicates. */
async function overtureDone(ds, townId) {
  const scanId = 'overture-scan-' + townId.slice(0, 8);
  await ds.query(
    `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,0,$2,$3::jsonb)`,
    [
      scanId,
      townId,
      JSON.stringify({
        name: 'Synthetic Diner',
        category: 'restaurant',
        location: { type: 'Point', coordinates: [-87.5, 31.5] },
      }),
    ]
  );
  await ds.query(
    `INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)`,
    [scanId]
  );
  await ds.query(
    `INSERT INTO directory_town_scan_target ("communityId","scanId",provenance) VALUES ($1,$2,'recorded')`,
    [townId, scanId]
  );
}
const stubSink = () => {
  const real = require('../src/overture-private-sink');
  const original = real.OverturePrivateSink.prototype.commit;
  real.OverturePrivateSink.prototype.commit = async () => undefined;
  return () => (real.OverturePrivateSink.prototype.commit = original);
};
function harness(overrides = {}) {
  const calls = { reserve: 0, extract: 0, outcomes: [] };
  const snapshot = {
    path: '/nonexistent.parquet',
    sha256: 'c'.repeat(64),
    size: 10,
    rows: 3,
    bbox: [-90, 30, -80, 35],
  };
  return {
    calls,
    deps: (ds) => ({
      db: ds,
      policy,
      heartbeatMs: 60000,
      config: { limit: 2, maxAssets: 4, retryBackoffMs: 60000, maxAttempts: 3 },
      ensureSnapshot: async (reserve) => {
        await reserve({
          asset: policy.archive.url,
          etag: policy.archive.sha256,
          method: 'GET',
        });
        calls.reserve++;
        return snapshot;
      },
      extract: async (request) => {
        calls.extract++;
        for (const f of fixture.features) {
          const row = atp.atpFeatureToRow(f, 'syn_spider');
          if (!row) continue;
          calls.outcomes.push(
            await request.project({
              source: {
                id: row.id,
                names: row.names,
                basic_category: row.basic_category,
                taxonomy: row.taxonomy,
                geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
              },
            })
          );
        }
        return {
          scanId: 'atp-scan-' + request.policy.regions[0].id.slice(0, 8),
          sourceFileRowNumber: 3,
        };
      },
      ...overrides,
    }),
  };
}

test(
  'ATP sweep: run ledger, budget reservation, dedupe against Overture, then idempotent',
  { skip: !url },
  async () => {
    const restore = stubSink();
    try {
      await withDb(async (ds) => {
        const t = await town(ds, 'Atp Town');
        await town(ds, 'No Overture Yet');
        await overtureDone(ds, t);
        const h = harness();
        const out = await acq.runAtpAcquisitionSweep(h.deps(ds));
        assert.equal(out.status, 'ok');
        assert.equal(out.examined, 1, 'only the town Overture has finished');
        const runs = await ds.query(
          `SELECT provider,kind,status,release,reason FROM directory_acquisition_run`
        );
        assert.equal(runs.length, 1);
        assert.equal(runs[0].provider, 'alltheplaces');
        assert.equal(runs[0].release, policy.releaseId);
        assert.ok(runs[0].reason.startsWith('auto:'));
        assert.equal(h.calls.reserve, 1);
        assert.equal(
          (await ds.query(`SELECT 1 FROM directory_anonymous_overture_attempt`))
            .length,
          1,
          'the archive read is in the anonymous-attempt ledger'
        );
        // Synthetic Diner duplicates the staged Overture row; the hardware store is new.
        assert.deepEqual(
          h.calls.outcomes.map((o) => o.status),
          ['quarantined', 'eligible']
        );
        const [job] = await ds.query(
          `SELECT checkpoint FROM directory_acquisition_run_job`
        );
        assert.equal(
          job.checkpoint.dedupedAgainstOverture.overture_same_place,
          1
        );
        assert.equal(job.checkpoint.stagedOvertureCompared, 1);
        const again = await acq.runAtpAcquisitionSweep(h.deps(ds));
        assert.equal(again.examined, 0);
      });
    } finally {
      restore();
    }
  }
);

test(
  'ATP sweep: kill switch stops it before any provider work',
  { skip: !url },
  async () => {
    const restore = stubSink();
    try {
      await withDb(async (ds) => {
        const t = await town(ds, 'Paused Town');
        await overtureDone(ds, t);
        await ds.query(
          `INSERT INTO directory_operating_control (key,paused,reason,"updatedAt") VALUES ('provider_acquisition',true,'test',now())`
        );
        const h = harness();
        const out = await acq.runAtpAcquisitionSweep(h.deps(ds));
        assert.equal(out.status, 'paused');
        assert.equal(h.calls.reserve + h.calls.extract, 0);
        assert.equal(
          (await ds.query(`SELECT 1 FROM directory_acquisition_run`)).length,
          0
        );
      });
    } finally {
      restore();
    }
  }
);

test(
  'ATP sweep: a failed download is failed_retryable and the sweep backs off',
  { skip: !url },
  async () => {
    const restore = stubSink();
    try {
      await withDb(async (ds) => {
        for (const n of ['A', 'B']) await overtureDone(ds, await town(ds, n));
        const h = harness({
          ensureSnapshot: async () => {
            throw Object.assign(Error('getaddrinfo EAI_AGAIN'), {
              code: 'EAI_AGAIN',
            });
          },
        });
        const out = await acq.runAtpAcquisitionSweep(h.deps(ds));
        assert.equal(
          out.examined,
          1,
          'stops after the first retryable failure'
        );
        const [r] = await ds.query(
          `SELECT status FROM directory_acquisition_run`
        );
        assert.equal(r.status, 'failed_retryable');
      });
    } finally {
      restore();
    }
  }
);

/* ------------------------------ Geoapify ------------------------------ */

async function stagedRow(ds, scanId, n, { complete = true } = {}) {
  await ds.query(
    `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,'r',$3::jsonb)`,
    [
      scanId,
      n,
      JSON.stringify({
        name: 'Row ' + n,
        category: 'restaurant',
        location: { type: 'Point', coordinates: [-87.5, 31.5] },
      }),
    ]
  );
  if (complete)
    await ds.query(
      `INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1) ON CONFLICT DO NOTHING`,
      [scanId]
    );
}
const gpolicy = geo.selectGeoapifyPolicy(policies);
const okFetch = (log) => async (u) => {
  log.push(u.toString());
  return {
    ok: true,
    status: 200,
    json: async () => ({
      features: [
        {
          properties: {
            opening_hours: 'Mo-Fr 09:00-17:00',
            contact: { phone: '+1 555 0100', email: 'x@y.invalid' },
          },
        },
      ],
    }),
  };
};
const status = (ds) =>
  ds.query(
    `SELECT status FROM directory_provider_status WHERE provider='geoapify'`
  );

test(
  'Geoapify: no key records not_configured and does nothing',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      await stagedRow(ds, 'scan-1', 0);
      const log = [];
      const out = await geo.runGeoapifySweep({
        db: ds,
        apiKey: undefined,
        policy: gpolicy,
        fetchImpl: okFetch(log),
      });
      assert.equal(out.examined, 0);
      assert.equal(log.length, 0);
      assert.equal((await status(ds))[0].status, 'not_configured');
      assert.equal(
        (await ds.query(`SELECT 1 FROM directory_geoapify_enrichment`)).length,
        0
      );
      assert.equal(
        (await ds.query(`SELECT 1 FROM directory_provider_budget_attempt`))
          .length,
        0
      );
    });
  }
);

test(
  'Geoapify: enriches staged rows privately, budget-gated; details never carry the key or email',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      await stagedRow(ds, 'scan-1', 0);
      await stagedRow(ds, 'scan-1', 1);
      await stagedRow(ds, 'scan-incomplete', 0, { complete: false });
      const log = [];
      const out = await geo.runGeoapifySweep({
        db: ds,
        apiKey: 'test-key-not-real',
        policy: gpolicy,
        costCents: 2,
        batch: 10,
        fetchImpl: okFetch(log),
      });
      assert.equal(out.succeeded, 2, 'the incomplete scan is not enriched');
      const budget = await ds.query(
        `SELECT provider,operation,"reservedCents" FROM directory_provider_budget_attempt`
      );
      assert.equal(budget.length, 2);
      assert.deepEqual(budget[0], {
        provider: 'geoapify',
        operation: 'place-details',
        reservedCents: 2,
      });
      const rows = await ds.query(
        `SELECT details,"expiresAt","fetchedAt" FROM directory_geoapify_enrichment`
      );
      assert.equal(rows.length, 2);
      assert.deepEqual(rows[0].details, {
        openingHours: 'Mo-Fr 09:00-17:00',
        phone: '+1 555 0100',
      });
      const days = (rows[0].expiresAt - rows[0].fetchedAt) / 86400000;
      assert.ok(Math.abs(days - gpolicy.retentionDays) < 0.01);
      assert.doesNotMatch(
        JSON.stringify(rows),
        /test-key-not-real|x@y\.invalid/
      );
      assert.equal((await status(ds))[0].status, 'ok');
      // Already-enriched rows are not fetched again.
      const before = log.length;
      await geo.runGeoapifySweep({
        db: ds,
        apiKey: 'test-key-not-real',
        policy: gpolicy,
        fetchImpl: okFetch(log),
      });
      assert.equal(log.length, before);
    });
  }
);

test(
  'Geoapify: kill switch and a missing policy stop all lookups',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      await stagedRow(ds, 'scan-1', 0);
      const log = [];
      await geo.runGeoapifySweep({
        db: ds,
        apiKey: 'k',
        policy: null,
        fetchImpl: okFetch(log),
      });
      assert.equal((await status(ds))[0].status, 'no_policy');
      await ds.query(
        `INSERT INTO directory_operating_control (key,paused,reason,"updatedAt") VALUES ('provider_acquisition',true,'test',now())`
      );
      const out = await geo.runGeoapifySweep({
        db: ds,
        apiKey: 'k',
        policy: gpolicy,
        fetchImpl: okFetch(log),
      });
      assert.equal(out.status, 'paused');
      assert.equal(log.length, 0);
    });
  }
);

test(
  'Geoapify: retention deletes expired and withdrawn enrichment even with no key',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      await stagedRow(ds, 'scan-keep', 0);
      await stagedRow(ds, 'scan-old', 0);
      await stagedRow(ds, 'scan-revoked', 0);
      const ins = (scan, expires) =>
        ds.query(
          `INSERT INTO directory_geoapify_enrichment ("scanId","sourceFileRowNumber",details,"fetchedAt","expiresAt") VALUES ($1,0,'{}'::jsonb,now() - interval '40 days',${expires})`,
          [scan]
        );
      await ins('scan-keep', `now() + interval '1 day'`);
      await ins('scan-old', `now() - interval '1 day'`);
      await ins('scan-revoked', `now() + interval '1 day'`);
      await ds.query(
        `INSERT INTO directory_overture_private_revocation ("scanId") VALUES ('scan-revoked')`
      );
      await geo.runGeoapifySweep({ db: ds, apiKey: '', policy: gpolicy });
      assert.equal(await geo.runGeoapifyRetention(ds), 0);
      const left = await ds.query(
        `SELECT "scanId" FROM directory_geoapify_enrichment`
      );
      assert.deepEqual(
        left.map((r) => r.scanId),
        ['scan-keep']
      );
    });
  }
);

test(
  'Geoapify: its own monthly hard stop is never exceeded and never touches the shared ledger',
  { skip: !url },
  async () => {
    const budget = require('../src/provider-budget');
    const saved = process.env.DIRECTORY_GEOAPIFY_MONTHLY_LIMIT_CENTS;
    process.env.DIRECTORY_GEOAPIFY_MONTHLY_LIMIT_CENTS = '3';
    try {
      await withDb(async (ds) => {
        for (let i = 0; i < 6; i++) await stagedRow(ds, 'scan-b', i);
        const out = await geo.runGeoapifySweep({
          db: ds,
          apiKey: 'test-key-not-real',
          policy: gpolicy,
          costCents: 1,
          batch: 10,
          fetchImpl: okFetch([]),
        });
        assert.equal(out.succeeded, 3, 'stops at the 3 cent limit');
        assert.equal(out.status, 'blocked');
        assert.equal((await status(ds))[0].status, 'budget_blocked');
        assert.equal(
          (await ds.query(`SELECT 1 FROM directory_geoapify_enrichment`))
            .length,
          3
        );
        // Another provider is unaffected by Geoapify spend, and by Geoapify being exhausted.
        const r = await budget.reserveProviderBudget(ds, {
          attemptId: require('node:crypto').randomUUID(),
          provider: 'overture',
          operation: 'range.get',
          maxCostCents: 2500,
        });
        assert.equal(r.state, 'reserved');
        // ...and the other way round: shared spend does not use up Geoapify's ceiling.
        process.env.DIRECTORY_GEOAPIFY_MONTHLY_LIMIT_CENTS = '2500';
        const g = await budget.reserveProviderBudget(ds, {
          attemptId: require('node:crypto').randomUUID(),
          provider: 'geoapify',
          operation: 'place-details',
          maxCostCents: 1,
        });
        assert.equal(g.remainingCents, 2500 - 3 - 1);
      });
    } finally {
      if (saved === undefined)
        delete process.env.DIRECTORY_GEOAPIFY_MONTHLY_LIMIT_CENTS;
      else process.env.DIRECTORY_GEOAPIFY_MONTHLY_LIMIT_CENTS = saved;
    }
  }
);

test(
  'Geoapify: daily cap bounds lookups, coordinate-less rows are skipped, errors never carry the key',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      for (let i = 0; i < 4; i++) await stagedRow(ds, 'scan-c', i);
      await ds.query(
        `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ('scan-c',99,'r','{"name":"no coords"}')`
      );
      const first = await geo.runGeoapifySweep({
        db: ds,
        apiKey: 'test-key-not-real',
        policy: gpolicy,
        batch: 10,
        dailyLookups: 2,
        fetchImpl: okFetch([]),
      });
      assert.equal(first.succeeded, 2);
      const second = await geo.runGeoapifySweep({
        db: ds,
        apiKey: 'test-key-not-real',
        policy: gpolicy,
        batch: 10,
        dailyLookups: 2,
        fetchImpl: okFetch([]),
      });
      assert.equal(second.examined, 0, 'the daily cap is spent');
      // A transport error that echoes the request URL is redacted before it is logged or stored.
      const logs = [];
      const bad = await geo.runGeoapifySweep({
        db: ds,
        apiKey: 'test-key-not-real',
        policy: gpolicy,
        batch: 10,
        dailyLookups: 50,
        log: (m) => logs.push(m),
        fetchImpl: async (u) => {
          throw Error(`fetch failed for ${u.toString()}`);
        },
      });
      assert.equal(bad.failed, 1);
      const [s] = await ds.query(
        `SELECT status,detail FROM directory_provider_status WHERE provider='geoapify'`
      );
      assert.equal(s.status, 'error');
      assert.doesNotMatch(
        JSON.stringify([s, logs]),
        /test-key-not-real|apiKey=test/
      );
      assert.match(s.detail, /redacted/);
    });
  }
);
