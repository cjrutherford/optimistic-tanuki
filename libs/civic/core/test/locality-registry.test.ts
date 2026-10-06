import {
  resolveSourceIdentity,
  loadLocalityRegistry,
  validateLocalityGraph,
} from '../src/locality-registry.js';
import { isEditionIncluded } from '../src/foundation-types.js';
import { findRestrictedPublisher } from '../src/restricted-publishers.js';
import { join } from 'node:path';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';

const fixtures = join(__dirname, 'fixtures', 'locality-graph');
const slugs = (localities: readonly { slug: string }[]) =>
  localities.map((locality) => locality.slug);
const keys = (sources: readonly { sourceKey: string }[]) =>
  sources.map((source) => source.sourceKey);

describe('locality registry', () => {
  it('loads the production graph from nested state folders', () => {
    const registry = loadLocalityRegistry(
      join(__dirname, 'fixtures', 'localities')
    );
    expect(slugs(registry.ancestry('adel-ga'))).toStrictEqual([
      'adel-ga',
      'cook-county-ga',
      'south-georgia',
      'georgia',
      'us',
    ]);
    const editions = slugs(registry.editions()).sort();
    // Adel is a beta edition by choice since 2026-09-25 (daylight-poc b8343a7).
    expect(editions.filter((slug) => slug.endsWith('-ga'))).toStrictEqual([
      'adel-ga',
      'nashville-ga',
      'tifton-ga',
    ]);
    expect(editions.includes('groton-ct')).toBeTruthy();
    const adel = keys(registry.sourcesForRun('adel-ga'));
    expect(adel.includes('georgia-recorder')).toBeTruthy();
    expect(adel.includes('south-health-district')).toBeTruthy();
    expect(adel.includes('adel-news-tribune')).toBe(false);
    expect(adel.includes('berrien-press')).toBe(false);
    expect(adel.includes('tifton-gazette')).toBe(false);
  });

  it('discovers nothing through Google News, whose robots.txt disallows crawlers', () => {
    const registry = loadLocalityRegistry(
      join(__dirname, 'fixtures', 'localities')
    );
    for (const locality of registry.all()) {
      for (const source of registry.sourcesForRun(locality.slug)) {
        expect(source.adapter).not.toBe('news-discover');
        for (const url of [
          source.url,
          source.aggregateUrl,
          source.config?.['searchUrl'],
        ]) {
          if (typeof url === 'string')
            expect(url).not.toMatch(/news\.google\./u);
        }
      }
    }
  });

  it('resolves a village that belongs to two towns', () => {
    const registry = loadLocalityRegistry(
      join(__dirname, 'fixtures', 'localities')
    );
    const ancestry = slugs(registry.ancestry('mystic-ct'));
    expect(ancestry[0]).toBe('mystic-ct');
    for (const slug of [
      'groton-ct',
      'stonington-ct',
      'southeastern-ct',
      'connecticut',
      'us',
    ])
      expect(ancestry.includes(slug)).toBeTruthy();
    // Sources declared by either town reach the village, and each keeps its owner.
    const sources = registry.sourcesForRun('mystic-ct');
    expect(keys(sources).includes('groton-documents')).toBeTruthy();
    expect(
      keys(sources).includes('city-of-groton-documents') === false
    ).toBeTruthy();
  });

  it('derives restricted publishers from snippet-only aggregate sources', () => {
    const registry = loadLocalityRegistry(
      join(__dirname, 'fixtures', 'localities')
    );
    const berrien = registry
      .get('berrien-county-ga')
      .sources.find((source) => source.sourceKey === 'berrien-press');
    expect(berrien?.ownerSlug).toBe('berrien-county-ga');
    expect(berrien?.adapter).toBe('news-discover');
    expect(berrien?.accessMode).toBe('snippet-only');
    expect(
      findRestrictedPublisher(
        null,
        'https://www.theberrienpress.com/news/story'
      )?.domain
    ).toBe('theberrienpress.com');
    expect(findRestrictedPublisher('The Berrien Press')?.domain).toBe(
      'theberrienpress.com'
    );
    expect(
      findRestrictedPublisher(
        'Georgia Recorder',
        'https://georgiarecorder.com/feed/'
      )
    ).toBe(null);
  });

  it('normalizes URL-derived source identity and retains explicit source keys', () => {
    expect(
      resolveSourceIdentity({
        adapter: 'rss',
        url: 'HTTPS://Example.test/feed/',
      })
    ).toBe(
      resolveSourceIdentity({
        adapter: 'rss',
        url: 'https://example.test/feed',
      })
    );
    expect(
      resolveSourceIdentity({
        sourceKey: 'county-news',
        adapter: 'rss',
        url: 'https://example.test/feed/',
      })
    ).toBe('county-news');
  });

  it('collects sources from the edition, its ancestors, and places inside it, never siblings', () => {
    const registry = loadLocalityRegistry(fixtures);
    expect(slugs(registry.ancestry('town-a'))).toStrictEqual([
      'town-a',
      'county-a',
      'region-south',
      'state-ga',
      'us',
    ]);
    expect(registry.get('town-b').kind).toBe('city');
    expect(keys(registry.sourcesForRun('town-a'))).toStrictEqual([
      'county-discover',
      'county-minutes',
      'county-news',
      'county-paper',
      'region-news',
      'state-news',
      'town-a-news',
      'us-news',
    ]);
    expect(keys(registry.sourcesForRun('town-b')).includes('town-a-news')).toBe(
      false
    );
    expect(
      keys(registry.sourcesForRun('sibling-town')).includes('city-news')
    ).toBe(false);
  });

  it('supports nested places and a village with two parents', () => {
    const registry = loadLocalityRegistry(fixtures);
    expect(slugs(registry.ancestors('mystic-ct'))).toStrictEqual([
      'groton-ct',
      'stonington-ct',
      'southeastern-ct',
      'state-ct',
      'us',
    ]);
    expect(slugs(registry.descendants('groton-ct'))).toStrictEqual([
      'city-of-groton-ct',
      'mystic-ct',
    ]);
    const groton = keys(registry.sourcesForRun('groton-ct'));
    expect(groton.includes('city-of-groton-council')).toBeTruthy();
    expect(groton.includes('se-ct-news-discover')).toBeTruthy();
    expect(groton.includes('stonington-news')).toBe(false);
    expect(groton.includes('county-news')).toBe(false);
  });

  it('rejects missing parents, cycles, duplicate slugs, and duplicate source keys', () => {
    const registry = loadLocalityRegistry(fixtures);
    const all = [...registry.all()];
    const replace = (slug: string, patch: object) =>
      all.map((locality) =>
        locality.slug === slug ? { ...locality, ...patch } : locality
      );
    expect(() =>
      validateLocalityGraph(replace('town-a', { parents: ['missing'] }))
    ).toThrow(/missing parent missing/);
    expect(() =>
      validateLocalityGraph(replace('county-a', { parents: ['town-a'] }))
    ).toThrow(/cycle/);
    expect(() =>
      validateLocalityGraph([...all, registry.get('town-a')])
    ).toThrow(/duplicate locality slug town-a/);
    const sibling = registry.get('sibling-town');
    expect(() =>
      validateLocalityGraph(
        replace('sibling-town', {
          sources: [{ ...sibling.sources[0]!, sourceKey: 'town-a-news' }],
        })
      )
    ).toThrow(/duplicate sourceKey town-a-news/);
  });

  it('rejects a direct source that targets a configured restricted publisher', () => {
    withFixtureCopy((directory) => {
      appendSource(join(directory, 'ga/town-a.yaml'), [
        '  - sourceKey: ledger-direct',
        '    adapter: rss',
        '    name: Alpha Ledger direct',
        '    url: https://www.alphaledger.example/feed/',
        '    kind: news',
      ]);
      expect(() => loadLocalityRegistry(directory)).toThrow(
        /restricted publisher/
      );
    });
  });

  it('explains removed locality keys', () => {
    withFixtureCopy((directory) => {
      const file = join(directory, 'ga/town-a.yaml');
      writeFileSync(file, `${readFileSync(file, 'utf8')}tier: town\n`);
      expect(() => loadLocalityRegistry(directory)).toThrow(
        /tier was removed: use kind/
      );
    });
  });

  it('changes the rule version when inclusion inputs change', () => {
    const before = loadLocalityRegistry(fixtures);
    withFixtureCopy((directory) => {
      const file = join(directory, 'ga/county-a.yaml');
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replace(
          "excludePhrases: ['Alpha County, Illinois']",
          "excludePhrases: ['Alpha County, Illinois']\naliases: [Alpha]"
        )
      );
      const after = loadLocalityRegistry(directory);
      expect(after.ruleVersion('town-a')).toMatch(
        /^inclusion\.v1:[0-9a-f]{12}$/
      );
      expect(after.ruleVersion('town-a')).not.toBe(
        before.ruleVersion('town-a')
      );
      expect(after.ruleVersion('groton-ct')).toBe(
        before.ruleVersion('groton-ct')
      );
    });
  });

  it('keeps uncertain storable but not edition-includable', () => {
    expect(isEditionIncluded('uncertain')).toBe(false);
  });
});

function withFixtureCopy(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'civic-locality-registry-'));
  try {
    cpSync(fixtures, directory, { recursive: true });
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function appendSource(file: string, lines: string[]): void {
  writeFileSync(
    file,
    `${readFileSync(file, 'utf8').trimEnd()}\n${lines.join('\n')}\n`
  );
}
