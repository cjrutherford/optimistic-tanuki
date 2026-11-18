import { createHash } from 'node:crypto';
import {
  DIRECTORY_TAXONOMY_CATEGORIES,
  DIRECTORY_TAXONOMY_PLACE_TYPES,
  type TaxonomyExclusionReason,
  type TaxonomyMappingInstallResult,
  type TaxonomyMappingList,
  type TaxonomyMappingVersion,
} from '../../../libs/social/contracts/src/lib/directory';
import { IDEMPOTENCY_CONFLICT, ReviewConflictError } from './review-version';
import {
  findTaxonomyMapping,
  TAXONOMY_MAPPINGS,
  type TaxonomyMappingEntry,
  type TaxonomyMappingFile,
} from './taxonomy-mapping-data';

/**
 * Taxonomy mapping (S7d): the pure classifier, the canonical hash of a mapping file, and the idempotent
 * "install mapping version" operation that loads a checked-in file into the database.
 *
 * Effective category = operator override, else this mapping, else the stored (legacy) category. The classifier
 * here produces the middle step; overrides are applied by the served-read SQL and by the case store.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const VERSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface LoadedMapping {
  readonly id: string;
  readonly unmappedPolicy: 'keep_legacy' | 'exclude';
  readonly basic: ReadonlyMap<string, TaxonomyMappingEntry>;
  readonly nodes: ReadonlyMap<string, TaxonomyMappingEntry>;
}

export interface ClassifyInput {
  /** The stored Overture basic category. */
  readonly category: string | null | undefined;
  /** The taxonomy path, root first, when the listing carries one. */
  readonly taxonomyPath?: readonly string[] | null;
  readonly adult?: boolean;
}
export interface Classification {
  readonly categoryId: string | null;
  readonly placeTypeId: string | null;
  readonly basis: 'mapping' | 'legacy';
  readonly excluded: boolean;
  readonly exclusionReason: TaxonomyExclusionReason | null;
}

export function loadedFromFile(file: TaxonomyMappingFile): LoadedMapping {
  const basic = new Map<string, TaxonomyMappingEntry>();
  const nodes = new Map<string, TaxonomyMappingEntry>();
  for (const e of file.entries)
    (e.kind === 'basic_category' ? basic : nodes).set(e.key, e);
  return {
    id: file.version,
    unmappedPolicy: file.unmappedPolicy,
    basic,
    nodes,
  };
}

const excluded = (reason: TaxonomyExclusionReason): Classification => ({
  categoryId: null,
  placeTypeId: null,
  basis: 'mapping',
  excluded: true,
  exclusionReason: reason,
});

function fromEntry(
  e: TaxonomyMappingEntry,
  adult: boolean | undefined
): Classification {
  if (e.excluded)
    return excluded(e.exclusionReason ?? ('unmapped_taxonomy' as const));
  // Adult rows are served only to a visitor who opted in; a row not flagged adult never lands in the adult category.
  if (e.categoryId === 'adult' && adult !== true)
    return excluded('adult_restricted');
  return {
    categoryId: e.categoryId ?? null,
    placeTypeId: e.placeTypeId ?? null,
    basis: 'mapping',
    excluded: false,
    exclusionReason: null,
  };
}

/**
 * Most specific taxonomy node first, adult nodes always winning (as in the POC), then the stored basic category.
 * A category the mapping does not know follows the mapping's unmapped policy.
 */
export function classifyListing(
  mapping: LoadedMapping,
  input: ClassifyInput
): Classification {
  const path = (input.taxonomyPath ?? []).filter(
    (x): x is string => typeof x === 'string' && x.length > 0
  );
  const hits = path
    .map((k) => mapping.nodes.get(k))
    .filter((e): e is TaxonomyMappingEntry => !!e);
  const adultHit = hits.find((e) => e.categoryId === 'adult');
  const nodeHit = adultHit ?? hits[hits.length - 1];
  if (nodeHit) return fromEntry(nodeHit, input.adult);
  const category =
    typeof input.category === 'string' ? input.category.trim() : '';
  if (!category) return excluded('missing_basic_category');
  const basicHit = mapping.basic.get(category);
  if (basicHit) return fromEntry(basicHit, input.adult);
  if (mapping.unmappedPolicy === 'exclude')
    return excluded('unmapped_taxonomy');
  return {
    categoryId: category,
    placeTypeId: null,
    basis: 'legacy',
    excluded: false,
    exclusionReason: null,
  };
}

const sorted = (m: TaxonomyMappingFile) =>
  [...m.entries].sort((a, b) =>
    `${a.kind}\u0000${a.key}`.localeCompare(`${b.kind}\u0000${b.key}`)
  );

/** SHA-256 of the mapping's canonical JSON (entries ordered, so file order never changes the hash). */
export function mappingHash(m: TaxonomyMappingFile): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: m.version,
        unmappedPolicy: m.unmappedPolicy,
        categories: [...m.categories].sort(),
        placeTypes: [...m.placeTypes].map((p) => [p.id, p.categoryId]).sort(),
        entries: sorted(m).map((e) => [
          e.kind,
          e.key,
          e.categoryId ?? null,
          e.placeTypeId ?? null,
          e.excluded === true,
          e.exclusionReason ?? null,
        ]),
      })
    )
    .digest('hex');
}

/** Problems that make a mapping file unsafe to install; an empty list means it is valid. */
export function validateMappingFile(m: TaxonomyMappingFile): string[] {
  const problems: string[] = [];
  if (!VERSION_ID.test(m.version)) problems.push('version id is invalid');
  if (m.unmappedPolicy !== 'keep_legacy' && m.unmappedPolicy !== 'exclude')
    problems.push('unmapped policy is invalid');
  const known = new Set<string>(DIRECTORY_TAXONOMY_CATEGORIES.map((c) => c.id));
  const placeOwner = new Map<string, string>(
    DIRECTORY_TAXONOMY_PLACE_TYPES.map((p) => [p.id, p.categoryId])
  );
  const seen = new Set<string>();
  for (const e of m.entries) {
    const key = `${e.kind}:${e.key}`;
    if (seen.has(key)) problems.push(`duplicate entry ${key}`);
    seen.add(key);
    if (!e.key || e.key.length > 200) problems.push(`bad key ${key}`);
    if (e.excluded) {
      if (e.categoryId || e.placeTypeId || !e.exclusionReason)
        problems.push(`excluded entry ${key} must carry only a reason`);
    } else {
      if (!e.categoryId || !known.has(e.categoryId))
        problems.push(`entry ${key} has an unknown category`);
      if (e.exclusionReason)
        problems.push(`entry ${key} has a reason but is not excluded`);
      if (e.placeTypeId && placeOwner.get(e.placeTypeId) !== e.categoryId)
        problems.push(`entry ${key} has a place type outside its category`);
    }
  }
  return problems;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

const toVersion = (r: any): TaxonomyMappingVersion => ({
  id: r.id,
  sourceHash: r.sourceHash,
  unmappedPolicy: r.unmappedPolicy,
  active: r.active === true,
  installedById: r.installedById ?? null,
  createdAt: iso(r.createdAt),
  activatedAt: r.activatedAt ? iso(r.activatedAt) : null,
  rowCount: Number(r.rowCount ?? 0),
});

const VERSION_SELECT = `SELECT v.id,v."sourceHash",v."unmappedPolicy",v.active,v."installedById",v."createdAt",v."activatedAt",
  (SELECT count(*)::int FROM directory_taxonomy_mapping_row r WHERE r."versionId"=v.id) AS "rowCount"
  FROM directory_taxonomy_mapping_version v`;

export async function listTaxonomyMappings(q: Q): Promise<TaxonomyMappingList> {
  const rows = await q.query(
    `${VERSION_SELECT} ORDER BY v."createdAt" DESC, v.id`
  );
  const installed = new Set(rows.map((r: any) => r.id));
  return {
    versions: rows.map(toVersion),
    available: TAXONOMY_MAPPINGS.map((m) => ({
      id: m.version,
      installed: installed.has(m.version),
    })),
  };
}

/** The active mapping, loaded for classification; null when none is installed and active. */
export async function loadActiveMapping(q: Q): Promise<LoadedMapping | null> {
  const [v] = await q.query(
    `SELECT id,"unmappedPolicy" FROM directory_taxonomy_mapping_version WHERE active=true`
  );
  return v ? loadMapping(q, v.id) : null;
}

export async function loadMapping(
  q: Q,
  versionId: string
): Promise<LoadedMapping | null> {
  const [v] = await q.query(
    `SELECT id,"unmappedPolicy" FROM directory_taxonomy_mapping_version WHERE id=$1`,
    [versionId]
  );
  if (!v) return null;
  const rows = await q.query(
    `SELECT kind,"overtureKey" AS key,"categoryId","placeTypeId",excluded,"exclusionReason"
     FROM directory_taxonomy_mapping_row WHERE "versionId"=$1`,
    [versionId]
  );
  return loadedFromFile({
    version: v.id,
    unmappedPolicy: v.unmappedPolicy,
    categories: [],
    placeTypes: [],
    entries: rows.map((r: any) => ({
      kind: r.kind,
      key: r.key,
      ...(r.categoryId ? { categoryId: r.categoryId } : {}),
      ...(r.placeTypeId ? { placeTypeId: r.placeTypeId } : {}),
      ...(r.excluded ? { excluded: true as const } : {}),
      ...(r.exclusionReason ? { exclusionReason: r.exclusionReason } : {}),
    })),
  });
}

/**
 * Installs a checked-in mapping version. Idempotent: installing the same version again changes nothing (and
 * activates it if asked and not yet active). A version id already installed with different content is refused,
 * so history is never rewritten; a changed mapping is a new version.
 */
export async function installTaxonomyMapping(
  db: Db,
  input: { version: string; activate: boolean; actorId: string }
): Promise<TaxonomyMappingInstallResult> {
  if (
    typeof input.version !== 'string' ||
    !VERSION_ID.test(input.version) ||
    typeof input.activate !== 'boolean' ||
    !UUID.test(input.actorId)
  )
    throw Error('Invalid mapping install');
  const file = findTaxonomyMapping(input.version);
  if (!file) throw Error('Invalid mapping install: unknown version');
  const problems = validateMappingFile(file);
  if (problems.length) throw Error(`Invalid mapping install: ${problems[0]}`);
  const hash = mappingHash(file);
  return db.transaction(async (q) => {
    await q.query(
      `SELECT pg_advisory_xact_lock(hashtext('directory_taxonomy_mapping'))`
    );
    const [existing] = await q.query(
      `SELECT id,"sourceHash",active FROM directory_taxonomy_mapping_version WHERE id=$1 FOR UPDATE`,
      [file.version]
    );
    let replayed = true;
    if (existing) {
      if (existing.sourceHash !== hash)
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
    } else {
      replayed = false;
      await q.query(
        `INSERT INTO directory_taxonomy_mapping_version (id,"sourceHash","unmappedPolicy",active,"installedById","createdAt")
         VALUES ($1,$2,$3,false,$4,clock_timestamp())`,
        [file.version, hash, file.unmappedPolicy, input.actorId]
      );
      const entries = sorted(file);
      for (let i = 0; i < entries.length; i += 500) {
        const slice = entries.slice(i, i + 500);
        await q.query(
          `INSERT INTO directory_taxonomy_mapping_row ("versionId",kind,"overtureKey","categoryId","placeTypeId",excluded,"exclusionReason")
           SELECT $1,u.kind,u.key,u.cat,u.place,u.excl,u.reason
           FROM unnest($2::text[],$3::text[],$4::text[],$5::text[],$6::boolean[],$7::text[]) AS u(kind,key,cat,place,excl,reason)`,
          [
            file.version,
            slice.map((e) => e.kind),
            slice.map((e) => e.key),
            slice.map((e) => e.categoryId ?? null),
            slice.map((e) => e.placeTypeId ?? null),
            slice.map((e) => e.excluded === true),
            slice.map((e) => e.exclusionReason ?? null),
          ]
        );
      }
    }
    if (input.activate && !(existing && existing.active === true)) {
      replayed = false;
      await q.query(
        `UPDATE directory_taxonomy_mapping_version SET active=false WHERE active=true AND id<>$1`,
        [file.version]
      );
      await q.query(
        `UPDATE directory_taxonomy_mapping_version SET active=true,"activatedAt"=clock_timestamp() WHERE id=$1`,
        [file.version]
      );
    }
    const [row] = await q.query(`${VERSION_SELECT} WHERE v.id=$1`, [
      file.version,
    ]);
    return { replayed, version: toVersion(row) };
  });
}

/** The taxonomy path a stored listing carries, root first, when it has one (most private rows do not). */
export function taxonomyPathOf(listing: any): string[] {
  const raw = listing?.taxonomyPath ?? listing?.taxonomy?.hierarchy;
  return Array.isArray(raw)
    ? raw.filter((x: unknown): x is string => typeof x === 'string')
    : [];
}

export interface EffectiveClassification {
  readonly categoryId: string | null;
  readonly placeTypeId: string | null;
  readonly basis: 'override' | 'mapping' | 'legacy';
  readonly excluded: boolean;
  readonly exclusionReason: TaxonomyExclusionReason | null;
}

/** Override, else mapping, else the stored category. An override beats an exclusion. */
export function effectiveClassification(
  mapping: LoadedMapping | null,
  override: { categoryId: string; placeTypeId: string | null } | null,
  listing: any
): EffectiveClassification {
  if (override)
    return {
      categoryId: override.categoryId,
      placeTypeId: override.placeTypeId,
      basis: 'override',
      excluded: false,
      exclusionReason: null,
    };
  if (!mapping) {
    const c = typeof listing?.category === 'string' ? listing.category : null;
    return {
      categoryId: c,
      placeTypeId: null,
      basis: 'legacy',
      excluded: false,
      exclusionReason: null,
    };
  }
  return classifyListing(mapping, {
    category: listing?.category,
    taxonomyPath: taxonomyPathOf(listing),
    adult: listing?.adult === true,
  });
}

export interface TaxonomyCaseFlag {
  readonly reason: 'unmapped_taxonomy' | 'ambiguous_taxonomy';
  /** The stored category, or the competing node keys for an ambiguous listing. */
  readonly observed: string;
}

/** Every taxonomy path a stored listing carries: the single path, plus any alternate `taxonomyPaths`. */
function taxonomyPathsOf(listing: any): string[][] {
  const paths: string[][] = [];
  const single = taxonomyPathOf(listing);
  if (single.length) paths.push(single);
  if (Array.isArray(listing?.taxonomyPaths))
    for (const p of listing.taxonomyPaths)
      if (Array.isArray(p)) {
        const clean = p.filter(
          (x: unknown): x is string => typeof x === 'string' && x.length > 0
        );
        if (clean.length) paths.push(clean);
      }
  return paths;
}

const sameOutcome = (a: TaxonomyMappingEntry, b: TaxonomyMappingEntry) =>
  (a.categoryId ?? null) === (b.categoryId ?? null) &&
  (a.placeTypeId ?? null) === (b.placeTypeId ?? null) &&
  (a.excluded === true) === (b.excluded === true);

/**
 * Whether a listing needs an operator's decision under a mapping. `unmapped_taxonomy`: it has a category but no
 * taxonomy node or basic-category entry knows it. `ambiguous_taxonomy`: several taxonomy paths reach a node of
 * the same (greatest) depth and those nodes map to different outcomes, so "most specific wins" cannot choose.
 * An adult node always wins, as in the classifier, so it is never ambiguous.
 */
export function taxonomyCaseFlag(
  mapping: LoadedMapping,
  listing: any
): TaxonomyCaseFlag | null {
  const hits: { depth: number; key: string; entry: TaxonomyMappingEntry }[] =
    [];
  for (const path of taxonomyPathsOf(listing)) {
    let best: (typeof hits)[number] | null = null;
    path.forEach((key, depth) => {
      const entry = mapping.nodes.get(key);
      if (entry) best = { depth, key, entry };
    });
    if (best) hits.push(best);
  }
  if (hits.some((h) => h.entry.categoryId === 'adult')) return null;
  if (hits.length) {
    const top = Math.max(...hits.map((h) => h.depth));
    const tied = hits.filter((h) => h.depth === top);
    const first = tied[0];
    if (tied.some((h) => !sameOutcome(h.entry, first.entry)))
      return {
        reason: 'ambiguous_taxonomy',
        observed: [...new Set(tied.map((h) => h.key))].sort().join(' | '),
      };
    return null;
  }
  const category =
    typeof listing?.category === 'string' ? listing.category.trim() : '';
  if (!category || mapping.basic.has(category)) return null;
  return { reason: 'unmapped_taxonomy', observed: category };
}
