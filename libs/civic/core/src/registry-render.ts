import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import YAML from 'yaml';
import { parseDiscoveredSource, validateLocalityConfig } from './config.js';
import {
  resolveSourceIdentity,
  validateLocalityGraph,
} from './locality-registry.js';
import type { LocalityRow, SourceRow } from './schema.js';
import type { LocalityConfig } from './types.js';

/** One generated YAML document, addressed relative to the registry directory. */
export interface RenderedFile {
  relativePath: string;
  contents: string;
}

/** A row left out of the registry, and why. */
export interface ExcludedRow {
  /** Locality slug, or source key (falling back to the source id). */
  key: string;
  kind: 'locality' | 'source';
  reason: string;
}

export interface RenderedRegistry {
  files: RenderedFile[];
  excluded: ExcludedRow[];
}

/** Kinds whose name alone is too general to place an item; the registry marks them `broad`. */
const BROAD_KINDS = new Set(['country', 'state', 'region', 'planning-region']);

type Doc = Record<string, unknown>;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJson(text: string | null | undefined, field: string): unknown {
  if (text === null || text === undefined || text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${field} is not valid JSON`);
  }
}

function put(doc: Doc, key: string, value: unknown): void {
  if (value !== undefined && value !== null) doc[key] = value;
}

/** A locality row as a YAML document, without its sources. Throws on unparseable JSON columns. */
function localityDoc(row: LocalityRow): Doc {
  const kind = row.kind ?? 'town';
  const doc: Doc = {
    slug: row.slug,
    name: row.name,
    kind,
    state: row.state,
    timezone: row.timezone,
    lat: row.lat,
    lon: row.lon,
  };
  put(doc, 'parents', parseJson(row.parents, 'parents'));
  if (BROAD_KINDS.has(kind)) doc['broad'] = true;
  if (row.edition === true) doc['edition'] = true;
  put(doc, 'aliases', parseJson(row.aliases, 'aliases'));
  put(doc, 'excludePhrases', parseJson(row.excludePhrases, 'excludePhrases'));
  put(doc, 'officials', parseJson(row.officials, 'officials'));
  put(doc, 'topics', parseJson(row.topics, 'topics'));
  put(doc, 'cadence', parseJson(row.cadence, 'cadence'));
  put(doc, 'websites', parseJson(row.websites, 'websites'));
  return doc;
}

function sourceDoc(row: SourceRow): Doc {
  const doc: Doc = {};
  doc['sourceKey'] =
    row.sourceKey ??
    resolveSourceIdentity({ adapter: row.adapter, url: row.url });
  put(doc, 'coverage', row.coverage);
  doc['adapter'] = row.adapter;
  doc['name'] = row.name;
  doc['url'] = row.url;
  doc['kind'] = row.kind;
  put(doc, 'config', parseJson(row.config, 'config'));
  put(doc, 'desk', row.desk);
  put(doc, 'accessMode', row.accessMode);
  put(doc, 'accessRestrictionReason', row.accessRestrictionReason);
  put(doc, 'restrictionPolicyUrl', row.restrictionPolicyUrl);
  put(doc, 'aggregateDiscovery', row.aggregateDiscovery);
  put(doc, 'aggregateUrl', row.aggregateUrl);
  put(
    doc,
    'coverageCapabilities',
    parseJson(row.coverageCapabilities, 'coverageCapabilities')
  );
  return doc;
}

/**
 * Render the locality registry as YAML from database rows.
 *
 * One file per locality, `<state>/<slug>.yaml`: the loader reads one locality
 * per file and owns each source by the file that declares it, so this is the
 * layout with no grouping logic. Output is deterministic (sorted by slug).
 *
 * A row the loader would refuse is left out with a reason, and so is
 * everything that depends on it, so one bad town never breaks the registry.
 * Inactive localities and disabled sources are left out too. Columns the
 * schema does not hold (`excludePhrases`, `officials`) cannot be rendered;
 * `broad` is derived from the locality kind.
 */
export function renderLocalityRegistry(
  localities: readonly LocalityRow[],
  sources: readonly SourceRow[]
): RenderedRegistry {
  const excluded: ExcludedRow[] = [];
  const skip = (kind: ExcludedRow['kind'], key: string, reason: string) =>
    excluded.push({ kind, key, reason });

  // 1. Per-row validation of localities.
  const candidates = new Map<string, { doc: Doc; config: LocalityConfig }>();
  const sortedRows = [...localities].sort((a, b) =>
    a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
  );
  for (const row of sortedRows) {
    if (row.active === false) {
      skip('locality', row.slug, 'inactive');
      continue;
    }
    if (candidates.has(row.slug)) {
      skip('locality', row.slug, `duplicate locality slug ${row.slug}`);
      continue;
    }
    try {
      const doc = localityDoc(row);
      candidates.set(row.slug, { doc, config: validateLocalityConfig(doc) });
    } catch (error) {
      skip('locality', row.slug, message(error));
    }
  }

  // 2. Keep only localities whose parents are all kept (peel from the roots).
  const accepted = new Set<string>();
  for (let progressed = true; progressed; ) {
    progressed = false;
    for (const [slug, { config }] of candidates) {
      if (accepted.has(slug)) continue;
      if (config.parents.every((parent) => accepted.has(parent))) {
        accepted.add(slug);
        progressed = true;
      }
    }
  }
  const excludedSlugs = new Set(
    excluded.filter((e) => e.kind === 'locality').map((e) => e.key)
  );
  for (const [slug, { config }] of candidates) {
    if (accepted.has(slug)) continue;
    const unknown = config.parents.find((p) => !candidates.has(p));
    const dropped = config.parents.find(
      (p) => candidates.has(p) && !accepted.has(p) && p !== slug
    );
    const cyclic = config.parents.find((p) => !accepted.has(p));
    skip(
      'locality',
      slug,
      unknown
        ? excludedSlugs.has(unknown)
          ? `parent ${unknown} is excluded`
          : `missing parent ${unknown} for ${slug}`
        : dropped
        ? `parent ${dropped} is excluded or part of a parent cycle`
        : `parent cycle detected through ${cyclic}`
    );
  }

  // 3. Sources: each must validate alone, be enabled, have a kept owner and a unique key.
  const parsed = new Map<string, LocalityConfig['sources']>();
  const docs = new Map<string, Doc[]>();
  const seenKeys = new Map<string, string>();
  const sortedSources = [...sources].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  const keepSource = (row: SourceRow): void => {
    const owner = row.ownerSlug ?? row.localitySlug ?? '';
    let key = row.sourceKey ?? row.id;
    try {
      if (row.enabled === false) {
        skip('source', key, 'disabled');
        return;
      }
      if (!accepted.has(owner)) {
        skip(
          'source',
          key,
          `owner ${owner || '(none)'} is not in the registry`
        );
        return;
      }
      const doc = sourceDoc(row);
      key = doc['sourceKey'] as string;
      const config = parseDiscoveredSource(doc, owner);
      const existing = seenKeys.get(config.sourceKey);
      if (existing) {
        skip(
          'source',
          config.sourceKey,
          `duplicate sourceKey ${config.sourceKey} in ${existing} and ${owner}`
        );
        return;
      }
      seenKeys.set(config.sourceKey, owner);
      parsed.set(owner, [...(parsed.get(owner) ?? []), config]);
      docs.set(owner, [...(docs.get(owner) ?? []), doc]);
    } catch (error) {
      skip('source', key, message(error));
    }
  };
  sortedSources.forEach(keepSource);

  // 4. Cross-source rules (restricted publishers) are only checkable on the whole graph.
  const assemble = () =>
    [...accepted].map((slug) => ({
      ...candidates.get(slug)!.config,
      sources: parsed.get(slug) ?? [],
    }));
  for (let guard = 0; ; guard++) {
    try {
      validateLocalityGraph(assemble());
      break;
    } catch (error) {
      const match = /source (\S+) targets a restricted publisher/u.exec(
        message(error)
      );
      if (!match || guard > sources.length) throw error;
      const key = match[1];
      for (const [owner, list] of parsed)
        parsed.set(
          owner,
          list.filter((s) => s.sourceKey !== key)
        );
      for (const [owner, list] of docs)
        docs.set(
          owner,
          list.filter((d) => d['sourceKey'] !== key)
        );
      skip('source', key, message(error));
    }
  }

  const files: RenderedFile[] = [...accepted].sort().map((slug) => {
    const { doc, config } = candidates.get(slug)!;
    const body: Doc = { ...doc };
    // Round-trip through the validated config's defaults only where the loader needs them.
    body['topics'] = config.topics;
    body['cadence'] = config.cadence;
    const owned = docs.get(slug) ?? [];
    if (owned.length) body['sources'] = owned;
    return {
      relativePath: `${config.state.toLowerCase()}/${slug}.yaml`,
      contents: YAML.stringify(body),
    };
  });
  return { files, excluded };
}

/**
 * Write rendered files to `dir` so a concurrent reader sees either the old
 * registry or the new one, never a partial one: the files go to a sibling
 * temp directory, which is then renamed over `dir`. The previous directory is
 * moved aside first and removed afterwards; with no previous directory (first
 * run) the rename alone installs it.
 */
export function writeLocalityRegistry(
  dir: string,
  files: readonly RenderedFile[]
): void {
  const parent = dirname(dir);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, `.${basename(dir)}.new-`));
  try {
    for (const file of files) {
      const target = join(staging, file.relativePath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.contents);
    }
    const stale = existsSync(dir)
      ? join(parent, `.${basename(dir)}.old-${process.pid}-${Date.now()}`)
      : undefined;
    if (stale) renameSync(dir, stale);
    try {
      renameSync(staging, dir);
    } catch (error) {
      if (stale) renameSync(stale, dir);
      throw error;
    }
    if (stale) rmSync(stale, { recursive: true, force: true });
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}
