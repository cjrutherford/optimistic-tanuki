import { deriveSourceFreshnessFromRows } from '../src/freshness.js';

describe('source freshness derivation', () => {
  it('uses a current-run fetched fallback when observedAt is null', () => {
    const result = deriveSourceFreshnessFromRows(
      [{ id: 42, sourceId: 'restricted', observedAt: null }],
      {
        rawDocuments: [
          {
            id: 10,
            sourceId: 'restricted',
            fetchedAt: '2026-09-13T10:00:00.000Z',
          },
        ],
        rawVersions: [
          {
            id: 11,
            sourceId: 'restricted',
            fetchedAt: '2026-09-13T10:01:00.000Z',
          },
        ],
        fetchAttempts: [
          {
            id: 12,
            sourceId: 'restricted',
            attemptedAt: '2026-09-13T10:02:00.000Z',
          },
        ],
        ledgers: [
          {
            id: 13,
            sourceId: 'restricted',
            lastSuccessAt: '2026-09-13T10:03:00.000Z',
            lastAttemptAt: '2026-09-13T10:03:00.000Z',
          },
        ],
      },
      {
        currentItemIds: [42],
        currentRawDocumentIds: [10],
        currentRawVersionIds: [11],
        currentFetchAttemptIds: [12],
        currentLedgerIds: [13],
      }
    );
    expect(result).toStrictEqual([
      {
        sourceKey: 'restricted',
        observedAt: null,
        fetchedAt: '2026-09-13T10:03:00.000Z',
        basis: 'fetched-fallback',
      },
    ]);
  });

  it('does not use newer stale rows outside the current run IDs', () => {
    const result = deriveSourceFreshnessFromRows(
      [{ id: 42, sourceId: 'source-a', observedAt: null }],
      {
        rawDocuments: [
          {
            id: 10,
            sourceId: 'source-a',
            fetchedAt: '2026-09-13T10:00:00.000Z',
          },
          {
            id: 99,
            sourceId: 'source-a',
            fetchedAt: '2026-09-15T10:00:00.000Z',
          },
        ],
        rawVersions: [],
        fetchAttempts: [],
        ledgers: [],
      },
      {
        currentItemIds: [42],
        currentRawDocumentIds: [10],
        currentRawVersionIds: [],
        currentFetchAttemptIds: [],
        currentLedgerIds: [],
      }
    );
    expect(result[0]?.fetchedAt).toBe('2026-09-13T10:00:00.000Z');
  });
});
