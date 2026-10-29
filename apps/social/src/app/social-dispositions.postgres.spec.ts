jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSource } from 'typeorm';
import loadDatabase from './loadDatabase';
import { validateSocialDispositions } from './social-account-export-dispositions';

const marker = 'private-social-dispositions-j23-v1';
const optedIn = process.env.SOCIAL_DISPOSITIONS_J23_MARKER;
if (optedIn !== undefined && optedIn !== marker)
  throw new Error('Invalid J23 fixture marker');
const describePrivate = optedIn === marker ? describe : describe.skip;
const fixture = {
  host: '127.0.0.1',
  port: 15553,
  username: 'social_dispositions_fixture',
  password: 'synthetic-j23-only',
  database: 'social_dispositions_j23_fixture',
};

describePrivate(
  'J23 dispositions against the complete migrated Social catalog',
  () => {
    let source: DataSource;
    it('accounts for every physical table/column, mapped relation and declared store without writing data', async () => {
      if (
        process.env.POSTGRES_HOST !== fixture.host ||
        process.env.POSTGRES_DB !== fixture.database
      )
        throw new Error('Wrong J23 database overrides');
      const options = loadDatabase({ get: () => fixture } as any);
      source = new DataSource({
        ...options,
        type: 'postgres',
        ...fixture,
        migrations: [],
        migrationsRun: false,
        synchronize: false,
        installExtensions: false,
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
        (
          await source.query(
            "SELECT current_setting('transaction_read_only') AS readonly"
          )
        )[0].readonly
      ).toBe('on');
      const inventory = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, 'social-account-export-dispositions.json'),
          'utf8'
        )
      );
      const rows: Array<{ table: string; columns: string[] }> =
        await source.query(`SELECT table_name AS "table", array_agg(column_name::text ORDER BY ordinal_position) AS columns
      FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name`);
      expect(rows).toHaveLength(36);
      expect(
        source.entityMetadatas.filter((m) => m.tableType !== 'junction')
      ).toHaveLength(34);
      expect(
        source.entityMetadatas.filter((m) => m.tableType === 'junction')
      ).toHaveLength(1);
      expect(
        validateSocialDispositions(source.entityMetadatas, inventory, rows)
      ).toEqual([]);
      const hiddenStore = [
        ...rows,
        { table: 'unreviewed_private_store', columns: ['secret'] },
      ];
      expect(
        validateSocialDispositions(
          source.entityMetadatas,
          inventory,
          hiddenStore
        ).length
      ).toBeGreaterThan(0);
      const missingColumn = rows.map((r) =>
        r.table === 'post'
          ? { ...r, columns: r.columns.filter((c) => c !== 'content') }
          : r
      );
      expect(
        validateSocialDispositions(
          source.entityMetadatas,
          inventory,
          missingColumn
        ).length
      ).toBeGreaterThan(0);
      const report = {
        result: 'PASS',
        readOnly: true,
        entities: 34,
        junctions: 1,
        physicalTables: rows.length,
        physicalColumns: rows.reduce((n, r) => n + r.columns.length, 0),
        stores: inventory.stores,
        scope:
          'Disposition policy/schema coverage; no snapshot capture or user data export implemented',
      };
      if (!process.env.SOCIAL_PARITY_REPORT_PATH)
        throw new Error('Missing private report path');
      fs.writeFileSync(
        process.env.SOCIAL_PARITY_REPORT_PATH,
        JSON.stringify(report, null, 2) + '\n'
      );
      fs.writeFileSync(
        process.env.SOCIAL_PARITY_REPORT_PATH.replace(
          '.json',
          '-physical-schema.json'
        ),
        JSON.stringify(rows, null, 2) + '\n'
      );
    });
    afterAll(async () => {
      if (source?.isInitialized) await source.destroy();
    });
  }
);
