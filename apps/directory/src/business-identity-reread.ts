import { businessNameHash, upstreamKeyHash } from './business-identity';

/**
 * Optional verified re-read of historical anchors (S5-item1-business-identity-design.md, section 4, decision 6).
 * Re-reading the SAME object (its etag equals the one the scan recorded as item-3 source evidence) at the SAME
 * `file_row_number` yields that row's upstream id as a fact, not a match. The re-read name, category and point
 * must equal the stored listing, or the row is skipped. Objects that are gone or differ are skipped. A scan
 * without item-3 evidence is excluded. The network sits behind an injected fetcher; this module never opens a
 * connection and never prints an id, key or hash.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

export interface RereadRow {
  readonly upstreamId: string;
  readonly name: string;
  readonly category: string;
  /** [longitude, latitude], the order the stored GeoJSON point uses. */
  readonly point: readonly [number, number];
}
/** What the fetcher saw at the object. `etag` is the object's ETag as served; `rows` is keyed by file row number. */
export interface RereadObject {
  readonly etag: string;
  readonly rows: Readonly<Record<string, RereadRow | undefined>>;
}
export interface RereadRequest {
  readonly artifactUrl: string;
  readonly etag: string;
  readonly rows: readonly string[];
}
/** Returns null when the object is gone. Must pin the request to `etag` (If-Match) and report the etag it got. */
export type RereadFetcher = (
  request: RereadRequest
) => Promise<RereadObject | null>;

export interface RereadCounts {
  examined: number;
  updated: number;
  alreadyRead: number;
  skippedNoEvidence: number;
  skippedObjectMissing: number;
  skippedObjectDiffers: number;
  skippedRowDiffers: number;
  skippedNoKey: number;
}

const sameNumber = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' && a === b;

/**
 * Candidates are anchored rows whose assertion is still `origin` with no key. `apply` false only counts what
 * would change. Writes only the assertion's key hash and evidence, compare-and-set on `evidence='origin'`.
 */
export async function rereadAnchors(
  db: Db,
  opts: { key: string; fetcher: RereadFetcher; apply?: boolean }
): Promise<RereadCounts> {
  if (typeof opts.key !== 'string' || opts.key.length < 32)
    throw Error(
      'A business identity key of at least 32 characters is required'
    );
  if (typeof opts.fetcher !== 'function') throw Error('A fetcher is required');
  const counts: RereadCounts = {
    examined: 0,
    updated: 0,
    alreadyRead: 0,
    skippedNoEvidence: 0,
    skippedObjectMissing: 0,
    skippedObjectDiffers: 0,
    skippedRowDiffers: 0,
    skippedNoKey: 0,
  };
  const rows = await db.query(
    `SELECT a.id, a."scanId", a."sourceFileRowNumber"::text AS row, a.evidence, a."upstreamKeyHash", r.listing, e."artifactUrl", e."artifactEtag"
       FROM directory_business_assertion a
       JOIN directory_overture_private_row r ON r."scanId"=a."scanId" AND r."sourceFileRowNumber"=a."sourceFileRowNumber"
       LEFT JOIN directory_overture_source_evidence e ON e."scanId"=a."scanId"
      WHERE a.state='current' AND a.evidence IN ('origin','artifact_reread')
      ORDER BY a."scanId", a."sourceFileRowNumber"`
  );
  const byScan = new Map<string, any[]>();
  for (const r of rows)
    byScan.set(r.scanId, [...(byScan.get(r.scanId) ?? []), r]);
  for (const [, group] of [...byScan].sort(([a], [b]) => (a < b ? -1 : 1))) {
    counts.examined += group.length;
    const todo = group.filter(
      (r) => r.evidence === 'origin' && r.upstreamKeyHash === null
    );
    counts.alreadyRead += group.length - todo.length;
    if (!todo.length) continue;
    const head = todo[0];
    if (!head.artifactEtag || !head.artifactUrl) {
      counts.skippedNoEvidence += todo.length;
      continue;
    }
    const object = await opts.fetcher({
      artifactUrl: head.artifactUrl,
      etag: head.artifactEtag,
      rows: todo.map((r) => r.row),
    });
    if (!object) {
      counts.skippedObjectMissing += todo.length;
      continue;
    }
    if (object.etag !== head.artifactEtag) {
      counts.skippedObjectDiffers += todo.length;
      continue;
    }
    for (const r of todo) {
      const seen = object.rows[r.row];
      const stored = r.listing as {
        name?: unknown;
        category?: unknown;
        location?: { coordinates?: unknown[] };
      } | null;
      const c = stored?.location?.coordinates;
      if (
        !seen ||
        !stored ||
        seen.name !== stored.name ||
        seen.category !== stored.category ||
        !Array.isArray(c) ||
        !sameNumber(c[0], seen.point?.[0]) ||
        !sameNumber(c[1], seen.point?.[1])
      ) {
        counts.skippedRowDiffers += 1;
        continue;
      }
      const hash = upstreamKeyHash(opts.key, seen.upstreamId);
      if (!hash) {
        counts.skippedNoKey += 1;
        continue;
      }
      if (!opts.apply) {
        counts.updated += 1;
        continue;
      }
      const done = await db.transaction(async (m) => {
        const w = await m.query(
          `UPDATE directory_business_assertion SET evidence='artifact_reread',"upstreamKeyHash"=$2,"nameHash"=COALESCE("nameHash",$3)
            WHERE id=$1 AND state='current' AND evidence='origin' AND "upstreamKeyHash" IS NULL RETURNING id`,
          [r.id, hash, businessNameHash(opts.key, stored.name)]
        );
        const hit = Array.isArray(w) && Array.isArray(w[0]) ? w[0] : w;
        return Array.isArray(hit) && hit.length > 0;
      });
      if (done) counts.updated += 1;
    }
  }
  return counts;
}
