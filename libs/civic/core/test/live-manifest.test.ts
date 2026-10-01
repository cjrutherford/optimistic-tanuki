import { loadLocalityRegistry } from '../src/locality-registry.js';
import { parseLocalityConfig } from '../src/config.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, 'fixtures', 'localities');
const towns = ['nashville-ga', 'tifton-ga', 'adel-ga'] as const;
const desks = new Set([
  'government',
  'schools',
  'public-safety',
  'weather',
  'planning-permits',
  'community-news',
  'local-reporting',
]);

describe('live locality/source manifest', () => {
  it('places each edition town directly inside its county', () => {
    const registry = loadLocalityRegistry(root);
    expect(
      towns.map((slug) => [slug, registry.get(slug).parents[0]])
    ).toStrictEqual([
      ['nashville-ga', 'berrien-county-ga'],
      ['tifton-ga', 'tift-county-ga'],
      ['adel-ga', 'cook-county-ga'],
    ]);
  });

  it('declares stable ownership and metadata for every enabled live source', () => {
    const registry = loadLocalityRegistry(root);
    const declarations = towns.flatMap((town) => registry.sourcesForRun(town));
    const keys = new Set<string>();
    for (const source of declarations) {
      if (source.enabled === false) continue;
      if (keys.has(source.sourceKey)) continue;
      keys.add(source.sourceKey);
      expect(source.sourceKey).toMatch(/^[a-z0-9]+(?:[-_.:][a-z0-9]+)*$/);
      expect(
        registry.get(source.ownerSlug).sources.includes(source)
      ).toBeTruthy();
      expect(['all', 'mentions'].includes(source.coverage)).toBeTruthy();
      expect(source.adapter.trim()).toBeTruthy();
      if (source.kind === 'news')
        expect(source.desk && desks.has(source.desk)).toBeTruthy();
      if (source.accessMode === 'snippet-only') {
        expect(source.aggregateDiscovery).toBe(true);
        expect(source.aggregateUrl).toBeTruthy();
        expect(source.accessRestrictionReason).toBeTruthy();
        expect(source.restrictionPolicyUrl).toBeTruthy();
      }
    }
  });

  it('keeps the fixture manifest parseable with coverage metadata', () => {
    const fixture = parseLocalityConfig(
      readFileSync(join(__dirname, 'fixtures', 'live-localities.yaml'), 'utf8')
    );
    expect(fixture.sources[0]?.coverageCapabilities?.pagination?.mode).toBe(
      'next-link'
    );
  });

  it('models restricted publisher sources as aggregate discovery, never direct RSS', () => {
    const registry = loadLocalityRegistry(root);
    const berrien = registry
      .get('berrien-county-ga')
      .sources.find((source) => source.sourceKey === 'berrien-press');
    const adel = registry
      .get('cook-county-ga')
      .sources.find((source) => source.sourceKey === 'adel-news-tribune');
    for (const source of [berrien, adel]) {
      expect(source).toBeTruthy();
      expect(source?.adapter).toBe('news-discover');
      expect(source?.accessMode).toBe('snippet-only');
      expect(source?.aggregateDiscovery).toBe(true);
    }
    expect(adel?.ownerSlug).toBe('cook-county-ga');
  });
});
