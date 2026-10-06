import { DataSource } from 'typeorm';
import { createFoundationDataSource } from '../../src/store.js';
import { createTestSchema, createTestDataSource } from './helpers/postgres.js';

describe('postgres test schemas', () => {
  it('pins each data source to its own schema', async () => {
    const first = await createTestDataSource();
    const second = await createTestDataSource();
    try {
      const [a] = await first.query('SELECT current_schema() AS name');
      const [b] = await second.query('SELECT current_schema() AS name');
      expect(a.name).not.toBe(b.name);
      expect(a.name).toMatch(/^civic_t_/);
    } finally {
      await first.destroy();
      await second.destroy();
    }
  });

  it('creates a foundation store with append-only guards in its own schema', async () => {
    const { name, url } = await createTestSchema();
    const dataSource: DataSource = await createFoundationDataSource(url);
    try {
      const triggers: { table: string }[] = await dataSource.query(
        `SELECT event_object_table AS "table" FROM information_schema.triggers
         WHERE trigger_schema = $1 AND trigger_name LIKE 'civic_%_immutable_%'`,
        [name]
      );
      expect(triggers.map((row) => row.table).sort()).toEqual([
        'canonical_story_revisions',
        'canonical_story_revisions',
        'llm_generations',
        'llm_generations',
        'story_revision_citations',
        'story_revision_citations',
      ]);
    } finally {
      await dataSource.destroy();
    }
  });
});
