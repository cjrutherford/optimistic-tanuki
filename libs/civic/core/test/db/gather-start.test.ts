import { createTestDataSource } from './helpers/postgres.js';
import { gatherStart } from '../../src/runner.js';
import { DataSource } from 'typeorm';
import { FetchLedgerSchema, FOUNDATION_SCHEMAS } from '../../src/schema.js';
import type { SourceConfig } from '../../src/types.js';

/** The foundation schema the runner reads, in memory. */
async function withFoundation(
  fn: (ds: DataSource) => Promise<void>
): Promise<void> {
  const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
  try {
    await fn(ds);
  } finally {
    await ds.destroy();
  }
}

const source = (sourceKey: string) =>
  ({
    sourceKey,
    ownerSlug: 'riverton-ga',
    coverage: 'all',
    adapter: 'rss',
    name: sourceKey,
    url: `https://example.com/${sourceKey}`,
    kind: 'news',
  } as SourceConfig);

describe('where a run starts reading', () => {
  it('reads since the last edition when every source has been read before, and the whole window when one is new', async () => {
    await withFoundation(async (ds) => {
      const ledger = ds.getRepository(FetchLedgerSchema);
      await ledger.insert({
        sourceId: 'gazette',
        url: 'https://example.com/gazette',
        lastSuccessAt: '2026-09-20T10:00:00Z',
      } as never);
      const options = {
        dataSource: ds,
        gatherSince: '2026-09-19',
      } as Parameters<typeof gatherStart>[0];
      expect(
        await gatherStart(options, [source('gazette')], '2026-03-27')
      ).toBe('2026-09-19');
      expect(
        await gatherStart(
          options,
          [source('gazette'), source('new-board')],
          '2026-03-27'
        )
      ).toBe('2026-03-27');
      await ledger.insert({
        sourceId: 'failing',
        url: 'https://example.com/failing',
        lastSuccessAt: null,
      } as never);
      expect(
        await gatherStart(options, [source('failing')], '2026-03-27')
      ).toBe('2026-03-27');
      expect(
        await gatherStart(
          { ...options, gatherSince: undefined },
          [source('gazette')],
          '2026-03-27'
        )
      ).toBe('2026-03-27');
    });
  });
});
