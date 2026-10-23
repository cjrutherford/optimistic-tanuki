import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSource } from 'typeorm';
import loadDatabase from './loadDatabase';
import { validateWorkspaceDispositions } from './workspace-account-export-dispositions';

const marker = 'private-workspace-dispositions-o01p-v1';
const optedIn = process.env.WORKSPACE_DISPOSITIONS_O01P_MARKER;
if (optedIn !== undefined && optedIn !== marker)
  throw new Error('Invalid O01-P fixture marker');
const describePrivate = optedIn === marker ? describe : describe.skip;
const fixture = {
  host: '127.0.0.1',
  port: 15556,
  username: 'workspace_dispositions_fixture',
  password: 'synthetic-o01p-only',
  database: 'workspace_dispositions_o01p_fixture',
};

describePrivate(
  'O01-P Workspace dispositions against the private migrated catalog',
  () => {
    let source: DataSource;
    it('reads the two-table catalog read-only and verifies unchanged row counts and scoped unique indexes', async () => {
      if (
        process.env.POSTGRES_HOST !== fixture.host ||
        process.env.POSTGRES_DB !== fixture.database ||
        process.env.POSTGRES_PORT !== String(fixture.port)
      )
        throw new Error('Wrong O01-P database overrides');
      const config = loadDatabase({
        get: (key: string) => (key === 'database' ? fixture : undefined),
      } as any) as any;
      source = new DataSource({
        ...config,
        ...fixture,
        type: 'postgres',
        migrations: [],
        migrationsRun: false,
        synchronize: false,
        extra: {
          options:
            '-c default_transaction_read_only=on -c statement_timeout=5000',
        },
      } as any);
      await source.initialize();
      expect(
        (await source.query('SELECT current_database() AS name'))[0].name
      ).toBe(fixture.database);
      expect(
        (await source.query('SHOW transaction_read_only'))[0]
          .transaction_read_only
      ).toBe('on');
      const catalog: Array<{ table: string; columns: string[] }> =
        await source.query(
          'SELECT table_name AS "table", array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema=\'public\' GROUP BY table_name ORDER BY table_name'
        );
      const counts = async () =>
        Promise.all(
          catalog.map(async (row) => ({
            table: row.table,
            rows: Number(
              (
                await source.query(
                  `SELECT count(*)::int AS count FROM public."${row.table.replace(
                    /"/g,
                    '""'
                  )}"`
                )
              )[0].count
            ),
          }))
        );
      const before = await counts();
      const inventory = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, 'workspace-account-export-dispositions.json'),
          'utf8'
        )
      );
      expect(
        validateWorkspaceDispositions(
          source.entityMetadatas,
          inventory,
          catalog
        )
      ).toEqual([]);
      expect(source.entityMetadatas).toHaveLength(1);
      expect(source.entityMetadatas[0].columns).toHaveLength(12);
      const indexes: Array<{
        is_primary: boolean;
        is_unique: boolean;
        columns: string[];
      }> = await source.query(
        "SELECT i.indisprimary AS is_primary, i.indisunique AS is_unique, array_agg(a.attname::text ORDER BY k.ordinality) AS columns FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality) ON true JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum WHERE n.nspname='public' AND t.relname='workspaces' AND i.indisunique GROUP BY i.indexrelid, i.indisprimary, i.indisunique ORDER BY i.indisprimary DESC"
      );
      const primaryKeys = indexes.filter((index) => index.is_primary);
      const scopedUniqueIndexes = indexes
        .filter((index) => index.is_unique && !index.is_primary)
        .map((index) => index.columns);
      expect(primaryKeys).toHaveLength(1);
      expect(primaryKeys[0].columns).toEqual(['id']);
      expect(scopedUniqueIndexes).toHaveLength(2);
      expect(scopedUniqueIndexes).toEqual(
        expect.arrayContaining([
          ['kind', 'slug', 'appScope'],
          ['sourceService', 'sourceId', 'appScope'],
        ])
      );
      const after = await counts();
      expect(after).toEqual(before);
      expect(catalog).toHaveLength(2);
      expect(
        catalog.reduce((total, row) => total + row.columns.length, 0)
      ).toBe(15);
      const reportRoot = process.env.WORKSPACE_DISPOSITIONS_RUNTIME_ROOT;
      if (!reportRoot) throw new Error('O01-P runtime report root required');
      const output = path.resolve(reportRoot);
      fs.mkdirSync(output, { recursive: true });
      fs.writeFileSync(
        path.join(output, 'catalog-readback.json'),
        JSON.stringify(
          {
            result: 'PASS',
            marker,
            readOnly: true,
            entities: 1,
            relations: 0,
            physicalTables: catalog,
            uniqueIndexes: indexes,
            countsBefore: before,
            countsAfter: after,
          },
          null,
          2
        ) + '\n'
      );
    });
    afterAll(async () => {
      if (source?.isInitialized) await source.destroy();
    });
  }
);
