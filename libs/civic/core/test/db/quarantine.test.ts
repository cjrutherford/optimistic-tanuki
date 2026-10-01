import { createTestDataSource } from './helpers/postgres.js';
import { DataSource } from 'typeorm';
import { FoundationQuarantineSchema } from '../../src/schema.js';
import { copyLegacyQuarantine } from '../../src/fetch-ledger.js';

describe('metadata-only quarantine', () => {
  it('copies legacy diagnostics idempotently without a payload body', async () => {
    const ds = await createTestDataSource([FoundationQuarantineSchema]);
    try {
      const legacy = {
        id: 12,
        sourceId: 'source-a',
        stage: 'gather',
        error: 'failed',
        payload: 'private body',
        createdAt: '2026-09-12T00:00:00.000Z',
      };
      expect(
        await copyLegacyQuarantine(ds, legacy, {
          path: '/tmp/civic.db.pre-foundation',
          sha256: 'abc',
          bytes: 10,
        })
      ).toBe(true);
      expect(
        await copyLegacyQuarantine(ds, legacy, {
          path: '/tmp/civic.db.pre-foundation',
          sha256: 'abc',
          bytes: 10,
        })
      ).toBe(false);
      const row = await ds
        .getRepository(FoundationQuarantineSchema)
        .findOneBy({ targetKey: 'legacy-row:12' });
      expect(row?.stage).toBe('legacy-rebuild');
      expect('payload' in (row ?? {})).toBe(false);
      expect(row?.payloadRef).toBe('legacy-backup:sha256:abc');
    } finally {
      await ds.destroy();
    }
  });
});
