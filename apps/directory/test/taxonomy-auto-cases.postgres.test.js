require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  createTaxonomyRun,
  getTaxonomyRun,
  runTaxonomyPass,
  runTaxonomyBatch,
} = require('../src/taxonomy-reclassification');
const { installTaxonomyMapping } = require('../src/taxonomy-mapping');
const { TAXONOMY_MAPPINGS } = require('../src/taxonomy-mapping-data');
const {
  decideTaxonomyCase,
  undoTaxonomyDecision,
  getTaxonomyCase,
  listTaxonomyCases,
} = require('../src/taxonomy-case');
const { beginRun } = require('../src/acquisition-run');
const {
  discoverRightsRelease,
  syncRightsCases,
} = require('../src/rights-case');

// Disposable, loopback-only database named s7d_scratch_*. Data is committed there; the caller drops the database.
const url = process.env.S7D_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s7d_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S7D_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s7d_scratch_* database required');
}
const hex = () => randomBytes(32).toString('hex');
const file = TAXONOMY_MAPPINGS[0];
const VERSION = file.version;

async function setup(ds) {
  await ds.query(
    `TRUNCATE directory_taxonomy_run_plan, directory_taxonomy_run_before, directory_taxonomy_run, directory_taxonomy_event, directory_taxonomy_case, directory_listing_category_override, directory_listing_classification, directory_taxonomy_mapping_row, directory_taxonomy_mapping_version, directory_business_assertion, directory_business, directory_listing_identity, directory_overture_private_row, directory_overture_private_row_revocation, directory_overture_private_scan_lock, directory_overture_private_membership, directory_overture_private_completion, directory_overture_private_policy, directory_acquisition_run CASCADE`
  );
  const town = randomUUID(),
    scan = hex(),
    policy = hex(),
    actor = randomUUID();
  await ds.query(
    'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false)',
    [policy]
  );
  await ds.query(
    'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
    [scan, policy]
  );
  await ds.query(
    'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1)',
    [scan]
  );
  await ds.query(
    'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',
    [scan]
  );
  const db = {
    query: (sql, params) => ds.query(sql, params),
    transaction: (fn) => ds.transaction(fn),
  };
  const addRow = (n, name, category, extra = {}) =>
    ds.query(
      'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
      [scan, n, town, JSON.stringify({ name, category, ...extra })]
    );
  await installTaxonomyMapping(db, {
    version: VERSION,
    activate: true,
    actorId: actor,
  });
  return { town, scan, actor, db, addRow };
}

const dryRun = (db, actor, id = randomUUID()) =>
  createTaxonomyRun(db, {
    id,
    mappingVersion: VERSION,
    scope: 'all',
    mode: 'dry_run',
    actorId: actor,
    reason: 'plan',
  }).then(() => id);

test(
  'taxonomy runs raise unmapped and ambiguous cases once, and a case can be dismissed and undone',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    try {
      const { town, scan, actor, db, addRow } = await setup(ds);
      const nodes = file.entries.filter(
        (e) =>
          e.kind === 'taxonomy_node' && e.categoryId && e.categoryId !== 'adult'
      );
      const a = nodes[0];
      const b = nodes.find((n) => n.categoryId !== a.categoryId);
      await addRow(1, 'Known Diner', 'restaurant');
      await addRow(2, 'Mystery Shop', 'weird_unknown_category');
      await addRow(3, 'Two Minds', 'restaurant', {
        taxonomyPaths: [[a.key], [b.key]],
      });
      await addRow(4, 'Overridden', 'another_unknown');
      // Row 4 already has an operator override: nothing to ask.
      const [{ id: identity4 }] = await ds.query(
        `INSERT INTO directory_listing_identity ("communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,4) RETURNING id`,
        [town, scan]
      );
      await ds.query(
        `INSERT INTO directory_listing_category_override ("communityId","listingKey","categoryId",active) VALUES ($1,$2,'stores',true)`,
        [town, identity4]
      );

      const run1 = await dryRun(db, actor);
      await runTaxonomyPass(db, { batchSize: 2 });
      assert.equal((await getTaxonomyRun(db, run1)).status, 'complete');
      let cases = (await listTaxonomyCases(db)).cases;
      assert.deepEqual(cases.map((c) => c.reason).sort(), [
        'ambiguous_taxonomy',
        'unmapped_taxonomy',
      ]);
      const unmapped = cases.find((c) => c.reason === 'unmapped_taxonomy');
      assert.equal(unmapped.name, 'Mystery Shop');
      assert.equal(unmapped.observedCategory, 'weird_unknown_category');
      assert.equal(unmapped.status, 'open');
      const ambiguous = cases.find((c) => c.reason === 'ambiguous_taxonomy');
      assert.equal(ambiguous.name, 'Two Minds');
      assert.equal(
        ambiguous.observedCategory,
        [a.key, b.key].sort().join(' | ')
      );
      const first = await getTaxonomyCase(db, unmapped.id);
      assert.equal(first.history.length, 1);
      assert.equal(first.history[0].action, 'open');
      assert.equal(first.history[0].actorId, actor);

      // Idempotent: a second run (same mapping version) raises nothing new.
      const run2 = await dryRun(db, actor);
      await runTaxonomyPass(db, { batchSize: 2 });
      assert.equal((await getTaxonomyRun(db, run2)).status, 'complete');
      assert.equal((await listTaxonomyCases(db)).cases.length, 2);

      // Dismiss: reason required, stale token refused, then dismissed with history.
      const dismiss = (c, extra = {}) =>
        decideTaxonomyCase(db, {
          decisionId: randomUUID(),
          caseId: c.id,
          actorId: actor,
          action: 'dismiss',
          reason: 'fine as it is',
          expectedVersionToken: c.versionToken,
          ...extra,
        });
      await assert.rejects(dismiss(unmapped, { reason: '  ' }), /Invalid/);
      await assert.rejects(
        dismiss({ ...unmapped, versionToken: 'f'.repeat(64) }),
        (e) => e.code === 'stale_decision' || /stale/.test(String(e.message))
      );
      const decisionId = randomUUID();
      const done = await dismiss(unmapped, { decisionId });
      assert.deepEqual(done, { replayed: false, status: 'dismissed' });
      assert.equal((await dismiss(unmapped, { decisionId })).replayed, true);
      const dismissed = await getTaxonomyCase(db, unmapped.id);
      assert.equal(dismissed.status, 'dismissed');
      assert.equal(dismissed.history.at(-1).action, 'dismiss');
      assert.equal(dismissed.history.at(-1).reason, 'fine as it is');
      assert.equal(dismissed.history.at(-1).reversible, true);
      // A dismissed case is not raised again by a later run.
      const run3 = await dryRun(db, actor);
      await runTaxonomyPass(db, { batchSize: 2 });
      assert.equal((await getTaxonomyRun(db, run3)).status, 'complete');
      assert.equal((await listTaxonomyCases(db)).cases.length, 2);
      assert.equal(
        (await listTaxonomyCases(db, { status: 'dismissed' })).cases.length,
        1
      );
      // Undo restores the prior status.
      const undone = await undoTaxonomyDecision(db, {
        decisionId: randomUUID(),
        caseId: unmapped.id,
        undoOf: decisionId,
        actorId: actor,
        reason: 'changed my mind',
        expectedVersionToken: dismissed.versionToken,
      });
      assert.equal(undone.status, 'open');
      // A dismissed case cannot be dismissed twice.
      const again = await getTaxonomyCase(db, ambiguous.id);
      await dismiss(again);
      await assert.rejects(
        dismiss(await getTaxonomyCase(db, ambiguous.id)),
        (e) =>
          e.code === 'invalid_state' || /invalid_state/.test(String(e.message))
      );
    } finally {
      await ds.destroy();
    }
  }
);

test(
  'apply phase skips rows that changed after the plan pass and reports them as drifted',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    try {
      const { scan, actor, db, addRow } = await setup(ds);
      for (let n = 1; n <= 6; n++) await addRow(n, `Place ${n}`, 'restaurant');
      const plan = await dryRun(db, actor);
      await runTaxonomyPass(db, { batchSize: 2 });
      const planned = await getTaxonomyRun(db, plan);
      assert.equal(planned.changedRows, 6);
      const applyId = randomUUID();
      await createTaxonomyRun(db, {
        id: applyId,
        mappingVersion: VERSION,
        scope: 'all',
        mode: 'apply',
        actorId: actor,
        reason: 'apply',
        expectedPlanHash: planned.planHash,
        confirm: 'APPLY',
      });
      // Plan pass of the apply run: 3 batches of 2 rows, plus the empty closing batch.
      for (let i = 0; i < 4; i++) await runTaxonomyBatch(db, { batchSize: 2 });
      let run = await getTaxonomyRun(db, applyId);
      assert.equal(run.phase, 'apply');
      assert.equal(run.appliedRows, 0);
      const planRows = await ds.query(
        'SELECT count(*)::int AS n FROM directory_taxonomy_run_plan WHERE "runId"=$1',
        [applyId]
      );
      assert.equal(planRows[0].n, 6);
      // Rows 2 and 5 change category between the plan pass and the apply pass.
      for (const n of [2, 5])
        await ds.query(
          `UPDATE directory_overture_private_row SET listing = jsonb_set(listing::jsonb,'{category}','"gym"')::json WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`,
          [scan, n]
        );
      await runTaxonomyPass(db, { batchSize: 2 });
      run = await getTaxonomyRun(db, applyId);
      assert.equal(run.status, 'complete');
      assert.equal(run.driftedRows, 2);
      assert.equal(run.appliedRows, 4);
      const rows = await ds.query(
        'SELECT "sourceFileRowNumber" AS n,"categoryId","mappingVersion" FROM directory_listing_classification ORDER BY 1'
      );
      assert.deepEqual(
        rows.map((r) => [
          Number(r.n),
          r.categoryId,
          r.mappingVersion === VERSION,
        ]),
        [
          [1, 'restaurants', true],
          [3, 'restaurants', true],
          [4, 'restaurants', true],
          [6, 'restaurants', true],
        ]
      );
      const left = await ds.query(
        'SELECT count(*)::int AS n FROM directory_taxonomy_run_plan WHERE "runId"=$1',
        [applyId]
      );
      assert.equal(left[0].n, 0);
    } finally {
      await ds.destroy();
    }
  }
);

test(
  'rights sync discovers the release recorded on a stage run; an explicit release overrides it',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    try {
      const { actor, db } = await setup(ds);
      assert.equal(await discoverRightsRelease(db), null);
      await assert.rejects(
        syncRightsCases(db, { syncId: randomUUID(), actorId: actor }),
        /no release recorded/
      );
      await beginRun(db, {
        provider: 'overture',
        release: '2026-10-21.0',
        kind: 'overture-stage',
        reason: 'stage',
      });
      assert.equal(await discoverRightsRelease(db), '2026-10-21.0');
      const synced = await syncRightsCases(db, {
        syncId: randomUUID(),
        actorId: actor,
      });
      assert.ok(synced.created >= 1);
      const [row] = await ds.query(
        `SELECT DISTINCT "releaseId" FROM directory_rights_case`
      );
      assert.equal(row.releaseId, '2026-10-21.0');
      await syncRightsCases(db, {
        syncId: randomUUID(),
        actorId: actor,
        releaseId: '2026-11-01.0',
      });
      const ids = await ds.query(
        `SELECT DISTINCT "releaseId" FROM directory_rights_case ORDER BY 1`
      );
      assert.deepEqual(
        ids.map((r) => r.releaseId),
        ['2026-10-21.0', '2026-11-01.0']
      );
    } finally {
      await ds.query('TRUNCATE directory_rights_case CASCADE');
      await ds.destroy();
    }
  }
);
