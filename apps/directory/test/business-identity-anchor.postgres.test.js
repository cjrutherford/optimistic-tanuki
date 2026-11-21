const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const h = require('./reviewed-spatial-helpers');
const f = require('./business-identity-carry-fixtures');
const {
  applyAnchors,
  planAnchors,
} = require('../src/business-identity-anchor');
const script = require('../../../scripts/local-directory-business-identity-anchor.cjs');

const url = h.databaseUrl(
  'S5_ANCHOR_TEST_DATABASE_URL',
  /^\/s5_identity_anchor_[a-z0-9_]+$/i
);
const town = '55555555-5555-4555-8555-555555555555';
const page = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04';
const P = f.hex('a'),
  P2 = f.hex('b');
const scans = [f.hex('c'), f.hex('d'), f.hex('e'), f.hex('f')];
const rows = (n) =>
  Array.from({ length: n }, (_, i) => ({ n: i + 1, name: `Biz ${i + 1}` }));

async function reset(db) {
  await f.clear(db);
  await db.query(
    'TRUNCATE directory_reviewed_binding, directory_address_review_decision, directory_address_review_candidate, directory_business_link_carry, directory_business_link_event, directory_business_link_active, directory_business_link_request CASCADE'
  );
}
const binding = (db, scan, n, state = 'active') =>
  db.query(
    `INSERT INTO directory_reviewed_binding ("candidateId","decisionId","communityId","scanId","sourceFileRowNumber",provenance,"stageContentHash","reviewedHash","fieldHashes",state,"verifiedAt","verifiedUntil")
   VALUES (gen_random_uuid(),gen_random_uuid(),$1,$2,$3,'source_file',$5,$5,'{}'::jsonb,$4::varchar,CASE WHEN $4::varchar='active' THEN now()-interval '1 day' END,CASE WHEN $4::varchar='active' THEN now()+interval '30 days' END)`,
    [town, scan, n, state, f.hex('9')]
  );
const candidate = (db, scan, n, status) =>
  db.query(
    `INSERT INTO directory_address_review_candidate ("communityId","scanId","sourceFileRowNumber","name","category","point","addresses","websites","phones","rights","risk","verdict","reasons","checks","policyVersion","status")
   VALUES ($1,$2,$3,'x','restaurant','{"lat":31,"lng":-83}'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'eligible','{}'::jsonb,'auto_approve','[]'::jsonb,'{}'::jsonb,'fixture-v1',$4)`,
    [town, scan, n, status]
  );
const linkedIdentity = async (db, scan, n) => {
  const id = (
    await db.query(
      'INSERT INTO directory_listing_identity ("communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3) RETURNING id',
      [town, scan, n]
    )
  )[0].id;
  await db.query(
    `INSERT INTO directory_business_link_request ("requestId","townId","listingId","businessCommunityId",status) VALUES ($1,$2,$3,$4,'pending')`,
    [randomUUID(), town, id, page]
  );
};

/** Rows 1..8 of scan 0: 1 link, 2 binding, 3 published candidate, 4 retired binding, 5 unpublished candidate, 6 bare identity, 7 nothing, 8 link+binding+candidate. */
async function seed(db) {
  await reset(db);
  await f.cohort(db, {
    policy: P,
    town,
    scans: [{ scan: scans[0], rows: rows(8) }],
  });
  await linkedIdentity(db, scans[0], 1);
  await binding(db, scans[0], 2);
  await candidate(db, scans[0], 3, 'published');
  await binding(db, scans[0], 4, 'retired');
  await candidate(db, scans[0], 5, 'needs_human');
  await db.query(
    'INSERT INTO directory_listing_identity ("communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,6)',
    [town, scans[0]]
  );
  await linkedIdentity(db, scans[0], 8);
  await binding(db, scans[0], 8);
  await candidate(db, scans[0], 8, 'published');
}
const minted = (db) =>
  db.query(
    'SELECT a."sourceFileRowNumber"::text AS row, a.evidence, a.confidence, a."upstreamKeyHash", a.state FROM directory_business_assertion a ORDER BY a."sourceFileRowNumber"'
  );

test(
  'anchors are minted only for the three anchor classes, one assertion each, no key',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await seed(db);
      const plan = await planAnchors(db);
      assert.deepEqual(plan.counts, {
        linkRequest: 2,
        binding: 2,
        candidate: 2,
        rows: 4,
        unanchorable: 0,
        alreadyAnchored: 0,
        toMint: 4,
      });
      const result = await applyAnchors(db, {
        planDigest: plan.digest,
        key: f.KEY,
      });
      assert.equal(result.minted, 4);
      const got = await minted(db);
      assert.deepEqual(
        got.map((r) => r.row),
        ['1', '2', '3', '8']
      );
      assert.ok(
        got.every(
          (r) =>
            r.evidence === 'origin' &&
            r.confidence === 'origin' &&
            r.upstreamKeyHash === null &&
            r.state === 'current'
        )
      );
      assert.equal(
        (await db.query('SELECT count(*)::int AS n FROM directory_business'))[0]
          .n,
        4
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS n FROM directory_business_event WHERE kind='created'`
          )
        )[0].n,
        4
      );
      // Unanchored rows (4 retired binding, 5 unpublished, 6 bare identity, 7 nothing) stay row-scoped.
    } finally {
      await db.destroy();
    }
  }
);

test(
  'applying twice changes nothing; a stale digest is refused',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await seed(db);
      const plan = await planAnchors(db);
      await assert.rejects(
        applyAnchors(db, { planDigest: f.hex('0'), key: f.KEY }),
        /digest/i
      );
      assert.deepEqual((await f.counts(db))['directory_business'].n, 0);
      await applyAnchors(db, {
        planDigest: plan.digest,
        key: f.KEY,
        batchSize: 2,
      });
      const before = await f.counts(db);
      const again = await planAnchors(db);
      assert.equal(again.digest, plan.digest);
      assert.equal(again.counts.toMint, 0);
      const second = await applyAnchors(db, {
        planDigest: again.digest,
        key: f.KEY,
      });
      assert.equal(second.minted, 0);
      assert.deepEqual(await f.counts(db), before);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'two scans with identical (region,row) and identical content give two unrelated businesses',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await reset(db);
      await f.cohort(db, {
        policy: P,
        town,
        scans: [{ scan: scans[0], rows: [{ n: 1, name: 'Same Place' }] }],
      });
      await f.cohort(db, {
        policy: P2,
        town,
        scans: [{ scan: scans[1], rows: [{ n: 1, name: 'Same Place' }] }],
      });
      await binding(db, scans[0], 1);
      await binding(db, scans[1], 1);
      const plan = await planAnchors(db);
      await applyAnchors(db, { planDigest: plan.digest, key: f.KEY });
      const got = await db.query(
        'SELECT "businessId", "scanId", "nameHash" FROM directory_business_assertion ORDER BY "scanId"'
      );
      assert.equal(got.length, 2);
      assert.notEqual(got[0].businessId, got[1].businessId);
      assert.equal(got[0].nameHash, got[1].nameHash);
      assert.equal(
        (await db.query('SELECT count(*)::int AS n FROM directory_business'))[0]
          .n,
        2
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM directory_business_carry_state'
          )
        )[0].n,
        0
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'a row missing from its town is unanchorable and never minted',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await reset(db);
      await f.cohort(db, {
        policy: P,
        town,
        scans: [{ scan: scans[0], rows: rows(1) }],
      });
      await binding(db, scans[0], 1);
      await binding(db, scans[0], 99);
      await binding(db, scans[3], 1);
      const plan = await planAnchors(db);
      assert.deepEqual([plan.counts.rows, plan.counts.unanchorable], [1, 2]);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'the script check prints counts per class, never an id, and apply needs its confirmations',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await seed(db);
      const out = await script.run(db);
      assert.equal(out.mode, 'check');
      const text = JSON.stringify(out);
      assert.ok(
        !text.includes(town) &&
          !text.includes(scans[0]) &&
          !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(text)
      );
      assert.deepEqual(Object.keys(out.counts).sort(), [
        'alreadyAnchored',
        'binding',
        'candidate',
        'linkRequest',
        'rows',
        'toMint',
        'unanchorable',
      ]);
      assert.equal(
        (await db.query('SELECT count(*)::int AS n FROM directory_business'))[0]
          .n,
        0
      );
      const applied = await script.run(db, {
        apply: true,
        planDigest: out.planDigest,
        key: f.KEY,
      });
      assert.equal(applied.minted, 4);
      assert.ok(!JSON.stringify(applied).match(/[0-9a-f]{8}-[0-9a-f]{4}-/));
    } finally {
      await db.destroy();
    }
  }
);
