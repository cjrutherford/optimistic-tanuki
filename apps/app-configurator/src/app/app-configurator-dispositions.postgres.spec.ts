import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';
import {
  APP_CONFIGURATOR_ACCOUNT_EXPORT_INVENTORY,
  validateAppConfiguratorDispositions,
} from './app-configurator-account-export-dispositions';

const marker = 'private-app-configurator-o02-v1';
const optedIn = process.env.APP_CONFIGURATOR_PARITY_PG_MARKER;
if (optedIn !== undefined && optedIn !== marker)
  throw new Error('Invalid O02 catalog fixture marker');
const describePrivate = optedIn === marker ? describe : describe.skip;

describePrivate('O02 App Configurator migrated physical catalog', () => {
  let source: DataSource;
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
  });
  it('matches real metadata, composite parents and all stores without changing rows', async () => {
    const env = process.env;
    if (
      env.APP_CONFIGURATOR_PARITY_PG_HOST !== '127.0.0.1' ||
      env.APP_CONFIGURATOR_PARITY_PG_PORT !== '15558' ||
      env.APP_CONFIGURATOR_PARITY_PG_DATABASE !== 'ot_app_configurator' ||
      env.APP_CONFIGURATOR_PARITY_PG_USER !== 'postgres' ||
      !env.APP_CONFIGURATOR_PARITY_REPORT_PATH
    )
      throw new Error('Wrong private O02 catalog overrides');
    source = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: 15558,
      username: 'postgres',
      password: env.APP_CONFIGURATOR_PARITY_PG_PASSWORD,
      database: 'ot_app_configurator',
      entities: [
        AppConfigurationEntity,
        AppInstanceEntity,
        AppMembershipEntity,
      ],
      synchronize: false,
      migrationsRun: false,
      migrations: [],
      extra: {
        options:
          '-c default_transaction_read_only=on -c statement_timeout=5000',
      },
    });
    await source.initialize();
    expect(
      (await source.query('SELECT current_database() AS name'))[0].name
    ).toBe('ot_app_configurator');
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
        catalog.map(async (row) => ({
          table: row.table,
          rows: (
            await source.query(
              `SELECT count(*)::text AS count FROM public."${row.table.replace(
                /"/g,
                '""'
              )}"`
            )
          )[0].count,
        }))
      );
    const before = await counts();
    expect(
      validateAppConfiguratorDispositions(
        source.entityMetadatas,
        APP_CONFIGURATOR_ACCOUNT_EXPORT_INVENTORY,
        catalog
      )
    ).toEqual([]);
    expect(catalog.map((row) => row.table).sort()).toEqual([
      'app_configuration_entity',
      'app_instances',
      'app_memberships',
      'migrations',
    ]);
    expect(source.entityMetadatas).toHaveLength(3);
    const foreignKeys = await source.query(
      `SELECT c.conrelid::regclass::text AS "table",c.confrelid::regclass::text AS parent,array_agg(a.attname::text ORDER BY k.ordinality) AS columns,array_agg(b.attname::text ORDER BY k.ordinality) AS "parentColumns" FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY AS k(child,parent,ordinality) ON true JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.child JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=k.parent WHERE n.nspname='public' AND c.contype='f' GROUP BY c.oid,c.conrelid,c.confrelid ORDER BY c.conrelid::regclass::text`
    );
    expect(foreignKeys).toEqual([
      {
        table: 'app_configuration_entity',
        parent: 'app_instances',
        columns: ['appInstanceId', 'workspaceId', 'appScope'],
        parentColumns: ['id', 'workspaceId', 'appScope'],
      },
      {
        table: 'app_memberships',
        parent: 'app_instances',
        columns: ['appInstanceId', 'workspaceId', 'appScope'],
        parentColumns: ['id', 'workspaceId', 'appScope'],
      },
    ]);
    const after = await counts();
    expect(after).toEqual(before);
    writeFileSync(
      env.APP_CONFIGURATOR_PARITY_REPORT_PATH!,
      JSON.stringify(
        {
          result: 'PASS',
          readOnly: true,
          entities: 3,
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
