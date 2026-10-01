import type { LocalityConfig } from '../../../src/types.js';

export const validLocality = {
  slug: 'town-a', name: 'Town A', state: 'GA', timezone: 'America/New_York',
  lat: 31, lon: -83, kind: 'town', parents: ['county-a'], edition: true, aliases: ['Town A'],
  topics: [], cadence: ['daily'],
  sources: [{
    sourceKey: 'town-news', ownerSlug: 'town-a', coverage: 'mentions',
    adapter: 'rss', name: 'Town News', url: 'https://example.test/feed', kind: 'news',
  }],
} satisfies LocalityConfig;
