import { assembleMarkdown } from '../src/briefing.js';
import { itemHash, loadLocality, sha256 } from '../src/pipeline.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('hashing', () => {
  it('rejects invalid locality files through the main locality ingress', () => {
    const directory = mkdtempSync(join(tmpdir(), 'civic-invalid-locality-'));
    const path = join(directory, 'bad.yaml');
    try {
      writeFileSync(
        path,
        'slug: bad\nname: Bad\nstate: GA\ntimezone: UTC\nlat: 1\nlon: 1\nkind: town\nparents: []\ntopics: []\ncadence: [daily]\nsources: [{ adapter: rss, name: Bad, url: https://example.test, kind: news }]\n'
      );
      expect(() => loadLocality(path)).toThrow(/sourceKey|required/i);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('sha256 is stable', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
  });
  it('itemHash dedupes case/whitespace variants', () => {
    expect(itemHash('s', 'Water Rates Vote', '2026-09-14')).toBe(
      itemHash('s', '  water rates vote ', '2026-09-14')
    );
  });
  it('itemHash separates distinct items', () => {
    expect(itemHash('s', 'A')).not.toBe(itemHash('s', 'B'));
  });
});

describe('assembleMarkdown', () => {
  it('renders deterministic template with stored dates/links', () => {
    const md = assembleMarkdown({
      locality: 'Nashville, GA',
      cadence: 'daily',
      periodStart: '2026-09-10',
      periodEnd: '2026-09-11',
      tldr: ['Council votes Monday.'],
      sections: [
        {
          heading: 'Council & Meetings — council',
          summary: 'One meeting.',
          items: [
            {
              title: 'Water rates vote',
              date: '2026-09-14',
              url: 'https://example.org/a',
            },
          ],
        },
      ],
      sourceCount: 2,
      model: 'qwen3:8b',
    });
    expect(md).toMatch(/# Civic Briefing — Nashville, GA/);
    expect(md).toMatch(/- Council votes Monday\./);
    expect(md).toMatch(
      /\*\*Water rates vote\*\* \(2026-09-14\) \[source\]\(https:\/\/example\.org\/a\)/
    );
  });
});
