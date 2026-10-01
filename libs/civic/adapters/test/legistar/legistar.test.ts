import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { legistarAdapter, parseNetDate } from '../../src/legistar/index.js';

const load = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('legistar', () => {
  it('parses .NET JSON dates', () => {
    expect(parseNetDate('/Date(1788307200000)/')?.slice(0, 10)).toBe(
      '2026-09-02'
    );
    expect(parseNetDate(undefined)).toBe(undefined);
    expect(parseNetDate('garbage')).toBe(undefined);
  });

  it('parses event records', async () => {
    const source = {
      sourceKey: 'x',
      ownerSlug: 'town-a',
      coverage: 'mentions',
      adapter: 'legistar',
      name: 'X',
      url: 'https://x',
      kind: 'meeting',
    } as const;
    const drafts = await legistarAdapter.parse(
      {
        url: 'https://x',
        contentType: 'application/legistar-event+json',
        payload: { kind: 'text', body: load('event.json') },
        fetchedAt: '',
      },
      source
    );
    expect(drafts.length).toBe(1);
    expect(drafts[0].title).toMatch(/City Council/);
    expect(drafts[0].eventDate).toBe('2026-09-02');
    expect(drafts[0].uris?.[0].endsWith('.pdf')).toBeTruthy();
  });

  it('parses event items + matters with kind mapping', async () => {
    const source = {
      sourceKey: 'x',
      ownerSlug: 'town-a',
      coverage: 'mentions',
      adapter: 'legistar',
      name: 'X',
      url: 'https://x',
      kind: 'meeting',
    } as const;
    const drafts = await legistarAdapter.parse(
      {
        url: 'https://x',
        contentType: 'application/legistar-items+json',
        payload: { kind: 'text', body: load('items.json') },
        fetchedAt: '',
      },
      source
    );
    expect(drafts.length).toBe(2);
    const kinds = drafts.map((d) => d.kind).sort();
    expect(kinds).toStrictEqual(['legislation', 'permit']);
  });
});
