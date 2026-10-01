import type { FetchResult } from '../../../src/types.js';

export const fetchedText = {
  kind: 'fetched',
  status: 200,
  url: 'https://example.test/story',
  requestUrl: 'https://example.test/feed',
  contentType: 'text/plain',
  fetchedAt: '2026-09-12T12:00:00.000Z',
  payload: { kind: 'text', body: 'hello' },
} satisfies FetchResult;

export const fetchedBlob = {
  kind: 'fetched',
  status: 206,
  url: 'https://example.test/document.pdf',
  requestUrl: 'https://example.test/index',
  contentType: 'application/pdf',
  fetchedAt: '2026-09-12T12:00:00.000Z',
  payload: { kind: 'blob-ref', ref: { store: 'local', key: 'sha256/ab/hash', sha256: 'ab'.repeat(32), bytes: 4, contentType: 'application/pdf' } },
} satisfies FetchResult;

export const notModified = {
  kind: 'not_modified',
  status: 304,
  url: 'https://example.test/story',
  requestUrl: 'https://example.test/story',
  contentType: 'text/plain',
  fetchedAt: '2026-09-12T12:00:00.000Z',
} satisfies FetchResult;
