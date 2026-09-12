import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const setupScript = new URL('../setup-and-migrate.sh', import.meta.url);

test('validates TypeORM migrations before creating databases', async () => {
  const source = await readFile(setupScript, 'utf8');
  const validationIndex = source.indexOf('validate-typeorm-migrations.mjs');
  const databaseCreationInvocation =
    '(cd "$ROOT_DIR" && bash ./scripts/create-dbs.sh)';
  const databaseCreationIndex = source.indexOf(databaseCreationInvocation);

  assert.notEqual(
    validationIndex,
    -1,
    'db setup must invoke the TypeORM migration validator'
  );
  assert.notEqual(
    databaseCreationIndex,
    -1,
    'db setup must invoke the Bash database creation script with Bash'
  );
  assert.ok(
    validationIndex < databaseCreationIndex,
    'db setup must validate migrations before creating databases'
  );
});
