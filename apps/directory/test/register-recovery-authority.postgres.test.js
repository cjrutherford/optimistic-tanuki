const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('../src/data-source').default;
const { beginRegisterRecovery, advanceRegisterRecovery } = require('../src/register-recovery-authority');
const { beginRecovery, readRecoveryEpochs } = require('../src/recovery-authority');
const { recoveryPage } = require('../src/recovery-traversal');
const { generateRecoveryProof } = require('../src/recovery-proof');
const url = process.env.DIRECTORY_RECOVERY_TEST_DATABASE_URL;

test('pending register authority fences, advances and retries atomically', { skip: !url }, async () => {
  db.setOptions({ url }); await db.initialize();
  const request = { sourceEpoch: randomUUID(), activationId: randomUUID(), socialGeneration:'1', owner:randomUUID(), expectedPrevious:null, externalFence:true };
  const checkpoint = (phase,cursor=null) => ({ phase, cursor });
  try {
    const town = randomUUID();
    await db.query(`INSERT INTO directory_town ("communityId",name,eligible,"geometryStatus") VALUES ($1,'test',true,'ready')`, [town]);
    await db.query("INSERT INTO directory_provider_work (\"communityId\",status) VALUES ($1,'pending')", [town]);
    await assert.rejects(beginRegisterRecovery(db,{...request,externalFence:false}), /fence/);
    const concurrent = await Promise.all([beginRegisterRecovery(db,request), beginRegisterRecovery(db,request)]);
    assert.deepEqual(concurrent[0],concurrent[1]);
    const first = concurrent[0];
    assert.equal((await db.query('SELECT status FROM directory_provider_work WHERE \"communityId\"=$1',[town]))[0].status,'blocked');
    assert.equal((await db.query('SELECT "geometryStatus" FROM directory_town WHERE "communityId"=$1',[town]))[0].geometryStatus,'pending');
    assert.deepEqual(await beginRegisterRecovery(db,request),first);
    await assert.rejects(beginRegisterRecovery(db,{...request,owner:randomUUID()}), /previous/);
    await assert.rejects(readRecoveryEpochs(db), /authority/);
    await assert.rejects(beginRecovery(db,request), /protocol/);
    await assert.rejects(recoveryPage(db,{ census: async () => { throw Error('unexpected source call'); } },first), /protocol/);
    await assert.rejects(generateRecoveryProof(db,first,'secret'), /protocol/);
    for (const key of ['sourceEpoch','activationId','recoveryEpoch','owner','socialGeneration','directoryGeneration']) {
      await assert.rejects(advanceRegisterRecovery(db,{...first,[key]:key.includes('Generation') ? '2' : randomUUID()},checkpoint('blocked'),checkpoint('reg-source')), /authority/);
    }
    await advanceRegisterRecovery(db,first,checkpoint('blocked'),checkpoint('reg-source'));
    assert.deepEqual(await advanceRegisterRecovery(db,first,checkpoint('blocked'),checkpoint('reg-source')),checkpoint('reg-source'));
    assert.equal((await beginRegisterRecovery(db,request)).phase,'reg-source');
    const cursor = randomUUID();
    await advanceRegisterRecovery(db,first,checkpoint('reg-source'),checkpoint('reg-source',cursor));
    await assert.rejects(advanceRegisterRecovery(db,first,checkpoint('reg-source'),checkpoint('reg-directory')), /changed/);
    await advanceRegisterRecovery(db,first,checkpoint('reg-source',cursor),checkpoint('reg-directory'));
    await assert.rejects(advanceRegisterRecovery(db,first,checkpoint('reg-source',randomUUID()),checkpoint('reg-directory')), /changed/);
    assert.deepEqual(await advanceRegisterRecovery(db,first,checkpoint('reg-source',cursor),checkpoint('reg-directory')), checkpoint('reg-directory'));
    await advanceRegisterRecovery(db,first,checkpoint('reg-directory'),checkpoint('reg-running'));
    const previous = Object.fromEntries(['sourceEpoch','activationId','socialGeneration','recoveryEpoch','owner','directoryGeneration'].map(k => [k,first[k]]));
    const second = await beginRegisterRecovery(db,{...request,expectedPrevious:previous});
    assert.notEqual(second.recoveryEpoch,first.recoveryEpoch); assert.equal(second.directoryGeneration,'2');
    await assert.rejects(beginRegisterRecovery(db,{...request,owner:randomUUID(),expectedPrevious:previous}), /previous/);
    await assert.rejects(advanceRegisterRecovery(db,first,checkpoint('blocked'),checkpoint('reg-source')), /authority/);
    // A failure after geometry invalidation must roll the entire begin back.
    await db.query(`CREATE FUNCTION fail_recovery_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected rollback'; END $$`);
    await db.query(`CREATE TRIGGER fail_recovery BEFORE UPDATE ON directory_installation FOR EACH ROW EXECUTE FUNCTION fail_recovery_insert()`);
    await db.query(`UPDATE directory_town SET "geometryStatus"='ready' WHERE "communityId"=$1`,[town]);
    const current = Object.fromEntries(Object.keys(previous).map(k => [k,second[k]]));
    await assert.rejects(beginRegisterRecovery(db,{...request,owner:randomUUID(),expectedPrevious:current}), /injected rollback/);
    assert.equal((await db.query('SELECT "geometryStatus" FROM directory_town WHERE "communityId"=$1',[town]))[0].geometryStatus,'ready');
    assert.equal((await db.query("SELECT \"recoveryEpoch\" FROM directory_installation WHERE id='recovery-authority'"))[0].recoveryEpoch,second.recoveryEpoch);
  } finally { await db.destroy(); }
});
