import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadLocalityConfig,
  LocalityConfigError,
  parseDiscoveredSource,
} from './config.js';
import {
  findRestrictedPublisher,
  restrictedPublishers,
  restrictedPublishersFromSources,
  setRestrictedPublishers,
} from './restricted-publishers.js';
import type { LocalityConfig, SourceConfig } from './types.js';

/** Sources carry their owner slug directly; the alias remains for callers that name the resolved form. */
export type ResolvedSource = SourceConfig;

export const INCLUSION_RULES_VERSION = 'inclusion.v1';

export interface LocalityRegistry {
  rootDirectory: string;
  get(slug: string): LocalityConfig;
  all(): readonly LocalityConfig[];
  /** Localities that publish their own briefing. */
  editions(): readonly LocalityConfig[];
  /** Every containing locality, nearest first, without duplicates. */
  ancestors(slug: string): readonly LocalityConfig[];
  /** Every contained locality, nearest first, without duplicates. */
  descendants(slug: string): readonly LocalityConfig[];
  /** The locality followed by its ancestors. */
  ancestry(slug: string): readonly LocalityConfig[];
  /** Sources owned by the locality, its ancestors, or its descendants. */
  sourcesForRun(slug: string): readonly SourceConfig[];
  /** Version of the inclusion inputs for an edition; changes when relevant configuration changes. */
  ruleVersion(slug: string): string;
}

export function resolveSourceIdentity(input: {
  sourceKey?: string;
  adapter: string;
  url: string;
}): string {
  let url: URL;
  try {
    url = new URL(input.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('unsupported protocol');
  } catch {
    throw new LocalityConfigError('url must be a valid http or https URL');
  }
  if (input.sourceKey !== undefined) {
    const key = input.sourceKey.normalize('NFKC').trim().toLowerCase();
    if (!key)
      throw new LocalityConfigError('sourceKey must be a non-empty string');
    return key;
  }
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return `${input.adapter.trim().toLowerCase()}:${url.toString()}`;
}

function walk(
  start: string,
  next: (slug: string) => readonly string[]
): string[] {
  const seen = new Set<string>([start]);
  const order: string[] = [];
  let frontier = [...next(start)];
  while (frontier.length) {
    const upcoming: string[] = [];
    for (const slug of frontier) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      order.push(slug);
      upcoming.push(...next(slug));
    }
    frontier = upcoming;
  }
  return order;
}

/** Validate a complete locality set: unique slugs and source keys, known parents, no cycles, and restricted publishers only via aggregates. */
export function validateLocalityGraph(
  localities: readonly LocalityConfig[]
): void {
  const bySlug = new Map<string, LocalityConfig>();
  for (const locality of localities) {
    if (bySlug.has(locality.slug))
      throw new LocalityConfigError(`duplicate locality slug ${locality.slug}`);
    bySlug.set(locality.slug, locality);
  }
  const sourceKeys = new Map<string, string>();
  for (const locality of localities) {
    for (const parent of locality.parents) {
      if (!bySlug.has(parent))
        throw new LocalityConfigError(
          `missing parent ${parent} for ${locality.slug}`
        );
    }
    for (const source of locality.sources) {
      if (source.ownerSlug !== locality.slug)
        throw new LocalityConfigError(
          `source ${source.sourceKey} must be declared by its owner ${source.ownerSlug}`
        );
      const existing = sourceKeys.get(source.sourceKey);
      if (existing)
        throw new LocalityConfigError(
          `duplicate sourceKey ${source.sourceKey} in ${existing} and ${locality.slug}`
        );
      sourceKeys.set(source.sourceKey, locality.slug);
    }
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (slug: string, path: string[]): void => {
    if (state.get(slug) === 'done') return;
    if (state.get(slug) === 'visiting')
      throw new LocalityConfigError(
        `parent cycle detected: ${[...path, slug].join(' -> ')}`
      );
    state.set(slug, 'visiting');
    for (const parent of bySlug.get(slug)!.parents)
      visit(parent, [...path, slug]);
    state.set(slug, 'done');
  };
  for (const locality of localities) visit(locality.slug, []);
  const publishers = restrictedPublishersFromSources(
    localities.flatMap((locality) => locality.sources)
  );
  const previous = restrictedPublishers();
  setRestrictedPublishers(publishers);
  try {
    for (const source of localities.flatMap((locality) => locality.sources)) {
      if (source.adapter === 'news-discover') continue;
      if (
        findRestrictedPublisher(null, source.url) ||
        (source.aggregateUrl &&
          findRestrictedPublisher(null, source.aggregateUrl))
      ) {
        throw new LocalityConfigError(
          `source ${source.sourceKey} targets a restricted publisher; use news-discover aggregate ingestion`
        );
      }
    }
  } finally {
    setRestrictedPublishers(previous);
  }
}

/** Build a registry from parsed localities. Also installs the configured restricted publishers. */
export function createLocalityRegistry(
  localities: readonly LocalityConfig[],
  rootDirectory = process.cwd()
): LocalityRegistry {
  validateLocalityGraph(localities);
  setRestrictedPublishers(
    restrictedPublishersFromSources(
      localities.flatMap((locality) => locality.sources)
    )
  );
  const bySlug = new Map(
    localities.map((locality) => [locality.slug, locality])
  );
  const children = new Map<string, string[]>();
  for (const locality of localities) {
    for (const parent of locality.parents)
      children.set(parent, [...(children.get(parent) ?? []), locality.slug]);
  }
  const get = (slug: string): LocalityConfig => {
    const locality = bySlug.get(slug);
    if (!locality) throw new LocalityConfigError(`unknown locality ${slug}`);
    return locality;
  };
  const ancestors = (slug: string) =>
    walk(get(slug).slug, (current) => get(current).parents).map(get);
  const descendants = (slug: string) =>
    walk(get(slug).slug, (current) => children.get(current) ?? []).map(get);
  const sourcesForRun = (slug: string): SourceConfig[] => {
    const owners = new Set([
      slug,
      ...ancestors(slug).map((locality) => locality.slug),
      ...descendants(slug).map((locality) => locality.slug),
    ]);
    return localities
      .filter((locality) => owners.has(locality.slug))
      .flatMap((locality) => locality.sources)
      .filter((source) => source.enabled !== false)
      .sort((a, b) =>
        a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0
      );
  };
  return {
    rootDirectory,
    get,
    all: () => localities,
    editions: () => localities.filter((locality) => locality.edition),
    ancestors,
    descendants,
    ancestry: (slug) => [get(slug), ...ancestors(slug)],
    sourcesForRun,
    ruleVersion(slug) {
      const related = [get(slug), ...ancestors(slug), ...descendants(slug)]
        .map((locality) => ({
          slug: locality.slug,
          name: locality.name,
          state: locality.state,
          parents: locality.parents,
          broad: locality.broad === true,
          aliases: locality.aliases ?? [],
          excludePhrases: locality.excludePhrases ?? [],
        }))
        .sort((a, b) => a.slug.localeCompare(b.slug));
      const sources = sourcesForRun(slug).map((source) => ({
        sourceKey: source.sourceKey,
        ownerSlug: source.ownerSlug,
        coverage: source.coverage,
        kind: source.kind,
        aggregateDiscovery: source.aggregateDiscovery === true,
      }));
      const digest = createHash('sha256')
        .update(JSON.stringify({ related, sources }))
        .digest('hex')
        .slice(0, 12);
      return `${INCLUSION_RULES_VERSION}:${digest}`;
    },
  };
}

function localityFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return localityFiles(path);
      return entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')
        ? [path]
        : [];
    })
    .sort();
}

/**
 * Load every locality YAML under a directory, including nested folders (for
 * example, one per state).
 *
 * Sources the sourcing engine adopted are merged in from `discovered` (by
 * default CIVIC_DISCOVERED_SOURCES): one file per locality, each source
 * validated as a hand-written one would be. A hand-written source always
 * wins a clash of keys or addresses, and a discovered source the operator
 * marked `enabled: false` stays off. Without the directory, nothing changes,
 * which is how replays stay a function of their corpus.
 */
export function loadLocalityRegistry(
  directory: string,
  discovered: string | undefined = process.env['CIVIC_DISCOVERED_SOURCES']
): LocalityRegistry {
  const rootDirectory = realpathSync(directory);
  const localities = localityFiles(directory).map((file) =>
    loadLocalityConfig(file)
  );
  return createLocalityRegistry(
    discovered ? mergeDiscovered(localities, discovered) : localities,
    rootDirectory
  );
}

/** The sources adopted for one locality, as the sourcing engine writes them. */
export interface DiscoveredSourcesFile {
  localitySlug: string;
  sources: {
    source: Record<string, unknown>;
    discoveredAt: string;
    via: string;
    evidence: string[];
  }[];
}

export function discoveredSourcesPath(
  directory: string,
  localitySlug: string
): string {
  return join(directory, `${localitySlug}.json`);
}

function mergeDiscovered(
  localities: readonly LocalityConfig[],
  directory: string
): LocalityConfig[] {
  if (!existsSync(directory)) return [...localities];
  const configured = new Set(
    localities.flatMap((locality) =>
      locality.sources.flatMap((source) => [
        source.sourceKey,
        normalizedAddress(source.url),
      ])
    )
  );
  return localities.map((locality) => {
    const path = discoveredSourcesPath(directory, locality.slug);
    if (!existsSync(path)) return locality;
    const file = JSON.parse(
      readFileSync(path, 'utf8')
    ) as DiscoveredSourcesFile;
    const adopted = (file.sources ?? [])
      .map((entry) => parseDiscoveredSource(entry.source, locality.slug))
      .filter(
        (source) =>
          !configured.has(source.sourceKey) &&
          !configured.has(normalizedAddress(source.url))
      );
    return adopted.length
      ? { ...locality, sources: [...locality.sources, ...adopted] }
      : locality;
  });
}

/** An address as sources are compared: host and path, without scheme, www, query order or trailing slash. */
export function normalizedAddress(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname
      .replace(/^www\./u, '')
      .toLowerCase()}${parsed.pathname.replace(/\/+$/u, '').toLowerCase()}`;
  } catch {
    return url.trim().toLowerCase();
  }
}
