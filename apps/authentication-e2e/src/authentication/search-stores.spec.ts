import { Client } from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const privateN03Test =
  process.env.N03_PRIVATE_MARKER === 'private-n03-otts-v1' ? it : it.skip;

privateN03Test(
  'N03 reconciles OT/TS catalogs and proves isolated history/index cleanup',
  async () => {
    if (
      process.env.N03_PRIVATE_MARKER !== 'private-n03-otts-v1' ||
      process.env.E2E_DB_PORT !== '15563'
    )
      throw new Error('PRIVATE_N03_FIXTURE_REQUIRED');
    const runtime = path.resolve(
      '.runtime-artifacts/account-rights/finish-sequence/search-stores/runtime'
    );
    const reportPath = process.env.N03_REPORT_PATH || '';
    if (!path.resolve(reportPath).startsWith(runtime + '/'))
      throw new Error('PRIVATE_N03_REPORT_REQUIRED');
    const command = promisify(execFile),
      container = process.env.N03_DB_CONTAINER_ID || '';
    if (!/^[a-f0-9]{64}$/.test(container))
      throw new Error('PRIVATE_N03_CONTAINER_REQUIRED');
    const inspect = JSON.parse(
      (await command('docker', ['inspect', container], { timeout: 10000 }))
        .stdout
    )[0];
    expect(inspect.Config.Labels['com.docker.compose.project']).toBe(
      'ot-df007-n03-search-stores'
    );
    const metadataPath = path.join(path.dirname(reportPath), 'metadata.json');
    const historyPath = path.join(path.dirname(reportPath), 'history.json');
    const worker = path.resolve(
      'apps/authentication-e2e/src/authentication/n03-catalog.worker.ts'
    );
    const runWorker = async (mode: string) => {
      const result = await command(
        process.execPath,
        [
          '-r',
          'ts-node/register/transpile-only',
          '-r',
          'tsconfig-paths/register',
          worker,
        ],
        {
          cwd: process.cwd(),
          timeout: 90000,
          maxBuffer: 1024 * 1024,
          env: {
            ...process.env,
            TS_NODE_PROJECT: path.resolve(
              'apps/authentication/tsconfig.app.json'
            ),
            N03_WORKER_MODE: mode,
            N03_METADATA_PATH: metadataPath,
            N03_HISTORY_REPORT_PATH: historyPath,
          },
        }
      );
      await fs.writeFile(
        path.join(path.dirname(reportPath), mode + '-worker.log'),
        result.stdout + result.stderr
      );
    };
    await runWorker('metadata');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    expect(metadata.owners).toHaveLength(11);
    const report: any = {
      result: 'RUNNING',
      slice: 'N03',
      applications: ['client-interface', 'local-hub'],
      configurationBoundary: metadata.configurationBoundary,
      catalogs: {},
      stages: {},
      cleanup: {},
    };
    const clients: Client[] = [];
    const before: any = {};
    let failure: unknown;
    const counts = async (client: Client) => {
      const tables = (
        await client.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
        )
      ).rows;
      const result: any = {};
      for (const table of tables)
        result[table.table_name] = Number(
          (
            await client.query(
              `SELECT count(*)::int AS count FROM "${table.table_name}"`
            )
          ).rows[0].count
        );
      return result;
    };
    try {
      for (const owner of metadata.owners) {
        expect(owner.database).toBe('ot_' + owner.owner.replace(/-/g, '_'));
        const client = new Client({
          host: '127.0.0.1',
          port: 15563,
          user: 'postgres',
          password: 'postgres',
          database: owner.database,
        });
        clients.push(client);
        await client.connect();
        before[owner.owner] = await counts(client);
        await client.query('BEGIN READ ONLY');
        try {
          expect(
            (await client.query('SHOW transaction_read_only')).rows[0]
              .transaction_read_only
          ).toBe('on');
          const tables = (
            await client.query(
              "SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname"
            )
          ).rows.map((row) => row.name);
          const extras = owner.owner === 'profile' ? ['goal', 'project'] : [];
          // These are migration-only primary sources, not ORM tables or derived indexes.
          const expected = [
            ...owner.tables.map((table: any) => table.name),
            owner.migrationTableName,
            ...extras,
          ].sort();
          expect(tables).toEqual(expected);
          const columns = (
            await client.query(
              "SELECT table_name,column_name,data_type,is_generated,generation_expression FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position"
            )
          ).rows;
          for (const table of owner.tables)
            expect(
              columns
                .filter((row) => row.table_name === table.name)
                .map((row) => row.column_name)
                .sort()
            ).toEqual(
              [
                ...table.columns.map((col: any) => col.name),
                ...(owner.owner === 'profile' && table.name === 'timeline'
                  ? ['relatedGoalId', 'relatedProjectId']
                  : []),
              ].sort()
            );
          expect(
            columns
              .filter((row) => row.table_name === owner.migrationTableName)
              .map((row) => row.column_name)
              .sort()
          ).toEqual(['id', 'name', 'timestamp']);
          if (owner.owner === 'profile') {
            const legacy: Record<string, string[]> = {
              goal: [
                'id',
                'name',
                'description',
                'target',
                'progress',
                'userId',
                'startDate',
                'endDate',
                'completed',
                'created_at',
                'relatedProfileId',
                'relatedProjectId',
              ],
              project: [
                'id',
                'name',
                'description',
                'userId',
                'created_at',
                'relatedProfileId',
                'timeLineEventsId',
                'goalsId',
              ],
            };
            for (const [name, fields] of Object.entries(legacy))
              expect(
                columns
                  .filter((row) => row.table_name === name)
                  .map((row) => row.column_name)
                  .sort()
              ).toEqual(fields.sort());
          }

          const extraSchemas = (
            await client.query(
              "SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('public','information_schema')"
            )
          ).rows;
          expect(extraSchemas).toEqual([]);
          const views = (
            await client.query(
              "SELECT c.relname,c.relkind,pg_get_viewdef(c.oid,true) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('m','v') ORDER BY c.relname"
            )
          ).rows;
          const generated = columns.filter(
            (row) => row.is_generated !== 'NEVER'
          );
          const textVectors = (
            await client.query(
              "SELECT c.relname,a.attname,t.typname FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_type t ON t.oid=a.atttypid WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND t.typname IN ('tsvector','tsquery')"
            )
          ).rows;
          const foreign = (
            await client.query(
              "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='f'"
            )
          ).rows;
          const triggers = (
            await client.query(
              "SELECT t.tgname,c.relname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY t.tgname"
            )
          ).rows;
          for (const candidate of [
            views,
            generated,
            textVectors,
            foreign,
            triggers,
          ])
            expect(candidate).toEqual([]);
          const indexes = (
            await client.query(
              "SELECT ic.relname AS name,tc.relname AS source_table,am.amname AS method,pg_get_indexdef(i.indexrelid) AS definition,pg_get_expr(i.indexprs,i.indrelid) AS expression FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid JOIN pg_class tc ON tc.oid=i.indrelid JOIN pg_namespace n ON n.oid=tc.relnamespace JOIN pg_am am ON am.oid=ic.relam WHERE n.nspname='public' ORDER BY ic.relname"
            )
          ).rows;
          for (const index of indexes) {
            expect(expected).toContain(index.source_table);
            expect(['btree', 'hash']).toContain(index.method);
          }
          report.catalogs[owner.owner] = {
            database: owner.database,
            registeredTables: owner.tables.length,
            migrationOnlyPrimaryTables: extras,
            migrationOnlyColumns:
              owner.owner === 'profile'
                ? { timeline: ['relatedGoalId', 'relatedProjectId'] }
                : {},
            physicalTables: tables.length,
            extraSchemas,
            columns: columns.length,
            views,
            generated,
            textVectors,
            foreign,
            triggers,
            indexes,
          };
        } finally {
          await client.query('ROLLBACK');
        }
        expect(await counts(client)).toEqual(before[owner.owner]);
      }
      report.stages.readOnlyElevenOwnerCatalogAttribution = true;
      await runWorker('history');
      const history = JSON.parse(await fs.readFile(historyPath, 'utf8'));
      expect(history.result).toBe('PASS');
      for (const value of Object.values(history.stages))
        expect(value).toBe(true);
      expect(history.cleanup.fixtureHistoryRows).toBe(0);
      report.history = history;
      report.stages.realHistoryCleanupAndIndexReadback = true;
    } catch (error) {
      failure = error;
      report.result = 'FAIL';
      report.error = String(error);
    } finally {
      try {
        const after: any = {};
        for (let i = 0; i < clients.length; i++) {
          const owner = metadata.owners[i].owner;
          after[owner] = await counts(clients[i]);
          expect(after[owner]).toEqual(before[owner]);
          const remaining = (
            await clients[i].query(
              "SELECT count(*)::int AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal"
            )
          ).rows[0].count;
          expect(Number(remaining)).toBe(0);
        }
        report.cleanup.databaseCountsRestored = true;
        report.cleanup.countsBefore = before;
        report.cleanup.countsAfter = after;
      } catch (error) {
        failure = error;
        report.result = 'FAIL';
        report.cleanup.error = String(error);
      }
      if (!failure) report.result = 'PASS';
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
      await Promise.all(clients.map((c) => c.end()));
    }
    if (failure) throw failure;
  }
);
