import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import loadDatabase from './loadDatabase';
import staticDatabase from './staticDatabase';

const OPT_IN_MARKER = 'private-social-j16-v1';
const FIXTURE = {
  host: '127.0.0.1',
  port: 15553,
  username: 'social_parity_fixture',
  password: 'synthetic-social-parity-j16-password',
  database: 'social_parity_j16_fixture',
} as const;
const RUN_ROOT = process.env.SOCIAL_PARITY_RUNTIME_ROOT
  ? path.resolve(process.env.SOCIAL_PARITY_RUNTIME_ROOT)
  : undefined;
const optIn = process.env.SOCIAL_PARITY_PG_MARKER;

if (optIn !== undefined && optIn !== OPT_IN_MARKER) {
  throw new Error('Invalid Social parity PostgreSQL opt-in marker');
}

const describeOptIn = optIn === OPT_IN_MARKER ? describe : describe.skip;

function requiredEnv(name: string, expected: string): void {
  if (process.env[name] !== expected) {
    throw new Error(
      `Invalid Social parity PostgreSQL fixture setting: ${name}`
    );
  }
}

function sortedJson(value: Record<string, string>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    )
  );
}

async function publicTableCounts(
  source: DataSource
): Promise<Record<string, string>> {
  const tables: Array<{ table_name: string }> = await source.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  const counts: Record<string, string> = {};
  for (const { table_name: tableName } of tables) {
    const safeName = tableName.replace(/"/g, '""');
    const rows: Array<{ count: string }> = await source.query(
      `SELECT COUNT(*)::text AS count FROM public."${safeName}"`
    );
    counts[tableName] = rows[0].count;
  }
  return counts;
}

describeOptIn('Social PostgreSQL entity and repository parity', () => {
  let source: DataSource | undefined;

  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
  });

  it('resolves all 33 registered repositories against the migrated schema without changing table counts', async () => {
    requiredEnv('SOCIAL_PARITY_PG_MARKER', OPT_IN_MARKER);
    requiredEnv('SOCIAL_PARITY_PG_HOST', FIXTURE.host);
    requiredEnv('SOCIAL_PARITY_PG_PORT', String(FIXTURE.port));
    requiredEnv('SOCIAL_PARITY_PG_DATABASE', FIXTURE.database);
    requiredEnv('SOCIAL_PARITY_PG_USER', FIXTURE.username);
    requiredEnv('SOCIAL_PARITY_PG_PASSWORD', FIXTURE.password);
    if (!RUN_ROOT) {
      throw new Error('Social parity private runtime root is required');
    }
    // The migration DataSource reads port/user/password from the copied YAML.
    // Only its host and database are overridden through these environment keys.
    requiredEnv('POSTGRES_HOST', FIXTURE.host);
    requiredEnv('POSTGRES_DB', FIXTURE.database);
    if (
      process.env.POSTGRES_PORT ||
      process.env.POSTGRES_USER ||
      process.env.POSTGRES_PASSWORD
    ) {
      throw new Error(
        'Unexpected Social parity PostgreSQL credential override'
      );
    }

    const migrationOptions = staticDatabase.options as any;
    expect(migrationOptions.host).toBe(FIXTURE.host);
    expect(migrationOptions.port).toBe(FIXTURE.port);
    expect(migrationOptions.username).toBe(FIXTURE.username);
    expect(migrationOptions.password).toBe(FIXTURE.password);
    expect(migrationOptions.database).toBe(FIXTURE.database);

    const runtimeOptions = loadDatabase({
      get: () => ({ ...FIXTURE }),
    } as any);
    const runtimeEntities = runtimeOptions.entities as any[];
    const migrationEntities = migrationOptions.entities as any[];
    const entityNames = (entities: any[]) =>
      entities.map((entity) => entity.name).sort();

    expect(runtimeEntities).toHaveLength(33);
    expect(migrationEntities).toHaveLength(33);
    expect(entityNames(runtimeEntities)).toEqual(
      entityNames(migrationEntities)
    );

    const dataSource = new DataSource({
      ...runtimeOptions,
      type: 'postgres',
      host: FIXTURE.host,
      port: FIXTURE.port,
      username: FIXTURE.username,
      password: FIXTURE.password,
      database: FIXTURE.database,
      entities: runtimeEntities,
      migrationsRun: false,
      synchronize: false,
      connectTimeoutMS: 3000,
    });
    source = dataSource;
    await dataSource.initialize();

    const actualDatabase: Array<{ current_database: string }> =
      await dataSource.query('SELECT current_database()');
    expect(actualDatabase[0].current_database).toBe(FIXTURE.database);

    const entityMetadatas = dataSource.entityMetadatas.filter(
      (metadata) => metadata.tableType !== 'junction'
    );
    expect(entityMetadatas).toHaveLength(33);

    const providers = (Reflect.getMetadata('providers', AppModule) ||
      []) as Array<{
      provide?: unknown;
      inject?: unknown[];
      useFactory?: (dataSource: DataSource) => unknown;
    }>;
    const repositoryProviders = providers.filter(
      (provider) =>
        typeof provider.provide === 'string' &&
        provider.provide.endsWith('Repository')
    );
    expect(repositoryProviders).toHaveLength(33);

    const baselinePath = process.env.SOCIAL_PARITY_BASELINE_COUNTS;
    const reportPath = process.env.SOCIAL_PARITY_REPORT_PATH;
    if (!baselinePath || !reportPath) {
      throw new Error('Social parity baseline/report paths are required');
    }
    const safeRuntimePrefix = `${RUN_ROOT}${path.sep}`;
    for (const candidate of [baselinePath, reportPath]) {
      if (!path.resolve(candidate).startsWith(safeRuntimePrefix)) {
        throw new Error(
          'Social parity report path is outside the private runtime directory'
        );
      }
    }
    const baseline = JSON.parse(
      fs.readFileSync(baselinePath, 'utf8')
    ) as Record<string, string>;
    const countsBefore = await publicTableCounts(dataSource);
    expect(sortedJson(countsBefore)).toBe(sortedJson(baseline));

    const resolvedRepositories: Array<{
      entity: string;
      table: string;
      rowCount: string;
      boundedRowsRead: number;
    }> = [];
    for (const entity of runtimeEntities) {
      const provider = repositoryProviders.find(
        (candidate) => candidate.provide === getRepositoryToken(entity)
      );
      expect(provider).toBeDefined();
      expect(provider?.inject).toContain('SOCIAL_CONNECTION');
      expect(typeof provider?.useFactory).toBe('function');
      const repository = provider?.useFactory?.(dataSource);
      expect(repository).toBeDefined();
      expect((repository as any).metadata.target).toBe(entity);

      const beforeCount = String(await (repository as any).count());
      const rows = await (repository as any).find({
        take: 1,
        loadEagerRelations: false,
      });
      const afterCount = String(await (repository as any).count());
      expect(afterCount).toBe(beforeCount);
      expect(rows.length).toBeLessThanOrEqual(1);

      const metadata = dataSource.getMetadata(entity);
      expect(countsBefore).toHaveProperty(metadata.tableName);
      resolvedRepositories.push({
        entity: entity.name,
        table: metadata.tableName,
        rowCount: afterCount,
        boundedRowsRead: rows.length,
      });
    }

    const countsAfter = await publicTableCounts(dataSource);
    expect(sortedJson(countsAfter)).toBe(sortedJson(countsBefore));
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          result: 'PASS',
          database: FIXTURE.database,
          entityCount: entityMetadatas.length,
          repositoryProviderCount: repositoryProviders.length,
          registeredRepositoriesResolved: resolvedRepositories.length,
          publicTableCountsBefore: countsBefore,
          publicTableCountsAfter: countsAfter,
          unchangedTableCounts: true,
          relationshipJoinsExercised: false,
          repositories: resolvedRepositories,
        },
        null,
        2
      ) + '\n'
    );
  }, 30_000);
});
