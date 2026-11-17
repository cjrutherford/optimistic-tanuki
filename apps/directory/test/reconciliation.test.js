const test = require('node:test');
const assert = require('node:assert/strict');
const dataSource = require('../src/data-source').default;
const { DirectoryReconciler: BaseReconciler } = require('../src/reconciliation');
class DirectoryReconciler extends BaseReconciler { constructor(db, read) { super(db, read, async (_event, id, sourceEpoch, eventNonce) => ({ status: 'pending', sourceEpoch, eventNonce, snapshot: await read(id) })); } }
const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const { randomUUID } = require('node:crypto');
const { beginRecovery } = require('../src/recovery-authority');
const { configureReceiptPool } = require('../src/reconciliation');
let authority, nonces;
async function setup() { authority = await beginRecovery(dataSource, {sourceEpoch:randomUUID(), owner:randomUUID(), activationId:randomUUID(), socialGeneration:'1'}); nonces = new Map(); await configureReceiptPool(dataSource, 100); }
function identity(revision, communityId) { if (!nonces.has(revision)) nonces.set(revision, randomUUID()); return { revision, communityId, eventNonce: nonces.get(revision), sourceEpoch: authority.sourceEpoch, recoveryEpoch: authority.recoveryEpoch }; }
async function teardown() { await dataSource.query("DELETE FROM directory_census_progress WHERE id='recovery'"); await dataSource.query("DELETE FROM directory_installation WHERE id='recovery-authority'"); }


test('reconciliation deduplicates, serializes and invalidates geometry for late events', {skip: !url}, async () => {
  dataSource.setOptions({url}); await dataSource.initialize(); await setup();
  const id = '00000000-0000-4000-8000-000000000099';
  const town = {id, name:'New town', slug:null, adminArea:null, appScope:'local-hub', isPrivate:false, localityType:'town'};
  let current = town;
  const reconciler = new DirectoryReconciler(dataSource, async () => current);
  try {
    await Promise.all([reconciler.apply(identity('100', id)), reconciler.apply(identity('100', id))]);
    assert.equal((await dataSource.query('SELECT count(*)::int n FROM directory_reconciliation_receipt WHERE "eventId"=$1', ['100']))[0].n, 1);
    let row = (await dataSource.query('SELECT * FROM directory_town WHERE "communityId"=$1', [id]))[0];
    assert.equal(row.slug, null); assert.equal(row.geometryStatus, 'pending');
    await dataSource.query('UPDATE directory_town SET "geometryStatus"=\'ready\' WHERE "communityId"=$1', [id]);
    current = {...town, isPrivate:true}; await reconciler.apply(identity('102', id));
    current = town; await reconciler.apply(identity('101', id)); // allocation order is not commit order
    row = (await dataSource.query('SELECT * FROM directory_town WHERE "communityId"=$1', [id]))[0];
    assert.equal(row.eligible, true); assert.equal(row.geometryStatus, 'pending');
    const work = (await dataSource.query('SELECT * FROM directory_provider_work WHERE "communityId"=$1', [id]))[0];
    assert.equal(work.status, 'blocked');
    await new DirectoryReconciler(dataSource, async () => null).apply(identity('103', id));
    row = (await dataSource.query('SELECT * FROM directory_town WHERE "communityId"=$1', [id]))[0];
    assert.equal(row.eligible, false);
  } finally { await teardown(); await dataSource.destroy(); }
});

test('receipt is invisible until the reconciliation transaction commits and replay checks both identities', {skip: !url}, async () => {
  const { randomUUID, randomBytes } = require('node:crypto');
  const eventId = BigInt(`0x${randomBytes(7).toString('hex')}`).toString();
  const communityId = randomUUID();
  let releaseCommit, reachedCommit;
  const beforeCommit = new Promise(resolve => { reachedCommit = resolve; });
  const continueCommit = new Promise(resolve => { releaseCommit = resolve; });
  dataSource.setOptions({url}); await dataSource.initialize(); await setup();
  const pausedDb = { transaction: callback => dataSource.transaction(async manager => {
    await callback(manager);
    reachedCommit();
    await continueCommit;
  }) };
  const reconciler = new DirectoryReconciler(pausedDb, async () => null);
  let apply;
  try {
    apply = reconciler.apply(identity(eventId, communityId));
    await Promise.race([beforeCommit, apply.then(() => { throw Error("transaction finished before commit pause"); })]);
    assert.equal((await dataSource.query('SELECT 1 FROM directory_reconciliation_receipt WHERE "eventId"=$1 AND "communityId"=$2', [eventId, communityId])).length, 0);
    releaseCommit();
    await apply;
    assert.equal((await dataSource.query('SELECT 1 FROM directory_reconciliation_receipt WHERE "eventId"=$1 AND "communityId"=$2', [eventId, communityId])).length, 1);
    const replay = new DirectoryReconciler(dataSource, async () => { throw Error('replay should not read Social'); });
    await replay.apply(identity(eventId, communityId));
    await assert.rejects(replay.apply(identity(eventId, randomUUID())), /Event identity collision/);
  } finally {
    releaseCommit();
    if (apply) await apply.catch(() => undefined);
    await dataSource.query('DELETE FROM directory_reconciliation_receipt WHERE "eventId"=$1', [eventId]);
    await teardown(); await dataSource.destroy();
  }
});

test('event lock is held through commit even across different community identities', {skip: !url}, async () => {
  const { randomUUID, randomBytes } = require('node:crypto');
  const eventId = BigInt(`0x${randomBytes(7).toString('hex')}`).toString();
  const communityId = randomUUID();
  let release, reached;
  const paused = new Promise(resolve => { reached = resolve; });
  const proceed = new Promise(resolve => { release = resolve; });
  dataSource.setOptions({url}); await dataSource.initialize(); await setup();
  const reconciler = new DirectoryReconciler(dataSource, async () => { reached(); await proceed; return null; });
  let applying;
  try {
    applying = reconciler.apply(identity(eventId, communityId));
    await Promise.race([paused, applying.then(() => { throw Error('apply finished before barrier'); })]);
    const locked = await dataSource.transaction(async manager => manager.query(
      "SELECT pg_try_advisory_xact_lock(hashtextextended('directory-event-v1:' || $1, 0)) AS acquired", [eventId]));
    assert.equal(locked[0].acquired, false);
    release(); await applying;
    const unlocked = await dataSource.transaction(async manager => manager.query(
      "SELECT pg_try_advisory_xact_lock(hashtextextended('directory-event-v1:' || $1, 0)) AS acquired", [eventId]));
    assert.equal(unlocked[0].acquired, true);
    await assert.rejects(reconciler.apply(identity(eventId, randomUUID())), /Event identity collision/);
  } finally {
    release(); if (applying) await applying.catch(() => undefined);
    await dataSource.query('DELETE FROM directory_reconciliation_receipt WHERE "eventId"=$1', [eventId]);
    await dataSource.query('DELETE FROM directory_town WHERE "communityId"=$1', [communityId]);
    await teardown(); await dataSource.destroy();
  }
});

test('retirement fences a delayed request and cleanup fails closed', {skip: !url}, async () => {
  const { randomUUID, randomBytes } = require('node:crypto');
  const eventId = BigInt(`0x${randomBytes(7).toString('hex')}`).toString();
  const communityId = randomUUID();
  dataSource.setOptions({url}); await dataSource.initialize(); await setup();
  let pending = true, unavailable = false, release, reached;
  const entered = new Promise(resolve => { reached = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  const snapshot = {id:communityId, name:'Fence town', slug:null, adminArea:null, appScope:'local-hub', isPrivate:false, localityType:'town'};
  const reconcile = new BaseReconciler(dataSource, async () => snapshot, async (_event, _id, sourceEpoch, eventNonce) => {
    if (unavailable) throw Error('Social unavailable');
    return pending ? {status:'pending', sourceEpoch, eventNonce, snapshot} : {status:'absent'};
  });
  try {
    assert.equal(await reconcile.apply(identity(eventId, communityId)), 'applied');
    assert.equal(await reconcile.cleanup(identity(eventId, communityId)), 'pending');
    unavailable = true;
    await assert.rejects(reconcile.cleanup(identity(eventId, communityId)));
    assert.equal((await dataSource.query('SELECT 1 FROM directory_reconciliation_receipt WHERE "eventId"=$1', [eventId])).length, 1);
    unavailable = false;
    // A request delayed before entering the transaction resumes only after ACK and cleanup.
    const delayed = (async () => { reached(); await barrier; return reconcile.apply(identity(eventId, communityId)); })();
    await entered; pending = false;
    assert.equal(await reconcile.cleanup(identity(eventId, communityId)), 'retired');
    await dataSource.query('UPDATE directory_town SET eligible=false WHERE "communityId"=$1', [communityId]);
    release(); assert.equal(await delayed, 'retired');
    assert.equal((await dataSource.query('SELECT eligible FROM directory_town WHERE "communityId"=$1', [communityId]))[0].eligible, false);
    assert.equal((await dataSource.query('SELECT 1 FROM directory_reconciliation_receipt WHERE "eventId"=$1', [eventId])).length, 0);
  } finally {
    release();
    await dataSource.query('DELETE FROM directory_reconciliation_receipt WHERE "eventId"=$1', [eventId]);
    await dataSource.query('DELETE FROM directory_provider_work WHERE "communityId"=$1', [communityId]);
    await dataSource.query('DELETE FROM directory_town WHERE "communityId"=$1', [communityId]);
    await teardown(); await dataSource.destroy();
  }
});
