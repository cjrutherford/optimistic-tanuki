const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('../src/data-source').default;
const { beginRecovery, initializeRecovery, inspectRecovery } = require('../src/recovery-authority');
const url = process.env.DIRECTORY_RECOVERY_TEST_DATABASE_URL;

test('recovery authority is durable, exclusive and cannot certify an unverified census', { skip: !url }, async () => {
  db.setOptions({ url }); await db.initialize();
  const source = randomUUID(), owner = randomUUID();
  try {
    const town = randomUUID();
    await db.query(`INSERT INTO directory_town ("communityId", name, eligible, "geometryStatus") VALUES ($1, 'Old town', true, 'ready')`, [town]);
    await assert.rejects(initializeRecovery(db, source, owner), /legacy/i);
    const activationId = randomUUID();
    const results = await Promise.allSettled([beginRecovery(db, {sourceEpoch:source, owner, activationId, socialGeneration:'1'}), beginRecovery(db, {sourceEpoch:source, owner:randomUUID(), activationId, socialGeneration:'1'})]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const initialized = results.find(r => r.status === 'fulfilled').value;
    const state = await inspectRecovery(db, source, initialized.recoveryEpoch, initialized.owner);
    const towns = await db.query('SELECT "geometryStatus" FROM directory_town WHERE "communityId"=$1', [town]);
    assert.equal(towns[0].geometryStatus, 'pending');
    assert.equal(state.phase, 'blocked');
    assert.equal(state.cursor, null);
    await assert.rejects(inspectRecovery(db, randomUUID(), state.recoveryEpoch, state.owner), /epoch/);
    await assert.rejects(inspectRecovery(db, source, randomUUID(), state.owner), /epoch/);
    await assert.rejects(inspectRecovery(db, source, '', state.owner), /epoch/);
    await assert.rejects(inspectRecovery(db, source, state.recoveryEpoch, randomUUID()), /owner/);
    await db.destroy(); await db.initialize();
    assert.deepEqual(await inspectRecovery(db, source, state.recoveryEpoch, state.owner), state);
  } finally { await db.destroy(); }
});
