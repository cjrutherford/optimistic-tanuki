const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const h = require('./reviewed-spatial-helpers');
const f = require('./business-identity-carry-fixtures');
const {
  applyAnchors,
  planAnchors,
} = require('../src/business-identity-anchor');
const { rereadAnchors } = require('../src/business-identity-reread');

const url = h.databaseUrl(
  'S5_REREAD_TEST_DATABASE_URL',
  /^\/s5_identity_reread_[a-z0-9_]+$/i
);
const town = '66666666-6666-4666-8666-666666666666';
const P = f.hex('a'),
  P2 = f.hex('b');
const withEvidence = f.hex('c'),
  noEvidence = f.hex('d');
const ETAG = 'etag';
const binding = (db, scan, n) =>
  db.query(
    `INSERT INTO directory_reviewed_binding ("candidateId","decisionId","communityId","scanId","sourceFileRowNumber",provenance,"stageContentHash","reviewedHash","fieldHashes",state,"verifiedAt","verifiedUntil")
   VALUES (gen_random_uuid(),gen_random_uuid(),$1,$2,$3,'source_file',$4,$4,'{}'::jsonb,'active',now()-interval '1 day',now()+interval '30 days')`,
    [town, scan, n, f.hex('9')]
  );

async function seed(db) {
  await f.clear(db);
  await db.query('TRUNCATE directory_reviewed_binding CASCADE');
  await f.cohort(db, {
    policy: P,
    town,
    release: '2026-09-23.0',
    scans: [
      {
        scan: withEvidence,
        rows: [
          { n: 1, name: 'Alpha' },
          { n: 2, name: 'Beta' },
        ],
      },
    ],
  });
  await f.cohort(db, {
    policy: P2,
    town,
    scans: [{ scan: noEvidence, rows: [{ n: 1, name: 'Alpha' }] }],
  });
  await binding(db, withEvidence, 1);
  await binding(db, withEvidence, 2);
  await binding(db, noEvidence, 1);
  const plan = await planAnchors(db);
  await applyAnchors(db, { planDigest: plan.digest, key: f.KEY });
}
const honest = {
  etag: ETAG,
  rows: {
    1: {
      upstreamId: 'up-1',
      name: 'Alpha',
      category: 'restaurant',
      point: [-83, 31],
    },
    2: {
      upstreamId: 'up-2',
      name: 'Beta',
      category: 'restaurant',
      point: [-83, 31],
    },
  },
};
const stub =
  (object, calls = []) =>
  async (request) => {
    calls.push(request);
    return typeof object === 'function' ? object(request) : object;
  };
const state = (db) =>
  db.query(
    `SELECT "sourceFileRowNumber"::text AS row, "scanId", evidence, "upstreamKeyHash" FROM directory_business_assertion ORDER BY "scanId","sourceFileRowNumber"`
  );
const reread = (db, fetcher, apply = true) =>
  rereadAnchors(db, { key: f.KEY, fetcher, apply });

test(
  'the same object and matching rows record artifact_reread; a scan with no evidence is excluded',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await seed(db);
      const calls = [];
      const counts = await reread(db, stub(honest, calls));
      assert.equal(counts.updated, 2);
      assert.equal(counts.skippedNoEvidence, 1);
      assert.equal(
        calls.length,
        1,
        'the scan without evidence is never fetched'
      );
      assert.deepEqual(calls[0], {
        artifactUrl: 'https://example.test/artifact',
        etag: ETAG,
        rows: ['1', '2'],
      });
      const got = await state(db);
      const read = got.filter((r) => r.scanId === withEvidence);
      assert.ok(
        read.every(
          (r) =>
            r.evidence === 'artifact_reread' &&
            r.upstreamKeyHash === f.hash(`up-${r.row}`)
        )
      );
      const excluded = got.find((r) => r.scanId === noEvidence);
      assert.deepEqual(
        [excluded.evidence, excluded.upstreamKeyHash],
        ['origin', null]
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'a different etag, a missing object or a differing name, category or point writes nothing',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await seed(db);
      const before = await state(db);
      const cases = [
        [stub({ ...honest, etag: 'other' }), 'skippedObjectDiffers', 2],
        [stub(null), 'skippedObjectMissing', 2],
        [
          stub({
            etag: ETAG,
            rows: {
              1: { ...honest.rows[1], name: 'Alpha Two' },
              2: { ...honest.rows[2], category: 'bar' },
            },
          }),
          'skippedRowDiffers',
          2,
        ],
        [
          stub({
            etag: ETAG,
            rows: { 1: { ...honest.rows[1], point: [-83, 31.0001] } },
          }),
          'skippedRowDiffers',
          2,
        ],
      ];
      for (const [fetcher, field, n] of cases) {
        const counts = await reread(db, fetcher);
        assert.equal(counts.updated, 0);
        assert.equal(counts[field], n);
        assert.deepEqual(await state(db), before);
      }
    } finally {
      await db.destroy();
    }
  }
);

test(
  'a partly differing object writes only the rows that agree, and a repeat writes nothing',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await seed(db);
      const partial = {
        etag: ETAG,
        rows: { 1: honest.rows[1], 2: { ...honest.rows[2], name: 'Changed' } },
      };
      assert.equal((await reread(db, stub(partial))).updated, 1);
      const once = await state(db);
      assert.equal((await reread(db, stub(partial))).updated, 0);
      assert.deepEqual(await state(db), once);
      const dry = await reread(db, stub(honest), false);
      assert.equal(dry.updated, 1);
      assert.deepEqual(await state(db), once);
      assert.equal((await reread(db, stub(honest))).updated, 1);
    } finally {
      await db.destroy();
    }
  }
);

test('the command refuses without --allow-network and --confirm-database, and makes no connection', () => {
  const script = path.resolve(
    __dirname,
    '../../../scripts/local-directory-business-identity-reread.cjs'
  );
  const env = {
    ...process.env,
    DIRECTORY_DATABASE_URL:
      'postgres://u:p@127.0.0.1:1/s5_identity_reread_none',
    TS_NODE_PROJECT: path.resolve(__dirname, '../tsconfig.json'),
  };
  const run = (...args) =>
    spawnSync(
      process.execPath,
      ['-r', 'ts-node/register/transpile-only', script, ...args],
      { env, encoding: 'utf8' }
    );
  assert.match(run().stderr, /--allow-network/);
  assert.match(
    run('--confirm-database', 's5_identity_reread_none').stderr,
    /--allow-network/
  );
  assert.match(run('--allow-network').stderr, /--confirm-database/);
  assert.match(
    run('--allow-network', '--confirm-database', 'other').stderr,
    /does not match/
  );
  assert.match(
    run('--allow-network', '--confirm-database', 's5_identity_reread_none')
      .stderr,
    /--fetcher/
  );
});
