import { distanceMeters } from './alltheplaces';
import {
  audit,
  lockTown,
  type Db,
  type PairListing,
  type Q,
} from './duplicate-review';

/**
 * Automatic handling of the duplicate queue (owner decisions D13 and D18, 2026-11-18).
 *
 *  1. Stale cleanup. A case whose listings are gone (row missing, scan revoked or retired, row revoked) can no longer be
 *     reviewed. It is closed as `stale` with the reason recorded and the hiding suppression lifted, so a listing that
 *     survives elsewhere is not left hidden by a pair that no longer exists. Reviewer decisions are never touched.
 *  2. Conservative same-place rules. Only pairs that are almost certainly one place are resolved automatically, as
 *     `merged` with `decidedBy='auto'` and the rule id on the case and its event (`actorKind='auto'`). The weaker
 *     listing stays hidden (that is what D13 already does), so the rule changes who owns the decision, not what the
 *     public sees. Auto-resolved cases stay in the D18 sample population (state `merged`), so the wrong-merge rate
 *     still covers them, and a reviewer can undo or swap them. A case a reviewer has ever touched is never resolved
 *     automatically.
 *
 * Both steps are idempotent and have a dry-run that reports counts without writing.
 */
export const AUTO_RULE_EXACT = 'auto_exact_name_colocated';
export const AUTO_RULE_VARIANT = 'auto_brand_variant_colocated';
export const AUTO_RULES: readonly string[] = [
  AUTO_RULE_EXACT,
  AUTO_RULE_VARIANT,
];
/** Same name once punctuation, case, filler words and apostrophes are ignored, and the points are this close. */
export const AUTO_EXACT_MAX_METERS = 25;
/** One name contains the other (a brand and its longer listing form), the points are this close, sources differ. */
export const AUTO_VARIANT_MAX_METERS = 10;
export const AUTO_VARIANT_MAX_EXTRA_TOKENS = 3;
const FILLER = new Set(['the', 'and', 'of', 'inc', 'llc', 'co', 'company']);
/** A single-word name this generic ("Cafe") says nothing about which business it is. */
const GENERIC = new Set([
  'cafe',
  'coffee',
  'pizza',
  'market',
  'store',
  'shop',
  'grill',
  'bar',
  'restaurant',
  'salon',
  'bank',
  'church',
  'school',
  'hotel',
  'motel',
  'gas',
  'station',
  'diner',
  'deli',
]);
/** An extra word that names a different part of a site (a pharmacy inside a grocery), so the pair may be two listings. */
const DEPARTMENT = new Set([
  'pharmacy',
  'bakery',
  'deli',
  'bank',
  'atm',
  'fuel',
  'gas',
  'vision',
  'optical',
  'clinic',
  'urgent',
  'care',
  'wireless',
  'cafe',
  'coffee',
  'bar',
  'liquor',
  'drive',
  'thru',
  'kiosk',
  'express',
  'outlet',
  'warehouse',
  'floral',
  'portrait',
  'studio',
  'salon',
  'tire',
  'tires',
  'service',
  'services',
]);

const tokens = (name: string): Set<string> =>
  new Set(
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/['’`]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter((t) => t && !FILLER.has(t))
  );

const datasets = (l: PairListing): Set<string> =>
  new Set((l.sources ?? []).map((s) => s?.dataset ?? ''));

/** The rule id when the pair is almost certainly one place, else null. Pure; symmetric in its two listings. */
export function autoResolveRule(
  a: PairListing,
  b: PairListing,
  distance: number = distanceMeters(
    [a.coordinates[0], a.coordinates[1]],
    [b.coordinates[0], b.coordinates[1]]
  )
): string | null {
  if (!(distance <= AUTO_EXACT_MAX_METERS)) return null;
  const ta = tokens(a.name);
  const tb = tokens(b.name);
  if (!ta.size || !tb.size) return null;
  const shared = [...ta].filter((t) => tb.has(t)).length;
  const small = ta.size <= tb.size ? ta : tb;
  const big = ta.size <= tb.size ? tb : ta;
  if (shared !== small.size) return null;
  const extras = [...big].filter((t) => !small.has(t));
  if (!extras.length) return AUTO_RULE_EXACT;
  if (distance > AUTO_VARIANT_MAX_METERS) return null;
  if (extras.length > AUTO_VARIANT_MAX_EXTRA_TOKENS) return null;
  if (extras.some((t) => DEPARTMENT.has(t))) return null;
  if (small.size < 2) {
    const [only] = [...small];
    if (only.length < 5 || GENERIC.has(only)) return null;
  }
  const da = datasets(a);
  const db = datasets(b);
  const sameSources = da.size === db.size && [...da].every((d) => db.has(d));
  return sameSources ? null : AUTO_RULE_VARIANT;
}

export interface AutoResolveResult {
  readonly examined: number;
  readonly resolved: number;
  readonly byRule: Readonly<Record<string, number>>;
  readonly caseIds: readonly string[];
}

const BATCH = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const listingOf = (scanId: string, row: string, l: any): PairListing | null => {
  const c = l?.location?.coordinates;
  if (
    typeof l?.name !== 'string' ||
    !Array.isArray(c) ||
    !Number.isFinite(c[0]) ||
    !Number.isFinite(c[1])
  )
    return null;
  return {
    scanId,
    row,
    name: l.name,
    category: l.category,
    coordinates: [c[0], c[1]],
    sources: Array.isArray(l.sources) ? l.sources : [],
  };
};

/**
 * Resolves open cases of one town (or every town when `townId` is omitted) that match a same-place rule. Never
 * touches a case a reviewer has acted on. `dryRun` reports what would resolve and writes nothing.
 */
export async function autoResolveDuplicates(
  db: Db,
  input: { townId?: string; dryRun?: boolean; limit?: number } = {}
): Promise<AutoResolveResult> {
  if (input.townId !== undefined && !UUID.test(input.townId))
    throw Error('Invalid duplicate case');
  const limit = Math.min(Math.max(input.limit ?? BATCH, 1), 50_000);
  const run = async (q: Q, lock: boolean) => {
    const rows = await q.query(
      `SELECT c.id, c."communityId" AS town, c."keptScanId", c."keptRow"::text AS "keptRow", c."hiddenScanId", c."hiddenRow"::text AS "hiddenRow",
              kr.listing AS kept, hr.listing AS hidden
         FROM directory_duplicate_case c
         JOIN directory_overture_private_row kr ON kr."scanId"=c."keptScanId" AND kr."sourceFileRowNumber"=c."keptRow"
         JOIN directory_overture_private_row hr ON hr."scanId"=c."hiddenScanId" AND hr."sourceFileRowNumber"=c."hiddenRow"
        WHERE c.state='queued' AND ($1::uuid IS NULL OR c."communityId"=$1::uuid)
          AND NOT EXISTS (SELECT 1 FROM directory_duplicate_case_event e WHERE e."caseId"=c.id AND e."actorId" IS NOT NULL)
        ORDER BY c."communityId", c.id LIMIT ${limit}`,
      [input.townId ?? null]
    );
    const byRule: Record<string, number> = {};
    const caseIds: string[] = [];
    for (const r of rows) {
      const kept = listingOf(r.keptScanId, r.keptRow, r.kept);
      const hidden = listingOf(r.hiddenScanId, r.hiddenRow, r.hidden);
      if (!kept || !hidden) continue;
      const rule = autoResolveRule(kept, hidden);
      if (!rule) continue;
      if (!input.dryRun) {
        if (lock) await lockTown(q, r.town);
        const done = await q.query(
          `UPDATE directory_duplicate_case SET state='merged',"decidedAt"=CURRENT_TIMESTAMP,"decidedBy"='auto',"autoRule"=$2
            WHERE id=$1 AND state='queued' RETURNING id`,
          [r.id, rule]
        );
        if (!done.length) continue;
        await audit(
          q,
          r.id,
          'auto_merged',
          null,
          `same place by ${rule}; the weaker listing stays hidden`,
          { kind: 'auto', ruleId: rule }
        );
      }
      byRule[rule] = (byRule[rule] ?? 0) + 1;
      caseIds.push(r.id);
    }
    return {
      examined: rows.length,
      resolved: caseIds.length,
      byRule,
      caseIds,
    };
  };
  return input.dryRun ? run(db, false) : db.transaction((tx) => run(tx, true));
}

export const STALE_REASONS = [
  'row_missing',
  'scan_revoked',
  'row_revoked',
  'scan_retired',
] as const;
export interface StaleCloseResult {
  readonly examined: number;
  readonly closed: number;
  readonly byReason: Readonly<Record<string, number>>;
}

const sideReason = (side: 'kept' | 'hidden') => `CASE
  WHEN NOT EXISTS (SELECT 1 FROM directory_overture_private_row r WHERE r."scanId"=c."${side}ScanId" AND r."sourceFileRowNumber"=c."${side}Row") THEN 'row_missing'
  WHEN EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=c."${side}ScanId") THEN 'scan_revoked'
  WHEN EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=c."${side}ScanId" AND x."sourceFileRowNumber"=c."${side}Row") THEN 'row_revoked'
  WHEN EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."communityId"=c."communityId" AND z."scanId"=c."${side}ScanId") THEN 'scan_retired'
  END`;

/**
 * Closes open and automatically resolved cases whose kept or hidden listing is no longer live. Works across every town
 * (or one when `townId` is given) because a town whose scans were all retired is no longer visited by the sweep.
 */
export async function closeStaleDuplicateCases(
  db: Db,
  input: { townId?: string; dryRun?: boolean; limit?: number } = {}
): Promise<StaleCloseResult> {
  if (input.townId !== undefined && !UUID.test(input.townId))
    throw Error('Invalid duplicate case');
  const limit = Math.min(Math.max(input.limit ?? BATCH, 1), 50_000);
  const find = (q: Q) =>
    q.query(
      `SELECT * FROM (
         SELECT c.id, c."communityId" AS town, c."suppressionId",
                ${sideReason('kept')} AS "keptReason", ${sideReason(
        'hidden'
      )} AS "hiddenReason"
           FROM directory_duplicate_case c
          WHERE (c.state='queued' OR (c.state='merged' AND c."decidedBy"='auto'))
            AND ($1::uuid IS NULL OR c."communityId"=$1::uuid)) s
        WHERE s."keptReason" IS NOT NULL OR s."hiddenReason" IS NOT NULL
        ORDER BY s.town, s.id LIMIT ${limit}`,
      [input.townId ?? null]
    );
  const reasonOf = (r: any): string =>
    r.keptReason
      ? `kept listing ${r.keptReason}`
      : `hidden listing ${r.hiddenReason}`;
  const tally = (rows: any[]) => {
    const byReason: Record<string, number> = {};
    for (const r of rows) {
      const k = r.keptReason ?? r.hiddenReason;
      byReason[k] = (byReason[k] ?? 0) + 1;
    }
    return byReason;
  };
  if (input.dryRun) {
    const rows = await find(db);
    return { examined: rows.length, closed: 0, byReason: tally(rows) };
  }
  const candidates = await find(db);
  const closedRows: any[] = [];
  const towns = [...new Set(candidates.map((r: any) => r.town as string))];
  for (const town of towns) {
    await db.transaction(async (tx) => {
      await lockTown(tx, town);
      for (const r of candidates.filter((x: any) => x.town === town)) {
        const done = await tx.query(
          `UPDATE directory_duplicate_case SET state='stale',"decidedAt"=CURRENT_TIMESTAMP,"decidedBy"='system',"autoRule"=NULL
            WHERE id=$1 AND (state='queued' OR (state='merged' AND "decidedBy"='auto')) RETURNING id`,
          [r.id]
        );
        if (!done.length) continue;
        if (r.suppressionId)
          await tx.query(
            `UPDATE directory_listing_suppression SET "liftedAt"=CURRENT_TIMESTAMP,"liftReasonCode"='resolved'
              WHERE id=$1 AND "liftedAt" IS NULL`,
            [r.suppressionId]
          );
        await audit(tx, r.id, 'closed_stale', null, `stale: ${reasonOf(r)}`, {
          kind: 'system',
        });
        closedRows.push(r);
      }
    });
  }
  return {
    examined: candidates.length,
    closed: closedRows.length,
    byReason: tally(closedRows),
  };
}
