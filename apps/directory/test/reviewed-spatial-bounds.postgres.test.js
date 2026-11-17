const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pendingChecks } = require('../src/register-pending-runtime');
const { mappableReviewed } = require('../src/reviewed-spatial');
const { reconcile } = require('../../../scripts/local-directory-reviewed-spatial-reconcile.cjs');
const h = require('./reviewed-spatial-helpers');

const url = h.databaseUrl('S5_SPATIAL_TEST_DATABASE_URL', /^\/directory_spatial_test_[a-z0-9_]+$/i);
const town = '33333333-3333-4333-8333-333333333333';
const otherTown = '44444444-4444-4444-8444-444444444444';
const scanId = h.unique();
const box = '-83.1,30.9,-82.9,31.1';
const day = h.DAY;

async function world(run) {
  const db = await h.connect(url);
  try {
    await h.reset(db, [town, otherTown]);
    await h.scan(db, scanId, h.policy('c'));
    return await run(db);
  } finally {
    await db.destroy();
  }
}
async function ready(db) {
  const result = await reconcile(db, { apply: true });
  assert.equal(result.completed, true);
  return h.checks(pendingChecks, db, town);
}

/**
 * The old bounds result, computed from the live tables alone: every reviewed row with an active lease and a
 * current token, in key order, filtered in JS by the shared validator and the inclusive box. No projection.
 */
async function oracle(db, boxValue, adult = false) {
  const [west, south, east, north] = boxValue.split(',').map(Number);
  const rows = await db.query(
    `SELECT r.listing FROM directory_overture_private_row r
     JOIN directory_overture_private_membership m ON m."scanId"=r."scanId"
     JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false
     JOIN directory_overture_private_completion c ON c."scanId"=r."scanId"
     WHERE r."regionId"=$1 AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=r."scanId")
       AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")
       AND (NOT (r.listing ? 'adult') OR r.listing->'adult'='false'::jsonb OR ($2::boolean AND r.listing->'adult'='true'::jsonb))
       AND r.listing->>'assignmentChangeToken'=$3
       AND EXISTS (SELECT 1 FROM directory_reviewed_binding b WHERE b."scanId"=r."scanId" AND b."sourceFileRowNumber"=r."sourceFileRowNumber" AND b.state='active' AND b."verifiedUntil">now())
     ORDER BY r."scanId",r."sourceFileRowNumber"`, [town, adult, h.token]);
  return rows.map((r) => r.listing).filter((l) => {
    const m = mappableReviewed(l);
    return m && m.coordinates[0] >= west && m.coordinates[0] <= east && m.coordinates[1] >= south && m.coordinates[1] <= north;
  }).map((l) => l.name);
}

test('parity: bounds pages equal the old JS-filtered result on a mixed fixture, in order, each row once', { skip: !url }, () => world(async (db) => {
  const a = { scan: scanId, town };
  await h.bulk(db, { ...a, from: 1, count: 100 }); // mappable, in box
  await h.bulk(db, { ...a, from: 101, count: 50, address: false }); // website only
  await h.bulk(db, { ...a, from: 151, count: 50, lng: -70 }); // mappable, outside box
  await h.bulk(db, { ...a, from: 201, count: 30, state: 'pending' });
  await h.bulk(db, { ...a, from: 231, count: 20, state: 'suspended' });
  await h.bulk(db, { ...a, from: 251, count: 20, until: new Date(Date.now() - day) }); // expired lease
  await h.bulk(db, { ...a, from: 271, count: 10, adult: true });
  await h.bulk(db, { ...a, from: 281, count: 10, assignment: h.randomUUID(), tokenOnBinding: h.token }); // old token
  await h.plain(db, { ...a, from: 291, count: 10 }); // unreviewed, in box
  // Rows exactly on the west edge of a tight box: the inclusive test must agree with the oracle.
  const edge = '-83,31,-82.995,31.0003';
  const checks = await ready(db);
  for (const value of [box, edge, '-84,30,-82,32']) {
    const expected = await oracle(db, value);
    const got = await h.traverse(checks, town, value);
    assert.deepEqual(got.names, expected, value);
    assert.equal(new Set(got.names).size, got.names.length);
  }
  assert.equal((await oracle(db, box)).length, 100);
  assert.equal((await h.traverse(checks, town, box)).pages, 4);
  const withAdult = await h.traverse(checks, town, box, { adult: true });
  assert.deepEqual(withAdult.names, await oracle(db, box, true));
  assert.equal(withAdult.names.length, 110);
}));

test('hasMore is decided after validation: 25 mappable among 40 website-only and 500 unreviewed rows is one page', { skip: !url }, () => world(async (db) => {
  const a = { scan: scanId, town };
  await h.bulk(db, { ...a, from: 1, count: 25 });
  await h.bulk(db, { ...a, from: 26, count: 40, address: false });
  await h.plain(db, { ...a, from: 100, count: 500 });
  const checks = await ready(db);
  const page = await checks.localListings(town, 0, '', false, '', true, '', undefined, box);
  assert.equal(page.listings.length, 25);
  assert.equal(page.hasMore, false);
  assert.equal(page.nextCursor, null);
  // Interleaved so a mappable row sits behind the invalid ones in key order.
  await h.bulk(db, { ...a, from: 700, count: 1 });
  const again = await ready(db);
  const first = await again.localListings(town, 0, '', false, '', true, '', undefined, box);
  assert.equal(first.listings.length, 25);
  assert.equal(first.hasMore, true);
  const second = await again.localListings(town, 0, '', false, '', true, first.nextCursor, undefined, box);
  assert.deepEqual(second.listings.map((x) => x.name), ['Place 700']);
  assert.equal(second.hasMore, false);
}));

test('cap regression: 6,000 in-box reviewed rows paginate to exhaustion with no error', { skip: !url }, () => world(async (db) => {
  await h.bulk(db, { scan: scanId, town, from: 1, count: 6000, cols: 200 });
  const checks = await ready(db);
  const got = await h.traverse(checks, town, box);
  assert.equal(got.pages, 240);
  assert.equal(got.names.length, 6000);
  assert.equal(new Set(got.names).size, 6000);
  assert.equal(got.last.hasMore, false);
}));

test('each exclusion removes its row, and nothing else', { skip: !url }, () => world(async (db) => {
  const b = (from, o = {}) => h.bulk(db, { scan: scanId, town, from, count: 1, ...o });
  const names = (rows) => rows.map((n) => `Place ${n}`);
  await b(1); await b(2); await b(3); // controls
  const cases = {};
  for (const [i, name] of ['expired', 'suspended', 'pending', 'rowRevoked', 'scanRevoked', 'policyRevoked', 'wrongTown', 'movedTown', 'adult', 'noToken', 'oldToken', 'staleDigest'].entries()) cases[name] = 10 + i;
  await b(cases.expired); await b(cases.suspended); await b(cases.pending); await b(cases.rowRevoked);
  await b(cases.movedTown); await b(cases.adult, { adult: true }); await b(cases.noToken); await b(cases.oldToken); await b(cases.staleDigest);
  await h.bulk(db, { scan: scanId, town: otherTown, from: cases.wrongTown, count: 1 });
  const other = h.unique();
  await h.scan(db, other, h.policy('d'));
  await h.bulk(db, { scan: other, town, from: 1, count: 1 }); // policy revoked later
  const third = h.unique();
  await h.scan(db, third, h.policy('e'));
  await h.bulk(db, { scan: third, town, from: 1, count: 1 }); // scan revoked later
  const checks = await ready(db);
  const baseline = await h.traverse(checks, town, box);
  assert.equal(baseline.names.length, 13); // 3 controls + 8 mutable rows + the policy and scan siblings; adult and wrong town excluded
  const sql = (q, p) => db.query(q, p);
  const at = (n) => [scanId, n];
  await sql(`UPDATE directory_reviewed_binding SET "verifiedUntil"=now()-interval '1 minute' WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`, at(cases.expired));
  await sql(`UPDATE directory_reviewed_binding SET state='suspended',"stateCause"='lease_expired',"suspendedAt"=now(),"verifiedUntil"=NULL WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`, at(cases.suspended));
  await sql(`UPDATE directory_reviewed_binding SET state='pending',"verifiedAt"=NULL,"verifiedUntil"=NULL WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`, at(cases.pending));
  await sql('INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,$2)', at(cases.rowRevoked));
  await sql('INSERT INTO directory_overture_private_revocation ("scanId") VALUES ($1)', [third]);
  await sql('UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1', [h.policy('d')]);
  await sql('UPDATE directory_overture_private_row SET "regionId"=$3 WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2', [...at(cases.movedTown), otherTown]);
  // Token and digest cases: keep the digest honest so only the rule under test can exclude the row.
  await sql(`UPDATE directory_overture_private_row SET listing=listing-'assignmentChangeToken' WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`, at(cases.noToken));
  await sql(`UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{assignmentChangeToken}',to_jsonb($3::text)) WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`, [...at(cases.oldToken), h.randomUUID()]);
  await sql(`UPDATE directory_reviewed_spatial p SET "listingDigest"=md5(r.listing::text) FROM directory_overture_private_row r WHERE r."scanId"=p."scanId" AND r."sourceFileRowNumber"=p."sourceFileRowNumber"`);
  await sql(`UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{name}','"Edited"') WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`, at(cases.staleDigest));
  const fresh = h.checks(pendingChecks, db, town);
  assert.equal((await fresh.spatialHealth()).ready, true, 'the exclusions are query-time, not readiness');
  const after = await h.traverse(fresh, town, box);
  // Only the controls stand; the adult row needs the adult choice.
  assert.deepEqual(after.names, names([1, 2, 3]));
  const adult = await h.traverse(fresh, town, box, { adult: true });
  assert.deepEqual(adult.names, names([1, 2, 3, cases.adult]));
}));

test('not ready: bounds answers Spatial index unavailable while the plain listing still answers', { skip: !url }, () => world(async (db) => {
  await h.bulk(db, { scan: scanId, town, from: 1, count: 3 });
  await ready(db);
  await db.query('DELETE FROM directory_reviewed_spatial WHERE "sourceFileRowNumber"=2');
  const checks = h.checks(pendingChecks, db, town);
  await assert.rejects(checks.localListings(town, 0, '', false, '', true, '', undefined, box), /Spatial index unavailable/);
  const plain = await checks.localListings(town, 0, '', false, '', true);
  assert.equal(plain.listings.length, 3);
  const detail = await checks.localListings(town, 0);
  assert.equal(detail.listings.length, 3);
  // A request that cannot be answered completely never becomes a short answer: repairing restores it.
  assert.equal((await reconcile(db, { apply: true })).completed, true);
  const repaired = h.checks(pendingChecks, db, town);
  assert.equal((await h.traverse(repaired, town, box)).names.length, 3);
}));

test('unreviewed rows in the box never appear and their number changes no response byte', { skip: !url }, () => world(async (db) => {
  await h.bulk(db, { scan: scanId, town, from: 1, count: 60 });
  const checks = await ready(db);
  const pages = async () => {
    const out = [];
    let cursor = '';
    for (;;) {
      const page = await checks.localListings(town, 0, '', false, '', true, cursor, undefined, box);
      // References and cursors are sealed with a random nonce; everything else must be byte-identical.
      out.push(JSON.stringify({ ...page, nextCursor: undefined, listings: page.listings.map(({ reference, ...rest }) => rest) }));
      if (!page.hasMore) return out;
      cursor = page.nextCursor;
    }
  };
  const before = await pages();
  await h.plain(db, { scan: scanId, town, from: 1000, count: 700 });
  const after = await pages();
  assert.deepEqual(after, before);
  await h.plain(db, { scan: scanId, town, from: 5000, count: 1300 });
  assert.deepEqual(await pages(), before);
  assert.ok(!before.join('').includes('Plain '));
}));
