import { join } from 'node:path';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { DataSource } from 'typeorm';
import { loadLocalityRegistry } from '../../src/locality-registry.js';
import {
  createFoundationDataSource,
  FOUNDATION_SCHEMA_VERSION,
  preflightFoundationTarget,
} from '../../src/store.js';
import { ensureLocality } from '../../src/pipeline.js';
import { createTestSchema } from './helpers/postgres.js';

const fixtures = join(__dirname, '..', 'fixtures', 'locality-graph');

/** Run SQL against one schema through a plain connection, as an out-of-band writer would. */
async function execIn(url: string, statements: string[]): Promise<void> {
  const raw = new DataSource({ type: 'postgres', url });
  await raw.initialize();
  try {
    for (const statement of statements) await raw.query(statement);
  } finally {
    await raw.destroy();
  }
}

describe('foundation persistence isolation', () => {
  it('creates the current schema on an empty target and records its version', async () => {
    const { name, url } = await createTestSchema();
    const ds = await createFoundationDataSource(url);
    try {
      const tables = (
        await ds.query(
          "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name",
          [name]
        )
      ).map((row: { name: string }) => row.name);
      expect(tables).toStrictEqual([
        'agenda_items',
        'briefings',
        'canonical_stories',
        'canonical_story_items',
        'canonical_story_revisions',
        'civic_items',
        'edition_items',
        'edition_stories',
        'fetch_attempts',
        'fetch_ledger',
        'llm_generations',
        'localities',
        'pipeline_run_leases',
        'pipeline_runs',
        'pipeline_stage_runs',
        'quarantine',
        'raw_document_versions',
        'raw_documents',
        'schema_meta',
        'sources',
        'stories',
        'story_revision_citations',
      ]);
      expect(
        await ds.query('SELECT key, value FROM schema_meta')
      ).toStrictEqual([
        { key: 'schemaVersion', value: FOUNDATION_SCHEMA_VERSION },
      ]);
      const guards = (
        await ds.query(
          'SELECT trigger_name AS name FROM information_schema.triggers WHERE trigger_schema = $1 GROUP BY trigger_name ORDER BY trigger_name',
          [name]
        )
      ).map((row: { name: string }) => row.name);
      expect(guards).toStrictEqual([
        'civic_canonical_story_revisions_immutable_delete',
        'civic_canonical_story_revisions_immutable_update',
        'civic_llm_generations_immutable_delete',
        'civic_llm_generations_immutable_update',
        'civic_story_revision_citations_immutable_delete',
        'civic_story_revision_citations_immutable_update',
      ]);
      const columns = (
        await ds.query(
          "SELECT column_name AS name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'civic_items'",
          [name]
        )
      ).map((row: { name: string }) => row.name);
      for (const column of [
        'originalSnippet',
        'publisher',
        'canonicalUrl',
        'articleProvenance',
        'contentChecksum',
        'scopeKind',
      ])
        expect(columns.includes(column)).toBeTruthy();
      const uniqueIndexColumns = async (table: string): Promise<string[]> => {
        const rows: { columns: string[] }[] = await ds.query(
          `SELECT array_agg(a.attname::text ORDER BY k.ord) AS columns
           FROM pg_index i
           JOIN pg_class c ON c.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
           JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
           WHERE n.nspname = $1 AND c.relname = $2 AND i.indisunique
           GROUP BY i.indexrelid`,
          [name, table]
        );
        return rows.map((row) => row.columns.join(','));
      };
      expect(
        (await uniqueIndexColumns('llm_generations')).includes(
          'runId,operation,inputSha256,attempt'
        )
      ).toBeTruthy();
      expect(
        (await uniqueIndexColumns('canonical_story_revisions')).includes(
          'canonicalStoryId,revision'
        )
      ).toBeTruthy();
      expect(
        (await uniqueIndexColumns('edition_items')).includes(
          'localitySlug,civicItemId,ruleVersion'
        )
      ).toBeTruthy();
    } finally {
      await ds.destroy();
    }
  });

  it('reopens a current target and passes the read-only preflight', async () => {
    const { url } = await createTestSchema();
    await (await createFoundationDataSource(url)).destroy();
    const reopened = await createFoundationDataSource(url);
    await reopened.destroy();
    await preflightFoundationTarget(url);
  });

  it('rejects non-foundation, unversioned, and older-version targets with a new-database hint', async () => {
    const cases: string[][] = [
      ['CREATE TABLE unrelated (id INTEGER)'],
      ['CREATE TABLE localities (slug TEXT PRIMARY KEY)'],
      [
        'CREATE TABLE schema_meta ("key" TEXT PRIMARY KEY, value TEXT NOT NULL)',
        "INSERT INTO schema_meta VALUES ('schemaVersion', '2026-01-01.1')",
      ],
    ];
    for (const statements of cases) {
      const { url } = await createTestSchema();
      await execIn(url, statements);
      await expect((() => createFoundationDataSource(url))()).rejects.toThrow(
        /new database/
      );
      await expect((() => preflightFoundationTarget(url))()).rejects.toThrow(
        /new database/
      );
    }
    // Rewritten from the SQLite 'missing.db does not exist' case: on Postgres the
    // equivalent of "nothing there yet" is an empty schema, and a non-postgres URL is refused outright.
    const empty = await createTestSchema();
    await expect(
      (() => preflightFoundationTarget(empty.url))()
    ).rejects.toThrow(/foundation target is empty/);
    await expect(
      (() => preflightFoundationTarget('sqlite:///tmp/foundation.db'))()
    ).rejects.toThrow(/foundation target must be a postgres URL/);
    await expect(
      (() => createFoundationDataSource('sqlite:///tmp/foundation.db'))()
    ).rejects.toThrow(/foundation target must be a postgres URL/);
  });

  it('persists each source once with its owner and coverage', async () => {
    const registry = loadLocalityRegistry(fixtures);
    const { url } = await createTestSchema();
    const ds = await createFoundationDataSource(url);
    try {
      await ensureLocality(ds, registry.get('town-a'), registry);
      await ensureLocality(ds, registry.get('sibling-town'), registry);
      const rows = (await ds.query(
        'SELECT "sourceKey", "ownerSlug", coverage FROM sources ORDER BY "sourceKey"'
      )) as { sourceKey: string; ownerSlug: string; coverage: string }[];
      expect(new Set(rows.map((row) => row.sourceKey)).size).toBe(rows.length);
      expect(rows.find((row) => row.sourceKey === 'county-news')).toStrictEqual(
        {
          sourceKey: 'county-news',
          ownerSlug: 'county-a',
          coverage: 'mentions',
        }
      );
      expect(
        rows.find((row) => row.sourceKey === 'county-minutes')
      ).toStrictEqual({
        sourceKey: 'county-minutes',
        ownerSlug: 'county-a',
        coverage: 'all',
      });
      expect(
        rows.filter((row) => row.sourceKey === 'sibling-news').length
      ).toBe(1);
      const locality = (
        await ds.query(
          "SELECT kind, parents, edition FROM localities WHERE slug = 'town-a'"
        )
      )[0];
      expect({
        ...locality,
        parents: JSON.parse(locality.parents),
      }).toStrictEqual({ kind: 'town', parents: ['county-a'], edition: true });
    } finally {
      await ds.destroy();
    }
  });

  it('excludes a disabled source from every edition run', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'civic-localities-'));
    try {
      cpSync(fixtures, directory, { recursive: true });
      const countyPath = join(directory, 'ga/county-a.yaml');
      writeFileSync(
        countyPath,
        readFileSync(countyPath, 'utf8').replace(
          'sourceKey: county-news',
          'sourceKey: county-news\n    enabled: false'
        )
      );
      const registry = loadLocalityRegistry(directory);
      expect(
        registry
          .sourcesForRun('town-a')
          .some((source) => source.sourceKey === 'county-news')
      ).toBe(false);
      expect(
        registry
          .sourcesForRun('sibling-town')
          .some((source) => source.sourceKey === 'county-news')
      ).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
