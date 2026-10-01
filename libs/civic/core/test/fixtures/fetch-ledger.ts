import type { FetchResult } from '../../src/types.js';

/** Reusable fixture inputs for ledger transition and persistence tests. */
export const fetchLedgerFixture = {
  sourceId: 'fixture-source',
  first: {
    kind: 'fetched', status: 200, url: 'https://example.test/story/', requestUrl: 'https://example.test/feed',
    contentType: 'text/plain', fetchedAt: '2026-09-12T12:00:00.000Z', payload: { kind: 'text', body: 'fixture body' },
  } satisfies FetchResult,
  notModified: {
    kind: 'not_modified', status: 304, url: 'https://example.test/story', requestUrl: 'https://example.test/feed',
    contentType: 'text/plain', fetchedAt: '2026-09-12T13:00:00.000Z',
  } satisfies FetchResult,
};
