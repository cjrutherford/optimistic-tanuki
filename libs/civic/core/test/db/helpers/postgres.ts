import { randomBytes } from 'node:crypto';
import { DataSource, type EntitySchema } from 'typeorm';
import { ALL_SCHEMAS } from '../../../src/schema.js';
import { TEST_SCHEMA_PREFIX } from './global-setup.js';

/**
 * Database tests run against a real Postgres (CIVIC_TEST_DATABASE_URL), each
 * in a schema of its own, so they can run in parallel and leave nothing
 * behind. Schemas created by a test file are dropped after it finishes (see
 * setup.ts); a crashed run's leftovers are dropped by global-setup.ts.
 */

const created: string[] = [];

export function testDatabaseUrl(): string {
  const url = process.env['CIVIC_TEST_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'CIVIC_TEST_DATABASE_URL is required for civic-core database tests; run them with nx run civic-core:test-db'
    );
  }
  return url;
}

/** The test database URL with its search_path pinned to one schema. */
export function urlForSchema(schema: string): string {
  const url = new URL(testDatabaseUrl());
  url.searchParams.set('options', `-c search_path=${schema}`);
  return url.toString();
}

async function withAdmin<T>(fn: (admin: DataSource) => Promise<T>): Promise<T> {
  const admin = new DataSource({ type: 'postgres', url: testDatabaseUrl() });
  await admin.initialize();
  try {
    return await fn(admin);
  } finally {
    await admin.destroy();
  }
}

/**
 * A new, empty schema and a URL that targets it. Use the URL wherever a
 * foundation target is expected (createFoundationDataSource and friends).
 */
export async function createTestSchema(): Promise<{
  name: string;
  url: string;
}> {
  const name = `${TEST_SCHEMA_PREFIX}${randomBytes(6).toString('hex')}`;
  await withAdmin((admin) => admin.query(`CREATE SCHEMA "${name}"`));
  created.push(name);
  return { name, url: urlForSchema(name) };
}

/**
 * An initialized data source on a fresh schema, synchronized from the given
 * entities (all civic entities by default).
 */
export async function createTestDataSource(
  entities: (EntitySchema | Function)[] = ALL_SCHEMAS
): Promise<DataSource> {
  const { url } = await createTestSchema();
  const dataSource = new DataSource({
    type: 'postgres',
    url,
    entities,
    synchronize: true,
  });
  await dataSource.initialize();
  return dataSource;
}

export async function withTestDataSource<T>(
  fn: (dataSource: DataSource) => Promise<T>
): Promise<T> {
  const dataSource = await createTestDataSource();
  try {
    return await fn(dataSource);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

export async function dropCreatedSchemas(): Promise<void> {
  const names = created.splice(0);
  if (!names.length) return;
  await withAdmin(async (admin) => {
    for (const name of names) {
      await admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    }
  });
}
