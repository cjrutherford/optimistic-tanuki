import { createHash } from 'node:crypto';
import { businessNameHash } from './business-identity';

/**
 * Historical anchors (S5-item1-business-identity-design.md, section 4). Existing scans have no source key, so no
 * historical row is ever matched to another row. A row gets an `origin` business only when something durable is
 * already attached to it: a listing identity with a link request, a non-retired reviewed binding, or a published
 * address-review candidate. Each anchored row gets one assertion with a null upstream key. These can never carry
 * automatically; every other row stays row-scoped. Nothing here reads a name, a position or a row number to match.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64 = /^[a-f0-9]{64}$/;
export const ANCHOR_BATCH = 500;
export const ANCHOR_CLASSES = ['linkRequest', 'binding', 'candidate'] as const;
export type AnchorClass = (typeof ANCHOR_CLASSES)[number];

export interface AnchorRow {
  readonly town: string;
  readonly scanId: string;
  readonly row: string;
  readonly policyId: string;
  readonly classes: readonly AnchorClass[];
  readonly name: string | null;
}

export interface AnchorPlan {
  readonly digest: string;
  readonly towns: number;
  readonly counts: Readonly<{ linkRequest: number; binding: number; candidate: number; rows: number; unanchorable: number; alreadyAnchored: number; toMint: number }>;
  readonly rows: readonly AnchorRow[];
}

const townLock = (town: string) => `directory-business-identity:${town}`;
const cmp = (a: { scanId: string; row: string }, b: { scanId: string; row: string }) =>
  a.scanId < b.scanId ? -1 : a.scanId > b.scanId ? 1 : BigInt(a.row) < BigInt(b.row) ? -1 : BigInt(a.row) > BigInt(b.row) ? 1 : 0;

/**
 * Anchor rows of one town (or all). A row is anchorable only when its private row exists in the anchoring town
 * and belongs to a cohort; anything else is counted as unanchorable and never invented.
 */
async function loadAnchors(q: Q, town?: string): Promise<{ rows: AnchorRow[]; unanchorable: number; counts: Record<AnchorClass, number>; assertedKeys: Set<string> }> {
  const found = await q.query(
    `WITH anchors AS (
       SELECT li."communityId" AS town, li."scanId", li."sourceFileRowNumber" AS row, 'linkRequest' AS cls
         FROM directory_listing_identity li
        WHERE EXISTS (SELECT 1 FROM directory_business_link_request q WHERE q."listingId"=li.id)
       UNION ALL
       SELECT b."communityId", b."scanId", b."sourceFileRowNumber", 'binding' FROM directory_reviewed_binding b WHERE b.state<>'retired'
       UNION ALL
       SELECT c."communityId", c."scanId", c."sourceFileRowNumber", 'candidate' FROM directory_address_review_candidate c WHERE c.status='published')
     SELECT a.town, a."scanId", a.row::text AS row, a.cls, m."policyId", r.listing->>'name' AS name,
            (r."scanId" IS NOT NULL AND r."regionId"=a.town::text AND m."scanId" IS NOT NULL) AS ok
       FROM anchors a
       LEFT JOIN directory_overture_private_row r ON r."scanId"=a."scanId" AND r."sourceFileRowNumber"=a.row
       LEFT JOIN directory_overture_private_membership m ON m."scanId"=a."scanId"
      WHERE ($1::uuid IS NULL OR a.town=$1::uuid)`,
    [town ?? null]
  );
  const byRow = new Map<string, { town: string; scanId: string; row: string; policyId: string; name: string | null; classes: Set<AnchorClass> }>();
  const counts: Record<AnchorClass, number> = { linkRequest: 0, binding: 0, candidate: 0 };
  let unanchorable = 0;
  const bad = new Set<string>();
  for (const f of found) {
    const key = `${f.scanId}:${f.row}`;
    if (!f.ok || !UUID.test(f.town) || !HEX64.test(f.scanId) || !HEX64.test(f.policyId ?? '')) { bad.add(key); continue; }
    const entry = byRow.get(key) ?? { town: f.town, scanId: f.scanId, row: f.row, policyId: f.policyId, name: f.name ?? null, classes: new Set<AnchorClass>() };
    entry.classes.add(f.cls);
    byRow.set(key, entry);
  }
  unanchorable = [...bad].filter((k) => !byRow.has(k)).length;
  for (const e of byRow.values()) for (const c of e.classes) counts[c] += 1;
  const asserted = await q.query('SELECT "scanId", "sourceFileRowNumber"::text AS row FROM directory_business_assertion WHERE ($1::uuid IS NULL OR "communityId"=$1::uuid)', [town ?? null]);
  const assertedKeys = new Set<string>(asserted.map((a: { scanId: string; row: string }) => `${a.scanId}:${a.row}`));
  const rows = [...byRow.values()]
    .map((e): AnchorRow => ({ town: e.town, scanId: e.scanId, row: e.row, policyId: e.policyId, name: e.name, classes: ANCHOR_CLASSES.filter((c) => e.classes.has(c)) }))
    .sort(cmp);
  return { rows, unanchorable, counts, assertedKeys };
}

/** Read-only plan. The digest covers the anchor set, not whether a row is already minted, so a repeat run matches. */
export async function planAnchors(q: Q, opts: { town?: string } = {}): Promise<AnchorPlan> {
  const { rows, unanchorable, counts, assertedKeys } = await loadAnchors(q, opts.town);
  const digest = createHash('sha256');
  for (const r of rows) digest.update(`${r.town}\t${r.scanId}\t${r.row}\t${r.classes.join(',')}\n`);
  const alreadyAnchored = rows.filter((r) => assertedKeys.has(`${r.scanId}:${r.row}`)).length;
  return {
    digest: digest.digest('hex'),
    towns: new Set(rows.map((r) => r.town)).size,
    counts: { ...counts, rows: rows.length, unanchorable, alreadyAnchored, toMint: rows.length - alreadyAnchored },
    rows,
  };
}

export interface AnchorResult { readonly planDigest: string; readonly minted: number; readonly skipped: number }

/**
 * Mints one `origin` business and one null-key assertion per anchored row that has none yet. Town by town, in
 * transactions of ANCHOR_BATCH rows; each transaction recomputes the town's plan under the town lock and aborts
 * when the anchor set changed. A row that already has any assertion is skipped, so a repeat run writes nothing.
 */
export async function applyAnchors(db: Db, opts: { planDigest: string; key: string; batchSize?: number }): Promise<AnchorResult> {
  if (!HEX64.test(opts.planDigest)) throw Error('A plan digest is required');
  if (typeof opts.key !== 'string' || opts.key.length < 32) throw Error('A business identity key of at least 32 characters is required');
  const plan = await planAnchors(db);
  if (plan.digest !== opts.planDigest) throw Error('Plan digest does not match the current plan; run --check again');
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? ANCHOR_BATCH, ANCHOR_BATCH));
  const perTown = new Map<string, AnchorRow[]>();
  for (const r of plan.rows) perTown.set(r.town, [...(perTown.get(r.town) ?? []), r]);
  let minted = 0, skipped = 0;
  for (const [town, planned] of [...perTown].sort(([a], [b]) => (a < b ? -1 : 1))) {
    for (let at = 0; at < planned.length; at += batchSize) {
      const batch = planned.slice(at, at + batchSize);
      const result = await db.transaction(async (m) => {
        await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))', [townLock(town)]);
        const current = await loadAnchors(m, town);
        const expect = planned.map((r) => `${r.scanId}:${r.row}:${r.classes.join(',')}`).join('|');
        if (current.rows.map((r) => `${r.scanId}:${r.row}:${r.classes.join(',')}`).join('|') !== expect) throw Error('The anchor set changed during apply; refusing to continue');
        let did = 0, skip = 0;
        for (const row of batch) {
          if (current.assertedKeys.has(`${row.scanId}:${row.row}`)) { skip += 1; continue; }
          const [business] = await m.query('INSERT INTO directory_business ("communityId") VALUES ($1) RETURNING id', [town]);
          await m.query(
            `INSERT INTO directory_business_assertion ("businessId","communityId","scanId","sourceFileRowNumber","policyId",evidence,confidence,"upstreamKeyHash","nameHash",state)
             VALUES ($1,$2,$3,$4,$5,'origin','origin',NULL,$6,'current')`,
            [business.id, town, row.scanId, row.row, row.policyId, businessNameHash(opts.key, row.name)]
          );
          await m.query(
            `INSERT INTO directory_business_event ("businessId",kind,cause,"scanId","sourceFileRowNumber") VALUES ($1,'created','historical_anchor',$2,$3)`,
            [business.id, row.scanId, row.row]
          );
          did += 1;
        }
        return { did, skip };
      });
      minted += result.did; skipped += result.skip;
    }
  }
  return { planDigest: plan.digest, minted, skipped };
}
