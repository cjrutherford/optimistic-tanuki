import { join } from 'node:path';
import { loadLocalityRegistry } from '../src/locality-registry.js';
import type { SourceConfig } from '../src/types.js';

const registry = loadLocalityRegistry(
  join(__dirname, 'fixtures', 'localities')
);
const countyDiscovery = (slug: string): SourceConfig[] =>
  registry
    .get(slug)
    .sources.filter((source) => source.adapter === 'news-discover');

describe('live manifest locality isolation', () => {
  it('does not place another county town in county discovery aliases', () => {
    const namesByCounty: Record<string, string[]> = {
      'berrien-county-ga': ['nashville'],
      'tift-county-ga': ['tifton'],
      'cook-county-ga': ['adel'],
    };
    for (const [county, ownNames] of Object.entries(namesByCounty)) {
      const all = countyDiscovery(county).flatMap((source) => {
        const config = source.config as { matchNames?: unknown } | undefined;
        return Array.isArray(config?.matchNames)
          ? config.matchNames.map(String).map((name) => name.toLowerCase())
          : [];
      });
      for (const other of Object.values(namesByCounty).flat()) {
        if (!ownNames.includes(other)) expect(all.includes(other)).toBe(false);
      }
    }
  });

  it('allows cross-county discovery only through intentionally shared regional sources', () => {
    const countyKeys = new Set([
      'berrien-news-discover',
      'berrien-press',
      'tift-news-discover',
      'cook-news-discover',
      'adel-news-tribune',
    ]);
    const townSources = ['nashville-ga', 'tifton-ga', 'adel-ga'].map((town) =>
      registry.sourcesForRun(town)
    );
    for (const sources of townSources) {
      for (const source of sources.filter((candidate) =>
        countyKeys.has(candidate.sourceKey)
      )) {
        const owner = source.ownerSlug;
        if (source.sourceKey.startsWith('berrien-'))
          expect(owner).toBe('berrien-county-ga');
        if (source.sourceKey.startsWith('tift-'))
          expect(owner).toBe('tift-county-ga');
        if (
          source.sourceKey === 'cook-news-discover' ||
          source.sourceKey === 'adel-news-tribune'
        )
          expect(owner).toBe('cook-county-ga');
      }
    }
  });
});
