const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const h = require('./reviewed-spatial-helpers');
const f = require('./business-identity-carry-fixtures');
const {
  applyCarry,
  planCarry,
  carryAllowsRevoke,
} = require('../src/business-identity-carry');

const url = h.databaseUrl(
  'S5_CARRY_TEST_DATABASE_URL',
  /^\/s5_identity_carry_[a-z0-9_]+$/i
);
const town = '44444444-4444-4444-8444-444444444444';
const P0 = f.hex('0'),
  A = f.hex('a'),
  B = f.hex('b');
const scanA = f.hex('c'),
  scanB1 = f.hex('d'),
  scanB2 = f.hex('e');
const opts = (from, to) => ({ fromPolicyId: from, toPolicyId: to, key: f.KEY });
const run = async (db, from, to, extra = {}, hooks) => {
  const plan = await planCarry(db, opts(from, to));
  return {
    plan,
    result: await applyCarry(
      db,
      { ...opts(from, to), planDigest: plan.digest, ...extra },
      hooks
    ),
  };
};
const rows = (...ids) =>
  ids.map((id, i) => ({ n: i + 1, id, name: `Biz ${id}` }));
const within = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    ),
  ]);

/** Release one (cohort A) is imported and given origin businesses; release two (cohort B) is staged, not yet carried. */
async function twoReleases(db, a, b) {
  await f.clear(db);
  await f.cohort(db, {
    policy: A,
    town,
    release: '2026-09-23.0',
    scans: [{ scan: scanA, rows: a }],
  });
  await run(db, P0, A);
  await f.cohort(db, { policy: B, town, release: '2026-10-21.0', scans: b });
}
const businessOf = async (db, scan, row) =>
  (
    await db.query(
      'SELECT "businessId" FROM directory_business_assertion WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
      [scan, row]
    )
  )[0]?.businessId;

test(
  'happy path: three businesses carry, predecessors are superseded, events are written',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await twoReleases(db, rows('k1', 'k2', 'k3'), [
        { scan: scanB1, rows: rows('k1', 'k2', 'k3') },
      ]);
      const before = [1, 2, 3].map((n) => null);
      const originals = await Promise.all(
        [1, 2, 3].map((n) => businessOf(db, scanA, n))
      );
      assert.ok(originals.every(Boolean));
      const { plan, result } = await run(db, A, B);
      assert.deepEqual(
        {
          carry: plan.counts.carry,
          new: plan.counts.new,
          unresolved: plan.counts.unresolved,
        },
        { carry: 3, new: 0, unresolved: 0 }
      );
      assert.equal(result.complete, true);
      assert.deepEqual(
        await Promise.all([1, 2, 3].map((n) => businessOf(db, scanB1, n))),
        originals
      );
      assert.deepEqual(
        (await f.assertions(db, A)).map((r) => r.state),
        ['superseded', 'superseded', 'superseded']
      );
      assert.deepEqual(
        (await f.assertions(db, B)).map((r) => [r.state, r.confidence]),
        [
          ['current', 'carried'],
          ['current', 'carried'],
          ['current', 'carried'],
        ]
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int n FROM directory_business_event WHERE kind='carried'`
          )
        )[0].n,
        3
      );
      assert.equal(
        (await db.query('SELECT count(*)::int n FROM directory_business'))[0].n,
        3
      );
      assert.ok(before.length === 3);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'duplicate: two rows sharing a key in different scans of the cohort are not carried and the business is absent',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await twoReleases(db, rows('k1', 'k2'), [
        {
          scan: scanB1,
          rows: [
            { n: 1, id: 'k1', name: 'Biz k1' },
            { n: 2, id: 'k2', name: 'Biz k2' },
          ],
        },
        { scan: scanB2, rows: [{ n: 1, id: 'k1', name: 'Biz k1' }] },
      ]);
      const k1 = await businessOf(db, scanA, 1);
      const { plan } = await run(db, A, B);
      assert.deepEqual(
        { carry: plan.counts.carry, unresolved: plan.counts.unresolved },
        { carry: 1, unresolved: 2 }
      );
      assert.equal(await businessOf(db, scanB1, 1), undefined);
      assert.equal(await businessOf(db, scanB2, 1), undefined);
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int n FROM directory_business_assertion WHERE "businessId"=$1 AND state='current'`,
            [k1]
          )
        )[0].n,
        1
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int n FROM directory_business_assertion WHERE "businessId"=$1 AND "policyId"=$2`,
            [k1, B]
          )
        )[0].n,
        0
      );
      assert.equal(
        (
          await db.query('SELECT state FROM directory_business WHERE id=$1', [
            k1,
          ])
        )[0].state,
        'active'
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int n FROM directory_business_event WHERE kind='unresolved' AND cause='duplicate' AND "businessId"=$1`,
            [k1]
          )
        )[0].n,
        2
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'duplicate then withdrawal between check and apply stays unresolved and the digest is unchanged',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await twoReleases(db, rows('k1'), [
        { scan: scanB1, rows: rows('k1') },
        { scan: scanB2, rows: rows('k1') },
      ]);
      const checked = await planCarry(db, opts(A, B));
      await db.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,1)',
        [scanB2]
      );
      assert.equal((await planCarry(db, opts(A, B))).digest, checked.digest);
      await applyCarry(db, { ...opts(A, B), planDigest: checked.digest });
      assert.equal(await businessOf(db, scanB1, 1), undefined);
      assert.equal(await businessOf(db, scanB2, 1), undefined);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'upstream split: the old key carries, the new key is a new unrelated business',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await twoReleases(db, rows('k1'), [
        {
          scan: scanB1,
          rows: [
            { n: 1, id: 'k1' },
            { n: 2, id: 'k9' },
          ],
        },
      ]);
      const k1 = await businessOf(db, scanA, 1);
      const { plan } = await run(db, A, B);
      assert.deepEqual(
        { carry: plan.counts.carry, new: plan.counts.new },
        { carry: 1, new: 1 }
      );
      assert.equal(await businessOf(db, scanB1, 1), k1);
      const fresh = await businessOf(db, scanB1, 2);
      assert.ok(fresh && fresh !== k1);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM directory_business_event WHERE "otherBusinessId" IS NOT NULL'
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
  'upstream merge: one key survives, the other business is absent and nothing is merged',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await twoReleases(db, rows('k1', 'k2'), [
        { scan: scanB1, rows: rows('k1') },
      ]);
      const [k1, k2] = [
        await businessOf(db, scanA, 1),
        await businessOf(db, scanA, 2),
      ];
      await run(db, A, B);
      assert.equal(await businessOf(db, scanB1, 1), k1);
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int n FROM directory_business_assertion WHERE "businessId"=$1 AND "policyId"=$2`,
            [k2, B]
          )
        )[0].n,
        0
      );
      assert.deepEqual(
        (
          await db.query(
            'SELECT state, "successorId" FROM directory_business WHERE id=ANY($1::uuid[]) ORDER BY id',
            [[k1, k2]]
          )
        ).map((r) => [r.state, r.successorId]),
        [
          ['active', null],
          ['active', null],
        ]
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int n FROM directory_business_event WHERE kind IN ('merged','split')`
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
  'conflict: a key on two active businesses is never carried',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await twoReleases(db, rows('k1', 'k1x'), [
        { scan: scanB1, rows: rows('k1') },
      ]);
      // Make the second business also assert the first key (a corrupted or hand-built state).
      await db.query(
        'UPDATE directory_business_assertion SET "upstreamKeyHash"=$1 WHERE "scanId"=$2 AND "sourceFileRowNumber"=2',
        [f.hash('k1'), scanA]
      );
      const { plan } = await run(db, A, B);
      assert.deepEqual(
        { carry: plan.counts.carry, unresolved: plan.counts.unresolved },
        { carry: 0, unresolved: 1 }
      );
      assert.equal(await businessOf(db, scanB1, 1), undefined);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'a retired predecessor is not carried; keyless rows never get a business',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await twoReleases(db, rows('k1'), [
        { scan: scanB1, rows: [{ n: 1, id: 'k1' }, { n: 2 }] },
      ]);
      await db.query(
        `UPDATE directory_business SET state='retired', "retiredAt"=now() WHERE id=$1`,
        [await businessOf(db, scanA, 1)]
      );
      const { plan } = await run(db, A, B);
      assert.deepEqual(
        {
          carry: plan.counts.carry,
          unresolved: plan.counts.unresolved,
          new: plan.counts.new,
        },
        { carry: 0, unresolved: 1, new: 1 }
      );
      assert.equal(await businessOf(db, scanB1, 1), undefined);
      assert.equal(await businessOf(db, scanB1, 2), undefined);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'a keyed cohort without source evidence, or not strictly newer, is refused; a keyless cohort needs no carry',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await twoReleases(db, rows('k1'), [{ scan: scanB1, rows: rows('k1') }]);
      await db.query(
        'DELETE FROM directory_overture_source_evidence WHERE "scanId"=$1',
        [scanB1]
      );
      await assert.rejects(planCarry(db, opts(A, B)), /no source evidence/);
      await f.clear(db);
      await f.cohort(db, {
        policy: A,
        town,
        release: '2026-10-21.0',
        scans: [{ scan: scanA, rows: rows('k1') }],
      });
      await run(db, P0, A);
      await f.cohort(db, {
        policy: B,
        town,
        release: '2026-10-21.0',
        scans: [{ scan: scanB1, rows: rows('k1') }],
      });
      await assert.rejects(planCarry(db, opts(A, B)), /strictly newer/);
      await f.clear(db);
      await f.cohort(db, {
        policy: B,
        town,
        scans: [{ scan: scanB1, rows: [{ n: 1 }, { n: 2 }] }],
      });
      const plan = await planCarry(db, opts(A, B));
      assert.equal(plan.keyed, false);
      assert.deepEqual(await carryAllowsRevoke(db, A, B), { ok: true });
    } finally {
      await db.destroy();
    }
  }
);

test(
  'idempotent: a second apply changes nothing and a run killed after batch one resumes from the cursor',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      const ids = Array.from({ length: 7 }, (_, i) => `k${i + 1}`);
      await twoReleases(db, rows(...ids), [
        { scan: scanB1, rows: rows(...ids) },
      ]);
      await assert.rejects(
        run(
          db,
          A,
          B,
          { batchSize: 2 },
          {
            afterBatch: () => {
              throw Error('killed');
            },
          }
        ),
        /killed/
      );
      const partial = (
        await db.query(
          `SELECT state, "cursorRow"::text AS cursor FROM directory_business_carry_state WHERE "toPolicyId"='${B}'`
        )
      )[0];
      assert.deepEqual([partial.state, partial.cursor], ['running', '2']);
      assert.equal((await f.assertions(db, B)).length, 2);
      await run(db, A, B, { batchSize: 2 });
      const done = await f.counts(db);
      assert.equal((await f.assertions(db, B)).length, 7);
      assert.equal(
        (
          await db.query(
            `SELECT state FROM directory_business_carry_state WHERE "toPolicyId"='${B}'`
          )
        )[0].state,
        'complete'
      );
      const again = await run(db, A, B);
      assert.equal(again.result.applied.carry + again.result.applied.new, 0);
      assert.deepEqual(await f.counts(db), done);
      // A wrong digest is refused outright.
      await assert.rejects(
        applyCarry(db, { ...opts(A, B), planDigest: 'f'.repeat(64) }),
        /digest/
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'two concurrent applies converge on the state of a single run',
  { skip: !url },
  async () => {
    const one = await h.connect(url),
      two = await h.connect(url);
    try {
      const ids = Array.from({ length: 9 }, (_, i) => `k${i + 1}`);
      await twoReleases(one, rows(...ids), [
        { scan: scanB1, rows: rows(...ids) },
      ]);
      const plan = await planCarry(one, opts(A, B));
      await within(
        Promise.all([
          applyCarry(one, {
            ...opts(A, B),
            planDigest: plan.digest,
            batchSize: 2,
          }),
          applyCarry(two, {
            ...opts(A, B),
            planDigest: plan.digest,
            batchSize: 2,
          }),
        ]),
        60000,
        'concurrent apply'
      );
      assert.equal((await f.assertions(one, B)).length, 9);
      assert.equal(
        (await one.query('SELECT count(*)::int n FROM directory_business'))[0]
          .n,
        9
      );
      assert.equal(
        (
          await one.query(
            `SELECT count(*)::int n FROM directory_business_event WHERE kind='carried'`
          )
        )[0].n,
        9
      );
      assert.equal(
        (
          await one.query(
            `SELECT count(*)::int n FROM directory_business_assertion WHERE state='current'`
          )
        )[0].n,
        9
      );
    } finally {
      await one.destroy();
      await two.destroy();
    }
  }
);

test(
  'the cutover precondition holds until every keyed town is carried',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await twoReleases(db, rows('k1'), [{ scan: scanB1, rows: rows('k1') }]);
      assert.equal((await carryAllowsRevoke(db, A, B)).ok, false);
      await run(db, A, B);
      assert.equal((await carryAllowsRevoke(db, A, B)).ok, true);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'the carry command is read-only by default, needs a confirmed database and digest, and prints no credential',
  { skip: !url },
  async () => {
    const env = {
      ...process.env,
      DIRECTORY_DATABASE_URL: url,
      DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY: f.KEY,
    };
    const call = (...args) =>
      spawnSync(
        process.execPath,
        [
          '-r',
          'ts-node/register/transpile-only',
          'scripts/local-directory-business-identity-carry.cjs',
          ...args,
        ],
        {
          encoding: 'utf8',
          env: { ...env, TS_NODE_PROJECT: 'apps/directory/tsconfig.json' },
        }
      );
    const db = await h.connect(url);
    try {
      await twoReleases(db, rows('k1'), [{ scan: scanB1, rows: rows('k1') }]);
      const before = await f.counts(db);
      const check = call('--from-policy', A, '--to-policy', B, '--check');
      assert.equal(check.status, 0, check.stderr);
      const report = JSON.parse(check.stdout);
      assert.deepEqual([report.mode, report.counts.carry], ['check', 1]);
      assert.deepEqual(await f.counts(db), before);
      const secret = new URL(url).password || '\u0000';
      for (const args of [
        ['--apply'],
        [
          '--apply',
          '--confirm-database',
          'wrong',
          '--plan-digest',
          report.planDigest,
        ],
        [
          '--apply',
          '--confirm-database',
          decodeURIComponent(new URL(url).pathname.slice(1)),
        ],
      ]) {
        const r = call('--from-policy', A, '--to-policy', B, ...args);
        assert.notEqual(r.status, 0);
        assert.ok(!(r.stdout + r.stderr).includes(secret));
      }
      assert.deepEqual(await f.counts(db), before);
      const applied = call(
        '--from-policy',
        A,
        '--to-policy',
        B,
        '--apply',
        '--confirm-database',
        decodeURIComponent(new URL(url).pathname.slice(1)),
        '--plan-digest',
        report.planDigest
      );
      assert.equal(applied.status, 0, applied.stderr);
      assert.ok(!applied.stdout.includes(f.hash('k1')));
      assert.equal((await f.assertions(db, B)).length, 1);
    } finally {
      await db.destroy();
    }
  }
);
