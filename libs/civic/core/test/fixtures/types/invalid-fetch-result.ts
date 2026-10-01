import type { FetchResult } from '../../../src/types.js';

// @ts-expect-error a 304 never carries a payload
export const invalid304: FetchResult = { kind: 'not_modified', status: 304, url: 'https://example.test', requestUrl: 'https://example.test', contentType: 'text/plain', fetchedAt: '2026-09-12T12:00:00.000Z', payload: { kind: 'text', body: 'wrong' } };
// @ts-expect-error failed results never carry a payload
export const invalidFailed: FetchResult = { kind: 'failed', status: 500, url: 'https://example.test', requestUrl: 'https://example.test', contentType: 'text/plain', fetchedAt: '2026-09-12T12:00:00.000Z', error: { kind: 'http', message: 'bad', retryable: true }, payload: { kind: 'text', body: 'wrong' } };
// @ts-expect-error fetched status is restricted to 200 or 206
export const invalid204: FetchResult = { kind: 'fetched', status: 204, url: 'https://example.test', requestUrl: 'https://example.test', contentType: 'text/plain', fetchedAt: '2026-09-12T12:00:00.000Z', payload: { kind: 'text', body: '' } };
// @ts-expect-error fetched status is restricted to 200 or 206
export const invalid500: FetchResult = { kind: 'fetched', status: 500, url: 'https://example.test', requestUrl: 'https://example.test', contentType: 'text/plain', fetchedAt: '2026-09-12T12:00:00.000Z', payload: { kind: 'text', body: '' } };
