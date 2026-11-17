const test = require('node:test');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { OverturePrivateSink } = require('../src/overture-private-sink');
const { townCoverage } = require('../src/town-coverage');
const {
  backfill,
} = require('../../../scripts/local-directory-scan-target-backfill.cjs');

const url = process.env.COVERAGE_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    process.env.COVERAGE_TEST_DISPOSABLE !== 'yes' ||
    !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
    !/^\/cov_scratch_[a-z0-9_]+$/.test(parsed.pathname)
  )
    throw Error('Refusing non-disposable coverage test database');
}
const policy = '1'.repeat(64);
const scanA = 'a'.repeat(64);
const scanB = 'b'.repeat(64);
const townA = '00000000-0000-4000-8000-0000000000a1';
const townB = '00000000-0000-4000-8000-0000000000b1';
const townC = '00000000-0000-4000-8000-0000000000c1';
const token = '00000000-0000-4000-8000-0000000000d1';
const row = (n, regionId) => ({
  sourceFileRowNumber: n,
  regionId,
  outcome: {
    status: 'eligible',
    listing: {
      name: `Shop ${n}`,
      category: 'shop',
      location: { type: 'Point', coordinates: [0, 0] },
      attribution: ['Attribution'],
      notices: [],
      termsUrls: [],
    },
  },
});
const TABLES =
  'directory_town_scan_target, directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation, directory_overture_source_evidence';
const targets = (db, scanId) =>
  db.query(
    'SELECT "communityId", "scanId", "completedAt", "rowCount", provenance FROM directory_town_scan_target WHERE "scanId"=$1 ORDER BY "communityId"',
    [scanId]
  );
const open = async () => {
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  await db.query(`TRUNCATE ${TABLES}`);
  return db;
};

test(
  'the sink records targets at load and completes them with row counts',
  { skip: !url },
  async () => {
    const db = await open();
    try {
      const sink = new OverturePrivateSink(db);
      await sink.load(scanA, policy, [townA, townB, 'not-a-uuid', townA]);
      let t = await targets(db, scanA);
      assert.deepEqual(
        t.map((x) => [x.communityId, x.provenance, x.completedAt, x.rowCount]),
        [
          [townA, 'recorded', null, null],
          [townB, 'recorded', null, null],
        ]
      );
      await sink.commit([row(1, townA), row(2, townA), row(3, 'x')], {
        scanId: scanA,
        sourceFileRowNumber: 3,
      });
      // A resumed attempt records nothing new and changes nothing.
      const again = new OverturePrivateSink(db);
      await again.load(scanA, policy, [townA, townB]);
      assert.equal((await targets(db, scanA)).length, 2);
      await again.complete();
      t = await targets(db, scanA);
      assert.deepEqual(
        t.map((x) => [x.communityId, x.rowCount, x.completedAt !== null]),
        [
          [townA, 2, true],
          [townB, 0, true],
        ]
      );
      const stamp = t[0].completedAt.getTime();
      await again.complete();
      const retried = await targets(db, scanA);
      assert.equal(retried[0].completedAt.getTime(), stamp);
      assert.equal(retried[0].rowCount, 2);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'backfill infers targets from completed scans, never from running ones, and is idempotent',
  { skip: !url },
  async () => {
    const db = await open();
    try {
      const done = new OverturePrivateSink(db);
      await done.load(scanA, policy);
      await done.commit([row(1, townA), row(2, townA), row(3, townB)], {
        scanId: scanA,
        sourceFileRowNumber: 3,
      });
      await done.complete();
      const running = new OverturePrivateSink(db);
      await running.load(scanB, policy);
      await running.commit([row(1, townC)], {
        scanId: scanB,
        sourceFileRowNumber: 1,
      });
      const check = await backfill(db, { apply: false });
      assert.equal(check.mode, 'check');
      assert.equal(check.completedScans, 1);
      assert.equal(check.candidateTargets, 2);
      assert.equal(check.missingTargets, 2);
      assert.equal(
        (await targets(db, scanA)).length,
        0,
        'check writes nothing'
      );
      const applied = await backfill(db, { apply: true });
      assert.equal(applied.inserted, 2);
      assert.deepEqual(
        (await targets(db, scanA)).map((x) => [
          x.communityId,
          x.completedAt,
          x.rowCount,
          x.provenance,
        ]),
        [
          [townA, null, 2, 'backfill-rows'],
          [townB, null, 1, 'backfill-rows'],
        ]
      );
      assert.equal((await targets(db, scanB)).length, 0);
      assert.equal((await backfill(db, { apply: true })).inserted, 0);
      // A backfilled target (completedAt NULL) still counts as complete: the completion row is the proof.
      assert.equal((await townCoverage(db, townB, token)).state, 'available');
    } finally {
      await db.destroy();
    }
  }
);

test(
  'townCoverage reports each state from real rows',
  { skip: !url },
  async () => {
    const db = await open();
    try {
      const cover = async (town) => townCoverage(db, town, token);
      assert.equal(
        (await cover(townA)).state,
        'unconfigured',
        'no policy row yet'
      );
      // Scan A targets A (rows) and B (no rows); scan B targets A and is still running.
      const a = new OverturePrivateSink(db);
      await a.load(scanA, policy, [townA, townB]);
      assert.equal((await cover(townA)).state, 'acquiring');
      await a.commit([row(1, townA), row(2, townA)], {
        scanId: scanA,
        sourceFileRowNumber: 2,
      });
      assert.equal(
        (await cover(townA)).state,
        'acquiring',
        'no completion yet'
      );
      await a.complete();
      assert.deepEqual(await cover(townA), {
        state: 'available',
        withheldReviewedDetails: 0,
      });
      assert.deepEqual(await cover(townB), {
        state: 'empty',
        withheldReviewedDetails: 0,
      });
      const b = new OverturePrivateSink(db);
      await b.load(scanB, policy, [townA, townB]);
      assert.equal((await cover(townA)).state, 'partial');
      assert.equal((await cover(townB)).state, 'empty');
      // Reviewed details without an active binding are counted, not exposed.
      await db.query(
        `UPDATE directory_overture_private_row SET listing=listing||'{"reviewed":{"website":"https://example.test"}}'::jsonb WHERE "scanId"=$1 AND "sourceFileRowNumber"=1`,
        [scanA]
      );
      assert.equal((await cover(townA)).withheldReviewedDetails, 1);
      // A row for another assignment token is not served.
      await db.query(
        `UPDATE directory_overture_private_row SET listing=listing||jsonb_build_object('assignmentChangeToken',$2::text) WHERE "scanId"=$1`,
        [scanA, townC]
      );
      assert.equal((await cover(townA)).state, 'empty');
      assert.equal((await townCoverage(db, townA, townC)).state, 'partial');
      // Withdrawing scan A removes its listings; the town it targeted now reads as withdrawn or scan B's state.
      await a.withdraw(scanA);
      assert.equal((await cover(townA)).state, 'acquiring');
      assert.equal((await cover(townB)).state, 'acquiring');
      await b.withdraw(scanB);
      assert.deepEqual(await cover(townA), {
        state: 'blocked',
        reason: 'policy-withdrawn',
        withheldReviewedDetails: 0,
      });
      // A revoked policy blocks too.
      const c = new OverturePrivateSink(db);
      const policy2 = '2'.repeat(64);
      await c.load('c'.repeat(64), policy2, [townC]);
      await c.complete();
      assert.equal((await cover(townC)).state, 'empty');
      await db.query(
        'UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1',
        [policy2]
      );
      assert.equal((await cover(townC)).state, 'blocked');
      // Policy 1 stays active, so the town is not unconfigured; revoking every policy makes it so.
      await db.query(
        'UPDATE directory_overture_private_policy SET revoked=true'
      );
      assert.equal((await cover(townB)).state, 'blocked');
      assert.equal(
        (await cover('00000000-0000-4000-8000-0000000000e1')).state,
        'unconfigured'
      );
      assert.equal((await cover(townC)).state, 'blocked');
    } finally {
      await db.destroy();
    }
  }
);
