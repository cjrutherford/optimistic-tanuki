const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  attach,
  recomputeScanId,
} = require('../../../scripts/local-directory-source-freshness-attach.cjs');
const { evidenceHashMatches } = require('../src/source-freshness');

// Needs a migrated disposable database (DIRECTORY_TEST_DATABASE_URL). Upstream is always an in-process stub.
const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const digest = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');
const MODIFIED = 'Wed, 21 Oct 2026 17:43:48 GMT';
const item = {
  id: '00001',
  asset:
    'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/part-00001-x-c000.zstd.parquet',
  size: 1234,
  etag: 'abc123-11',
  lastModified: MODIFIED,
};
const items = [item];
const inventory = {
  release: '2026-10-21.0',
  envelope: [-180, -90, 180, 90],
  inventorySha256: digest(JSON.stringify(items)),
  items,
};
const policy = {
  itemId: '00001',
  approvalSha256: 'a'.repeat(64),
  projectionSha256: 'b'.repeat(64),
  classifierSha256: 'c'.repeat(64),
  regions: [{ id: 'r1' }],
  singleMatch: true,
  maxTransferBytes: 1024,
  envelope: inventory.envelope,
};
const scanId = recomputeScanId(inventory, item, policy);
const reserveAttempt = (attempt) => ({
  state: 'reserved',
  attemptId: attempt.attemptId,
  period: new Date().toISOString().slice(0, 7),
});
const stub =
  (over = {}, calls = []) =>
  async (target, init) => {
    calls.push({
      target,
      method: init.method,
      ifMatch: init.headers['If-Match'],
    });
    const { status = 200, etag = item.etag, modified = MODIFIED } = over;
    return new Response(null, {
      status,
      headers: {
        etag: `"${etag}"`,
        'last-modified': modified,
        'content-length': '1234',
      },
    });
  };

async function withDb(fn) {
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    await db.query('TRUNCATE directory_overture_source_evidence');
    await db.query(
      'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
      [scanId]
    );
    await fn(db);
  } finally {
    await db.query(
      'DELETE FROM directory_overture_private_completion WHERE "scanId"=$1',
      [scanId]
    );
    await db.destroy();
  }
}
const count = async (db) =>
  (
    await db.query(
      'SELECT count(*)::int AS n FROM directory_overture_source_evidence'
    )
  )[0].n;

test(
  'check mode verifies against the pinned ETag with If-Match and writes nothing',
  { skip: !url },
  () =>
    withDb(async (db) => {
      const calls = [];
      const result = await attach({
        db,
        inventory,
        policy,
        scanId,
        upstream: stub({}, calls),
        reserveAttempt,
      });
      assert.equal(result.status, 'checked');
      assert.equal(await count(db), 0);
      assert.deepEqual(
        calls.map((c) => [c.method, c.ifMatch]),
        [['HEAD', `"${item.etag}"`]]
      );
    })
);

test(
  'apply attaches an attached_verified row with a null observedAt and a verifying hash',
  { skip: !url },
  () =>
    withDb(async (db) => {
      const name = (await db.query('SELECT current_database() AS n'))[0].n;
      const wrong = await attach({
        db,
        inventory,
        policy,
        scanId,
        upstream: stub(),
        reserveAttempt,
        apply: true,
        confirmDatabase: 'not_this_db',
      });
      assert.equal(wrong.status, 'refused');
      assert.equal(await count(db), 0);
      const result = await attach({
        db,
        inventory,
        policy,
        scanId,
        upstream: stub(),
        reserveAttempt,
        apply: true,
        confirmDatabase: name,
      });
      assert.equal(result.status, 'attached');
      const [row] = await db.query(
        'SELECT * FROM directory_overture_source_evidence WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(row.kind, 'attached_verified');
      assert.equal(row.observedAt, null);
      assert.equal(row.releaseId, '2026-10-21.0');
      assert.equal(
        new Date(row.upstreamLastModified).toISOString(),
        new Date(MODIFIED).toISOString()
      );
      assert.match(
        row.recorder,
        /^attach:local-directory-source-freshness-attach\.cjs@[0-9a-f]{12}$/
      );
      assert.ok(evidenceHashMatches(row));
      const again = await attach({
        db,
        inventory,
        policy,
        scanId,
        upstream: stub(),
        reserveAttempt,
        apply: true,
        confirmDatabase: name,
      });
      assert.equal(again.status, 'refused');
      assert.equal(await count(db), 1);
    })
);

test(
  'a replaced object, a changed ETag, or an inventory mismatch attach nothing',
  { skip: !url },
  () =>
    withDb(async (db) => {
      const name = (await db.query('SELECT current_database() AS n'))[0].n;
      const run = (upstream, extra = {}) =>
        attach({
          db,
          inventory,
          policy,
          scanId,
          upstream,
          reserveAttempt,
          apply: true,
          confirmDatabase: name,
          ...extra,
        });
      assert.equal((await run(stub({ status: 412 }))).status, 'refused');
      assert.equal(
        (await run(stub({ etag: 'different-1' }))).status,
        'refused'
      );
      const mismatch = await run(
        stub({ modified: 'Thu, 22 Oct 2026 00:00:00 GMT' })
      );
      assert.equal(mismatch.status, 'refused');
      assert.match(mismatch.reason, /inventory/);
      assert.equal(await count(db), 0);
    })
);

test(
  'a scan id that does not recompute or is not completed is refused before any request',
  { skip: !url },
  () =>
    withDb(async (db) => {
      const calls = [];
      const bad = await attach({
        db,
        inventory,
        policy: { ...policy, approvalSha256: 'f'.repeat(64) },
        scanId,
        upstream: stub({}, calls),
        reserveAttempt,
      });
      assert.equal(bad.status, 'refused');
      assert.match(bad.reason, /scan id/);
      await db.query(
        'DELETE FROM directory_overture_private_completion WHERE "scanId"=$1',
        [scanId]
      );
      const missing = await attach({
        db,
        inventory,
        policy,
        scanId,
        upstream: stub({}, calls),
        reserveAttempt,
      });
      assert.equal(missing.status, 'refused');
      assert.match(missing.reason, /completed/);
      assert.equal(calls.length, 0);
    })
);
