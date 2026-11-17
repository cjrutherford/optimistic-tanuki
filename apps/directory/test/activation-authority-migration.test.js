const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { DirectoryFoundation1793887610644 } = require('../migrations/1793887610644-DirectoryFoundation');
const { isEnabledDirectoryAuthority } = require('../src/activation-authority');
const url = process.env.DIRECTORY_MIGRATION_TEST_DATABASE_URL;
test('upgrade preserves legacy rows but does not enable legacy authority', { skip: !url }, async () => {
  const db = new DataSource({ type: 'postgres', url }); await db.initialize();
  const runner = db.createQueryRunner(); await runner.connect();
  const schema = 'activation_' + randomUUID().replaceAll('-', '');
  try {
    await runner.query(`CREATE SCHEMA "${schema}"`);
    await runner.query(`SET search_path TO "${schema}"`);
    await runner.query('CREATE TABLE directory_census_progress (id text primary key, phase text, cursor uuid, "sourceEpoch" uuid, "recoveryEpoch" uuid, owner uuid); CREATE TABLE directory_town (id uuid primary key); CREATE TABLE directory_reconciliation_receipt (id bigint primary key)');
    const id = randomUUID();
    await runner.query(`INSERT INTO directory_census_progress VALUES ('recovery','enabled',NULL,$1,$1,$1)`, [id]);
    await runner.query('INSERT INTO directory_town VALUES ($1)', [id]);
    await runner.query('INSERT INTO directory_reconciliation_receipt VALUES (42)');
    await new DirectoryFoundation1793887610644().up(runner);
    const [row] = await runner.query('SELECT * FROM directory_census_progress');
    assert.equal(isEnabledDirectoryAuthority(row), false);
    assert.equal(row.activationId, null); assert.equal(row.socialGeneration, null); assert.equal(row.directoryGeneration, null);
    assert.equal((await runner.query('SELECT count(*)::int n FROM directory_town'))[0].n, 1);
    assert.equal((await runner.query('SELECT count(*)::int n FROM directory_reconciliation_receipt'))[0].n, 1);
    await runner.query('UPDATE directory_census_progress SET "activationId"=$1, "socialGeneration"=1, "directoryGeneration"=2', [id]);
    assert.equal(isEnabledDirectoryAuthority((await runner.query('SELECT * FROM directory_census_progress'))[0]), true);
  } finally { await runner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await runner.release(); await db.destroy(); }
});
