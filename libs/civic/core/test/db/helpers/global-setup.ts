import { Client } from 'pg';

/** Every test schema starts with this; leftovers from a crashed run are dropped. */
export const TEST_SCHEMA_PREFIX = 'civic_t_';

// Loaded by Jest outside its module mapper, so this file has no relative imports.
export default async function globalSetup(): Promise<void> {
  const url = process.env['CIVIC_TEST_DATABASE_URL'];
  if (!url) return;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ name: string }>(
      'SELECT nspname AS name FROM pg_namespace WHERE starts_with(nspname, $1)',
      [TEST_SCHEMA_PREFIX]
    );
    for (const { name } of rows) {
      await client.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    }
  } finally {
    await client.end();
  }
}
