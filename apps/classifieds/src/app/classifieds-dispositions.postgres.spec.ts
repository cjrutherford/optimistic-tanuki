import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';
import {
  CLASSIFIEDS_ACCOUNT_EXPORT_INVENTORY,
  validateClassifiedsDispositions,
} from './classifieds-account-export-dispositions';

const marker = 'private-classifieds-o09-v1';
const optedIn = process.env['CLASSIFIEDS_PARITY_PG_MARKER'];
if (optedIn !== undefined && optedIn !== marker)
  throw new Error('Invalid O09 private catalog marker');
const describePrivate = optedIn === marker ? describe : describe.skip;

describePrivate('O09 Classifieds migrated physical catalog', () => {
  let source: DataSource;
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
  });

  it('checks the read-only two-table catalog without foreign keys, inventory and unchanged counts', async () => {
    const env = process.env;
    if (
      env['CLASSIFIEDS_PARITY_PG_HOST'] !== '127.0.0.1' ||
      env['CLASSIFIEDS_PARITY_PG_PORT'] !== '15560' ||
      env['CLASSIFIEDS_PARITY_PG_DATABASE'] !== 'ot_classifieds' ||
      env['CLASSIFIEDS_PARITY_PG_USER'] !== 'postgres' ||
      env['CLASSIFIEDS_PARITY_PG_PASSWORD'] !== 'postgres' ||
      !env['CLASSIFIEDS_PARITY_REPORT_PATH']
    )
      throw new Error('Wrong private O09 catalog overrides');
    source = new DataSource({
      type: 'postgres',
      host: env['CLASSIFIEDS_PARITY_PG_HOST'],
      port: Number(env['CLASSIFIEDS_PARITY_PG_PORT']),
      database: env['CLASSIFIEDS_PARITY_PG_DATABASE'],
      username: env['CLASSIFIEDS_PARITY_PG_USER'],
      password: env['CLASSIFIEDS_PARITY_PG_PASSWORD'],
      entities: [ClassifiedAdEntity, AccountDeletionWriteFenceEntity],
      migrations: [],
      migrationsRun: false,
      synchronize: false,
      extra: {
        options:
          '-c default_transaction_read_only=on -c statement_timeout=5000',
      },
    });
    await source.initialize();
    expect(
      (await source.query('SELECT current_database() AS name'))[0].name
    ).toBe('ot_classifieds');
    expect(
      (await source.query('SHOW transaction_read_only'))[0]
        .transaction_read_only
    ).toBe('on');
    const catalog: Array<{ table: string; columns: string[] }> =
      await source.query(
        `SELECT table_name AS "table",array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name`
      );
    const counts = async () =>
      Promise.all(
        catalog.map(async (table) => ({
          table: table.table,
          rows: (
            await source.query(
              `SELECT count(*)::text AS count FROM public."${table.table.replace(
                /"/g,
                '""'
              )}"`
            )
          )[0].count,
        }))
      );
    const before = await counts();
    expect(
      validateClassifiedsDispositions(
        source.entityMetadatas,
        CLASSIFIEDS_ACCOUNT_EXPORT_INVENTORY,
        catalog
      )
    ).toEqual([]);
    expect(source.entityMetadatas).toHaveLength(1);
    const foreignKeys = await source.query(
      `SELECT c.conrelid::regclass::text AS "table",c.confrelid::regclass::text AS parent,array_agg(a.attname::text ORDER BY k.ordinality) AS columns,array_agg(b.attname::text ORDER BY k.ordinality) AS "parentColumns",min(c.confdeltype::text) AS "deleteAction" FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY AS k(child,parent,ordinality) ON true JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.child JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=k.parent WHERE n.nspname='public' AND c.contype='f' GROUP BY c.oid,c.conrelid,c.confrelid ORDER BY c.conrelid::regclass::text`
    );
    expect(foreignKeys).toEqual([]);
    const after = await counts();
    expect(after).toEqual(before);
    expect(catalog).toHaveLength(2);
    expect(
      catalog.reduce((count, table) => count + table.columns.length, 0)
    ).toBe(21);
    writeFileSync(
      env['CLASSIFIEDS_PARITY_REPORT_PATH']!,
      JSON.stringify(
        {
          result: 'PASS',
          readOnly: true,
          entities: 1,
          physicalTables: catalog,
          foreignKeys,
          countsBefore: before,
          countsAfter: after,
        },
        null,
        2
      ) + '\n'
    );
  }, 30000);
});
