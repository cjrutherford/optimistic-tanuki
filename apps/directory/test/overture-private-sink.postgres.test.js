const test = require('node:test');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { OverturePrivateSink } = require('../src/overture-private-sink');
const {
  createPrivateOvertureProjector,
} = require('../src/overture-private-projection');

const url = process.env.OVERTURE_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    process.env.OVERTURE_TEST_DISPOSABLE !== 'yes' ||
    !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
    !/^\/overture_test_[a-z0-9_]+$/.test(parsed.pathname)
  )
    throw Error('Refusing non-disposable Overture test database');
}
const scanId = 'a'.repeat(64);
const testPolicy = '1'.repeat(64);
const complete = async (db, id) => {
  const sink = new OverturePrivateSink(db);
  await sink.load(id, testPolicy);
  return sink.isComplete(id);
};
const cp = (n) => ({ scanId, sourceFileRowNumber: n });
const quarantine = (n) => ({
  sourceFileRowNumber: n,
  regionId: 'fixture',
  outcome: { status: 'quarantined', secret: 'never store' },
});
const eligible = (n) => ({
  sourceFileRowNumber: n,
  regionId: 'fixture',
  outcome: {
    status: 'eligible',
    listing: {
      name: 'Fixture',
      category: 'shop',
      location: { type: 'Point', coordinates: [0, 0] },
      attribution: ['Fixture attribution'],
      notices: [],
      termsUrls: [],
      secret: 'never store',
    },
  },
});

test(
  'private sink persists atomically, fences concurrent attempts and resumes after restart',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation'
      );
      const a = new OverturePrivateSink(db),
        b = new OverturePrivateSink(db);
      assert.equal(await a.load(scanId, testPolicy), null);
      assert.equal(await b.load(scanId, testPolicy), null);
      const outcomes = await Promise.allSettled([
        a.commit([eligible(1), quarantine(2)], cp(2)),
        b.commit([quarantine(3)], cp(3)),
      ]);
      assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
      assert.match(
        outcomes.find((x) => x.status === 'rejected').reason.message,
        /Stale/
      );
      const restart = new OverturePrivateSink(db);
      const checkpoint = await restart.load(scanId, testPolicy);
      const stored = await db.query(
        'SELECT * FROM directory_overture_private_row ORDER BY "sourceFileRowNumber"'
      );
      assert.equal(stored.length, checkpoint.sourceFileRowNumber === 2 ? 2 : 1);
      assert.ok(!JSON.stringify(stored).includes('never store'));
      for (const row of stored.filter((r) => !r.listing))
        assert.equal(row.regionId, null);
      const duplicate = checkpoint.sourceFileRowNumber + 2;
      await db.query(
        'INSERT INTO directory_overture_private_row ("scanId", "sourceFileRowNumber") VALUES ($1, $2)',
        [scanId, duplicate]
      );
      await assert.rejects(
        restart.commit(
          [quarantine(duplicate - 1), quarantine(duplicate)],
          cp(duplicate)
        )
      );
      assert.deepEqual(
        await new OverturePrivateSink(db).load(scanId, testPolicy),
        checkpoint
      );
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_overture_private_row WHERE "sourceFileRowNumber" = $1',
            [duplicate - 1]
          )
        ).length,
        0
      );
      await db.query(
        'DELETE FROM directory_overture_private_row WHERE "scanId" = $1 AND "sourceFileRowNumber" = $2',
        [scanId, duplicate]
      );
      await restart.commit([quarantine(duplicate)], cp(duplicate));
      assert.deepEqual(
        await new OverturePrivateSink(db).load(scanId, testPolicy),
        cp(duplicate)
      );
      await assert.rejects(
        restart.commit([quarantine(duplicate + 1)], {
          scanId: 'b'.repeat(64),
          sourceFileRowNumber: duplicate + 1,
        }),
        /Mismatched/
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'synthetic DuckDB extraction persists only authorized projections and resumes in Postgres',
  { skip: !url },
  async () => {
    const { DuckDBInstance } = require('@duckdb/node-api');
    const { extractPrivate } = await import(
      '../../../scripts/overture-private-extractor.mjs'
    );
    const { createHash } = require('node:crypto');
    const { mkdtemp, readFile, rm } = require('node:fs/promises');
    const { join } = require('node:path');
    const { tmpdir } = require('node:os');
    const hash = (x) => createHash('sha256').update(x).digest('hex');
    const dir = await mkdtemp(join(tmpdir(), 'overture-pg-test-'));
    const db = new DataSource({ type: 'postgres', url });
    const duck = await DuckDBInstance.create(':memory:');
    const conn = await duck.connect();
    try {
      await db.initialize();
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation'
      );
      await conn.run('LOAD spatial');
      const path = join(dir, 'source.parquet');
      await conn.run(
        `COPY (SELECT ST_Point(2,2) AS geometry, {'xmin':2.,'xmax':2.,'ymin':2.,'ymax':2.} AS bbox, {'primary':'Fixture'} AS names, 'shop' AS basic_category, {'primary':'shop','hierarchy':['shop']} AS taxonomy, [{'property':'','dataset':'Example','license':'Example'}] AS sources) TO '${path}' (FORMAT PARQUET)`
      );
      const bytes = await readFile(path);
      const items = [
        { id: 'fixture', asset: 'fixture.parquet', size: bytes.length },
      ];
      const inventorySha256 = hash(JSON.stringify(items));
      const policy = {
        authorized: true,
        inventorySha256,
        itemId: 'fixture',
        assetSha256: hash(bytes),
        approvalSha256: '1'.repeat(64),
        projectionSha256: '2'.repeat(64),
        classifierSha256: '3'.repeat(64),
        regions: [
          {
            id: 'town',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [5, 0],
                  [5, 5],
                  [0, 5],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      };
      const fields = Object.keys(
        require('../src/overture-rights').OVERTURE_RIGHTS_FIELDS
      );
      const permissions = Object.fromEntries(
        ['ingest', 'retain', 'privateDisplay'].map((op) => [op, fields])
      );
      const rights = {
        releaseId: 'fixture',
        operations: { ingest: true, retain: true, privateDisplay: true },
        terms: [
          {
            dataset: 'Example',
            license: 'Example',
            attribution: 'Example attribution',
            termsUrl: 'https://example.test',
            permissions,
          },
        ],
      };
      const project = createPrivateOvertureProjector(
        'fixture',
        rights,
        async () => ({ residential: false, sensitive: false, adult: false })
      );
      const opts = {
        connection: conn,
        sourcePath: path,
        inventory: { items, inventorySha256 },
        policy,
        project,
      };
      const first = await extractPrivate({
        ...opts,
        sink: new OverturePrivateSink(db),
      });
      assert.equal(await complete(db, first.scanId), true);
      const retry = await extractPrivate({
        ...opts,
        sourcePath: path + '.missing',
        sink: new OverturePrivateSink(db),
      });
      assert.deepEqual(retry, first);
      const emptyPolicy = {
        ...policy,
        regions: [
          {
            id: 'elsewhere',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [30, 30],
                  [31, 30],
                  [31, 31],
                  [30, 31],
                  [30, 30],
                ],
              ],
            },
          },
        ],
      };
      const empty = await extractPrivate({
        ...opts,
        policy: emptyPolicy,
        sink: new OverturePrivateSink(db),
      });
      assert.equal(empty.sourceFileRowNumber, -1);
      assert.equal(await complete(db, empty.scanId), true);
      assert.equal(
        await new OverturePrivateSink(db).load(empty.scanId, testPolicy),
        null
      );
      const stored = await db.query(
        'SELECT * FROM directory_overture_private_row'
      );
      assert.equal(stored.length, 1);
      assert.equal(stored[0].listing.name, 'Fixture');
      await extractPrivate({ ...opts, sink: new OverturePrivateSink(db) });
      assert.equal(
        (await db.query('SELECT * FROM directory_overture_private_row')).length,
        1
      );
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation'
      );
      const remoteItem = {
        id: 'fixture',
        asset:
          'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/fixture.parquet',
        size: bytes.length,
        etag: 'fixture-1',
        rows: 1,
        rowGroups: 1,
        bbox: [0, 0, 5, 5],
        lastModified: 'Wed, 21 Oct 2026 17:43:57 GMT',
      };
      const remoteItems = [remoteItem],
        remoteHash = hash(JSON.stringify(remoteItems));
      const remotePolicy = {
        ...policy,
        inventorySha256: remoteHash,
        maxTransferBytes: 64 * 1024 * 1024,
      };
      const envelope = [0, 0, 5, 5];
      let requests = 0;
      const upstream = async (_url, options) => {
        assert.equal(options.headers['If-Match'], '"fixture-1"');
        requests++;
        if (options.method === 'HEAD')
          return new Response(null, {
            status: 200,
            headers: {
              etag: '"fixture-1"',
              'content-length': String(bytes.length),
              'accept-ranges': 'bytes',
            },
          });
        const range = /^bytes=(\d+)-(\d*)$/.exec(options.headers.Range);
        assert.ok(range);
        const start = Number(range[1]),
          end = Math.min(
            range[2] ? Number(range[2]) : bytes.length - 1,
            bytes.length - 1
          );
        return new Response(bytes.subarray(start, end + 1), {
          status: 206,
          headers: {
            etag: '"fixture-1"',
            'content-length': String(end - start + 1),
            'content-range': `bytes ${start}-${end}/${bytes.length}`,
            'accept-ranges': 'bytes',
          },
        });
      };
      const remoteOpts = {
        ...opts,
        reserveAttempt: async (attempt) => ({
          state: 'reserved',
          attemptId: attempt.attemptId,
          period: new Date().toISOString().slice(0, 7),
        }),
        sourceMode: 'remote',
        inventory: {
          items: remoteItems,
          inventorySha256: remoteHash,
          release: '2026-10-21.0',
          envelope,
        },
        policy: remotePolicy,
        upstream,
      };
      await extractPrivate({
        ...remoteOpts,
        sink: new OverturePrivateSink(db),
      });
      assert.ok(requests > 0);
      assert.equal(
        (
          await db.query('SELECT listing FROM directory_overture_private_row')
        )[0].listing.name,
        'Fixture'
      );
      await extractPrivate({
        ...remoteOpts,
        sink: new OverturePrivateSink(db),
      });
      assert.equal(
        (await db.query('SELECT 1 FROM directory_overture_private_row')).length,
        1
      );
    } finally {
      conn.closeSync();
      duck.closeSync();
      if (db.isInitialized) await db.destroy();
      await rm(dir, { recursive: true, force: true });
    }
  }
);

test(
  'withdrawal durably fences stale writers, preserves other scan, and handles both lock orders',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const reset = () =>
      db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation'
      );
    try {
      await reset();
      const stale = new OverturePrivateSink(db),
        operator = new OverturePrivateSink(db);
      await stale.load(scanId, testPolicy);
      await operator.withdraw(scanId); // before first checkpoint
      await assert.rejects(stale.commit([eligible(1)], cp(1)), /revoked/);
      await assert.rejects(
        new OverturePrivateSink(db).commit([eligible(1)], cp(1))
      );
      const fresh = new OverturePrivateSink(db);
      await assert.rejects(fresh.load(scanId, testPolicy), /revoked/);
      await assert.rejects(fresh.commit([eligible(1)], cp(1)), /Invalid/);
      await reset();
      const writer = new OverturePrivateSink(db);
      await writer.load(scanId, testPolicy);
      await writer.commit([eligible(1), quarantine(2)], cp(2));
      await operator.withdraw('b'.repeat(64));
      assert.equal(
        (await db.query('SELECT * FROM directory_overture_private_row')).length,
        2
      );
      const stale2 = new OverturePrivateSink(db);
      await stale2.load(scanId, testPolicy);
      await operator.withdraw(scanId);
      await operator.withdraw(scanId);
      assert.equal(
        (await db.query('SELECT * FROM directory_overture_private_row')).length,
        0
      );
      await assert.rejects(stale2.commit([eligible(3)], cp(3)), /revoked/);
      await assert.rejects(
        new OverturePrivateSink(db).load(scanId, testPolicy),
        /revoked/
      );
      await reset();
      const first = new OverturePrivateSink(db);
      await first.load(scanId, testPolicy);
      // Hold the shared lock until both requests are queued, deterministically selecting order.
      const lock = db.createQueryRunner();
      await lock.connect();
      await lock.startTransaction();
      await lock.query(
        'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
        [scanId]
      );
      await lock.query(
        'SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId"=$1 FOR UPDATE',
        [scanId]
      );
      const commit = first.commit([eligible(1)], cp(1));
      // Wait until PostgreSQL observes the blocked commit, then queue withdrawal.
      while (
        !(await db.query('SELECT 1 FROM pg_locks WHERE NOT granted')).length
      )
        await new Promise((r) => setTimeout(r, 5));
      const withdrawal = operator.withdraw(scanId);
      while (
        (await db.query('SELECT 1 FROM pg_locks WHERE NOT granted')).length < 2
      )
        await new Promise((r) => setTimeout(r, 5));
      await lock.commitTransaction();
      await lock.release();
      await commit;
      await withdrawal;
      assert.equal(
        (await db.query('SELECT * FROM directory_overture_private_row')).length,
        0
      );
      await assert.rejects(
        new OverturePrivateSink(db).load(scanId, testPolicy),
        /revoked/
      );
      await reset();
      const second = new OverturePrivateSink(db);
      await second.load(scanId, testPolicy);
      const lock2 = db.createQueryRunner();
      await lock2.connect();
      await lock2.startTransaction();
      await lock2.query(
        'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
        [scanId]
      );
      await lock2.query(
        'SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId"=$1 FOR UPDATE',
        [scanId]
      );
      const withdrawalFirst = operator.withdraw(scanId);
      while (
        !(await db.query('SELECT 1 FROM pg_locks WHERE NOT granted')).length
      )
        await new Promise((r) => setTimeout(r, 5));
      const commitSecond = second.commit([eligible(1)], cp(1));
      const rejected = assert.rejects(commitSecond, /revoked/);
      while (
        (await db.query('SELECT 1 FROM pg_locks WHERE NOT granted')).length < 2
      )
        await new Promise((r) => setTimeout(r, 5));
      await lock2.commitTransaction();
      await lock2.release();
      await withdrawalFirst;
      await rejected;
      assert.equal(
        (await db.query('SELECT * FROM directory_overture_private_row')).length,
        0
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'independent scans commit concurrently and withdrawal isolates them',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const other = 'b'.repeat(64);
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation'
      );
      const a = new OverturePrivateSink(db),
        b = new OverturePrivateSink(db);
      await a.load(scanId, testPolicy);
      await b.load(other, '2'.repeat(64));
      const lock = db.createQueryRunner();
      await lock.connect();
      await lock.startTransaction();
      await lock.query(
        'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
        [scanId]
      );
      await lock.query(
        'SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId"=$1 FOR UPDATE',
        [scanId]
      );
      try {
        const blocked = a.commit([eligible(1)], cp(1));
        await Promise.race([
          b.commit([quarantine(1)], { scanId: other, sourceFileRowNumber: 1 }),
          new Promise((_, reject) =>
            setTimeout(() => reject(Error('unrelated scan blocked')), 1500)
          ),
        ]);
        await lock.commitTransaction();
        await blocked;
      } finally {
        if (lock.isTransactionActive) await lock.rollbackTransaction();
        await lock.release();
      }
      await a.withdraw(scanId);
      assert.deepEqual(
        await new OverturePrivateSink(db).load(other, '2'.repeat(64)),
        { scanId: other, sourceFileRowNumber: 1 }
      );
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_overture_private_row WHERE "scanId"=$1',
            [other]
          )
        ).length,
        1
      );
      await assert.rejects(
        new OverturePrivateSink(db).load(scanId, testPolicy),
        /revoked/
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'row withdrawal removes only its scan row and fences future ingestion',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation'
      );
      const other = 'b'.repeat(64),
        a = new OverturePrivateSink(db),
        b = new OverturePrivateSink(db);
      await a.load(scanId, testPolicy);
      await b.load(other, testPolicy);
      await a.commit([eligible(1)], cp(1));
      await b.commit([eligible(1)], { scanId: other, sourceFileRowNumber: 1 });
      await a.withdrawRow(scanId, 1);
      await a.withdrawRow(scanId, 2);
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_overture_private_row WHERE "scanId"=$1',
            [scanId]
          )
        ).length,
        0
      );
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_overture_private_row WHERE "scanId"=$1',
            [other]
          )
        ).length,
        1
      );
      await a.commit([eligible(2), eligible(3)], cp(3));
      assert.deepEqual(
        await new OverturePrivateSink(db).load(scanId, testPolicy),
        cp(3)
      );
      const retained = await db.query(
        'SELECT "sourceFileRowNumber" FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.deepEqual(
        retained.map((row) => Number(row.sourceFileRowNumber)),
        [3]
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'empty scan completion is durable, fences commits and is removed by withdrawal',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation'
      );
      const a = new OverturePrivateSink(db),
        stale = new OverturePrivateSink(db);
      await a.load(scanId, testPolicy);
      await stale.load(scanId, testPolicy);
      await a.complete();
      assert.equal(await complete(db, scanId), true);
      await assert.rejects(stale.commit([eligible(1)], cp(1)), /complete/);
      await a.withdraw(scanId);
      await assert.rejects(complete(db, scanId), /revoked/);
      await assert.rejects(
        new OverturePrivateSink(db).load(scanId, testPolicy),
        /revoked/
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'load observes withdrawal serialized ahead of it',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation'
      );
      const lock = db.createQueryRunner();
      await lock.connect();
      await lock.startTransaction();
      await lock.query(
        'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
        [scanId]
      );
      await lock.query(
        'SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId"=$1 FOR UPDATE',
        [scanId]
      );
      await lock.query(
        'INSERT INTO directory_overture_private_revocation ("scanId") VALUES ($1)',
        [scanId]
      );
      const pending = new OverturePrivateSink(db).load(scanId, testPolicy);
      const early = await Promise.race([
        pending.then(
          () => 'loaded',
          () => 'rejected'
        ),
        new Promise((resolve) => setTimeout(() => resolve('blocked'), 150)),
      ]);
      assert.equal(early, 'blocked');
      await lock.commitTransaction();
      await lock.release();
      await assert.rejects(pending, /revoked/);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'a stale scanner cannot mark another scanner checkpoint complete',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation'
      );
      const stale = new OverturePrivateSink(db),
        writer = new OverturePrivateSink(db);
      await stale.load(scanId, testPolicy);
      await writer.load(scanId, testPolicy);
      await writer.commit([eligible(1)], cp(1));
      await assert.rejects(stale.complete(), /Stale/);
      assert.equal(await writer.isComplete(scanId), false);
      await writer.complete();
      assert.equal(await writer.isComplete(scanId), true);
      await assert.rejects(stale.isComplete(scanId), /Stale/);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'policy membership is durable, immutable and revoked as a cohort',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const policy = '1'.repeat(64),
      other = '2'.repeat(64),
      first = '3'.repeat(64),
      second = '4'.repeat(64);
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_revocation, directory_overture_private_row, directory_overture_private_checkpoint, directory_overture_private_completion, directory_overture_private_row_revocation'
      );
      const a = new OverturePrivateSink(db),
        b = new OverturePrivateSink(db);
      await a.load(first, policy);
      await b.load(second, policy);
      await a.commit([eligible(1)], { scanId: first, sourceFileRowNumber: 1 });
      await b.complete();
      await assert.rejects(
        new OverturePrivateSink(db).load(first, other),
        /bound/i
      );
      await new OverturePrivateSink(db).withdrawPolicy(policy);
      await assert.rejects(
        a.commit([eligible(2)], { scanId: first, sourceFileRowNumber: 2 }),
        /revoked/i
      );
      await assert.rejects(
        new OverturePrivateSink(db).load(second, policy),
        /revoked/i
      );
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_overture_private_row WHERE "scanId"=$1',
            [first]
          )
        ).length,
        0
      );
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_overture_private_completion WHERE "scanId"=$1',
            [second]
          )
        ).length,
        0
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'policy withdrawal serializes registration, rolls back and preserves unrelated policies',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const policy = '5'.repeat(64),
      other = '6'.repeat(64),
      a = '7'.repeat(64),
      b = '8'.repeat(64),
      c = '9'.repeat(64),
      legacy = 'e'.repeat(64);
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_revocation, directory_overture_private_row, directory_overture_private_checkpoint, directory_overture_private_completion, directory_overture_private_row_revocation'
      );
      const first = new OverturePrivateSink(db),
        survivor = new OverturePrivateSink(db);
      await first.load(a, policy);
      await first.commit([eligible(1)], { scanId: a, sourceFileRowNumber: 1 });
      await survivor.load(b, other);
      await survivor.commit([eligible(1)], {
        scanId: b,
        sourceFileRowNumber: 1,
      });
      await db.query(
        'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1)',
        [legacy]
      );
      await assert.rejects(
        new OverturePrivateSink(db).load(legacy, policy),
        /legacy/i
      );
      const faultPolicy = 'f'.repeat(64),
        faultScan = 'd'.repeat(64),
        fault = new OverturePrivateSink(db);
      await fault.load(faultScan, faultPolicy);
      await fault.commit([eligible(1)], {
        scanId: faultScan,
        sourceFileRowNumber: 1,
      });
      const broken = {
        transaction: (f) =>
          db.transaction((manager) =>
            f({
              query: async (sql, args) => {
                const result = await manager.query(sql, args);
                if (sql.includes('DELETE FROM directory_overture_private_row '))
                  throw Error('injected rollback');
                return result;
              },
            })
          ),
      };
      await assert.rejects(
        new OverturePrivateSink(broken).withdrawPolicy(faultPolicy),
        /injected/
      );
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_overture_private_row WHERE "scanId"=$1',
            [faultScan]
          )
        ).length,
        1
      );
      await assert.rejects(
        new OverturePrivateSink(db).load(faultScan, faultPolicy),
        /revoked/
      );
      assert.equal(
        (await new OverturePrivateSink(db).withdrawPolicy(faultPolicy))
          .complete,
        true
      );
      assert.deepEqual(await new OverturePrivateSink(db).load(a, policy), {
        scanId: a,
        sourceFileRowNumber: 1,
      });
      const lock = db.createQueryRunner();
      await lock.connect();
      await lock.startTransaction();
      await lock.query(
        'SELECT 1 FROM directory_overture_private_policy WHERE "policyId"=$1 FOR UPDATE',
        [policy]
      );
      const waitForLock = async (fragment) => {
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline) {
          if (
            (
              await db.query(
                "SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND position($1 in query)>0",
                [fragment]
              )
            ).length
          )
            return;
          await new Promise((r) => setTimeout(r, 10));
        }
        throw Error('Timed out waiting for policy lock: ' + fragment);
      };
      const registering = new OverturePrivateSink(db).load(c, policy);
      await waitForLock(
        'SELECT revoked FROM directory_overture_private_policy'
      );
      const withdrawing = new OverturePrivateSink(db).withdrawPolicy(policy);
      await waitForLock(
        'SELECT "policyId" FROM directory_overture_private_policy'
      );
      await lock.commitTransaction();
      await lock.release();
      await registering;
      await withdrawing;
      await assert.rejects(
        new OverturePrivateSink(db).load(c, policy),
        /revoked/
      );
      assert.deepEqual(await new OverturePrivateSink(db).load(b, other), {
        scanId: b,
        sourceFileRowNumber: 1,
      });
      const pre = 'a'.repeat(64);
      await new OverturePrivateSink(db).withdrawPolicy(pre);
      await assert.rejects(
        new OverturePrivateSink(db).load('b'.repeat(64), pre),
        /revoked/
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'withdrawal queued before registration prevents a new member',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const policy = 'c'.repeat(64),
      scan = 'd'.repeat(64),
      lock = db.createQueryRunner();
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_revocation, directory_overture_private_row, directory_overture_private_checkpoint, directory_overture_private_completion, directory_overture_private_row_revocation'
      );
      await db.query(
        'INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1)',
        [policy]
      );
      await lock.connect();
      await lock.startTransaction();
      await lock.query(
        'SELECT 1 FROM directory_overture_private_policy WHERE "policyId"=$1 FOR UPDATE',
        [policy]
      );
      const waitForLock = async (fragment) => {
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline) {
          if (
            (
              await db.query(
                "SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND position($1 in query)>0",
                [fragment]
              )
            ).length
          )
            return;
          await new Promise((r) => setTimeout(r, 10));
        }
        throw Error('Timed out waiting for policy lock: ' + fragment);
      };
      const withdrawal = new OverturePrivateSink(db).withdrawPolicy(policy);
      await waitForLock(
        'SELECT "policyId" FROM directory_overture_private_policy'
      );
      const registration = new OverturePrivateSink(db).load(scan, policy);
      const rejected = assert.rejects(registration, /revoked/);
      await waitForLock(
        'SELECT revoked FROM directory_overture_private_policy'
      );
      await lock.commitTransaction();
      await withdrawal;
      await rejected;
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_overture_private_membership WHERE "scanId"=$1',
            [scan]
          )
        ).length,
        0
      );
    } finally {
      if (lock.isTransactionActive) await lock.rollbackTransaction();
      await lock.release();
      await db.destroy();
    }
  }
);

test(
  'policy withdrawal denies access immediately and resumes bounded cleanup after interruption',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const policy = 'a'.repeat(64),
      scan = 'b'.repeat(64);
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_revocation, directory_overture_private_row, directory_overture_private_checkpoint, directory_overture_private_completion, directory_overture_private_row_revocation'
      );
      await new OverturePrivateSink(db).load(scan, policy);
      await db.query(
        'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber") SELECT $1,n FROM generate_series(1,1200) AS n',
        [scan]
      );
      await db.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,1300)',
        [scan]
      );
      const first = await new OverturePrivateSink(db).withdrawPolicy(policy, {
        maxBatches: 1,
      });
      assert.equal(first.complete, false);
      const remaining = (
        await db.query(
          'SELECT count(*)::int n FROM directory_overture_private_row WHERE "scanId"=$1',
          [scan]
        )
      )[0].n;
      assert.ok(remaining > 0 && remaining < 1200);
      await assert.rejects(
        new OverturePrivateSink(db).load(scan, policy),
        /revoked/i
      );
      let result = first;
      for (let i = 0; i < 8 && !result.complete; i++)
        result = await new OverturePrivateSink(db).withdrawPolicy(policy, {
          maxBatches: 1,
        });
      assert.equal(result.complete, true);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM directory_overture_private_row WHERE "scanId"=$1',
            [scan]
          )
        )[0].n,
        0
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM directory_overture_private_row_revocation WHERE "scanId"=$1',
            [scan]
          )
        )[0].n,
        0
      );
      await assert.rejects(
        new OverturePrivateSink(db).load(scan, policy),
        /revoked/i
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'local evaluation reads completed permitted rows and removes withdrawn policies',
  { skip: !url },
  async () => {
    const {
      pendingChecks,
      pendingServer,
    } = require('../src/register-pending-runtime');
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const town = '00000000-0000-4000-8000-000000000005';
    const id = {
      sourceEpoch: '00000000-0000-4000-8000-000000000001',
      recoveryEpoch: '00000000-0000-4000-8000-000000000002',
      owner: '00000000-0000-4000-8000-000000000003',
      activationId: '00000000-0000-4000-8000-000000000004',
      socialGeneration: '1',
      directoryGeneration: '2',
    };
    const authority = {
      ...id,
      authorityEpoch: id.recoveryEpoch,
      protocol: 'register-pending-v1',
      phase: 'reg-running',
      cursor: null,
      eligible: true,
      dbNow: new Date('2026-01-01T00:10:00Z'),
      registerRequest: {
        ...id,
        sweep: { generation: '1' },
        lastCompletedSweep: {
          generation: '1',
          completedAt: '2026-01-01T00:00:00Z',
        },
      },
    };
    const snapshot = {
      id: town,
      name: 'Town',
      appScope: 'local-hub',
      isPrivate: false,
      localityType: 'town',
    };
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_row_revocation, directory_overture_private_revocation'
      );
      const sink = new OverturePrivateSink(db);
      await sink.load(scanId, testPolicy);
      const input = eligible(1);
      input.regionId = town;
      await sink.commit([input], cp(1));
      const wrapper = {
        query: (sql, params) =>
          sql.includes('FROM directory_census_progress p')
            ? Promise.resolve([authority])
            : db.query(sql, params),
      };
      const source = {
        scan: async () => [],
        current: async () => ({
          status: 'current',
          changeToken: town,
          snapshot,
        }),
      };
      const checks = pendingChecks(wrapper, source, id);
      assert.equal(
        (await checks.localListings(town)).listings.length,
        0,
        'incomplete scans are hidden'
      );
      await sink.complete();
      assert.equal((await checks.localListings(town)).listings.length, 1);
      assert.equal(
        (await checks.localListings(town, 0, 'fixture')).listings.length,
        1
      );
      assert.equal(
        (await checks.localListings(town, 0, 'no-such-business')).listings
          .length,
        0
      );
      const secret = 'local-listing-secret-123456789012345',
        server = pendingServer(
          checks,
          undefined,
          undefined,
          undefined,
          undefined,
          secret
        );
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      try {
        const endpoint = `http://127.0.0.1:${
          server.address().port
        }/internal/local-evaluation/towns/${town}/listings?offset=0`;
        const read = async () => {
          const response = await fetch(endpoint, {
            headers: { authorization: `Bearer ${secret}` },
          });
          assert.equal(response.status, 200);
          return response.json();
        };
        assert.equal((await read()).listings.length, 1);
        await sink.withdrawPolicy(testPolicy);
        assert.equal((await read()).listings.length, 0);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    } finally {
      await db.destroy();
    }
  }
);

test(
  'local reviewed contact fields require a matching source and disappear on withdrawal',
  { skip: !url },
  async () => {
    const { OVERTURE_RIGHTS_FIELDS } = require('../src/overture-rights');
    const fields = Object.keys(OVERTURE_RIGHTS_FIELDS),
      permissions = Object.fromEntries(
        ['ingest', 'retain', 'publicDisplay'].map((op) => [op, fields])
      );
    const policy = {
      releaseId: 'fixture',
      operations: { ingest: true, retain: true, publicDisplay: true },
      terms: [
        {
          dataset: 'Fixture',
          license: 'Fixture',
          attribution: 'Fixture attribution',
          termsUrl: 'https://example.test/terms',
          permissions,
        },
      ],
    };
    const source = {
      releaseId: 'fixture',
      sources: [{ property: '', dataset: 'Fixture', license: 'Fixture' }],
      names: { primary: 'Fixture' },
      basic_category: 'shop',
      taxonomy: { primary: 'shop', hierarchy: ['shop'] },
      geometry: { type: 'Point', coordinates: [0, 0] },
      websites: ['https://example.test'],
      phones: ['+19125550100'],
      addresses: [{ freeform: '10 Main St' }],
    };
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await db.query(
        'TRUNCATE directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_row_revocation, directory_overture_private_revocation'
      );
      const sink = new OverturePrivateSink(db);
      await sink.load(scanId, testPolicy);
      await sink.commit([eligible(1)], cp(1));
      await sink.complete();
      const review = {
        evidenceUrl: 'https://example.test/official',
        nonResidential: true,
        nonSensitive: true,
        nonAdult: true,
        websiteVerified: true,
        phoneVerified: true,
        addressVerified: true,
      };
      await assert.rejects(
        sink.attachLocalReviewedFields(
          1,
          { ...source, names: { primary: 'Other' } },
          policy,
          review
        ),
        /mismatch/i
      );
      await sink.attachLocalReviewedFields(1, source, policy, review);
      const [r] = await db.query(
        'SELECT listing FROM directory_overture_private_row'
      );
      assert.equal(r.listing.reviewed.website, 'https://example.test/');
      assert.equal(r.listing.reviewed.phone, '+19125550100');
      assert.equal(r.listing.reviewed.address, '10 Main St');
      await sink.attachLocalReviewedFields(1, source, policy, {
        ...review,
        evidenceUrl: 'http://example.test/official',
      });
      const [http] = await db.query(
        'SELECT listing FROM directory_overture_private_row'
      );
      assert.equal(
        http.listing.reviewed.evidenceUrl,
        'http://example.test/official'
      );
      await sink.withdrawPolicy(testPolicy);
      assert.equal(
        (await db.query('SELECT 1 FROM directory_overture_private_row')).length,
        0
      );
    } finally {
      await db.destroy();
    }
  }
);

const evidenceInput = (over = {}) => ({
  kind: 'captured',
  releaseId: '2026-10-21.0',
  artifactUrl:
    'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/a.parquet',
  artifactEtag: 'abc-2',
  artifactBytes: 1234,
  upstreamLastModified: new Date('2026-10-21T12:00:00Z'),
  observedAt: new Date(),
  recorder: 'extractor:test@abcdefabcdef',
  inventorySha256: 'e'.repeat(64),
  ...over,
});
const resetAll = (db) =>
  db.query(
    'TRUNCATE directory_overture_source_evidence, directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation'
  );
const evidenceRows = (db, id = scanId) =>
  db.query(
    'SELECT * FROM directory_overture_source_evidence WHERE "scanId"=$1',
    [id]
  );

test(
  'completion and source evidence commit together; evidence is verifiable',
  { skip: !url },
  async () => {
    const { evidenceHashMatches } = require('../src/source-freshness');
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await resetAll(db);
      const sink = new OverturePrivateSink(db);
      await sink.load(scanId, testPolicy);
      await sink.complete(evidenceInput());
      assert.equal(await complete(db, scanId), true);
      const [row] = await evidenceRows(db);
      assert.equal(row.kind, 'captured');
      assert.equal(
        row.upstreamLastModified.toISOString(),
        '2026-10-21T12:00:00.000Z'
      );
      assert.equal(row.artifactBytes, '1234');
      assert.ok(row.recordedAt instanceof Date);
      assert.equal(evidenceHashMatches(row), true);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'an injected evidence failure rolls the completion back',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await resetAll(db);
      const sink = new OverturePrivateSink(db);
      await sink.load(scanId, testPolicy);
      await assert.rejects(
        sink.complete(evidenceInput({ artifactEtag: 'bad"etag' })),
        /Invalid source evidence/
      );
      assert.equal(await complete(db, scanId), false);
      assert.equal((await evidenceRows(db)).length, 0);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'missing evidence completes with no row; a bad or future date is stored as null, never invented',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await resetAll(db);
      const none = new OverturePrivateSink(db);
      await none.load(scanId, testPolicy);
      await none.complete(null);
      assert.equal(await complete(db, scanId), true);
      assert.equal((await evidenceRows(db)).length, 0);
      const other = 'c'.repeat(64),
        future = new OverturePrivateSink(db);
      await future.load(other, testPolicy);
      await future.complete(
        evidenceInput({
          upstreamLastModified: new Date(Date.now() + 86400000 * 400),
          releaseId: '2027-11-16.0',
        })
      );
      assert.equal(
        (await evidenceRows(db, other))[0].upstreamLastModified,
        null
      );
      const third = 'd'.repeat(64),
        skewed = new OverturePrivateSink(db);
      await skewed.load(third, testPolicy);
      await skewed.complete(
        evidenceInput({
          upstreamLastModified: new Date('2026-06-01T00:00:00Z'),
        })
      );
      assert.equal(
        (await evidenceRows(db, third))[0].upstreamLastModified,
        null,
        'release id and header more than 14 days apart'
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'a re-run with different evidence throws and never overwrites',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await resetAll(db);
      const first = new OverturePrivateSink(db);
      await first.load(scanId, testPolicy);
      await first.complete(evidenceInput());
      const before = (await evidenceRows(db))[0];
      const again = new OverturePrivateSink(db);
      await again.load(scanId, testPolicy);
      await assert.rejects(
        again.complete(
          evidenceInput({
            upstreamLastModified: new Date('2026-10-22T12:00:00Z'),
          })
        ),
        /different content/
      );
      assert.equal(
        (await evidenceRows(db))[0].evidenceSha256,
        before.evidenceSha256
      );
      await assert.rejects(
        db.query(
          'INSERT INTO directory_overture_source_evidence SELECT * FROM directory_overture_source_evidence'
        ),
        /duplicate key/
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'withdrawal and policy withdrawal delete the evidence with the completion',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await resetAll(db);
      const a = new OverturePrivateSink(db);
      await a.load(scanId, testPolicy);
      await a.complete(evidenceInput());
      await a.withdraw(scanId);
      assert.equal((await evidenceRows(db)).length, 0);
      await resetAll(db);
      const b = new OverturePrivateSink(db);
      await b.load(scanId, testPolicy);
      await b.complete(evidenceInput());
      let result = { complete: false };
      for (let i = 0; i < 8 && !result.complete; i++)
        result = await new OverturePrivateSink(db).withdrawPolicy(testPolicy, {
          maxBatches: 1,
        });
      assert.equal(result.complete, true);
      assert.equal((await evidenceRows(db)).length, 0);
    } finally {
      await db.destroy();
    }
  }
);

test('no source writes update or upsert source evidence', () => {
  const fs = require('node:fs'),
    path = require('node:path');
  const files = [
    path.join(__dirname, '../src/source-evidence-store.ts'),
    path.join(__dirname, '../src/overture-private-sink.ts'),
    path.join(__dirname, '../src/register-pending-runtime.ts'),
  ];
  for (const file of files)
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      /UPDATE\s+"?directory_overture_source_evidence/i,
      file
    );
  assert.doesNotMatch(
    fs.readFileSync(files[0], 'utf8'),
    /DO UPDATE/i,
    'evidence insert never upserts'
  );
});

const identityKey = 'sink-business-identity-test-key-32-bytes!';
const { upstreamKeyHash } = require('../src/business-identity');
const withId = (n, upstreamId) => {
  const row = eligible(n);
  row.outcome.upstreamId = upstreamId;
  return row;
};
const resetKeys = (db) =>
  db.query(
    'TRUNCATE directory_overture_source_key, directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_checkpoint, directory_overture_private_row, directory_overture_private_revocation, directory_overture_private_row_revocation, directory_overture_source_evidence'
  );
const keyRows = (db) =>
  db.query(
    'SELECT "scanId","sourceFileRowNumber","upstreamKeyHash","keyVersion" FROM directory_overture_source_key ORDER BY "sourceFileRowNumber"'
  );

test(
  'a committed batch writes one keyed hash per eligible row, none for a quarantined row, and none in the listing',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await resetKeys(db);
      const sink = new OverturePrivateSink(db, {
        businessIdentityKey: identityKey,
      });
      await sink.load(scanId, testPolicy);
      const quarantined = quarantine(2);
      quarantined.outcome.upstreamId = 'gers-quarantined';
      await sink.commit(
        [withId(1, 'gers-1'), quarantined, withId(3, 'gers-3')],
        cp(3)
      );
      const keys = await keyRows(db);
      assert.deepEqual(
        keys.map((k) => [
          Number(k.sourceFileRowNumber),
          k.upstreamKeyHash,
          k.keyVersion,
        ]),
        [
          [1, upstreamKeyHash(identityKey, 'gers-1'), 1],
          [3, upstreamKeyHash(identityKey, 'gers-3'), 1],
        ]
      );
      const stored = JSON.stringify(
        await db.query('SELECT * FROM directory_overture_private_row')
      );
      for (const secret of [
        'gers-1',
        'gers-3',
        'gers-quarantined',
        keys[0].upstreamKeyHash,
        keys[1].upstreamKeyHash,
      ])
        assert.ok(!stored.includes(secret));
    } finally {
      await resetKeys(db);
      await db.destroy();
    }
  }
);

test(
  'without a key, or with an unusable id, no key row is written and the batch still commits',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await resetKeys(db);
      const keyless = new OverturePrivateSink(db, {
        businessIdentityKey: undefined,
      });
      await keyless.load(scanId, testPolicy);
      const saved = process.env.DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY;
      delete process.env.DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY;
      try {
        await keyless.commit([withId(1, 'gers-1')], cp(1));
      } finally {
        if (saved !== undefined)
          process.env.DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY = saved;
      }
      assert.equal((await keyRows(db)).length, 0);
      const sink = new OverturePrivateSink(db, {
        businessIdentityKey: identityKey,
      });
      await sink.load(scanId, testPolicy);
      await sink.commit(
        [
          withId(2, undefined),
          withId(3, ''),
          withId(4, 42),
          withId(5, 'x'.repeat(300)),
          withId(6, null),
          eligible(7),
        ],
        cp(7)
      );
      assert.equal((await keyRows(db)).length, 0);
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_overture_private_row WHERE "scanId"=$1',
            [scanId]
          )
        ).length,
        7
      );
      await assert.rejects(
        new OverturePrivateSink(db, { businessIdentityKey: 'short' }).commit(
          [withId(8, 'gers-8')],
          cp(8)
        ),
        (e) => !/short|gers-8/.test(e.message)
      );
    } finally {
      await resetKeys(db);
      await db.destroy();
    }
  }
);

test(
  'row withdrawal keeps the key row and scan or policy withdrawal removes it',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await resetKeys(db);
      const other = 'b'.repeat(64);
      const a = new OverturePrivateSink(db, {
          businessIdentityKey: identityKey,
        }),
        b = new OverturePrivateSink(db, { businessIdentityKey: identityKey });
      await a.load(scanId, testPolicy);
      await b.load(other, testPolicy);
      await a.commit([withId(1, 'gers-1'), withId(2, 'gers-2')], cp(2));
      await b.commit([withId(1, 'gers-1')], {
        scanId: other,
        sourceFileRowNumber: 1,
      });
      await a.withdrawRow(scanId, 1);
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_overture_private_row WHERE "scanId"=$1 AND "sourceFileRowNumber"=1',
            [scanId]
          )
        ).length,
        0
      );
      assert.equal((await keyRows(db)).length, 3);
      // A row revoked before ingestion is never keyed either.
      await a.withdrawRow(scanId, 3);
      await a.commit([withId(3, 'gers-3'), withId(4, 'gers-4')], cp(4));
      assert.deepEqual(
        (await keyRows(db))
          .filter((k) => k.scanId === scanId)
          .map((k) => Number(k.sourceFileRowNumber)),
        [1, 2, 4]
      );
      await a.withdraw(scanId);
      assert.deepEqual(
        (await keyRows(db)).map((k) => k.scanId),
        [other]
      );
      // Policy withdrawal purges keys of withdrawn rows as well as live ones.
      await b.withdrawRow(other, 1);
      assert.equal((await b.withdrawPolicy(testPolicy)).complete, true);
      assert.equal((await keyRows(db)).length, 0);
    } finally {
      await resetKeys(db);
      await db.destroy();
    }
  }
);

test(
  'a replayed batch at a stale checkpoint writes no key',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await resetKeys(db);
      const first = new OverturePrivateSink(db, {
          businessIdentityKey: identityKey,
        }),
        stale = new OverturePrivateSink(db, {
          businessIdentityKey: identityKey,
        });
      await first.load(scanId, testPolicy);
      await stale.load(scanId, testPolicy);
      await first.commit([withId(1, 'gers-1')], cp(1));
      await assert.rejects(
        stale.commit([withId(1, 'gers-replayed'), withId(2, 'gers-2')], cp(2)),
        /Stale/
      );
      assert.deepEqual(
        (await keyRows(db)).map((k) => Number(k.sourceFileRowNumber)),
        [1]
      );
      assert.equal(
        (await keyRows(db))[0].upstreamKeyHash,
        upstreamKeyHash(identityKey, 'gers-1')
      );
    } finally {
      await resetKeys(db);
      await db.destroy();
    }
  }
);
