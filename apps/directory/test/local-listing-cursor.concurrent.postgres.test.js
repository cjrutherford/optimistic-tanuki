const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { pendingChecks } = require('../src/register-pending-runtime');

const url = process.env.S5_CURSOR_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
    !/^\/directory_cursor_test_[a-z0-9_]+$/i.test(parsed.pathname)
  ) {
    throw Error(
      'A dedicated loopback directory_cursor_test_* database is required'
    );
  }
}

const identity = {
  sourceEpoch: '00000000-0000-4000-8000-000000000001',
  recoveryEpoch: '00000000-0000-4000-8000-000000000002',
  owner: '00000000-0000-4000-8000-000000000003',
  activationId: '00000000-0000-4000-8000-000000000004',
  socialGeneration: '1',
  directoryGeneration: '2',
};
const town = randomUUID();
const changeToken = randomUUID();
const scans = {
  first: 'a'.repeat(32) + randomBytes(16).toString('hex'),
  second: 'b'.repeat(32) + randomBytes(16).toString('hex'),
  inserted: 'c'.repeat(32) + randomBytes(16).toString('hex'),
};
const policies = {
  first: randomBytes(32).toString('hex'),
  second: randomBytes(32).toString('hex'),
  inserted: randomBytes(32).toString('hex'),
};
const secret = 'cursor-postgres-fixture-secret-32-bytes';
const snapshot = {
  id: town,
  name: 'Fixture Town',
  slug: null,
  adminArea: 'GA',
  appScope: 'local-hub',
  isPrivate: false,
  localityType: 'town',
};
const listing = (name) => ({
  name,
  category: 'restaurant',
  location: { type: 'Point', coordinates: [-83, 31] },
  attribution: ['Fixture source'],
  notices: [],
  termsUrls: ['https://example.test/terms'],
  assignmentChangeToken: changeToken,
});

test(
  'cursor pages reapply withdrawal and policy filters and can include later rows',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const request = {
        ...identity,
        sweep: { generation: '1' },
        lastCompletedSweep: {
          generation: '1',
          completedAt: new Date().toISOString(),
        },
      };
      await db.query(
        `INSERT INTO directory_installation (id, "recoveryEpoch") VALUES ('recovery-authority',$1)
       ON CONFLICT (id) DO UPDATE SET "recoveryEpoch"=EXCLUDED."recoveryEpoch"`,
        [identity.recoveryEpoch]
      );
      await db.query(
        `INSERT INTO directory_census_progress
        (id,phase,cursor,protocol,"registerRequest","sourceEpoch","recoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration")
       VALUES ('recovery','reg-running',NULL,'register-pending-v1',$1::jsonb,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET phase=EXCLUDED.phase,cursor=NULL,protocol=EXCLUDED.protocol,
         "registerRequest"=EXCLUDED."registerRequest", "sourceEpoch"=EXCLUDED."sourceEpoch",
         "recoveryEpoch"=EXCLUDED."recoveryEpoch",owner=EXCLUDED.owner,
         "activationId"=EXCLUDED."activationId","socialGeneration"=EXCLUDED."socialGeneration",
         "directoryGeneration"=EXCLUDED."directoryGeneration"`,
        [
          JSON.stringify(request),
          identity.sourceEpoch,
          identity.recoveryEpoch,
          identity.owner,
          identity.activationId,
          identity.socialGeneration,
          identity.directoryGeneration,
        ]
      );
      await db.query(
        `INSERT INTO directory_town ("communityId",name,eligible) VALUES ($1,'Fixture Town',true)
       ON CONFLICT ("communityId") DO UPDATE SET eligible=true`,
        [town]
      );
      for (const policyId of Object.values(policies)) {
        await db.query(
          'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false) ON CONFLICT ("policyId") DO UPDATE SET revoked=false',
          [policyId]
        );
      }
      for (const [key, scanId] of Object.entries(scans)) {
        await db.query(
          'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2) ON CONFLICT ("scanId") DO UPDATE SET "policyId"=EXCLUDED."policyId"',
          [scanId, policies[key]]
        );
        await db.query(
          'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
          [scanId]
        );
      }
      for (let row = 1; row <= 26; row++) {
        await db.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4::jsonb)',
          [
            scans.first,
            row,
            town,
            JSON.stringify(listing(`First scan row ${row}`)),
          ]
        );
      }
      await db.query(
        'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,1,$2,$3::jsonb)',
        [scans.second, town, JSON.stringify(listing('Policy-revoked row'))]
      );

      const source = {
        scan: async () => [],
        current: async () => ({ status: 'current', changeToken, snapshot }),
      };
      const checks = pendingChecks(db, source, identity, secret);
      const first = await checks.localListings(town, 0, '', false, '', true);
      assert.equal(first.listings.length, 25);
      assert.equal(first.hasMore, true);
      assert.ok(first.nextCursor);
      assert.deepEqual(
        first.listings.map((item) => item.name),
        Array.from({ length: 25 }, (_, index) => `First scan row ${index + 1}`)
      );

      await db.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,26)',
        [scans.first]
      );
      await db.query(
        'UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1',
        [policies.second]
      );
      await db.query(
        'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,1,$2,$3::jsonb)',
        [scans.inserted, town, JSON.stringify(listing('Inserted after cursor'))]
      );
      const second = await checks.localListings(
        town,
        0,
        '',
        false,
        '',
        true,
        first.nextCursor
      );
      assert.deepEqual(
        second.listings.map((item) => item.name),
        ['Inserted after cursor']
      );
      assert.equal(second.hasMore, false);
    } finally {
      await db.destroy();
    }
  }
);

// Reviewed-address bounds search under concurrent writers (S5 item 2, slice 5). Non-snapshot semantics:
// each page is one statement and so one snapshot; between pages the live tables are re-read.
const { performance } = require('node:perf_hooks');
const h = require('./reviewed-spatial-helpers');
const {
  reconcile,
} = require('../../../scripts/local-directory-reviewed-spatial-reconcile.cjs');

const boundsTown = '55555555-5555-4555-8555-555555555555';
const boundsBox = '-83.1,30.9,-82.9,31.1';
const bScan = h.unique();
async function boundsWorld(run, readers = 10) {
  const db = await h.connect(url, readers + 5);
  try {
    await h.reset(db, [boundsTown]);
    await h.scan(db, bScan, h.policy('c'));
    return await run(db);
  } finally {
    await db.destroy();
  }
}
async function boundsReady(db) {
  assert.equal((await reconcile(db, { apply: true })).completed, true);
  return h.checks(pendingChecks, db, boundsTown);
}
const placeNames = (rows) => rows.map((n) => `Place ${n}`);

test(
  'bounds pages re-read live state between pages: removals vanish, a later confirmation appears, an earlier one waits for a restart',
  { skip: !url },
  () =>
    boundsWorld(async (db) => {
      await h.bulk(db, { scan: bScan, town: boundsTown, from: 1, count: 60 });
      const checks = await boundsReady(db);
      const first = await checks.localListings(
        boundsTown,
        0,
        '',
        false,
        '',
        true,
        '',
        undefined,
        boundsBox
      );
      assert.deepEqual(
        first.listings.map((x) => x.name),
        placeNames(Array.from({ length: 25 }, (_, i) => i + 1))
      );
      await h.suspend(db, bScan, 40);
      await h.suspend(db, bScan, 41); // retired rows leave the same way: state change plus projection delete
      await db.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,42)',
        [bScan]
      );
      await db.query(
        `UPDATE directory_reviewed_binding SET "verifiedUntil"=now()-interval '1 second' WHERE "scanId"=$1 AND "sourceFileRowNumber"=43`,
        [bScan]
      );
      await h.bulk(db, { scan: bScan, town: boundsTown, from: 70, count: 1 }); // after the cursor
      await h.bulk(db, { scan: bScan, town: boundsTown, from: 0, count: 1 }); // before the cursor
      const rest = [];
      let cursor = first.nextCursor;
      for (;;) {
        const page = await checks.localListings(
          boundsTown,
          0,
          '',
          false,
          '',
          true,
          cursor,
          undefined,
          boundsBox
        );
        rest.push(...page.listings.map((x) => x.name));
        if (!page.hasMore) break;
        cursor = page.nextCursor;
      }
      const expected = [
        ...Array.from({ length: 14 }, (_, i) => i + 26),
        ...Array.from({ length: 17 }, (_, i) => i + 44),
        70,
      ];
      assert.deepEqual(rest, placeNames(expected));
      assert.ok(!rest.includes('Place 0'));
      const restart = await h.traverse(checks, boundsTown, boundsBox);
      assert.equal(restart.names[0], 'Place 0');
      assert.equal(new Set(restart.names).size, restart.names.length);
    })
);

test(
  'withdrawing the 26th row after page one leaves an empty final page with no cursor',
  { skip: !url },
  () =>
    boundsWorld(async (db) => {
      await h.bulk(db, { scan: bScan, town: boundsTown, from: 1, count: 26 });
      const checks = await boundsReady(db);
      const first = await checks.localListings(
        boundsTown,
        0,
        '',
        false,
        '',
        true,
        '',
        undefined,
        boundsBox
      );
      assert.equal(first.listings.length, 25);
      assert.equal(first.hasMore, true);
      await h.suspend(db, bScan, 26);
      const second = await checks.localListings(
        boundsTown,
        0,
        '',
        false,
        '',
        true,
        first.nextCursor,
        undefined,
        boundsBox
      );
      assert.deepEqual(second.listings, []);
      assert.equal(second.hasMore, false);
      assert.equal(second.nextCursor, null);
    })
);

test(
  'a reader never sees an uncommitted confirmation, and sees it once committed',
  { skip: !url },
  () =>
    boundsWorld(async (db) => {
      await h.bulk(db, { scan: bScan, town: boundsTown, from: 1, count: 2 });
      await h.bulk(db, {
        scan: bScan,
        town: boundsTown,
        from: 3,
        count: 1,
        state: 'pending',
      });
      const checks = await boundsReady(db);
      const writer = db.createQueryRunner();
      await writer.connect();
      await writer.startTransaction();
      try {
        await writer.query(
          `UPDATE directory_reviewed_binding SET state='active',"verifiedAt"=now(),"verifiedUntil"=now()+interval '1 day' WHERE "scanId"=$1 AND "sourceFileRowNumber"=3`,
          [bScan]
        );
        await writer.query(h.projectionSql(), [bScan, 3, 3]);
        const during = await h.traverse(checks, boundsTown, boundsBox);
        assert.deepEqual(during.names, placeNames([1, 2]));
        await writer.commitTransaction();
      } catch (error) {
        await writer.rollbackTransaction();
        throw error;
      } finally {
        await writer.release();
      }
      assert.deepEqual(
        (await h.traverse(checks, boundsTown, boundsBox)).names,
        placeNames([1, 2, 3])
      );
    })
);

test(
  '20 readers paging while a writer toggles 200 bindings: no inactive row served, no duplicates, no errors',
  { skip: !url },
  () =>
    boundsWorld(async (db) => {
      const rows = Array.from({ length: 200 }, (_, i) => i + 1);
      await h.bulk(db, { scan: bScan, town: boundsTown, from: 1, count: 200 });
      const checks = await boundsReady(db);
      // inactive[n] holds [start,end] windows during which binding n was certainly not active.
      const inactive = new Map(rows.map((n) => [n, []]));
      const open = new Map();
      let stop = false,
        toggles = 0;
      const writer = (async () => {
        while (!stop) {
          const n = 1 + Math.floor(Math.random() * 200);
          if (open.has(n)) {
            const start = open.get(n);
            const end = performance.now();
            await h.confirm(db, bScan, n);
            inactive.get(n).push([start, end]);
            open.delete(n);
          } else {
            await h.suspend(db, bScan, n);
            open.set(n, performance.now());
          }
          toggles += 1;
        }
      })();
      const violations = [],
        errors = [];
      let requests = 0,
        traversals = 0;
      const reader = async () => {
        while (!stop) {
          const seen = new Set();
          let cursor = '';
          for (;;) {
            const t0 = performance.now();
            let page;
            try {
              page = await checks.localListings(
                boundsTown,
                0,
                '',
                false,
                '',
                true,
                cursor,
                undefined,
                boundsBox
              );
            } catch (error) {
              errors.push(error.message);
              break;
            }
            const t1 = performance.now();
            requests += 1;
            for (const item of page.listings) {
              const n = Number(item.name.slice(6));
              if (seen.has(n)) violations.push(`duplicate ${n}`);
              seen.add(n);
              if (
                inactive.get(n).some(([a, b]) => t0 >= a && t1 <= b) ||
                (open.has(n) && t0 >= open.get(n))
              )
                violations.push(`inactive ${n}`);
            }
            if (!page.hasMore) break;
            cursor = page.nextCursor;
          }
          traversals += 1;
        }
      };
      setTimeout(() => {
        stop = true;
      }, 5000);
      await Promise.all([writer, ...Array.from({ length: 20 }, reader)]);
      console.log(
        JSON.stringify({
          concurrency: { toggles, requests, traversals, errors: errors.length },
        })
      );
      assert.ok(toggles > 50 && requests > 100, 'the load actually ran');
      assert.deepEqual(violations, []);
      assert.deepEqual(errors, []);
    }, 20)
);

// Performance sanity. Opt in with S5_SPATIAL_PERF=1 and S5_SPATIAL_PERF_DATABASE_URL (directory_spatial_test_*).
const perfUrl = process.env.S5_SPATIAL_PERF
  ? h.databaseUrl(
      'S5_SPATIAL_PERF_DATABASE_URL',
      /^\/directory_spatial_test_[a-z0-9_]+$/i
    )
  : null;
test(
  'performance: 400,000 imported rows, 60,000 reviewed; dense town pages stay index-driven and fast',
  { skip: !perfUrl, timeout: 600000 },
  async () => {
    const db = await h.connect(perfUrl, 4);
    try {
      const towns = Array.from(
        { length: 20 },
        (_, i) => `66666666-6666-4666-8666-${String(i + 1).padStart(12, '0')}`
      );
      await h.reset(db, towns);
      await h.scan(db, bScan, h.policy('c'));
      let next = 1;
      for (const [i, t] of towns.entries()) {
        const reviewed = i === 0 ? 30000 : Math.floor(30000 / 19);
        const imported = i === 0 ? 120000 : 14000;
        await h.bulk(db, {
          scan: bScan,
          town: t,
          from: next,
          count: reviewed,
          lng: -83,
          lat: 31,
          step: 0.001,
          cols: 200,
        });
        next += reviewed;
        await h.plain(db, {
          scan: bScan,
          town: t,
          from: next,
          count: imported,
          lng: -83,
          lat: 31,
          step: 0.001,
          cols: 200,
        });
        next += imported;
      }
      for (const t of [
        'directory_overture_private_row',
        'directory_reviewed_spatial',
        'directory_reviewed_binding',
        'directory_overture_private_membership',
      ])
        await db.query(`ANALYZE ${t}`);
      const counts = (
        await db.query(
          `SELECT (SELECT count(*)::int FROM directory_overture_private_row) AS imported,(SELECT count(*)::int FROM directory_reviewed_spatial) AS projected`
        )
      )[0];
      assert.ok(
        counts.imported >= 390000 && counts.projected >= 59000,
        JSON.stringify(counts)
      );
      assert.equal((await reconcile(db, { apply: true })).completed, true);
      const dense = towns[0];
      let captured;
      const spy = new Proxy(db, {
        get(target, key) {
          if (key === 'transaction') {
            return (iso, fn) =>
              target.transaction(iso, (manager) =>
                fn(
                  new Proxy(manager, {
                    get(m, k) {
                      if (k === 'query')
                        return (sql, params) => {
                          if (sql.includes('directory_reviewed_spatial sp'))
                            captured = { sql, params };
                          return m.query(sql, params);
                        };
                      const v = m[k];
                      return typeof v === 'function' ? v.bind(m) : v;
                    },
                  })
                )
              );
          }
          const v = target[key];
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
      const checks = h.checks(pendingChecks, spy, dense);
      const report = { rows: counts };
      const walk = (node, out) => {
        if (
          node['Node Type'] === 'Seq Scan' &&
          [
            'directory_overture_private_row',
            'directory_reviewed_spatial',
          ].includes(node['Relation Name'])
        )
          out.push(node['Relation Name']);
        (node.Plans || []).forEach((c) => walk(c, out));
        return out;
      };
      for (const [label, area] of [
        ['2deg', '-84,30,-82,32'],
        ['0.02deg', '-83,31,-82.98,31.02'],
      ]) {
        // First page, a page from the middle of the walk, and the last page.
        const pages = [];
        let cursor = '';
        for (;;) {
          const page = await checks.localListings(
            dense,
            0,
            '',
            false,
            '',
            true,
            cursor,
            undefined,
            area
          );
          pages.push(cursor);
          if (!page.hasMore) break;
          cursor = page.nextCursor;
        }
        const picks = {
          first: pages[0],
          middle: pages[Math.floor(pages.length / 2)],
          last: pages[pages.length - 1],
        };
        for (const [where, at] of Object.entries(picks)) {
          const times = [];
          for (let i = 0; i < 50; i += 1) {
            const t = performance.now();
            await checks.localListings(
              dense,
              0,
              '',
              false,
              '',
              true,
              at,
              undefined,
              area
            );
            times.push(performance.now() - t);
          }
          times.sort((a, b) => a - b);
          const plan = await db.query(
            `EXPLAIN (ANALYZE, FORMAT JSON) ${captured.sql}`,
            captured.params
          );
          const root = plan[0]['QUERY PLAN'][0];
          const scans = walk(root.Plan, []);
          report[`${label}/${where}`] = {
            pages: pages.length,
            p50: +times[24].toFixed(1),
            p95: +times[47].toFixed(1),
            max: +times[49].toFixed(1),
            executionMs: root['Execution Time'],
            seqScans: scans,
          };
          assert.deepEqual(scans, [], `${label}/${where} must not seq scan`);
          assert.ok(times[47] < 150, `${label}/${where} p95 ${times[47]}`);
        }
      }
      const t = performance.now();
      const full = await h.traverse(checks, dense, '-84,30,-82,32');
      report.fullTraversal = {
        rows: full.names.length,
        pages: full.pages,
        seconds: +((performance.now() - t) / 1000).toFixed(1),
      };
      assert.equal(full.names.length, 30000);
      console.log(JSON.stringify({ performance: report }));
    } finally {
      await db.destroy();
    }
  }
);
