import { writeFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import loadDatabase from './loadDatabase';
import { validatePaymentsDispositions } from './payments-account-export-dispositions';

const enabled =
  process.env['PAYMENTS_PARITY_MARKER'] === 'private-payments-a01-v1';
(enabled ? describe : describe.skip)(
  'Payments migrated physical disposition catalog',
  () => {
    it('matches every registered table and column without modifying rows', async () => {
      if (
        process.env['PAYMENTS_PARITY_HOST'] !== '127.0.0.1' ||
        process.env['PAYMENTS_PARITY_PORT'] !== '15560'
      )
        throw new Error('Private Payments catalog fixture required');
      const database = {
        host: '127.0.0.1',
        port: 15560,
        username: 'postgres',
        password: 'postgres',
        database: 'ot_payments',
      };
      const config = {
        get: (name: string) => (name === 'database' ? database : undefined),
      } as ConfigService;
      const source = new DataSource({
        ...loadDatabase(config),
        migrations: [],
        migrationsRun: false,
        synchronize: false,
        dropSchema: false,
      });
      const runner = source.createQueryRunner();
      try {
        await source.initialize();
        await runner.connect();
        await runner.query('BEGIN READ ONLY');
        expect(
          validatePaymentsDispositions(
            source.entityMetadatas.map((m) => m.target as Function)
          )
        ).toEqual([]);
        const actual = (await runner.query(
          `SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name`
        )) as Array<{ table_name: string; column_name: string }>;
        const tables = [...new Set(actual.map((x) => x.table_name))];
        expect(tables.sort()).toEqual(
          [
            ...source.entityMetadatas.map((m) => m.tableName),
            'migrations',
          ].sort()
        );
        for (const entity of source.entityMetadatas) {
          expect(
            actual
              .filter((x) => x.table_name === entity.tableName)
              .map((x) => x.column_name)
              .sort()
          ).toEqual(entity.columns.map((c) => c.databaseName).sort());
        }
        const counts = async () =>
          Object.fromEntries(
            await Promise.all(
              tables.map(async (table) => {
                if (!/^[a-z_]+$/.test(table))
                  throw new Error('Unsafe catalog identifier');
                const rows = await runner.query(
                  `SELECT count(*)::text AS count FROM public."${table}"`
                );
                return [table, rows[0].count];
              })
            )
          );
        const before = await counts();
        const after = await counts();
        expect(after).toEqual(before);
        const path = process.env['PAYMENTS_PARITY_REPORT_PATH'];
        if (!path) throw new Error('Private report path required');
        writeFileSync(
          path,
          JSON.stringify(
            {
              status: 'PASS',
              entities: source.entityMetadatas.length,
              tables: tables.length,
              columns: actual.length,
              readOnly: true,
              countsBefore: before,
              countsAfter: after,
            },
            null,
            2
          ) + '\n'
        );
        await runner.query('ROLLBACK');
      } finally {
        if (!runner.isReleased && source.isInitialized) {
          await runner.query('ROLLBACK').catch(() => undefined);
          await runner.release();
        }
        if (source.isInitialized) await source.destroy();
      }
    });
  }
);
