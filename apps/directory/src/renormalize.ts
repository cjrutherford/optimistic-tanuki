import type { DataSource } from 'typeorm';
import {
  NORMALIZER_VERSION,
  normalizeRecord,
  toStored,
  type FieldState,
} from './normalize';

type Db = Pick<DataSource, 'query' | 'transaction'>;

/**
 * Re-normalisation without re-acquisition (D27). The rows a scan staged keep the raw name and category (and the raw
 * contact fields, where the listing retains them), so the normalised block can be rebuilt from the stored rows when
 * NORMALIZER_VERSION is bumped. It only ever touches `listing.normalized`, so it is idempotent: a row already on the
 * current version is left alone, a second pass changes nothing.
 *
 * Two limits, both reported rather than hidden:
 *  - A listing that does not retain its raw address, phone or website keeps the validity states the earlier version
 *    computed from the source record; only name, category and the keys derived from them are rebuilt.
 *  - A row that a reviewed binding or reviewed spatial entry points at is skipped, because those entries pin the exact
 *    listing text (`md5(listing::text)`), and the row is counted in `skipped`.
 */
export interface RenormalizeOutcome {
  scanId: string;
  version: string;
  scanned: number;
  updated: number;
  skipped: number;
  dryRun: boolean;
}

const BATCH = 2000;

export function rebuildNormalized(listing: any) {
  const raw = {
    names: { primary: typeof listing?.name === 'string' ? listing.name : '' },
    basic_category: listing?.category,
    addresses: listing?.addresses,
    phones: listing?.phones,
    websites: listing?.websites,
  };
  const fresh = toStored(normalizeRecord('overture', raw));
  const old = listing?.normalized;
  // Fields the listing cannot recompute keep the state the source record gave them.
  for (const f of ['address', 'phone', 'website', 'hours'] as const) {
    const retained =
      f === 'address'
        ? listing?.addresses
        : f === 'phone'
        ? listing?.phones
        : f === 'website'
        ? listing?.websites
        : undefined;
    if (retained === undefined && old && typeof old[f] === 'string')
      fresh[f] = old[f] as FieldState;
  }
  if (!listing?.addresses && !listing?.phones && !listing?.websites)
    delete fresh.contact;
  return fresh;
}

export async function renormalizeScan(
  db: Db,
  scanId: string,
  options: { dryRun?: boolean; version?: string } = {}
): Promise<RenormalizeOutcome> {
  const dryRun = options.dryRun === true;
  const out: RenormalizeOutcome = {
    scanId,
    version: options.version ?? NORMALIZER_VERSION,
    scanned: 0,
    updated: 0,
    skipped: 0,
    dryRun,
  };
  let after = '-1';
  for (;;) {
    const rows: {
      n: string;
      listing: any;
      pinned: boolean;
    }[] = await db.query(
      `SELECT r."sourceFileRowNumber"::text AS n, r.listing,
              (EXISTS (SELECT 1 FROM directory_reviewed_spatial s WHERE s."scanId"=r."scanId" AND s."sourceFileRowNumber"=r."sourceFileRowNumber")
            OR EXISTS (SELECT 1 FROM directory_reviewed_binding b WHERE b."scanId"=r."scanId" AND b."sourceFileRowNumber"=r."sourceFileRowNumber")) AS pinned
         FROM directory_overture_private_row r
        WHERE r."scanId"=$1 AND r."sourceFileRowNumber">$2::bigint AND r.listing IS NOT NULL
          AND (r.listing#>>'{normalized,v}') IS DISTINCT FROM $3
        ORDER BY r."sourceFileRowNumber" LIMIT ${BATCH}`,
      [scanId, after, out.version]
    );
    if (!rows.length) break;
    for (const r of rows) {
      out.scanned++;
      if (r.pinned) {
        out.skipped++;
        continue;
      }
      const next = { ...rebuildNormalized(r.listing), v: out.version };
      out.updated++;
      if (!dryRun)
        await db.query(
          `UPDATE directory_overture_private_row SET listing = listing || jsonb_build_object('normalized', $3::jsonb)
            WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2::bigint`,
          [scanId, r.n, JSON.stringify(next)]
        );
    }
    after = rows[rows.length - 1].n;
    if (rows.length < BATCH) break;
  }
  if (!dryRun)
    await db.query(
      `INSERT INTO directory_scan_normalization ("scanId","normalizerVersion","rowCount")
       VALUES ($1::varchar,$2::varchar,(SELECT count(*) FROM directory_overture_private_row WHERE "scanId"=$1::varchar))
       ON CONFLICT ("scanId") DO UPDATE SET "normalizerVersion"=EXCLUDED."normalizerVersion","rowCount"=EXCLUDED."rowCount","normalizedAt"=clock_timestamp()`,
      [scanId, out.version]
    );
  return out;
}

/** Live scans whose recorded normalizer version is missing or not the current one. */
export async function scansNeedingNormalization(
  db: Pick<DataSource, 'query'>,
  limit = 100,
  version: string = NORMALIZER_VERSION
): Promise<string[]> {
  const rows: { scanId: string }[] = await db.query(
    `SELECT c."scanId" FROM directory_overture_private_completion c
      WHERE NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=c."scanId")
        AND EXISTS (SELECT 1 FROM directory_town_scan_target s WHERE s."scanId"=c."scanId"
              AND NOT EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."communityId"=s."communityId" AND z."scanId"=s."scanId"))
        AND NOT EXISTS (SELECT 1 FROM directory_scan_normalization n WHERE n."scanId"=c."scanId" AND n."normalizerVersion"=$2)
      ORDER BY c."scanId" LIMIT $1`,
    [limit, version]
  );
  return rows.map((r) => r.scanId);
}

export async function renormalizePending(
  db: Db,
  options: { dryRun?: boolean; limit?: number; version?: string } = {}
): Promise<RenormalizeOutcome[]> {
  const out: RenormalizeOutcome[] = [];
  for (const scanId of await scansNeedingNormalization(
    db,
    options.limit ?? 100,
    options.version
  ))
    out.push(await renormalizeScan(db, scanId, options));
  return out;
}
