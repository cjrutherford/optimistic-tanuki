import { supersededByLiveCohort } from './business-identity-read';
import type {
  LocalDirectoryCoverage,
  LocalDirectoryCoverageState,
} from '../../../libs/social/contracts/src/lib/directory';

/**
 * Coverage: what persisted facts prove about a town's listings. Town-level and unfiltered, so a page filtered by
 * q, category, bounds or cursor that happens to hold no rows never turns into `empty`. Freshness is a separate
 * label and never reaches this module.
 */
export const WITHHELD_CAP = 1_000_000;

/** FROM clause shared by the listing read and coverage: a row is only reachable through a bound, completed, unrevoked-policy scan. */
export const SERVED_ROW_FROM = `directory_overture_private_row r
      JOIN directory_overture_private_membership m ON m."scanId"=r."scanId"
      JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false
      JOIN directory_overture_private_completion c ON c."scanId"=r."scanId"`;

/**
 * A reviewer's open suppression hides the row it names and, once the row is a business, every row currently
 * asserted to that business, so a later scan cannot bring a suppressed listing back. A lift ends it; the
 * suppression rows are history and nothing here reads or changes source provenance.
 */
export const notSuppressedSql = (row: string): string =>
  `AND NOT EXISTS (SELECT 1 FROM directory_listing_suppression sp
        WHERE sp."liftedAt" IS NULL
        AND ((sp."scanId"=${row}."scanId" AND sp."sourceFileRowNumber"=${row}."sourceFileRowNumber")
          OR (sp."businessId" IS NOT NULL AND EXISTS (SELECT 1 FROM directory_business_assertion sa
              WHERE sa."scanId"=${row}."scanId" AND sa."sourceFileRowNumber"=${row}."sourceFileRowNumber"
              AND sa."businessId"=sp."businessId" AND sa.state='current'))))`;

/** Visibility predicates shared by the listing read and coverage. The adult choice is deliberately not part of them. */
export const servedRowWhere = (town: string, changeToken: string): string =>
  `r."regionId"=${town} AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=r."scanId")
      AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")
      ${supersededByLiveCohort('r')}
      ${notSuppressedSql('r')}
      AND (NOT (r.listing ? 'assignmentChangeToken') OR r.listing->>'assignmentChangeToken'=${changeToken})`;

/** The active, unexpired binding that lets a reviewed row show its reviewed fields. */
export const reviewedActiveSql = (row: string): string =>
  `EXISTS (SELECT 1 FROM directory_reviewed_binding b WHERE b."scanId"=${row}."scanId" AND b."sourceFileRowNumber"=${row}."sourceFileRowNumber" AND b.state='active' AND b."verifiedUntil">now())`;

export interface CoverageFacts {
  served: boolean;
  completedLive: boolean;
  acquiring: boolean;
  anyTarget: boolean;
  /**
   * Global fact: some non-revoked source policy exists. Only an explicit `false` means unconfigured; a caller that
   * cannot say (undefined) keeps the town-level states.
   */
  anyActivePolicy?: boolean;
  withheldReviewedDetails: number;
}

export function deriveCoverage(facts: CoverageFacts): LocalDirectoryCoverage {
  const withheldReviewedDetails = Math.min(
    Math.max(0, Math.trunc(Number(facts.withheldReviewedDetails) || 0)),
    WITHHELD_CAP
  );
  const state = (
    s: LocalDirectoryCoverageState,
    reason?: 'policy-withdrawn'
  ): LocalDirectoryCoverage => ({
    state: s,
    ...(reason ? { reason } : {}),
    withheldReviewedDetails,
  });
  if (facts.served) return state(facts.acquiring ? 'partial' : 'available');
  // Nothing is configured or publication is paused globally: no town-level fact can be true. A town withdrawn by
  // policy keeps its more specific `blocked`, and town-ineligible is decided before this function is reached.
  if (
    facts.anyActivePolicy === false &&
    !(facts.anyTarget && !facts.acquiring && !facts.completedLive)
  )
    return state('unconfigured');
  if (facts.completedLive) return state('empty');
  if (facts.acquiring) return state('acquiring');
  if (facts.anyTarget) return state('blocked', 'policy-withdrawn');
  return state('unknown');
}

export const BLOCKED_TOWN_INELIGIBLE: LocalDirectoryCoverage = Object.freeze({
  state: 'blocked',
  reason: 'town-ineligible',
  withheldReviewedDetails: 0,
}) as LocalDirectoryCoverage;

type Q = {
  query: (sql: string, params?: unknown[]) => Promise<any>;
};
type Db = Q & { transaction?: (...args: any[]) => Promise<any> };

/** A scan counts only while its completion stands, its policy is active and nothing withdrew it. */
const LIVE_SCAN = `EXISTS (SELECT 1 FROM directory_overture_private_completion c WHERE c."scanId"=t."scanId")
        AND EXISTS (SELECT 1 FROM directory_overture_private_membership m JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false WHERE m."scanId"=t."scanId")
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=t."scanId")`;

const SQL = `SELECT
  EXISTS (SELECT 1 FROM ${SERVED_ROW_FROM} WHERE ${servedRowWhere(
  '$1::text',
  '$2'
)}) AS served,
  EXISTS (SELECT 1 FROM directory_town_scan_target t WHERE t."communityId"=$1::uuid AND ${LIVE_SCAN}) AS "completedLive",
  EXISTS (SELECT 1 FROM directory_town_scan_target t WHERE t."communityId"=$1::uuid
    AND NOT EXISTS (SELECT 1 FROM directory_overture_private_completion c WHERE c."scanId"=t."scanId")
    AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=t."scanId")) AS acquiring,
  EXISTS (SELECT 1 FROM directory_town_scan_target t WHERE t."communityId"=$1::uuid) AS "anyTarget",
  EXISTS (SELECT 1 FROM directory_overture_private_policy p WHERE p.revoked=false) AS "anyActivePolicy",
  (SELECT count(*)::int FROM (SELECT 1 FROM ${SERVED_ROW_FROM} WHERE ${servedRowWhere(
  '$1::text',
  '$2'
)} AND r.listing ? 'reviewed' AND NOT ${reviewedActiveSql(
  'r'
)} LIMIT ${WITHHELD_CAP}) w) AS "withheld"`;

/**
 * One read-only statement (one MVCC snapshot) under the listing's 2 s statement timeout. `changeToken` is the
 * town's current assignment token, the same one the listing filters on. Adult rows count as served whatever the
 * request's adult choice, because coverage is a town fact; only a state and a count leave this function, never
 * which rows were adult.
 */
export async function townCoverage(
  db: Db,
  town: string,
  changeToken: string
): Promise<LocalDirectoryCoverage> {
  const run = async (q: Q) => {
    const [row] = await q.query(SQL, [town, changeToken]);
    return deriveCoverage({
      served: row?.served === true,
      completedLive: row?.completedLive === true,
      acquiring: row?.acquiring === true,
      anyTarget: row?.anyTarget === true,
      ...(row?.anyActivePolicy === undefined
        ? {}
        : { anyActivePolicy: row.anyActivePolicy === true }),
      withheldReviewedDetails: Number(row?.withheld ?? 0),
    });
  };
  if (typeof db.transaction !== 'function') return run(db);
  return db.transaction('READ COMMITTED', async (manager: Q) => {
    await manager.query('SET TRANSACTION READ ONLY');
    await manager.query("SET LOCAL statement_timeout='2s'");
    return run(manager);
  });
}
