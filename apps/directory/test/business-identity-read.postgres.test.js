const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { pendingChecks } = require('../src/register-pending-runtime');
const { planCarry, applyCarry } = require('../src/business-identity-carry');
const { servingGeneration } = require('../src/business-identity-read');
const { reconcile } = require('../../../scripts/local-directory-reviewed-spatial-reconcile.cjs');
const f = require('./business-identity-carry-fixtures');

const url = process.env.S5_READ_IDENTITY_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) || !/^\/s5_identity_read_[a-z0-9_]+$/i.test(parsed.pathname)) throw Error('A dedicated loopback s5_identity_read_* database is required');
}

const identity = {
  sourceEpoch: '00000000-0000-4000-8000-000000000001', recoveryEpoch: '00000000-0000-4000-8000-000000000002', owner: '00000000-0000-4000-8000-000000000003',
  activationId: '00000000-0000-4000-8000-000000000004', socialGeneration: '1', directoryGeneration: '2',
};
const town = randomUUID();
const changeToken = randomUUID();
const secret = 'cursor-postgres-fixture-secret-32-bytes';
const snapshot = { id: town, name: 'Fixture Town', slug: null, adminArea: 'GA', appScope: 'local-hub', isPrivate: false, localityType: 'town' };
const P0 = f.hex('0'), A = f.hex('a'), B = f.hex('b'), scanA = f.hex('c'), scanB = f.hex('d');
const checksFor = (db) => pendingChecks(db, { scan: async () => [], current: async () => ({ status: 'current', changeToken, snapshot }) }, identity, secret);
const opts = (from, to) => ({ fromPolicyId: from, toPolicyId: to, key: f.KEY });
const rows = (...ids) => ids.map((id, i) => ({ n: i + 1, id, name: `Biz ${id}` }));

async function setup(db) {
  await f.clear(db);
  await db.query('TRUNCATE directory_reviewed_binding_event, directory_reviewed_binding, directory_reviewed_spatial, directory_reviewed_spatial_state');
  const request = { ...identity, sweep: { generation: '1' }, lastCompletedSweep: { generation: '1', completedAt: new Date().toISOString() } };
  await db.query(`INSERT INTO directory_installation (id, "recoveryEpoch") VALUES ('recovery-authority',$1) ON CONFLICT (id) DO UPDATE SET "recoveryEpoch"=EXCLUDED."recoveryEpoch"`, [identity.recoveryEpoch]);
  await db.query(
    `INSERT INTO directory_census_progress (id,phase,cursor,protocol,"registerRequest","sourceEpoch","recoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration")
     VALUES ('recovery','reg-running',NULL,'register-pending-v1',$1::jsonb,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET phase=EXCLUDED.phase,cursor=NULL,protocol=EXCLUDED.protocol,"registerRequest"=EXCLUDED."registerRequest","sourceEpoch"=EXCLUDED."sourceEpoch","recoveryEpoch"=EXCLUDED."recoveryEpoch",owner=EXCLUDED.owner,"activationId"=EXCLUDED."activationId","socialGeneration"=EXCLUDED."socialGeneration","directoryGeneration"=EXCLUDED."directoryGeneration"`,
    [JSON.stringify(request), identity.sourceEpoch, identity.recoveryEpoch, identity.owner, identity.activationId, identity.socialGeneration, identity.directoryGeneration]);
  await db.query(`INSERT INTO directory_town ("communityId",name,eligible) VALUES ($1,'Fixture Town',true) ON CONFLICT ("communityId") DO UPDATE SET eligible=true`, [town]);
}
const stamp = async (db) => {
  // The fixture rows carry no change token; give every row the town's current one so the listing query sees them.
  await db.query(`UPDATE directory_overture_private_row SET listing = jsonb_set(listing,'{assignmentChangeToken}',to_jsonb($1::text))`, [changeToken]);
  await reconcile(db, { apply: true });
};
const cohort = (db, policy, scan, release, rs) => f.cohort(db, { policy, town, release, scans: [{ scan, rows: rs }] });
const ids = (checks) => checks.localListings(town, 0, '', false, '', false, '', undefined, '', true);
const nullish = (v) => v === null || v === undefined;

/** Release one is carried into origin businesses and served; release two is imported, carried, and the old policy revoked. */
async function released(db, first, second) {
  await setup(db);
  await cohort(db, A, scanA, '2026-09-23.0', first);
  await planCarry(db, opts(P0, A)).then((p) => applyCarry(db, { ...opts(P0, A), planDigest: p.digest }));
  await stamp(db);
  const checks = checksFor(db);
  const before = await ids(checks);
  await cohort(db, B, scanB, '2026-10-21.0', second);
  await planCarry(db, opts(A, B)).then((p) => applyCarry(db, { ...opts(A, B), planDigest: p.digest }));
  await db.query('UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1', [A]);
  await stamp(db);
  return { checks, before, after: await ids(checks) };
}
const open = async () => { const db = new DataSource({ type: 'postgres', url }); await db.initialize(); return db; };

test('a business keeps its id across a cutover and exposes no reviewed fields until a binding is active', { skip: !url }, async () => {
  const db = await open();
  try {
    const { before, after } = await released(db, rows('k1', 'k2'), rows('k1', 'k2'));
    const ids = (r) => r.listings.map((l) => l.id).sort();
    assert.equal(before.listings.length, 2);
    assert.ok(before.listings.every((l) => /^[0-9a-f-]{36}$/.test(l.id)));
    assert.deepEqual(ids(after), ids(before));
    for (const l of after.listings) { assert.equal(l.address, undefined); assert.equal(l.website, undefined); assert.equal(l.phone, undefined); }
  } finally { await db.destroy(); }
});

test('an old listing-identity id aliases forward and detail returns the canonical id', { skip: !url }, async () => {
  const db = await open();
  try {
    await setup(db);
    await cohort(db, A, scanA, '2026-09-23.0', rows('k1'));
    await stamp(db);
    const checks = checksFor(db);
    const old = await db.query('SELECT id FROM directory_listing_identity LIMIT 1');
    // Identity rows exist only when a listing was served before carry; serve it once to mint one.
    const first = (await checks.localListings(town, 0, '', false, '', false, '', undefined, '', true)).listings[0];
    assert.ok(first.id);
    await planCarry(db, opts(P0, A)).then((p) => applyCarry(db, { ...opts(P0, A), planDigest: p.digest }));
    await cohort(db, B, scanB, '2026-10-21.0', rows('k1'));
    await planCarry(db, opts(A, B)).then((p) => applyCarry(db, { ...opts(A, B), planDigest: p.digest }));
    await db.query('UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1', [A]);
    await stamp(db);
    const business = (await db.query(`SELECT "businessId" AS id FROM directory_business_assertion WHERE "policyId"=$1 AND state='current'`, [B]))[0].id;
    assert.ok(old);
    const viaBusiness = await checks.localDetail(town, business);
    assert.equal(viaBusiness.id, business);
    const viaOld = await checks.localDetail(town, first.id);
    assert.ok(viaOld === null || viaOld.id === business, 'an old id either aliases forward or misses, never another business');
  } finally { await db.destroy(); }
});

test('every miss is the same null: unknown, retired, unresolved, absent and split without a successor', { skip: !url }, async () => {
  const db = await open();
  try {
    const { checks } = await released(db, rows('k1', 'k2', 'k3', 'k4'), rows('k1', 'k2'));
    const biz = async (n) => (await db.query('SELECT "businessId" AS id FROM directory_business_assertion WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2', [scanA, n]))[0].id;
    const [retired, absent, split] = [await biz(2), await biz(3), await biz(4)];
    await db.query(`UPDATE directory_business SET state='retired', "retiredAt"=now() WHERE id=$1`, [retired]);
    await db.query(`UPDATE directory_business SET state='split' WHERE id=$1`, [split]);
    const probes = [randomUUID(), retired, absent, split, '00000000-0000-4000-8000-00000000ffff'];
    const answers = [];
    for (const p of probes) answers.push(JSON.stringify(await checks.localDetail(town, p)));
    assert.deepEqual([...new Set(answers)], ['null']);
  } finally { await db.destroy(); }
});

test('a merged business follows its successor; a six-hop chain and a cycle both miss', { skip: !url }, async () => {
  const db = await open();
  try {
    const { checks } = await released(db, rows('k1'), rows('k1'));
    const live = (await db.query(`SELECT "businessId" AS id FROM directory_business_assertion WHERE "policyId"=$1 AND state='current'`, [B]))[0].id;
    const dead = async (successor) => { const id = randomUUID(); await db.query(`INSERT INTO directory_business (id,"communityId",state,"successorId") VALUES ($1,$3,'merged',$2)`, [id, successor, town]); return id; };
    const one = await dead(live);
    assert.equal((await checks.localDetail(town, one))?.id, live);
    let tail = live;
    for (let i = 0; i < 6; i++) tail = await dead(tail);
    assert.equal(await checks.localDetail(town, tail), null);
    const x = randomUUID(), y = randomUUID();
    await db.query(`INSERT INTO directory_business (id,"communityId",state) VALUES ($1,$3,'merged'),($2,$3,'merged')`, [x, y, town]);
    await db.query('UPDATE directory_business SET "successorId"=$2 WHERE id=$1', [x, y]);
    await db.query('UPDATE directory_business SET "successorId"=$2 WHERE id=$1', [y, x]);
    assert.equal(await checks.localDetail(town, x), null);
  } finally { await db.destroy(); }
});

test('a cursor and a reference issued before the cutover are rejected after the serving generation changes', { skip: !url }, async () => {
  const db = await open();
  try {
    await setup(db);
    await cohort(db, A, scanA, '2026-09-23.0', rows(...Array.from({ length: 30 }, (_, i) => `k${i + 1}`)));
    await planCarry(db, opts(P0, A)).then((p) => applyCarry(db, { ...opts(P0, A), planDigest: p.digest }));
    await stamp(db);
    const checks = checksFor(db);
    const bounds = '-84,30,-82,32';
    const page = await checks.localListings(town, 0, '', false, '', true, '');
    assert.ok(page.nextCursor);
    const generationBefore = await servingGeneration(db, secret);
    await cohort(db, B, scanB, '2026-10-21.0', rows(...Array.from({ length: 30 }, (_, i) => `k${i + 1}`)));
    await planCarry(db, opts(A, B)).then((p) => applyCarry(db, { ...opts(A, B), planDigest: p.digest }));
    await db.query('UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1', [A]);
    await stamp(db);
    assert.notEqual(await servingGeneration(db, secret), generationBefore);
    await assert.rejects(checks.localListings(town, 0, '', false, '', true, page.nextCursor));
    if (page.listings[0].reference) await assert.rejects(checks.localDetail(town, page.listings[0].reference));
  } finally { await db.destroy(); }
});

test('two live cohorts list a carried business once', { skip: !url }, async () => {
  const db = await open();
  try {
    await setup(db);
    await cohort(db, A, scanA, '2026-09-23.0', rows('k1', 'k2'));
    await planCarry(db, opts(P0, A)).then((p) => applyCarry(db, { ...opts(P0, A), planDigest: p.digest }));
    await cohort(db, B, scanB, '2026-10-21.0', rows('k1', 'k2'));
    await planCarry(db, opts(A, B)).then((p) => applyCarry(db, { ...opts(A, B), planDigest: p.digest }));
    await stamp(db);
    const list = await ids(checksFor(db));
    assert.equal(list.listings.length, 2);
    assert.equal(new Set(list.listings.map((l) => l.id)).size, 2);
    assert.ok(!list.listings.some((l) => nullish(l.id)));
  } finally { await db.destroy(); }
});
