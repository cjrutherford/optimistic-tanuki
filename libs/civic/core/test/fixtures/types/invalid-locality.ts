import type { LocalityConfig, SourceConfig } from '../../../src/types.js';

export const removedParentSlug = {
  slug: 'town-a',
  name: 'Town A',
  state: 'GA',
  timezone: 'America/New_York',
  lat: 31,
  lon: -83,
  kind: 'town',
  parents: ['county-a'],
  edition: true,
  // @ts-expect-error parentSlug was replaced by parents
  parentSlug: 'county-a',
  topics: [],
  cadence: ['daily'],
  sources: [],
} satisfies LocalityConfig;

export const missingOwnerSlug = {
  sourceKey: 'missing-owner',
  coverage: 'mentions',
  adapter: 'rss',
  name: 'Missing Owner',
  url: 'https://example.test/feed',
  kind: 'news',
  // @ts-expect-error ownerSlug is required for foundation sources
} satisfies SourceConfig;
