const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { pendingChecks } = require('../src/register-pending-runtime');
const { reconcile } = require('../../../scripts/local-directory-reviewed-spatial-reconcile.cjs');
const h = require('./reviewed-spatial-helpers');

const url = h.databaseUrl('S5_SPATIAL_TEST_DATABASE_URL', /^\/directory_spatial_test_[a-z0-9_]+$/i);
const town = '22222222-2222-4222-8222-222222222222';
const scanId = h.unique();

async function world(run) {
  const db = await h.connect(url);
  try {
    await h.reset(db, [town]);
    await h.scan(db, scanId, h.policy('c'));
    return await run(db);
  } finally {
    await db.destroy();
  }
}

/** Rows 1-5 active and projected, then five different kinds of drift. */
async function drifted(db) {
  await h.bulk(db, { scan: scanId, town, from: 1, count: 5 });
  await h.bulk(db, { scan: scanId, town, from: 6, count: 1, state: 'suspended' });
  await h.bulk(db, { scan: scanId, town, from: 7, count: 1, state: 'pending' });
  await db.query('DELETE FROM directory_reviewed_spatial WHERE "sourceFileRowNumber"=1'); // missing insert
  await db.query(`UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{name}','"Renamed"') WHERE "scanId"=$1 AND "sourceFileRowNumber"=2`, [scanId]); // stale digest (and, below, row 5's token change is stale too)
  await db.query(`UPDATE directory_reviewed_binding SET state='suspended',"stateCause"='lease_expired',"suspendedAt"=now(),"verifiedUntil"=NULL WHERE "scanId"=$1 AND "sourceFileRowNumber"=3`, [scanId]); // orphan: missed delete
  await db.query(`UPDATE directory_overture_private_row SET listing=listing-'assignmentChangeToken' WHERE "scanId"=$1 AND "sourceFileRowNumber"=5`, [scanId]); // superseded token
}
const checksum = async (db, tables) => {
  const out = [];
  for (const t of tables) out.push((await db.query(`SELECT md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) AS h FROM ${t} x`))[0].h);
  return out.join(':');
};
const READ = ['directory_reviewed_spatial', 'directory_reviewed_spatial_state'];
const AUTH = ['directory_reviewed_binding', 'directory_overture_private_row'];

test('check counts every kind of drift and writes nothing', { skip: !url }, () => world(async (db) => {
  await drifted(db);
  const before = await checksum(db, [...READ, ...AUTH]);
  const result = await reconcile(db);
  assert.equal(result.apply, false);
  assert.deepEqual(
    { missing: result.missing, stale: result.stale, orphaned: result.orphaned, versionMismatch: result.versionMismatch, unreachableAssignment: result.unreachableAssignment },
    { missing: 1, stale: 2, orphaned: 1, versionMismatch: 0, unreachableAssignment: 1 },
  );
  assert.equal(await checksum(db, [...READ, ...AUTH]), before);
}));

test('apply repairs missing, stale and orphaned rows, records the state, and a rerun is a no-op', { skip: !url }, () => world(async (db) => {
  await drifted(db);
  const authority = await checksum(db, AUTH);
  const result = await reconcile(db, { apply: true });
  assert.equal(result.completed, true);
  assert.deepEqual({ missing: result.missing, stale: result.stale, orphaned: result.orphaned }, { missing: 0, stale: 0, orphaned: 0 });
  assert.equal(result.deleted, 1);
  // Rows 1, 2, 4, 5 are projected; 3 (suspended after projection), 6 (suspended) and 7 (pending) are not.
  const rows = await db.query('SELECT "sourceFileRowNumber" AS n FROM directory_reviewed_spatial ORDER BY 1');
  assert.deepEqual(rows.map((r) => r.n), ['1', '2', '4', '5']);
  const [state] = await db.query('SELECT "validatorVersion","rebuildCompletedAt","reconciledAt",missing,stale,orphaned FROM directory_reviewed_spatial_state WHERE id=\'current\'');
  assert.equal(state.validatorVersion, 1);
  assert.ok(state.rebuildCompletedAt && state.reconciledAt);
  // It never touches a binding, a listing, a lease or a token.
  assert.equal(await checksum(db, AUTH), authority);
  // The superseded token is reported, not repaired.
  assert.equal(result.unreachableAssignment, 1);
  const stable = await checksum(db, ['directory_reviewed_spatial']);
  const again = await reconcile(db, { apply: true });
  assert.equal(again.projected, 0);
  assert.equal(again.deleted, 0);
  assert.equal(again.completed, true);
  assert.equal(await checksum(db, ['directory_reviewed_spatial']), stable);
}));

test('suspended and pending bindings stay unprojected and unrepaired', { skip: !url }, () => world(async (db) => {
  await h.bulk(db, { scan: scanId, town, from: 1, count: 2, state: 'suspended' });
  await h.bulk(db, { scan: scanId, town, from: 3, count: 2, state: 'pending' });
  const result = await reconcile(db, { apply: true });
  assert.equal(result.projected, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM directory_reviewed_spatial'))[0].n, 0);
  assert.equal(result.completed, true);
}));

test('an interrupted rebuild leaves the index not ready until a run completes', { skip: !url }, () => world(async (db) => {
  await drifted(db);
  await assert.rejects(reconcile(db, { apply: true, hooks: { afterBatch: async () => { throw Error('interrupted'); } } }), /interrupted/);
  const [state] = await db.query('SELECT "rebuildStartedAt","rebuildCompletedAt" FROM directory_reviewed_spatial_state WHERE id=\'current\'');
  assert.ok(state.rebuildStartedAt);
  assert.equal(state.rebuildCompletedAt, null);
  assert.equal((await h.checks(pendingChecks, db, town).spatialHealth()).ready, false);
  assert.equal((await reconcile(db, { apply: true })).completed, true);
  assert.equal((await h.checks(pendingChecks, db, town).spatialHealth()).ready, true);
}));

test('readiness catches a known failure: deleting one row, or a version mismatch, makes it not ready', { skip: !url }, () => world(async (db) => {
  await h.bulk(db, { scan: scanId, town, from: 1, count: 3 });
  await reconcile(db, { apply: true });
  const ok = await h.checks(pendingChecks, db, town).spatialHealth();
  assert.deepEqual({ ready: ok.ready, missing: ok.missing, validatorVersion: ok.validatorVersion }, { ready: true, missing: 0, validatorVersion: 1 });
  assert.ok(ok.rebuildCompletedAt);
  await db.query('DELETE FROM directory_reviewed_spatial WHERE "sourceFileRowNumber"=2');
  const gone = await h.checks(pendingChecks, db, town).spatialHealth();
  assert.deepEqual({ ready: gone.ready, missing: gone.missing }, { ready: false, missing: 1 });
  await reconcile(db, { apply: true });
  await db.query(`UPDATE directory_reviewed_spatial_state SET "validatorVersion"=0`);
  assert.equal((await h.checks(pendingChecks, db, town).spatialHealth()).ready, false);
  await db.query(`UPDATE directory_reviewed_spatial_state SET "validatorVersion"=1`);
  await db.query('UPDATE directory_reviewed_spatial SET "validatorVersion"=0');
  assert.equal((await h.checks(pendingChecks, db, town).spatialHealth()).ready, false);
}));

test('the command defaults to a read-only check and refuses --apply without the matching database name', { skip: !url }, () => world(async (db) => {
  await drifted(db);
  const env = { ...process.env, DIRECTORY_DATABASE_URL: url, TS_NODE_PROJECT: 'apps/directory/tsconfig.json' };
  const run = (...args) => spawnSync(process.execPath, ['-r', 'ts-node/register/transpile-only', 'scripts/local-directory-reviewed-spatial-reconcile.cjs', ...args], { env, encoding: 'utf8' });
  const before = await checksum(db, READ);
  const dry = run();
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(JSON.parse(dry.stdout).apply, false);
  assert.equal(await checksum(db, READ), before);
  assert.notEqual(run('--apply').status, 0);
  assert.notEqual(run('--apply', '--confirm-database', 'ot_directory').status, 0);
  assert.equal(await checksum(db, READ), before);
  const applied = run('--apply', '--confirm-database', new URL(url).pathname.slice(1));
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).completed, true);
}));
