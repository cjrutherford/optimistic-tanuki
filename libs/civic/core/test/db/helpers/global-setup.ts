import { Client } from 'pg';

/** Every test schema starts with this, then the project's scope. */
export const TEST_SCHEMA_PREFIX = 'civic_t_';

/**
 * Each project's jest.db.config sets globals.civicTestSchemaScope, so a run
 * only clears its own project's leftovers and never drops schemas another
 * project's tests are using at the same time.
 */
export function schemaPrefix(scope: unknown): string {
  if (typeof scope !== 'string' || !/^[a-z]+$/.test(scope)) {
    throw new Error('jest.db.config must set globals.civicTestSchemaScope');
  }
  return `${TEST_SCHEMA_PREFIX}${scope}_`;
}

// Loaded by Jest outside its module mapper, so this file has no relative imports.
export default async function globalSetup(
  _globalConfig: unknown,
  projectConfig: { globals: Record<string, unknown> }
): Promise<void> {
  const prefix = schemaPrefix(projectConfig.globals['civicTestSchemaScope']);
  const url = process.env['CIVIC_TEST_DATABASE_URL'];
  if (!url) return;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ name: string }>(
      'SELECT nspname AS name FROM pg_namespace WHERE starts_with(nspname, $1)',
      [prefix]
    );
    for (const { name } of rows) {
      await client.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    }
  } finally {
    await client.end();
  }
}
