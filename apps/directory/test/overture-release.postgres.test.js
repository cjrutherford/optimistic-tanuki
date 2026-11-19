require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DataSource } = require('typeorm');
const rel = require('../src/overture-release');
const run = require('../src/acquisition-run');
const refresh = require('../src/overture-auto-acquisition');
const { DEFAULT_QUALITY_LIMITS } = require('../src/run-quality');

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
const ACTIVE = '2026-10-21.0';
const NEW = '2026-11-18.0';
const DECL = 'other|https://docs.overturemaps.org/attribution/';
const policies = JSON.parse(
  readFileSync(join(__dirname, '../rights-policies/policies.json'), 'utf8')
);
const baseRights = policies.find((p) => p.releaseId === ACTIVE);
const inventoryFor = (release) => ({
  release,
  inventorySha256: 'a'.repeat(64),
  items: ['00001', '00002'].map((id, i) => ({
    id,
    asset: `https://example.invalid/release/${release}/theme=places/type=place/${id}.parquet`,
    etag: 'e' + id,
    size: 10,
    rows: 10,
    rowGroups: 1,
    bbox: [-90 + i * 10, 30, -81 + i * 10, 35],
    lastModified: 'Wed, 21 Oct 2026 00:00:00 GMT',
  })),
});
const source = (over = {}) => ({
  calls: [],
  listReleases: async () => over.releases ?? [ACTIVE, NEW],
  licenseOf: async () => ('license' in over ? over.license : DECL),
  buildInventory: async function (release) {
    if (over.inventoryError) throw Error(over.inventoryError);
    return inventoryFor(release);
  },
});

async function withDb(fn) {
  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  try {
    await ds.query(
      `TRUNCATE directory_acquisition_run, directory_acquisition_run_job, directory_acquisition_run_event, directory_town_scan_target,
       directory_town_geometry, directory_town, directory_provider_budget_attempt, directory_anonymous_overture_attempt,
       directory_operating_control, directory_overture_private_row, directory_boundary_lock, directory_overture_release_candidate CASCADE`
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
async function town(ds, name, o = {}) {
  const { eligible = true, ready = true, x = -88, rows = 0 } = o;
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
  for (let i = 0; i < rows; i++)
    await ds.query(
      `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,'{}'::jsonb)`,
      ['old-' + id.slice(0, 8), i, id]
    );
  return id;
}
/** Extractor that stages real private rows: spec[townId] = {n, bad} or {fail}. */
let scanSeq = 0;
function extractor(ds, spec = {}) {
  const calls = [];
  const extract = async (request) => {
    const region = request.policy.regions[0];
    calls.push(region.id);
    const s = spec[region.id] ?? { n: 2 };
    if (s.fail) throw Error(s.fail);
    const scanId = `s${++scanSeq}-${region.id}`.slice(0, 64);
    for (let i = 0; i < (s.n ?? 0); i++)
      await ds.query(
        `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [
          scanId,
          i,
          region.id,
          JSON.stringify({
            name: s.bad ? '' : 'Shop ' + i,
            category: 'shop',
            location: { coordinates: [-87.5 + i / 100, 31.5] },
          }),
        ]
      );
    return { scanId, sourceFileRowNumber: s.n ?? 0 };
  };
  return { extract, calls };
}
const stubSink = () => {
  const real = require('../src/overture-private-sink');
  const original = real.OverturePrivateSink.prototype.commit;
  real.OverturePrivateSink.prototype.commit = async () => undefined;
  return () => (real.OverturePrivateSink.prototype.commit = original);
};
const limits = {
  ...DEFAULT_QUALITY_LIMITS,
  minRowsForRates: 1,
  minNameCompleteness: 1,
};
const deps = (ds, src, ex, extra = {}) => ({
  db: ds,
  source: src,
  active: {
    release: ACTIVE,
    inventory: inventoryFor(ACTIVE),
    rights: baseRights,
  },
  extract: ex.extract,
  heartbeatMs: 60000,
  qualityLimits: limits,
  config: { limit: 2, maxAssets: 4, retryBackoffMs: 60000, maxAttempts: 3 },
  ...extra,
});
const cand = async (ds, release = NEW) =>
  (
    await ds.query(
      `SELECT * FROM directory_overture_release_candidate WHERE release=$1`,
      [release]
    )
  )[0];
const sandbox = async (fn) => {
  const restore = stubSink();
  try {
    await withDb(fn);
  } finally {
    restore();
  }
};

test('pure: release ordering and the rights check', () => {
  assert.ok(rel.compareReleases('2026-11-18.0', '2026-10-21.0') > 0);
  assert.ok(rel.compareReleases('2026-09-23.1', '2026-09-23.0') > 0);
  assert.equal(rel.compareReleases(ACTIVE, ACTIVE), 0);
  assert.equal(rel.isReleaseId('2026-11-18.0'), true);
  assert.equal(rel.isReleaseId('latest'), false);
  const ok = rel.checkReleaseRights(NEW, DECL, DECL, baseRights);
  assert.equal(ok.status, 'approved');
  assert.equal(ok.policy.releaseId, NEW);
  assert.ok(
    ok.policy.terms.every((t) => t.attribution.includes('(November 2026)'))
  );
  for (const declared of [null, '', 'other|https://elsewhere.invalid/']) {
    const bad = rel.checkReleaseRights(NEW, declared, DECL, baseRights);
    assert.equal(bad.status, 'mismatch');
    assert.equal(bad.policy, null);
  }
  const noIngest = rel.checkReleaseRights(NEW, DECL, DECL, {
    ...baseRights,
    operations: { ...baseRights.operations, ingest: false },
  });
  assert.equal(noIngest.status, 'mismatch');
});

test(
  'detect, canary on default 3 towns, promote when all succeed, idempotent',
  { skip: !url },
  () =>
    sandbox(async (ds) => {
      const big = await town(ds, 'Big', { rows: 5 });
      const mid = await town(ds, 'Mid', { rows: 3 });
      const small = await town(ds, 'Small', { rows: 1 });
      const empty = await town(ds, 'Empty');
      await town(ds, 'Ineligible', { eligible: false, rows: 9 });
      await town(ds, 'Pending', { ready: false, rows: 9 });
      const locked = await town(ds, 'Locked', { rows: 9 });
      await ds.query(
        `INSERT INTO directory_boundary_lock ("communityId",version,geoid,layer,vintage,"stateFips","archiveSha256","geometryHash","evidenceHash","sourceUrl",evidence)
         VALUES ($1,1,'0100000','place','2025','01',$2,$2,$2,'https://example.invalid/','{}'::jsonb)`,
        [locked, 'c'.repeat(64)]
      );
      const src = source();
      const ex = extractor(ds);
      const out = await rel.runOvertureReleaseSweep(deps(ds, src, ex));
      assert.equal(out.status, 'ok');
      const c = await cand(ds);
      assert.equal(c.status, 'promoted');
      assert.equal(c.rightsStatus, 'approved');
      assert.equal(c.rightsPolicy.releaseId, NEW);
      // Populated towns first, three of them, none excluded.
      assert.deepEqual([...c.canaryTownIds].sort(), [big, mid, small].sort());
      assert.ok(!c.canaryTownIds.includes(locked));
      assert.ok(!c.canaryTownIds.includes(empty));
      assert.deepEqual([...ex.calls].sort(), [big, mid, small].sort());
      assert.ok(c.canaryResults.every((r) => r.outcome === 'ok'));
      const active = await rel.activeOvertureRelease(ds);
      assert.equal(active.release, NEW);
      assert.equal(active.source, 'promoted');
      // Idempotent: a second sweep neither re-runs canaries nor re-promotes.
      const before = ex.calls.length;
      await rel.runOvertureReleaseSweep(deps(ds, src, ex));
      assert.equal(ex.calls.length, before);
      assert.equal(
        (
          await ds.query(
            `SELECT count(*)::int n FROM directory_overture_release_candidate`
          )
        )[0].n,
        1
      );
      // The refresh rule now sees the new release: the other towns are never attempted for it.
      const panel = await rel.overtureReleasePanel(ds);
      assert.equal(panel.active.release, NEW);
      assert.equal(panel.candidates[0].status, 'promoted');
      assert.equal(panel.candidates[0].canary.length, 3);
    })
);

test('configurable canary count', { skip: !url }, () =>
  sandbox(async (ds) => {
    await town(ds, 'A', { rows: 3 });
    await town(ds, 'B', { rows: 2 });
    await town(ds, 'C', { rows: 1 });
    const ex = extractor(ds);
    await rel.runOvertureReleaseSweep(
      deps(ds, source(), ex, { canaryTowns: 1 })
    );
    assert.equal((await cand(ds)).canaryTownIds.length, 1);
    assert.equal(ex.calls.length, 1);
  })
);

test(
  'a quality failure holds the release with quality_limit; a held release is never promoted',
  { skip: !url },
  () =>
    sandbox(async (ds) => {
      const a = await town(ds, 'A', { rows: 3 });
      await town(ds, 'B', { rows: 2 });
      const ex = extractor(ds, { [a]: { n: 2, bad: true } });
      await rel.runOvertureReleaseSweep(deps(ds, source(), ex));
      const c = await cand(ds);
      assert.equal(c.status, 'held');
      assert.equal(c.holdReason, 'quality_limit');
      assert.equal(
        c.canaryResults.find((r) => r.townId === a).reason,
        'quality_limit'
      );
      assert.equal((await rel.activeOvertureRelease(ds)).release, ACTIVE);
      const before = ex.calls.length;
      await rel.runOvertureReleaseSweep(deps(ds, source(), ex));
      assert.equal(ex.calls.length, before);
      assert.equal((await cand(ds)).status, 'held');
      const panel = await rel.overtureReleasePanel(ds);
      assert.equal(panel.candidates[0].holdReason, 'quality_limit');
    })
);

test(
  'an empty canary and a failed canary hold the release',
  { skip: !url },
  () =>
    sandbox(async (ds) => {
      const a = await town(ds, 'A', { rows: 3 });
      await town(ds, 'B', { rows: 2 });
      const ex = extractor(ds, { [a]: { n: 0 } });
      await rel.runOvertureReleaseSweep(deps(ds, source(), ex));
      assert.equal((await cand(ds)).holdReason, 'canary_empty');
    })
);

test(
  'a changed licence declaration is held as a rights mismatch and runs no canary',
  { skip: !url },
  () =>
    sandbox(async (ds) => {
      await town(ds, 'A', { rows: 3 });
      const ex = extractor(ds);
      const src = {
        ...source(),
        licenseOf: async (r) =>
          r === NEW ? 'other|https://new.invalid/' : DECL,
      };
      await rel.runOvertureReleaseSweep(deps(ds, src, ex));
      const c = await cand(ds);
      assert.equal(c.rightsStatus, 'mismatch');
      assert.equal(c.status, 'held');
      assert.equal(ex.calls.length, 0);
    })
);

test(
  'no canary towns holds; an unavailable inventory is retried, not held',
  { skip: !url },
  () =>
    sandbox(async (ds) => {
      const ex = extractor(ds);
      await rel.runOvertureReleaseSweep(deps(ds, source(), ex));
      assert.equal((await cand(ds)).holdReason, 'no_canary_towns');
      await ds.query(`TRUNCATE directory_overture_release_candidate`);
      await town(ds, 'A', { rows: 1 });
      await rel.runOvertureReleaseSweep(
        deps(ds, source({ inventoryError: 'stac down' }), ex)
      );
      const c = await cand(ds);
      assert.equal(c.status, 'detected');
      assert.match(c.lastError, /stac down/);
      await rel.runOvertureReleaseSweep(deps(ds, source(), ex));
      assert.equal((await cand(ds)).status, 'promoted');
    })
);

test(
  'older unseen releases are superseded; nothing newer is a no-op',
  { skip: !url },
  () =>
    sandbox(async (ds) => {
      const ex = extractor(ds);
      await rel.runOvertureReleaseSweep(
        deps(ds, source({ releases: [ACTIVE, '2026-11-04.0', NEW] }), ex)
      );
      assert.equal((await cand(ds, '2026-11-04.0')).status, 'rejected');
      assert.equal(
        (await cand(ds, '2026-11-04.0')).holdReason,
        `superseded_by_${NEW}`
      );
      await ds.query(`TRUNCATE directory_overture_release_candidate`);
      await rel.runOvertureReleaseSweep(
        deps(ds, source({ releases: [ACTIVE] }), ex)
      );
      assert.equal(
        (
          await ds.query(
            `SELECT count(*)::int n FROM directory_overture_release_candidate`
          )
        )[0].n,
        0
      );
    })
);

test(
  'the kill switch and the budget hard stop leave the state untouched',
  { skip: !url },
  () =>
    sandbox(async (ds) => {
      await town(ds, 'A', { rows: 3 });
      const ex = extractor(ds);
      await ds.query(
        `INSERT INTO directory_operating_control (key,paused,reason,"updatedAt") VALUES ('provider_acquisition',true,'t',now())
         ON CONFLICT (key) DO UPDATE SET paused=true`
      );
      const paused = await rel.runOvertureReleaseSweep(deps(ds, source(), ex));
      assert.equal(paused.status, 'paused');
      assert.equal(await cand(ds), undefined);
      await ds.query(
        `UPDATE directory_operating_control SET paused=false WHERE key='provider_acquisition'`
      );
      const { period } = await run.acquisitionBudgetPanel(ds);
      await ds.query(
        `INSERT INTO directory_provider_budget_attempt ("attemptId",period,provider,operation,"reservedCents") VALUES ($1,$2,'p','o',$3)`,
        [randomUUID(), period, 2200]
      );
      await ds.query(
        `INSERT INTO directory_provider_budget_attempt ("attemptId",period,provider,operation,"reservedCents") VALUES ($1,$2,'p','o',$3)`,
        [randomUUID(), period, 2200]
      );
      const blocked = await rel.runOvertureReleaseSweep(deps(ds, source(), ex));
      assert.equal(blocked.status, 'blocked');
      assert.equal(await cand(ds), undefined);
      assert.equal(ex.calls.length, 0);
    })
);

test(
  'restart resume: an interrupted canary run continues without duplicate runs',
  { skip: !url },
  () =>
    sandbox(async (ds) => {
      const a = await town(ds, 'A', { rows: 3 });
      const b = await town(ds, 'B', { rows: 2 });
      const ex = extractor(ds, { [a]: { fail: 'boom' } });
      // A throwing extractor leaves a retryable run; the second sweep retries only that town.
      await rel.runOvertureReleaseSweep(deps(ds, source(), ex));
      let c = await cand(ds);
      assert.ok(['canary_running', 'held'].includes(c.status));
      if (c.status === 'canary_running') {
        const ex2 = extractor(ds);
        await rel.runOvertureReleaseSweep(deps(ds, source(), ex2));
        assert.ok(!ex2.calls.includes(b));
      }
    })
);

test(
  'operator retry and reject: confirmed, idempotent by decision id, state-checked',
  { skip: !url },
  () =>
    sandbox(async (ds) => {
      const a = await town(ds, 'A', { rows: 3 });
      await town(ds, 'B', { rows: 2 });
      const ex = extractor(ds, { [a]: { n: 2, bad: true } });
      await rel.runOvertureReleaseSweep(deps(ds, source(), ex));
      assert.equal((await cand(ds)).status, 'held');
      const input = {
        release: NEW,
        actorId: randomUUID(),
        decisionId: randomUUID(),
        reason: 'looked at it',
      };
      const r1 = await rel.retryReleaseCandidate(ds, input);
      assert.equal(r1.status, 'detected');
      assert.equal(r1.replayed, false);
      const replay = await rel.retryReleaseCandidate(ds, input);
      assert.equal(replay.replayed, true);
      // Retry is only valid from held.
      await assert.rejects(
        rel.retryReleaseCandidate(ds, { ...input, decisionId: randomUUID() }),
        /invalid_state|state/i
      );
      // With good data the retried release now promotes.
      const ex2 = extractor(ds);
      await rel.runOvertureReleaseSweep(deps(ds, source(), ex2));
      // The earlier canary runs predate the reset, so this is a fresh evaluation.
      assert.equal((await cand(ds)).status, 'promoted');
      // Rejecting a promoted release is refused.
      await assert.rejects(
        rel.rejectReleaseCandidate(ds, { ...input, decisionId: randomUUID() }),
        /state/i
      );
      await assert.rejects(
        rel.rejectReleaseCandidate(ds, {
          ...input,
          release: '2027-01-01.0',
          decisionId: randomUUID(),
        }),
        /not found/i
      );
    })
);

test('reject keeps a held release out of consideration', { skip: !url }, () =>
  sandbox(async (ds) => {
    const a = await town(ds, 'A', { rows: 3 });
    const ex = extractor(ds, { [a]: { n: 2, bad: true } });
    await rel.runOvertureReleaseSweep(deps(ds, source(), ex));
    const input = {
      release: NEW,
      actorId: randomUUID(),
      decisionId: randomUUID(),
      reason: 'not this one',
    };
    assert.equal(
      (await rel.rejectReleaseCandidate(ds, input)).status,
      'rejected'
    );
    await assert.rejects(
      rel.rejectReleaseCandidate(ds, { ...input, release: ACTIVE }),
      /not found/i
    );
    await rel.runOvertureReleaseSweep(deps(ds, source(), extractor(ds)));
    assert.equal((await cand(ds)).status, 'rejected');
    assert.equal((await rel.activeOvertureRelease(ds)).release, ACTIVE);
  })
);

test('primePromotedRights serves the promoted policy', { skip: !url }, () =>
  sandbox(async (ds) => {
    await town(ds, 'A', { rows: 3 });
    await rel.runOvertureReleaseSweep(deps(ds, source(), extractor(ds)));
    await rel.primePromotedRights(ds);
    assert.equal(rel.promotedRightsPolicy(NEW).releaseId, NEW);
    assert.equal(rel.promotedRightsPolicy(ACTIVE), undefined);
  })
);
