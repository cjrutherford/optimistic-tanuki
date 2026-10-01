import { parseLocalityConfig } from '../src/config.js';
import type { EditorialDesk } from '../src/types.js';

const allDesks: readonly EditorialDesk[] = [
  'government',
  'schools',
  'public-safety',
  'weather',
  'planning-permits',
  'community-news',
  'local-reporting',
];

describe('editorial desks', () => {
  it('accepts each desk with equal eligibility and no ranking fields', () => {
    for (const desk of allDesks) {
      const locality = parseLocalityConfig({
        slug: `desk-${desk}`,
        name: `Desk ${desk}`,
        state: 'GA',
        timezone: 'America/New_York',
        lat: 31,
        lon: -83,
        kind: 'town',
        parents: ['county-a'],
        edition: true,
        topics: [],
        cadence: ['daily'],
        sources: [
          {
            sourceKey: `source-${desk}`,
            coverage: 'mentions' as const,
            adapter: 'rss',
            name: desk,
            url: 'https://example.test/feed',
            kind: 'news',
            desk,
            accessMode: 'full',
          },
        ],
      });
      const source = locality.sources[0] as unknown as Record<string, unknown>;
      expect(source['desk']).toBe(desk);
      expect('rank' in source).toBe(false);
      expect('weight' in source).toBe(false);
      expect('suppression' in source).toBe(false);
    }
  });
});
