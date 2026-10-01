import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  discoverSources,
  loadLocalityRegistry,
  normalizedAddress,
  OfficialDirectories,
  OutboundPolicy,
  searchProviderFromEnvironment,
  type LocalityConfig,
  type SourceConfig,
  type SourcingDecision,
} from '@optimistic-tanuki/civic-core';
import { registerAllAdapters } from '../src/index.js';

/**
 * Discovery benchmark (plan slice P1.7): runs source discovery for each
 * edition town with its hand-written sources hidden, and scores what it
 * adopts against them. Live network; run on demand only:
 *
 *   [SEARCH_URL=http://127.0.0.1:8980] CIVIC_BENCH_OUT=<dir> \
 *     nx run civic-adapters:discovery-benchmark
 */

const LOCAL_KINDS = new Set([
  'town',
  'city',
  'village',
  'county',
  'school-district',
]);

const repoData = resolve('data');
const out = resolve(process.env['CIVIC_BENCH_OUT'] ?? 'tmp/civic-discovery');
const directoriesDir = resolve(
  process.env['CIVIC_BENCH_DIRECTORIES'] ?? join(out, 'directories')
);
const registry = loadLocalityRegistry(
  join(__dirname, '../../core/test/fixtures/localities'),
  undefined
);
const towns = (process.env['CIVIC_BENCH_TOWNS'] ?? '')
  .split(',')
  .filter(Boolean);
const editions = registry
  .editions()
  .filter((town) => !towns.length || towns.includes(town.slug));
const search = searchProviderFromEnvironment();
const mode = search ? `search-${search.name}` : 'no-search';

function host(url: string): string {
  return new URL(url).hostname.replace(/^www\./u, '');
}

interface HandSource {
  ownerSlug: string;
  sourceKey: string;
  adapter: string;
  url: string;
  /** Whether discovery looks for it: sources of the town and local governments around it. */
  inScope: boolean;
  match: 'exact' | 'same-host' | 'missed';
}

function handSources(town: LocalityConfig): HandSource[] {
  const related = [
    { place: town, local: true },
    ...registry
      .ancestors(town.slug)
      .map((place) => ({ place, local: LOCAL_KINDS.has(place.kind) })),
    ...registry
      .descendants(town.slug)
      .map((place) => ({ place, local: LOCAL_KINDS.has(place.kind) })),
  ];
  return related.flatMap(({ place, local }) =>
    place.sources
      .filter((source: SourceConfig) => source.enabled !== false)
      .map((source: SourceConfig) => ({
        ownerSlug: place.slug,
        sourceKey: source.sourceKey,
        adapter: source.adapter,
        url: source.url,
        inScope: local,
        match: 'missed' as const,
      }))
  );
}

function score(hand: HandSource[], adopted: SourcingDecision[]): HandSource[] {
  const exact = new Set(adopted.map((d) => normalizedAddress(d.source.url)));
  const hosts = new Set(adopted.map((d) => host(d.source.url)));
  return hand.map((source) => ({
    ...source,
    match: exact.has(normalizedAddress(source.url))
      ? 'exact'
      : hosts.has(host(source.url))
      ? 'same-host'
      : 'missed',
  }));
}

beforeAll(() => {
  registerAllAdapters();
  mkdirSync(join(out, mode), { recursive: true });
  mkdirSync(directoriesDir, { recursive: true });
  // Adapters cache downloads under ./data; keep them with the reports.
  process.chdir(out);
});

describe(`discovery benchmark (${mode})`, () => {
  for (const town of editions) {
    it(`sources ${town.slug} blind`, async () => {
      // Caches go to ./data; a stray repo-root data/ appeared once (see plan).
      expect(process.cwd()).toBe(out);
      const started = Date.now();
      const ancestors = registry.ancestors(town.slug);
      const descendants = registry.descendants(town.slug);
      const httpClient = new OutboundPolicy();
      const directories = await new OfficialDirectories(
        directoriesDir,
        httpClient
      ).sitesFor([town, ...ancestors, ...descendants]);
      // Blind: nothing is configured, so every hand-written source is fair game.
      const { decisions, pagesRead } = await discoverSources({
        locality: town,
        ancestors: [...ancestors, ...descendants],
        existing: [],
        httpClient,
        search,
        officialSites: directories.sites,
        governmentDomains: directories.governmentDomains,
      });
      const adopted = decisions.filter((d) => d.adopted);
      const hand = score(handSources(town), adopted);
      const handHosts = new Set(hand.map((source) => host(source.url)));
      const report = {
        town: town.slug,
        mode,
        seconds: Math.round((Date.now() - started) / 1000),
        pagesRead,
        directoryNotes: directories.notes,
        officialSites: directories.sites,
        hand,
        adopted: adopted.map((d) => ({
          adapter: d.source.adapter,
          url: d.source.url,
          ownerSlug: d.ownerSlug,
          via: d.via,
          knownHost: handHosts.has(host(d.source.url)),
        })),
        refused: decisions
          .filter((d) => !d.adopted)
          .map((d) => ({
            adapter: d.source.adapter,
            url: d.source.url,
            via: d.via,
            reason: d.reasons[0] ?? '',
          })),
      };
      writeFileSync(
        join(out, mode, `${town.slug}.json`),
        `${JSON.stringify(report, null, 2)}\n`
      );
      expect(report.town).toBe(town.slug);
      expect(process.cwd()).toBe(out);
      expect(existsSync(repoData) && repoData !== join(out, 'data')).toBe(
        false
      );
    });
  }
});
