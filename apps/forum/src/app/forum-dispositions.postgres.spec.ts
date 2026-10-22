import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSource } from 'typeorm';
import loadDatabase from './loadDatabase';
import { validateForumDispositions } from './forum-account-export-dispositions';

const marker = 'private-forum-dispositions-j26-v1';
const optedIn = process.env.FORUM_DISPOSITIONS_J26_MARKER;
if (optedIn !== undefined && optedIn !== marker)
  throw new Error('Invalid J26 fixture marker');
const describePrivate = optedIn === marker ? describe : describe.skip;
const fixture = {
  host: '127.0.0.1',
  port: 15553,
  username: 'forum_dispositions_fixture',
  password: 'synthetic-j26-only',
  database: 'forum_dispositions_j26_fixture',
};

describePrivate('J26 Forum dispositions against the migrated catalog', () => {
  let source: DataSource;
  it('reads the complete physical catalog in read-only mode and verifies unchanged table counts', async () => {
    if (
      process.env.POSTGRES_HOST !== fixture.host ||
      process.env.POSTGRES_DB !== fixture.database ||
      process.env.POSTGRES_PORT !== String(fixture.port)
    )
      throw new Error('Wrong J26 database overrides');
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
      (
        await source.query(
          "SELECT current_setting('transaction_read_only') AS readonly"
        )
      )[0].readonly
    ).toBe('on');
    const rows: Array<{ table: string; columns: string[] }> =
      await source.query(
        `SELECT table_name AS "table", array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name`
      );
    const counts = async () =>
      Promise.all(
        rows.map(async (r) => ({
          table: r.table,
          rows: Number(
            (
              await source.query(
                `SELECT count(*)::int AS count FROM public."${r.table.replace(
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
        path.join(__dirname, 'forum-account-export-dispositions.json'),
        'utf8'
      )
    );
    expect(
      validateForumDispositions(source.entityMetadatas, inventory, rows)
    ).toEqual([]);
    expect(
      source.entityMetadatas.filter((m) => m.tableType !== 'junction')
    ).toHaveLength(6);
    expect(
      source.entityMetadatas.filter((m) => m.tableType === 'junction')
    ).toHaveLength(1);
    const junctionConstraints = await source.query(
      "SELECT contype AS type, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='forum_post_links_forum_link'::regclass ORDER BY contype, conname"
    );
    expect(junctionConstraints.filter((c: any) => c.type === 'p')).toHaveLength(
      1
    );
    expect(junctionConstraints.filter((c: any) => c.type === 'f')).toHaveLength(
      2
    );
    expect(
      junctionConstraints.some((c: any) =>
        c.definition.includes('REFERENCES forum_post(id)')
      )
    ).toBe(true);
    expect(
      junctionConstraints.some((c: any) =>
        c.definition.includes('REFERENCES forum_link(id)')
      )
    ).toBe(true);
    const after = await counts();
    expect(after).toEqual(before);
    expect(rows).toHaveLength(8);
    expect(rows.reduce((sum, row) => sum + row.columns.length, 0)).toBe(71);
    const reportPath = process.env.FORUM_DISPOSITIONS_J26_REPORT_PATH;
    if (!reportPath) throw new Error('J26 private report path required');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          result: 'PASS',
          readOnly: true,
          entities: 6,
          relations: 6,
          associationTables: 1,
          junctionConstraints,
          physicalTables: rows,
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
});
