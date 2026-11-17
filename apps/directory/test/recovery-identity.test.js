const test = require('node:test');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { randomUUID } = require('node:crypto');
const socialUrl = process.env.SOCIAL_IDENTITY_TEST_DATABASE_URL;
const directoryUrl = process.env.DIRECTORY_IDENTITY_TEST_DATABASE_URL;

test('recovery identity survives legacy upgrade and persists without sensitive fields', { skip: !socialUrl || !directoryUrl }, async () => {
  // These databases are dedicated to this test and contain two pre-migration events.
  const social = new DataSource({ type: 'postgres', url: socialUrl });
  const directory = new DataSource({ type: 'postgres', url: directoryUrl });
  await social.initialize(); await directory.initialize();
  try {
    const old = await social.query('SELECT * FROM community_directory_change ORDER BY revision');
    assert.equal(old.length, 2);
    assert.deepEqual(old.map(x => [x.revision, x.communityId, x.operation]), [['1', '11111111-1111-4111-8111-111111111111', 'changed'], ['2', '22222222-2222-4222-8222-222222222222', 'deleted']]);
    assert.ok(old.every(x => x.eventNonce && x.sourceEpoch === null));
    assert.notEqual(old[0].eventNonce, old[1].eventNonce);
    const epoch = randomUUID(), recovery = randomUUID();
    const [event] = await social.query('INSERT INTO community_directory_change ("communityId", operation, "sourceEpoch") VALUES ($1, $2, $3) RETURNING *', [randomUUID(), 'changed', epoch]);
    assert.equal(event.sourceEpoch, epoch);
    assert.ok(event.eventNonce && !old.some(x => x.eventNonce === event.eventNonce));
    await assert.rejects(social.query('INSERT INTO community_directory_change ("communityId", operation, "eventNonce") VALUES ($1, $2, $3)', [randomUUID(), 'changed', event.eventNonce]), e => e.code === '23505');
    assert.equal((await directory.query('SELECT "recoveryEpoch" FROM directory_installation WHERE id = $1', ['legacy']))[0].recoveryEpoch, null);
    await directory.query('UPDATE directory_installation SET "recoveryEpoch" = $1 WHERE id = $2', [recovery, 'legacy']);
    assert.equal((await directory.query('SELECT "recoveryEpoch" FROM directory_installation WHERE id = $1', ['legacy']))[0].recoveryEpoch, recovery);
    assert.deepEqual(Object.keys(event).sort(), ['communityId', 'createdAt', 'eventNonce', 'operation', 'revision', 'sourceEpoch'].sort());
  } finally { await social.destroy(); await directory.destroy(); }
});

test('fresh migration chain accepts distinct event nonces and persists epochs', { skip: !process.env.SOCIAL_FRESH_TEST_DATABASE_URL || !process.env.DIRECTORY_FRESH_TEST_DATABASE_URL }, async () => {
  const social = new DataSource({ type: 'postgres', url: process.env.SOCIAL_FRESH_TEST_DATABASE_URL });
  const directory = new DataSource({ type: 'postgres', url: process.env.DIRECTORY_FRESH_TEST_DATABASE_URL });
  await social.initialize(); await directory.initialize();
  try {
    const epoch = randomUUID(), recovery = randomUUID();
    const events = await social.query('INSERT INTO community_directory_change ("communityId", operation, "sourceEpoch") VALUES ($1, $2, $3), ($4, $2, $3) RETURNING "eventNonce", "sourceEpoch"', [randomUUID(), 'changed', epoch, randomUUID()]);
    assert.equal(events.length, 2);
    assert.notEqual(events[0].eventNonce, events[1].eventNonce);
    assert.ok(events.every(event => event.sourceEpoch === epoch));
    await directory.query('INSERT INTO directory_installation (id, "recoveryEpoch") VALUES ($1, $2)', ['fresh', recovery]);
    assert.equal((await directory.query('SELECT "recoveryEpoch" FROM directory_installation WHERE id = $1', ['fresh']))[0].recoveryEpoch, recovery);
  } finally { await social.destroy(); await directory.destroy(); }
});
