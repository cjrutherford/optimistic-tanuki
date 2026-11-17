const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('../src/data-source').default;
const { beginRecovery } = require('../src/recovery-authority');
const { recoveryPage } = require('../src/recovery-traversal');
const url = process.env.DIRECTORY_RECOVERY_TEST_DATABASE_URL;
test('recovery checkpoints each record and resumes after a failed snapshot', { skip: !url }, async () => {
  db.setOptions({url}); await db.initialize();
  try {
    const sourceEpoch = randomUUID(), owner = randomUUID();
    const state = await beginRecovery(db, {sourceEpoch, owner, activationId:randomUUID(), socialGeneration:'1'});
    const ids = [randomUUID(), randomUUID()].sort(); let fail = true;
    const source = { census: async cursor => ({ communities: ids.filter(id => !cursor || id > cursor).map(id => ({id})), nextCursor: null }), snapshot: async id => { if (id === ids[1] && fail) throw Error('outage'); return {id, name:'Town', slug:null, adminArea:null, appScope:'local-hub', isPrivate:false, localityType:'town'}; } };
    await assert.rejects(recoveryPage(db, source, state), /outage/);
    const [checkpoint] = await db.query("SELECT phase, cursor FROM directory_census_progress WHERE id='recovery'");
    assert.equal(checkpoint.phase, 'social'); assert.equal(checkpoint.cursor, ids[0]);
    await assert.rejects(recoveryPage(db, source, {...state, sourceEpoch:randomUUID()}), /epoch/);
    let release; let entered;
    const started = new Promise(resolve => { entered = resolve; });
    const held = recoveryPage(db, {...source, census: async (...args) => { entered(); await new Promise(resolve => { release = resolve; }); return source.census(...args); }}, state);
    await started;
    assert.equal(await recoveryPage(db, source, state), 'busy');
    release(); await assert.rejects(held, /outage/);
    fail = false;
    assert.equal(await recoveryPage(db, source, state), 'more');
    assert.equal(await recoveryPage(db, source, state), 'traversed');
    assert.equal((await db.query('SELECT count(*)::int n FROM directory_town WHERE eligible'))[0].n, 2);
    await assert.rejects(recoveryPage(db, source, {...state, owner:randomUUID()}), /owner/);
  } finally { await db.destroy(); }
});
