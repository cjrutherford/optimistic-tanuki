const { test } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../directory/src/data-source').default;
const { DirectoryReconciler: BaseReconciler } = require('../../directory/src/reconciliation');
class DirectoryReconciler extends BaseReconciler { constructor(db, read) { super(db, read, async (_event, id, sourceEpoch, eventNonce) => ({ status: 'pending', sourceEpoch, eventNonce, snapshot: await read(id) })); } }
const { censusPage } = require('../src/census');
const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const { randomUUID } = require('node:crypto');
const { initializeRecovery } = require('../../directory/src/recovery-authority');
const { configureReceiptPool } = require('../../directory/src/reconciliation');
let authority, nonces;
async function setup() { authority = await initializeRecovery(db, randomUUID(), randomUUID()); nonces = new Map(); await configureReceiptPool(db, 100); }
function identity(revision, communityId) { if (!nonces.has(revision)) nonces.set(revision, randomUUID()); return { revision, communityId, eventNonce: nonces.get(revision), sourceEpoch: authority.sourceEpoch, recoveryEpoch: authority.recoveryEpoch }; }
async function teardown() { await db.query("DELETE FROM directory_census_progress WHERE id='recovery'"); await db.query("DELETE FROM directory_installation WHERE id='recovery-authority'"); }


test('census resumes its durable cursor and withdraws absent towns', { skip: !url }, async () => {
  db.setOptions({ url }); await db.initialize(); await setup();
  const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
  const towns = new Map([[a, { id: a, name: 'A', slug: null, adminArea: null, appScope: 'local-hub', isPrivate: false, localityType: 'town' }], [b, { id: b, name: 'B', slug: null, adminArea: null, appScope: 'local-hub', isPrivate: false, localityType: 'city' }]]);
  const source = { census: async cursor => ({ communities: cursor ? [{ id: b }] : [{ id: a }], nextCursor: cursor ? null : a }) };
  const reconciler = new DirectoryReconciler(db, async id => towns.get(id) || null);
  try {
    assert.equal(await censusPage(db, source, reconciler), 'more');
    assert.equal((await db.query("SELECT cursor FROM directory_census_progress WHERE id='main'"))[0].cursor, a);
    assert.equal(await censusPage(db, source, new DirectoryReconciler(db, async id => towns.get(id) || null)), 'more');
    towns.delete(a);
    assert.equal(await censusPage(db, source, reconciler), 'complete');
    const rows = await db.query('SELECT "communityId", eligible, slug FROM directory_town ORDER BY "communityId"');
    assert.deepEqual(rows.map(r => [r.communityId, r.eligible, r.slug]), [[a, false, null], [b, true, null]]);
    assert.equal((await db.query('SELECT status FROM directory_provider_work WHERE "communityId"=$1', [b]))[0].status, 'blocked');
  } finally { await teardown(); await db.destroy(); }
});

test('retained events replay through durable receipts and accept a late lower identity', { skip: !url }, async () => {
  const { DeliveryScan } = require('../src/onboarding');
  db.setOptions({ url }); await db.initialize(); await setup();
  const id = '00000000-0000-4000-8000-000000000003';
  const town = { id, name: 'Late', slug: null, adminArea: null, appScope: 'local-hub', isPrivate: false, localityType: 'town' };
  const reconciler = new DirectoryReconciler(db, async () => town);
  let events = [identity('9902', id)], loseResponse = true;
  const source = { unread: async after => events.filter(e => !after || BigInt(e.revision) > BigInt(after)) };
  const scan = new DeliveryScan();
  try {
    await assert.rejects(scan.deliverBatch(source, { apply: async (...args) => { await reconciler.apply(...args); if (loseResponse) throw Error('lost reply'); } }), /lost reply/);
    loseResponse = false;
    await scan.deliverBatch(source, reconciler);
    events.unshift(identity('9901', id));
    await scan.deliverBatch(source, reconciler);
    await scan.deliverBatch(source, reconciler);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM directory_reconciliation_receipt WHERE "communityId"=$1', [id]))[0].n, 2);
    assert.equal(events.length, 2);
  } finally { await teardown(); await db.destroy(); }
});

test('concurrent replay preserves receipts and applies current privacy withdrawal', { skip: !url }, async () => {
  db.setOptions({ url }); await db.initialize(); await setup();
  const id = '00000000-0000-4000-8000-000000000004';
  let current = { id, name: 'Town', slug: null, adminArea: null, appScope: 'local-hub', isPrivate: false, localityType: 'town' };
  const reconciler = new DirectoryReconciler(db, async () => current);
  try {
    await Promise.all([reconciler.apply(identity('9910', id)), reconciler.apply(identity('9910', id))]);
    current = { ...current, isPrivate: true };
    await Promise.all([reconciler.apply(identity('9911', id)), reconciler.apply(identity('9911', id))]);
    const rows = await db.query('SELECT eligible FROM directory_town WHERE "communityId"=$1', [id]);
    assert.equal(rows[0].eligible, false);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM directory_reconciliation_receipt WHERE "communityId"=$1', [id]))[0].n, 2);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM directory_provider_work WHERE "communityId"=$1', [id]))[0].n, 0);
  } finally { await teardown(); await db.destroy(); }
});

test('concurrent census workers serialize and next pass finds an insertion behind the cursor', { skip: !url }, async () => {
  db.setOptions({ url }); await db.initialize(); await setup();
  const a = '00000000-0000-4000-8000-000000000011', b = '00000000-0000-4000-8000-000000000012';
  const town = id => ({ id, name: id, slug: null, adminArea: null, appScope: 'local-hub', isPrivate: false, localityType: 'town' });
  const towns = new Map([[b, town(b)]]);
  let entered, release;
  const enteredPage = new Promise(resolve => { entered = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  let pause = true;
  const source = { census: async cursor => {
    if (pause) { pause = false; entered(); await hold; }
    const ids = [...towns.keys()].sort().filter(id => !cursor || id > cursor);
    return { communities: ids.slice(0, 1).map(id => ({ id })), nextCursor: ids.length > 1 ? ids[0] : null };
  } };
  const reconciler = new DirectoryReconciler(db, async id => towns.get(id) || null);
  try {
    await db.query("DELETE FROM directory_census_progress WHERE id='main'");
    const first = censusPage(db, source, reconciler);
    await enteredPage;
    assert.equal(await censusPage(db, source, reconciler), 'busy');
    release();
    assert.equal(await first, 'more');
    towns.set(a, town(a));
    assert.equal(await censusPage(db, source, reconciler), 'complete');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM directory_town WHERE "communityId"=$1', [a]))[0].n, 0);
    assert.equal(await censusPage(db, source, reconciler), 'more');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM directory_town WHERE "communityId"=$1 AND eligible=true', [a]))[0].n, 1);
  } finally { release(); await teardown(); await db.destroy(); }
});
