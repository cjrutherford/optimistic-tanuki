import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const setupScript = new URL('../setup-and-migrate.sh', import.meta.url);

test('validates TypeORM migrations before creating databases', async () => {
  const source = await readFile(setupScript, 'utf8');
  const validationIndex = source.indexOf('validate-typeorm-migrations.mjs');
  const databaseCreationIndex = source.indexOf('sh ./scripts/create-dbs.sh');

  assert.notEqual(
    validationIndex,
    -1,
    'db setup must invoke the TypeORM migration validator'
  );
  assert.notEqual(
    databaseCreationIndex,
    -1,
    'db setup must create the required databases'
  );
  assert.ok(
    validationIndex < databaseCreationIndex,
    'db setup must validate migrations before creating databases'
  );
});
