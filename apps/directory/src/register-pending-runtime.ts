import {
  overtureReleasePanel,
  primePromotedRights,
  promotedRightsPolicy,
  rejectReleaseCandidate,
  retryReleaseCandidate,
} from './overture-release';
import { readFileSync } from 'node:fs';
import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import {
  businessIdentityHealth,
  type BusinessIdentityHealth,
  listIdentityReviewQueue,
} from './business-identity-review';
import {
  decideBusinessIdentity,
  type DecisionAction,
  type DecisionRow,
} from './business-identity-decision';
import { accountLifecycleConfig } from './account-lifecycle-server';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  validBaseListing,
  reviewedFields,
  mappableReviewed,
  readSpatialState,
  countMissingSpatial,
  REVIEWED_SPATIAL_VALIDATOR_VERSION,
} from './reviewed-spatial';
import {
  aggregateFreshness,
  freshnessCounts,
  PageFreshness,
} from './source-freshness';
import { openListingCursor, sealListingCursor } from './local-listing-cursor';
import { parseListingBounds } from './local-listing-bounds';
import {
  getOrCreateListingIdentities,
  findListingIdentity,
} from './listing-identity';
import {
  requestBusinessLink,
  reviewBusinessLink,
  revokeBusinessLink,
  readBusinessLink,
  listBusinessLinkRequests,
  listTownBusinessLinkRequests,
  listOwnerBusinessLinks,
} from './listing-business-link';
import {
  openListingReference,
  sealListingReference,
} from './local-listing-reference';
import {
  businessIdsForRows,
  businessOfSourceRow,
  resolveBusinessId,
  servingGeneration,
  supersededByLiveCohort,
} from './business-identity-read';
import { DataSource } from 'typeorm';
import { RegisterDeliveryV2 } from '../../directory-worker/src/register-delivery';
import { DirectoryRecoveryIdentity } from './register-recovery-authority';
import {
  CLASSIFICATION_EXCLUDED_SQL,
  CLASSIFICATION_JOINS,
  EFFECTIVE_CATEGORY_SQL,
} from './taxonomy-served';
import {
  BLOCKED_TOWN_INELIGIBLE,
  SERVED_ROW_FROM,
  servedRowWhere,
  notSuppressedSql,
  townCoverage,
} from './town-coverage';
import {
  LIFT_REASONS,
  SUPPRESSION_CONFLICT,
  SUPPRESSION_NOT_FOUND,
  SUPPRESSION_REASONS,
  listSuppressions,
  liftSuppression,
  suppressListing,
  type LiftReason,
  type SuppressionReason,
} from './listing-suppression';
import {
  DUPLICATE_ACTIONS,
  DUPLICATE_CASE_INVALID,
  DUPLICATE_CASE_NOT_FOUND,
  DUPLICATE_CASE_STALE,
  type DuplicateListQuery,
  decideDuplicateCase,
  getDuplicateCase,
  listDuplicateCases,
} from './duplicate-review';
import {
  SAMPLE_INVALID,
  SAMPLE_NOT_FOUND,
  drawDuplicateSample,
  getDuplicateSample,
  judgeSampleItem,
  listDuplicateSamples,
} from './duplicate-sample';
import {
  type DecideBody,
  type DuplicateRoute,
  parseDecideBody,
  parseDrawBody,
  parseDuplicateRoute,
  parseJudgeBody,
  parseListQuery,
} from './duplicate-routes';
import {
  REPORT_ACTIONS,
  REPORT_BUSY,
  REPORT_CONFLICT,
  REPORT_INVALID,
  REPORT_NOT_FOUND,
  REPORT_REASONS,
  contactKeyFrom,
  createReport,
  listReports,
  lookupReceipt,
  transitionReport,
  validateReport,
  type ReportAction,
  type ReportReason,
} from './listing-report';
import { currentPolicyVersion } from './policy-version';
import { lockAuthority } from './register-reconciliation-v2';
import { isEligibleCommunity } from './social-eligibility';
import { geographyHash, readCurrentBoundaryCandidate } from './boundary-review';
import { BoundaryDecision, recordBoundaryDecision } from './boundary-decision';
import {
  type AddressReviewHumanDecision,
  getAddressReviewCandidate,
  listAddressReviewCandidates,
  recordHumanAddressReviewDecision,
  undoAddressReviewDecision,
} from './address-review-store';
import {
  getBusinessIdentityReviewItem,
  undoBusinessIdentityDecision,
} from './business-identity-undo';
import { ReviewConflictError, VERSION_TOKEN } from './review-version';
import {
  decideRightsCase,
  getRightsCase,
  listRightsCases,
  discoverRightsRelease,
  syncRightsCases,
  undoRightsDecision,
} from './rights-case';
import {
  createWithdrawal,
  getWithdrawal,
  listWithdrawals,
  startWithdrawalWorker,
} from './withdrawal-request';
import { handleRightsRoute } from './rights-routes';
import { handleExportRoute, handlePublicExportRoute } from './export-routes';
import { buildPublicExport, type PublicExportFormat } from './public-export';
import { handleOpsRoute } from './ops-routes';
import { listControls, setControl } from './operating-controls';
import { collectOpsMetrics } from './ops-metrics';
import {
  createExportJob,
  ExportUnavailableError,
  getExportJob,
  listExportJobs,
  openExportArtifact,
  retryExportJob,
  startExportWorker,
} from './export-job';
import { handleTaxonomyRoute } from './taxonomy-routes';
import { handleAcquisitionRoute } from './acquisition-routes';
import { requestTownAcquisition } from './acquisition-refresh';
import {
  acquisitionBudgetPanel,
  cancelAcquisitionRun,
  getAcquisitionRun,
  importAcquisitionHistory,
  latestAcquisitionRun,
  listAcquisitionRuns,
  resumeAcquisitionRun,
  retryAcquisitionJob,
} from './acquisition-run';
import {
  decideTaxonomyCase,
  getTaxonomyCase,
  listTaxonomyCases,
  raiseTaxonomyCase,
  undoTaxonomyDecision,
} from './taxonomy-case';
import {
  cancelTaxonomyRun,
  createTaxonomyRun,
  getTaxonomyRun,
  listTaxonomyRuns,
  rollbackTaxonomyRun,
  startTaxonomyWorker,
} from './taxonomy-reclassification';
import {
  installTaxonomyMapping,
  listTaxonomyMappings,
} from './taxonomy-mapping';

/** Review conflicts (stale token, not latest, idempotency reuse, invalid state) are 409 with a stable code. */
function reviewFailure(res: ServerResponse, error: unknown): void {
  if (error instanceof ReviewConflictError) {
    res
      .writeHead(409, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      })
      .end(JSON.stringify({ code: error.code }));
    return;
  }
  const invalid =
    error instanceof Error &&
    error.message === 'Invalid business identity decision';
  res
    .writeHead(invalid ? 409 : 503, {
      ...(invalid ? { 'content-type': 'application/json' } : {}),
      'cache-control': 'no-store',
    })
    .end(invalid ? JSON.stringify({ code: 'invalid_state' }) : undefined);
}

const fields = [
  'sourceEpoch',
  'recoveryEpoch',
  'owner',
  'activationId',
  'socialGeneration',
  'directoryGeneration',
] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const generation = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[1-9][0-9]*$/.test(value) &&
  BigInt(value) <= 9223372036854775807n;

export function pendingRuntimeConfig(env: NodeJS.ProcessEnv) {
  const need = (key: string) => {
    const value = env[key];
    if (!value) throw Error(`${key} is required`);
    return value;
  };
  let identity: DirectoryRecoveryIdentity;
  try {
    identity = JSON.parse(need('DIRECTORY_REGISTER_RUNTIME_IDENTITY'));
  } catch {
    throw Error('Invalid runtime identity');
  }
  if (
    !identity ||
    typeof identity !== 'object' ||
    Array.isArray(identity) ||
    Object.keys(identity).length !== 6 ||
    fields.some((k) => !(k in identity)) ||
    ![
      identity.sourceEpoch,
      identity.recoveryEpoch,
      identity.owner,
      identity.activationId,
    ].every((v) => typeof v === 'string' && uuid.test(v)) ||
    !generation(identity.socialGeneration) ||
    !generation(identity.directoryGeneration)
  )
    throw Error('Invalid runtime identity');
  if (need('DIRECTORY_EXTERNAL_FENCE_ASSERTION') !== 'fenced')
    throw Error('External fence assertion required');
  const secret = need('DIRECTORY_REGISTER_READ_SECRET');
  if (Buffer.byteLength(secret) < 32)
    throw Error('Invalid register read secret');
  const reviewSecret = env.DIRECTORY_BOUNDARY_REVIEW_SECRET || undefined;
  if (
    reviewSecret !== undefined &&
    (Buffer.byteLength(reviewSecret) < 32 || reviewSecret === secret)
  )
    throw Error('Invalid boundary review secret');
  const pendingSecret = env.DIRECTORY_PENDING_READ_SECRET || undefined;
  if (
    pendingSecret !== undefined &&
    (Buffer.byteLength(pendingSecret) < 32 ||
      pendingSecret === secret ||
      pendingSecret === reviewSecret)
  )
    throw Error('Invalid pending read secret');
  const decisionSecret = env.DIRECTORY_BOUNDARY_DECISION_SECRET || undefined;
  if (
    decisionSecret !== undefined &&
    (Buffer.byteLength(decisionSecret) < 32 ||
      [secret, reviewSecret, pendingSecret].includes(decisionSecret))
  )
    throw Error('Invalid boundary decision secret');
  const containmentSecret = env.DIRECTORY_CONTAINMENT_READ_SECRET || undefined;
  if (
    containmentSecret !== undefined &&
    (Buffer.byteLength(containmentSecret) < 32 ||
      [secret, reviewSecret, pendingSecret, decisionSecret].includes(
        containmentSecret
      ))
  )
    throw Error('Invalid containment secret');
  const localSecret = env.DIRECTORY_LOCAL_EVALUATION_SECRET || undefined;
  if (
    localSecret !== undefined &&
    (env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      Buffer.byteLength(localSecret) < 32 ||
      [
        secret,
        reviewSecret,
        pendingSecret,
        decisionSecret,
        containmentSecret,
      ].includes(localSecret))
  )
    throw Error('Invalid local evaluation secret');
  const linkSecret = env.DIRECTORY_BUSINESS_LINK_SECRET || undefined;
  if (
    linkSecret !== undefined &&
    (env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !localSecret ||
      Buffer.byteLength(linkSecret) < 32 ||
      [
        secret,
        reviewSecret,
        pendingSecret,
        decisionSecret,
        containmentSecret,
        localSecret,
      ].includes(linkSecret))
  )
    throw Error('Invalid business link secret');
  const port = Number(need('SOCIAL_PORT')),
    listenPort = Number(env.DIRECTORY_PORT || 3120);
  if (
    ![port, listenPort].every((v) => Number.isInteger(v) && v > 0 && v <= 65535)
  )
    throw Error('Invalid port');
  // Not mounted without DIRECTORY_ACCOUNT_DELETION_SECRET; Authentication then blocks deletion and export.
  const lifecycle = accountLifecycleConfig(env, [
    secret,
    reviewSecret,
    pendingSecret,
    decisionSecret,
    containmentSecret,
    localSecret,
    linkSecret,
  ]);
  return {
    identity,
    lifecycle,
    databaseUrl: need('DIRECTORY_DATABASE_URL'),
    host: need('SOCIAL_HOST'),
    port,
    listenPort,
    secret,
    reviewSecret,
    pendingSecret,
    decisionSecret,
    containmentSecret,
    localSecret,
    linkSecret,
  };
}

class TownUnavailable extends Error {
  constructor() {
    super('Town unavailable');
  }
}
/**
 * `town-ineligible`: every global check passed and only the town's own eligibility failed. Anything else,
 * including any cause this code does not recognise, is `global` and fails closed.
 */
export class DirectoryAuthorityError extends Error {
  constructor(readonly kind: 'global' | 'town-ineligible') {
    super('Directory authority unavailable');
    this.name = 'DirectoryAuthorityError';
  }
}
type Database = Pick<DataSource, 'query'> &
  Partial<Pick<DataSource, 'transaction'>>;
type Source = Pick<RegisterDeliveryV2, 'scan' | 'current'> &
  Partial<Pick<RegisterDeliveryV2, 'geography'>>;
/**
 * The operator-approved rights policy for a release, read from the file DIRECTORY_RIGHTS_POLICY_FILE names (JSON,
 * one policy or an array). Absent or unreadable means no approval: every observed lineage then needs review.
 * Nothing here establishes approval; the file is the same trusted artifact the scripts load.
 */
function loadRightsPolicy(
  releaseId: string
): Parameters<typeof syncRightsCases>[1]['policy'] {
  const file = process.env.DIRECTORY_RIGHTS_POLICY_FILE;
  // A release the worker promoted (D29) carries its derived policy in the database; the file stays the first source.
  const promoted = () => promotedRightsPolicy(releaseId) as never;
  if (!file) return promoted();
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    const all = Array.isArray(parsed) ? parsed : [parsed];
    return all.find((p) => p?.releaseId === releaseId) ?? promoted();
  } catch {
    return promoted();
  }
}

export function pendingChecks(
  db: Database,
  source: Source,
  id: DirectoryRecoveryIdentity,
  cursorSecret?: string
) {
  async function authority(town?: string) {
    const rows = await db.query(
      `SELECT p.*, i."recoveryEpoch" AS "authorityEpoch", CURRENT_TIMESTAMP AS "dbNow",
      CASE WHEN $1::uuid IS NULL THEN true ELSE EXISTS (SELECT 1 FROM directory_town t WHERE t."communityId"=$1 AND t.eligible IS TRUE) END AS eligible
      FROM directory_census_progress p JOIN directory_installation i ON i.id='recovery-authority' WHERE p.id='recovery'`,
      [town || null]
    );
    const p = rows[0],
      request = p?.registerRequest,
      completed = request?.lastCompletedSweep;
    const completedAt = Date.parse(completed?.completedAt),
      now = new Date(p?.dbNow).getTime();
    if (
      rows.length !== 1 ||
      p.protocol !== 'register-pending-v1' ||
      p.phase !== 'reg-running' ||
      p.cursor !== null ||
      p.authorityEpoch !== id.recoveryEpoch ||
      fields.some((k) => p[k] !== id[k]) ||
      !request ||
      ['sourceEpoch', 'activationId', 'socialGeneration', 'owner'].some(
        (k) => request[k] !== id[k as keyof DirectoryRecoveryIdentity]
      ) ||
      !generation(completed?.generation) ||
      !generation(request.sweep?.generation) ||
      BigInt(completed.generation) > BigInt(request.sweep.generation) ||
      !Number.isFinite(completedAt) ||
      !Number.isFinite(now) ||
      completedAt > now ||
      now - completedAt > 900000
    )
      throw new DirectoryAuthorityError('global');
    if (p.eligible !== true)
      throw new DirectoryAuthorityError(
        p.eligible === false ? 'town-ineligible' : 'global'
      );
  }
  /** Degradation signal only: expired leases hide reviewed fields but never fail readiness. */
  async function bindingHealth(): Promise<{
    expiredLeases: number;
    suspended: number;
    pending: number;
    active: number;
  }> {
    const [row] = await db.query(
      `SELECT count(*) FILTER (WHERE state='active' AND "verifiedUntil"<=now())::int AS "expiredLeases", count(*) FILTER (WHERE state='suspended')::int AS suspended, count(*) FILTER (WHERE state='pending')::int AS pending, count(*) FILTER (WHERE state='active' AND "verifiedUntil">now())::int AS active FROM directory_reviewed_binding`
    );
    return {
      expiredLeases: row.expiredLeases,
      suspended: row.suspended,
      pending: row.pending,
      active: row.active,
    };
  }
  const evidenceColumns =
    'e."scanId",e."evidenceVersion",e.kind,e."releaseId",e."artifactUrl",e."artifactEtag",e."artifactBytes",e."upstreamLastModified",e."observedAt",e."recordedAt",e.recorder,e."inventorySha256",e."evidenceSha256"';
  let freshnessCountsCache:
    | { at: number; value: ReturnType<typeof freshnessCounts> }
    | undefined;
  /** Label-only: counts live, completed, policy-active scans by freshness state. Never changes readiness. */
  async function sourceFreshnessHealth(): Promise<
    ReturnType<typeof freshnessCounts>
  > {
    if (freshnessCountsCache && Date.now() - freshnessCountsCache.at < 60000)
      return freshnessCountsCache.value;
    const rows =
      await db.query(`SELECT ${evidenceColumns} FROM directory_overture_private_completion c
      JOIN directory_overture_private_membership m ON m."scanId"=c."scanId"
      JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false
      LEFT JOIN directory_overture_source_evidence e ON e."scanId"=c."scanId"
      WHERE NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=c."scanId")`);
    const value = freshnessCounts(
      rows.map((row: any) => (row.scanId ? row : null))
    );
    freshnessCountsCache = { at: Date.now(), value };
    return value;
  }
  let identityHealthCache:
    | { at: number; value: BusinessIdentityHealth }
    | undefined;
  /** Label-only identity counts (no ids), cached 60 s. Never changes readiness. */
  async function businessIdentityHealthCheck(): Promise<BusinessIdentityHealth> {
    if (identityHealthCache && Date.now() - identityHealthCache.at < 60000)
      return identityHealthCache.value;
    const value = await businessIdentityHealth(db);
    identityHealthCache = { at: Date.now(), value };
    return value;
  }
  const townFreshnessCache = new Map<
    string,
    { at: number; value: PageFreshness }
  >();
  /** Worst-wins over completed, non-revoked scans that still have a non-withdrawn row in the town. */
  async function townFreshness(town: string): Promise<PageFreshness> {
    const hit = townFreshnessCache.get(town);
    if (hit && Date.now() - hit.at < 60000) return hit.value;
    const rows = await db.query(
      `SELECT ${evidenceColumns} FROM directory_overture_private_completion c
      JOIN directory_overture_private_membership m ON m."scanId"=c."scanId"
      JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false
      LEFT JOIN directory_overture_source_evidence e ON e."scanId"=c."scanId"
      WHERE NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=c."scanId")
      AND EXISTS (SELECT 1 FROM directory_overture_private_row r WHERE r."scanId"=c."scanId" AND r."regionId"=$1
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation y WHERE y."scanId"=r."scanId" AND y."sourceFileRowNumber"=r."sourceFileRowNumber"))`,
      [town]
    );
    const value = aggregateFreshness(
      rows.map((row: any) => (row.scanId ? row : null))
    );
    if (townFreshnessCache.size >= 256) townFreshnessCache.clear();
    townFreshnessCache.set(town, { at: Date.now(), value });
    return value;
  }
  const unknownFreshness = (): PageFreshness => aggregateFreshness([]);
  let spatialCache:
    | {
        at: number;
        value: {
          ready: boolean;
          missing: number;
          validatorVersion: number | null;
          rebuildCompletedAt: string | null;
        };
      }
    | undefined;
  /**
   * Fail-closed readiness of the reviewed-address candidate index, cached for 30 s. Not ready,
   * or a failed probe, makes bounds search answer 503; it never fails overall readiness.
   */
  async function spatialHealth(): Promise<{
    ready: boolean;
    missing: number;
    validatorVersion: number | null;
    rebuildCompletedAt: string | null;
  }> {
    if (spatialCache && Date.now() - spatialCache.at < 30000)
      return spatialCache.value;
    const state = await readSpatialState(db);
    const missing = await countMissingSpatial(db);
    const completed = state?.rebuildCompletedAt
      ? new Date(state.rebuildCompletedAt).toISOString()
      : null;
    const value = {
      ready:
        !!state &&
        state.validatorVersion === REVIEWED_SPATIAL_VALIDATOR_VERSION &&
        completed !== null &&
        missing === 0,
      missing,
      validatorVersion: state?.validatorVersion ?? null,
      rebuildCompletedAt: completed,
    };
    spatialCache = { at: Date.now(), value };
    return value;
  }
  async function ready() {
    await authority();
    const page = await source.scan(id, null, 1);
    if (!Array.isArray(page) || page.length > 1)
      throw Error('Invalid Social response');
    await authority();
  }
  async function status(town: string) {
    if (!uuid.test(town)) throw Error('Invalid town');
    await authority(town);
    const current = await source.current(id, town);
    if (
      current?.status !== 'current' ||
      !uuid.test(current.changeToken) ||
      !current.snapshot ||
      current.snapshot.id !== town ||
      !isEligibleCommunity(current.snapshot)
    )
      throw Error('Town unavailable');
    await authority(town);
  }
  async function candidate(town: string) {
    if (!uuid.test(town) || !db.transaction || !source.geography)
      throw Error('Candidate unavailable');
    await authority(town);
    const result = await readCurrentBoundaryCandidate(
      db as DataSource,
      id,
      town,
      () => source.geography!(id, town)
    );
    await authority(town);
    return result;
  }
  async function approximate(town: string) {
    if (!uuid.test(town) || !source.geography) throw Error('Town unavailable');
    await authority();
    const current = await source.geography(id, town);
    if (
      current?.status === 'absent' ||
      (current?.status === 'current' && current.geography === null)
    )
      throw new TownUnavailable();
    if (
      current?.status !== 'current' ||
      !uuid.test(current.changeToken) ||
      !current.geography ||
      current.geography.communityId !== town
    )
      throw Error('Invalid Social response');
    const p = current.geography.referencePoint;
    if (
      p !== null &&
      (!Array.isArray(p) ||
        p.length !== 2 ||
        ![0, 1].every(
          (i) =>
            Object.prototype.hasOwnProperty.call(p, i) &&
            typeof p[i] === 'number' &&
            Number.isFinite(p[i])
        ) ||
        Math.abs(p[0]) > 180 ||
        Math.abs(p[1]) > 90)
    )
      throw Error('Invalid Social point');
    await authority(town);
    const after = await source.geography(id, town);
    if (
      !after ||
      !['absent', 'current'].includes(after.status) ||
      (after.status === 'current' && !uuid.test(after.changeToken))
    )
      throw Error('Invalid Social response');
    if (
      after?.status === 'absent' ||
      (after?.status === 'current' && after.geography === null)
    )
      throw new TownUnavailable();
    if (
      after?.status !== 'current' ||
      after.changeToken !== current.changeToken ||
      after.geography?.communityId !== town ||
      JSON.stringify(after.geography.referencePoint) !== JSON.stringify(p)
    )
      throw Error('Social geography changed');
    await authority(town);
    return {
      status: 'pending',
      approximateLocation:
        p === null
          ? null
          : {
              coordinates: [...p],
              label:
                'Approximate town location; verified boundary unavailable.',
            },
    };
  }
  async function readReviewed(
    town: string,
    longitude: number,
    latitude: number,
    includeGeometry: boolean
  ): Promise<
    | { status: 'pending' }
    | { status: 'ready'; covers: boolean; geometry?: object }
  > {
    if (
      !uuid.test(town) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      Math.abs(longitude) > 180 ||
      Math.abs(latitude) > 90 ||
      !db.transaction ||
      !source.geography
    )
      throw Error('Containment unavailable');
    await authority(town);
    // An owner lock is an owner-verified border. It has no Social candidate, so it is read from its own decision and
    // binding (which the recovery begin re-creates under each authority) rather than the Social-bound path below.
    const owner = await db.query(
      `SELECT b."geometryHash",encode(ST_AsEWKB(g.boundary,'XDR'),'hex') AS "geometryBinary", ST_Covers(g.boundary,ST_SetSRID(ST_MakePoint($2,$3),4326)) AS covers, CASE WHEN $6::boolean THEN ST_AsGeoJSON(g.boundary) ELSE NULL END AS geometry
      FROM directory_reviewed_geometry b JOIN directory_town t ON t."communityId"=b."communityId"
      JOIN directory_town_geometry g ON g."communityId"=b."communityId" AND g.version=b.version
      JOIN directory_boundary_decision d ON d."requestId"=b."requestId" AND d."communityId"=b."communityId" AND d.decision='verified' AND d."invalidatedAt" IS NULL AND d.reason='owner_lock'
      JOIN directory_boundary_lock l ON l."communityId"=b."communityId" AND l.version=b.version AND l."geometryHash"=b."geometryHash"
      WHERE b."communityId"=$1 AND t.eligible IS TRUE AND t."geometryVersion"=b.version AND b."changeToken"=d."changeToken" AND b."geographyHash"=d."geographyHash"
        AND b."recoveryEpoch"=$4 AND b."directoryGeneration"=$5 AND d."recoveryEpoch"=$4 AND d."directoryGeneration"=$5`,
      [
        town,
        longitude,
        latitude,
        id.recoveryEpoch,
        id.directoryGeneration,
        includeGeometry,
      ]
    );
    if (
      owner.length === 1 &&
      typeof owner[0].covers === 'boolean' &&
      typeof owner[0].geometryBinary === 'string' &&
      createHash('sha256')
        .update(Buffer.from(owner[0].geometryBinary, 'hex'))
        .digest('hex') === owner[0].geometryHash
    ) {
      await authority(town);
      if (!includeGeometry) return { status: 'ready', covers: owner[0].covers };
      if (
        typeof owner[0].geometry !== 'string' ||
        Buffer.byteLength(owner[0].geometry) > 8 * 1024 * 1024
      )
        throw Error('Invalid boundary geometry');
      return {
        status: 'ready',
        covers: owner[0].covers,
        geometry: JSON.parse(owner[0].geometry),
      };
    }
    const first = await source.geography(id, town);
    if (
      !first ||
      !['absent', 'current'].includes(first.status) ||
      (first.status === 'current' && !uuid.test(first.changeToken))
    )
      throw Error('Invalid Social response');
    const candidate = await readCurrentBoundaryCandidate(
      db as DataSource,
      id,
      town,
      async () => first
    );
    if (
      first?.status === 'absent' ||
      (first?.status === 'current' && first.geography === null)
    )
      throw new TownUnavailable();
    if (first?.status !== 'current') throw Error('Social unavailable');
    if (!candidate) {
      await authority(town);
      return { status: 'pending' };
    }
    const rows = await db.query(
      `SELECT b."requestId",b.version,b."geometryHash",encode(ST_AsEWKB(g.boundary,'XDR'),'hex') AS "geometryBinary", ST_Covers(g.boundary,ST_SetSRID(ST_MakePoint($2,$3),4326)) AS covers, CASE WHEN $11::boolean THEN ST_AsGeoJSON(g.boundary) ELSE NULL END AS geometry
      FROM directory_reviewed_geometry b JOIN directory_town t ON t."communityId"=b."communityId"
      JOIN directory_town_geometry g ON g."communityId"=b."communityId" AND g.version=b.version
      JOIN directory_boundary_decision d ON d."requestId"=b."requestId" AND d."communityId"=b."communityId"
      WHERE b."communityId"=$1 AND t.eligible IS TRUE AND t."geometryVersion"=b.version AND d.decision='verified' AND d."invalidatedAt" IS NULL
        AND b."changeToken"=d."changeToken" AND b."geographyHash"=d."geographyHash" AND b."recoveryEpoch"=$4 AND b."directoryGeneration"=$5
        AND d."sourceEpoch"=$6 AND d."activationId"=$7 AND d."socialGeneration"=$8 AND d."recoveryEpoch"=$4 AND d."directoryGeneration"=$5
        AND b."changeToken"=$9 AND b."geographyHash"=$10`,
      [
        town,
        longitude,
        latitude,
        id.recoveryEpoch,
        id.directoryGeneration,
        id.sourceEpoch,
        id.activationId,
        id.socialGeneration,
        candidate.changeToken,
        candidate.geographyHash,
        includeGeometry,
      ]
    );
    const after = await source.geography(id, town);
    if (
      !after ||
      !['absent', 'current'].includes(after.status) ||
      (after.status === 'current' && !uuid.test(after.changeToken))
    )
      throw Error('Invalid Social response');
    if (
      after?.status === 'absent' ||
      (after?.status === 'current' && after.geography === null)
    ) {
      await readCurrentBoundaryCandidate(
        db as DataSource,
        id,
        town,
        async () => after
      );
      throw new TownUnavailable();
    }
    if (after?.status !== 'current') throw Error('Social unavailable');
    if (
      after.changeToken !== candidate.changeToken ||
      geographyHash(after.geography, town) !== candidate.geographyHash
    ) {
      await readCurrentBoundaryCandidate(
        db as DataSource,
        id,
        town,
        async () => after
      );
      await authority(town);
      return { status: 'pending' };
    }
    await authority(town);
    if (!rows.length) return { status: 'pending' };
    if (
      rows.length !== 1 ||
      typeof rows[0].covers !== 'boolean' ||
      typeof rows[0].geometryBinary !== 'string' ||
      !/^[a-f0-9]+$/.test(rows[0].geometryBinary)
    )
      throw Error('Invalid containment response');
    const observedHash = createHash('sha256')
      .update(Buffer.from(rows[0].geometryBinary, 'hex'))
      .digest('hex');
    if (observedHash !== rows[0].geometryHash) {
      await (db as DataSource).transaction(async (manager) => {
        await lockAuthority(manager, id);
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [town]
        );
        await manager.query(
          `UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "requestId"=$2 AND "invalidatedAt" IS NULL AND EXISTS (SELECT 1 FROM directory_reviewed_geometry WHERE "communityId"=$1 AND "requestId"=$2 AND version=$3 AND "geometryHash"=$4)`,
          [town, rows[0].requestId, rows[0].version, rows[0].geometryHash]
        );
        await manager.query(
          'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1 AND "requestId"=$2 AND version=$3 AND "geometryHash"=$4',
          [town, rows[0].requestId, rows[0].version, rows[0].geometryHash]
        );
      });
      return { status: 'pending' };
    }
    const active = await db.query(
      `SELECT 1 FROM directory_reviewed_geometry b JOIN directory_town t ON t."communityId"=b."communityId" JOIN directory_boundary_decision d ON d."requestId"=b."requestId" WHERE b."communityId"=$1 AND b."requestId"=$2 AND b.version=$3 AND b."geometryHash"=$4 AND b."recoveryEpoch"=$5 AND b."directoryGeneration"=$6 AND t.eligible IS TRUE AND t."geometryVersion"=b.version AND d."invalidatedAt" IS NULL`,
      [
        town,
        rows[0].requestId,
        rows[0].version,
        rows[0].geometryHash,
        id.recoveryEpoch,
        id.directoryGeneration,
      ]
    );
    if (active.length !== 1) return { status: 'pending' };
    if (!includeGeometry) return { status: 'ready', covers: rows[0].covers };
    if (
      typeof rows[0].geometry !== 'string' ||
      Buffer.byteLength(rows[0].geometry) > 8 * 1024 * 1024
    )
      throw Error('Invalid boundary geometry');
    const geometry = JSON.parse(rows[0].geometry);
    if (
      !geometry ||
      !['Polygon', 'MultiPolygon'].includes(geometry.type) ||
      !Array.isArray(geometry.coordinates)
    )
      throw Error('Invalid boundary geometry');
    return { status: 'ready', covers: rows[0].covers, geometry };
  }
  async function containment(
    town: string,
    longitude: number,
    latitude: number
  ): Promise<{ status: 'pending' } | { status: 'ready'; covers: boolean }> {
    const result = await readReviewed(town, longitude, latitude, false);
    return result.status === 'pending'
      ? result
      : { status: 'ready', covers: result.covers };
  }
  async function boundary(
    town: string
  ): Promise<{ status: 'pending' } | { status: 'ready'; geometry: object }> {
    const result = await readReviewed(town, 0, 0, true);
    if (result.status === 'pending') return result;
    if (!result.geometry) throw Error('Boundary unavailable');
    return { status: 'ready', geometry: result.geometry };
  }
  async function decision(town: string, value: BoundaryDecision) {
    if (
      !uuid.test(town) ||
      !db.transaction ||
      !source.geography ||
      value?.candidate?.communityId !== town
    )
      throw Error('Decision unavailable');
    await authority(town);
    await recordBoundaryDecision(db as DataSource, id, value, () =>
      source.geography!(id, town)
    );
    await authority(town);
  }
  /**
   * One statement per page (one MVCC snapshot). The projection only proposes candidates; every
   * authority check is a live join, and the content digest ties a candidate to the exact listing
   * the validator saw. Read-only, bounded to 2 s: a timeout is a 503, never a short page.
   */
  async function boundsRows(
    town: string,
    bounds: { west: number; south: number; east: number; north: number },
    search: string,
    adult: boolean,
    changeToken: string,
    category: string,
    afterScan: string,
    afterRow: string
  ): Promise<any[]> {
    // The projection leads and each candidate is checked by a LATERAL lookup (LIMIT 1 keeps it a nested loop),
    // so the work is bounded by the town's projected rows in the box, never by the scan's other bindings.
    const sql = `SELECT x.listing,x."effectiveCategory",sp."scanId",sp."sourceFileRowNumber",true AS "reviewedActive" FROM directory_reviewed_spatial sp
      CROSS JOIN LATERAL (SELECT r.listing,${EFFECTIVE_CATEGORY_SQL} AS "effectiveCategory" FROM directory_reviewed_binding b
        JOIN directory_overture_private_row r ON r."scanId"=sp."scanId" AND r."sourceFileRowNumber"=sp."sourceFileRowNumber" AND r."regionId"=$1
        JOIN directory_overture_private_membership m ON m."scanId"=r."scanId"
        JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false
        JOIN directory_overture_private_completion c ON c."scanId"=r."scanId"${CLASSIFICATION_JOINS}
        WHERE b.id=sp."bindingId" AND b.state='active' AND b."verifiedUntil">now() AND b."scanId"=sp."scanId" AND b."sourceFileRowNumber"=sp."sourceFileRowNumber" AND b."communityId"=sp."communityId"
        AND sp."listingDigest"=md5(r.listing::text)
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=r."scanId")
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")
        ${supersededByLiveCohort('r')}
        ${notSuppressedSql('r')}
        AND (NOT (r.listing ? 'adult') OR r.listing->'adult'='false'::jsonb OR ($7::boolean AND r.listing->'adult'='true'::jsonb))
        AND r.listing->>'assignmentChangeToken'=$8
        AND NOT ${CLASSIFICATION_EXCLUDED_SQL}
        AND ($9='' OR ${EFFECTIVE_CATEGORY_SQL}=$9)
        AND ($12='' OR position(lower($12) in lower(r.listing->>'name'))>0 OR position(lower($12) in lower(${EFFECTIVE_CATEGORY_SQL}))>0)
        LIMIT 1) x
      WHERE sp."communityId"=$1::uuid AND sp."validatorVersion"=$2
      AND sp.point && ST_MakeEnvelope($3::float8,$4::float8,$5::float8,$6::float8,4326)
      AND ($10='' OR (sp."scanId",sp."sourceFileRowNumber")>($10,$11::bigint))
      ORDER BY sp."scanId",sp."sourceFileRowNumber" LIMIT 26`;
    const params = [
      town,
      REVIEWED_SPATIAL_VALIDATOR_VERSION,
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
      adult,
      changeToken,
      category,
      afterScan,
      afterRow,
      search,
    ];
    const run = (q: {
      query: (sql: string, params?: unknown[]) => Promise<any>;
    }) => q.query(sql, params);
    if (typeof (db as DataSource).transaction !== 'function') return run(db);
    return (db as DataSource).transaction('READ COMMITTED', async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      await manager.query("SET LOCAL statement_timeout='2s'");
      return run(manager);
    });
  }
  /** Public self-service export (S8b): the town must be a current, eligible register town, as for the listing read. */
  async function publicExport(v: { town: string; format: PublicExportFormat }) {
    if (!uuid.test(v.town)) throw Error('Invalid town');
    await authority(v.town);
    const current = await source.current(id, v.town);
    if (
      current?.status !== 'current' ||
      !uuid.test(current.changeToken) ||
      !current.snapshot ||
      current.snapshot.id !== v.town ||
      !isEligibleCommunity(current.snapshot)
    )
      throw Error('Town unavailable');
    const cap = Number(process.env.DIRECTORY_PUBLIC_EXPORT_MAX_ROWS);
    await primePromotedRights(db as never).catch(() => undefined);
    return buildPublicExport(db, {
      town: v.town,
      format: v.format,
      changeToken: current.changeToken,
      policyFor: loadRightsPolicy as never,
      releaseId: await discoverRightsRelease(db as never),
      ...(Number.isSafeInteger(cap) && cap > 0 ? { rowCap: cap } : {}),
    });
  }
  async function localListings(
    town: string,
    offset = 0,
    search = '',
    adult = false,
    category = '',
    cursorMode = false,
    cursor = '',
    detail?: { scanId: string; row: string; changeToken: string },
    boundsValue = '',
    identityMode = false
  ) {
    if (!uuid.test(town)) throw Error('Invalid town');
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000)
      throw Error('Invalid offset');
    if (
      typeof search !== 'string' ||
      search.length > 100 ||
      /[\x00-\x1f\x7f]/.test(search)
    )
      throw Error('Invalid search');
    if (typeof adult !== 'boolean') throw Error('Invalid adult choice');
    if (
      typeof category !== 'string' ||
      category.length > 100 ||
      (category !== '' && !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(category))
    )
      throw Error('Invalid category');
    if (
      typeof cursorMode !== 'boolean' ||
      typeof cursor !== 'string' ||
      (!cursorMode && cursor !== '') ||
      (cursorMode && offset !== 0)
    )
      throw Error('Invalid cursor mode');
    if (cursorMode && (!cursorSecret || Buffer.byteLength(cursorSecret) < 32))
      throw Error('Cursor unavailable');
    if (typeof identityMode !== 'boolean') throw Error('Invalid identity mode');
    if (
      typeof boundsValue !== 'string' ||
      (boundsValue && (!cursorMode || detail))
    )
      throw Error('Invalid bounds');
    const bounds = boundsValue ? parseListingBounds(boundsValue) : null;
    await authority(town);
    const before = await source.current(id, town);
    if (
      before?.status !== 'current' ||
      !uuid.test(before.changeToken) ||
      !before.snapshot ||
      before.snapshot.id !== town ||
      !isEligibleCommunity(before.snapshot)
    )
      throw Error('Town unavailable');
    if (
      detail &&
      (detail.changeToken !== before.changeToken ||
        !/^[a-f0-9]{64}$/.test(detail.scanId) ||
        !/^(0|[1-9][0-9]{0,15})$/.test(detail.row) ||
        !Number.isSafeInteger(Number(detail.row)))
    )
      throw Error('Invalid reference');
    const generation =
      cursorSecret && Buffer.byteLength(cursorSecret) >= 32
        ? await servingGeneration(db, cursorSecret)
        : undefined;
    const cursorQuery = {
      town,
      search,
      category,
      adult,
      changeToken: before.changeToken,
      bounds: bounds?.canonical,
      generation,
    };
    const position =
      cursorMode && cursor
        ? openListingCursor(cursorSecret || '', cursorQuery, cursor)
        : null;
    if (bounds && !(await spatialHealth()).ready)
      throw Error('Spatial index unavailable');
    const rows = bounds
      ? await boundsRows(
          town,
          bounds,
          search.trim(),
          adult,
          before.changeToken,
          category,
          position?.scanId || '',
          position?.row || '0'
        )
      : await db.query(
          `SELECT r.listing,${EFFECTIVE_CATEGORY_SQL} AS "effectiveCategory",r."scanId",r."sourceFileRowNumber",EXISTS (SELECT 1 FROM directory_reviewed_binding b WHERE b."scanId"=r."scanId" AND b."sourceFileRowNumber"=r."sourceFileRowNumber" AND b.state='active' AND b."verifiedUntil">now()) AS "reviewedActive" FROM ${SERVED_ROW_FROM}
      WHERE ${servedRowWhere('$1', '$5')}
      AND (NOT (r.listing ? 'adult') OR r.listing->'adult'='false'::jsonb OR ($4::boolean AND r.listing->'adult'='true'::jsonb))
      AND ($6='' OR ${EFFECTIVE_CATEGORY_SQL}=$6)
      AND ($7='' OR (r."scanId",r."sourceFileRowNumber")>($7,$8::bigint))
      AND ($10='' OR (r."scanId"=$10 AND r."sourceFileRowNumber"=$11::bigint))
      AND ($3='' OR position(lower($3) in lower(r.listing->>'name'))>0 OR position(lower($3) in lower(${EFFECTIVE_CATEGORY_SQL}))>0)
      ORDER BY (CASE WHEN $9::boolean THEN false ELSE EXISTS (SELECT 1 FROM directory_reviewed_binding b WHERE b."scanId"=r."scanId" AND b."sourceFileRowNumber"=r."sourceFileRowNumber" AND b.state='active' AND b."verifiedUntil">now()) END) DESC,r."scanId",r."sourceFileRowNumber" LIMIT 26 OFFSET $2`,
          [
            town,
            offset,
            search.trim(),
            adult,
            before.changeToken,
            category,
            position?.scanId || '',
            position?.row || '0',
            cursorMode,
            detail?.scanId || '',
            detail?.row || '0',
          ]
        );

    if (!Array.isArray(rows) || rows.length > 26)
      throw Error('Invalid listings');
    const projected = rows.map(
      ({
        listing,
        effectiveCategory,
        scanId,
        sourceFileRowNumber,
        reviewedActive,
      }: any) => {
        const c = listing?.location?.coordinates;
        if (!validBaseListing(listing)) throw Error('Invalid listing');
        const output: any = {
          name: listing.name,
          category:
            typeof effectiveCategory === 'string' && effectiveCategory
              ? effectiveCategory
              : listing.category,
          location: { type: 'Point', coordinates: c },
          attribution: listing.attribution,
          notices: listing.notices,
          termsUrls: listing.termsUrls,
        };
        if (cursorMode)
          output.reference = sealListingReference(
            cursorSecret!,
            { town, changeToken: before.changeToken, adult, generation },
            { scanId, row: String(sourceFileRowNumber) }
          );
        if (listing.adult === true) output.adult = true;
        // Reviewed fields are served only under an active binding with a current lease.
        const fields =
          reviewedActive === true ? reviewedFields(listing.reviewed) : null;
        if (fields) {
          if (fields.website) output.website = fields.website;
          if (fields.phone) output.phone = fields.phone;
          if (fields.address) output.address = fields.address;
          if (output.website || output.phone || output.address) {
            output.attribution = [
              ...new Set([...output.attribution, ...fields.attribution]),
            ];
            output.notices = [
              ...new Set([...output.notices, ...fields.notices]),
            ];
            output.termsUrls = [
              ...new Set([...output.termsUrls, ...fields.termsUrls]),
            ];
          }
        }
        return { output, scanId, row: String(sourceFileRowNumber) };
      }
    );
    // Every filter ran in SQL before LIMIT; this only asserts that code and projection agree. Dropping a row
    // here would make hasMore wrong, so a disagreement fails the request instead.
    if (bounds)
      for (const { output, scanId, row } of projected) {
        const c = output.location.coordinates,
          listing = rows.find(
            (x: any) =>
              x.scanId === scanId && String(x.sourceFileRowNumber) === row
          )?.listing;
        if (
          !output.address ||
          !mappableReviewed(listing) ||
          !(
            c[0] >= bounds.west &&
            c[0] <= bounds.east &&
            c[1] >= bounds.south &&
            c[1] <= bounds.north
          )
        )
          throw Error('Spatial projection disagrees with validator');
      }
    const selected = projected;
    const hasMore = selected.length > 25,
      pageRows = selected.slice(0, 25),
      listings = pageRows.map(({ output }: any) => output);
    if ((cursorMode || identityMode) && pageRows.length) {
      // A row with a current assertion to an active business carries the business id; every other row keeps its
      // row-scoped identity. The two are indistinguishable to a client.
      const businesses = await businessIdsForRows(
        db,
        town,
        pageRows.map(({ scanId, row }: any) => ({ scanId, row }))
      );
      const rowScoped = pageRows.filter(
        ({ scanId, row }: any) => !businesses.has(`${scanId}:${row}`)
      );
      const identities = await getOrCreateListingIdentities(
        db,
        town,
        rowScoped.map(({ scanId, row }: any) => ({ scanId, row }))
      );
      const bySource = new Map(
        identities.map((entry) => [`${entry.scanId}:${entry.row}`, entry.id])
      );
      for (const item of pageRows)
        item.output.id =
          businesses.get(`${item.scanId}:${item.row}`) ??
          bySource.get(`${item.scanId}:${item.row}`);
    }
    const after = await source.current(id, town);
    if (
      after?.status !== 'current' ||
      after.changeToken !== before.changeToken ||
      !after.snapshot ||
      after.snapshot.id !== town ||
      !isEligibleCommunity(after.snapshot)
    )
      throw Error('Town changed');
    await authority(town);
    // Label only: freshness never filters, reorders or empties a page. A failed lookup reads as unknown.
    const sourceFreshness: PageFreshness = detail
      ? unknownFreshness()
      : await townFreshness(town).catch(unknownFreshness);
    // Town-level and unfiltered, from persisted facts only. A failed lookup omits the field: it never fails the page.
    const coverage = detail
      ? undefined
      : await townCoverage(db, town, before.changeToken).catch(() => undefined);
    // Opaque label of the policies that produce pages; omitted when it cannot be derived.
    const policyVersion = detail
      ? undefined
      : await currentPolicyVersion(db, generation).catch(() => undefined);
    if (cursorMode) {
      const last = selected[24];
      return {
        listings,
        hasMore,
        nextCursor: hasMore
          ? sealListingCursor(cursorSecret!, cursorQuery, {
              reviewed: false,
              scanId: last.scanId,
              row: last.row,
            })
          : null,
        sourceFreshness,
        ...(coverage ? { coverage } : {}),
        ...(policyVersion ? { policyVersion } : {}),
      };
    }
    return {
      listings,
      hasMore,
      sourceFreshness,
      ...(coverage ? { coverage } : {}),
      ...(policyVersion ? { policyVersion } : {}),
    };
  }
  async function localDetail(town: string, reference: string, adult = false) {
    if (
      !uuid.test(town) ||
      typeof adult !== 'boolean' ||
      !cursorSecret ||
      Buffer.byteLength(cursorSecret) < 32
    )
      throw Error('Invalid reference');
    await authority(town);
    const current = await source.current(id, town);
    if (
      current?.status !== 'current' ||
      !uuid.test(current.changeToken) ||
      !current.snapshot ||
      current.snapshot.id !== town ||
      !isEligibleCommunity(current.snapshot)
    )
      throw Error('Town unavailable');
    const detailOf = async (position: { scanId: string; row: string }) => {
      const result = await localListings(
        town,
        0,
        '',
        adult,
        '',
        false,
        '',
        { ...position, changeToken: current.changeToken },
        '',
        // Always attach the stable id, as cursor pages do, so a detail opened by reference can be reported or linked.
        true
      );
      return result.listings[0] || null;
    };
    if (!uuid.test(reference)) {
      const generation = await servingGeneration(db, cursorSecret);
      return detailOf(
        openListingReference(
          cursorSecret,
          { town, changeToken: current.changeToken, adult, generation },
          reference
        )
      );
    }
    // Resolution order: a business id (following reviewer-set successors), then a row-scoped listing identity,
    // then that identity's row as an alias for its business. Every miss is the same null, so nothing says why.
    // The resolved row still passes every live check in localListings, including its own binding gate.
    const business = await resolveBusinessId(db, town, reference);
    if (business.kind === 'row') return detailOf(business.position);
    if (business.kind === 'dead') return null;
    const position = await findListingIdentity(db, town, reference);
    if (!position) return null;
    const direct = await detailOf(position);
    if (direct) return direct;
    const owner = await businessOfSourceRow(db, town, position);
    if (!owner) return null;
    const aliased = await resolveBusinessId(db, town, owner);
    return aliased.kind === 'row' ? detailOf(aliased.position) : null;
  }
  async function localLinkAction(town: string, action: string, value: any) {
    if (!db.transaction || !uuid.test(town) || !value || value.townId !== town)
      throw Error('Invalid business link');
    const store = db as any;
    if (action === 'request' || action === 'review') {
      if (
        !uuid.test(value.listingId || '') ||
        !(await localDetail(town, value.listingId, value.adult === true))
      )
        throw Error('Invalid business link listing');
      if (action === 'request') return requestBusinessLink(store, value);
      return reviewBusinessLink(store, value);
    }
    if (action === 'revoke') return revokeBusinessLink(store, value);
    throw Error('Invalid business link');
  }
  async function localLinkRead(town: string, listingId: string, adult = false) {
    if (!(await localDetail(town, listingId, adult))) return null;
    return readBusinessLink(db, town, listingId);
  }
  async function localLinkRequests(town: string, listingId: string) {
    if (!uuid.test(town) || !uuid.test(listingId))
      throw Error('Invalid business link');
    await authority(town);
    return listBusinessLinkRequests(db, town, listingId);
  }
  async function localTownLinkRequests(town: string, cursor?: string) {
    if (!uuid.test(town)) throw Error('Invalid business link');
    await authority(town);
    return listTownBusinessLinkRequests(db, town, cursor);
  }
  async function localOwnerLinks(
    town: string,
    listingId: string,
    ownerId: string
  ) {
    return listOwnerBusinessLinks(db, town, listingId, ownerId);
  }
  async function addressReviewList(
    town: string,
    status: string,
    limit: number,
    offset: number
  ) {
    if (!uuid.test(town) || !db.transaction)
      throw Error('Address review unavailable');
    await authority(town);
    const candidates = await listAddressReviewCandidates(db as DataSource, {
      communityId: town,
      status: status || undefined,
      limit,
      offset,
    });
    await authority(town);
    return { candidates };
  }
  async function addressReviewDecision(
    town: string,
    candidateId: string,
    value: Omit<AddressReviewHumanDecision, 'candidateId'>
  ) {
    if (!uuid.test(town) || !uuid.test(candidateId) || !db.transaction)
      throw Error('Address review unavailable');
    await authority(town);
    const rows = await db.query(
      'SELECT "communityId" FROM "directory_address_review_candidate" WHERE "id"=$1',
      [candidateId]
    );
    if (rows.length !== 1 || rows[0].communityId !== town)
      throw Error('Candidate unavailable');
    const result = await recordHumanAddressReviewDecision(db as DataSource, {
      ...value,
      candidateId,
    });
    await authority(town);
    return result;
  }
  async function addressReviewDetail(town: string, candidateId: string) {
    if (!uuid.test(town) || !uuid.test(candidateId) || !db.transaction)
      throw Error('Address review unavailable');
    await authority(town);
    const item = await getAddressReviewCandidate(db, town, candidateId);
    await authority(town);
    return item;
  }
  async function addressReviewUndo(
    town: string,
    candidateId: string,
    value: {
      decisionId: string;
      undoOf: string;
      expectedVersionToken: string;
      actorId: string;
      reason: string;
    }
  ) {
    if (!uuid.test(town) || !uuid.test(candidateId) || !db.transaction)
      throw Error('Address review unavailable');
    await authority(town);
    const rows = await db.query(
      'SELECT "communityId" FROM "directory_address_review_candidate" WHERE "id"=$1',
      [candidateId]
    );
    if (rows.length !== 1 || rows[0].communityId !== town)
      throw Error('Candidate unavailable');
    const result = await undoAddressReviewDecision(db as DataSource, {
      ...value,
      candidateId,
    });
    await authority(town);
    return result;
  }
  async function identityReviewDetail(town: string, businessId: string) {
    if (!uuid.test(town) || !uuid.test(businessId) || !db.transaction)
      throw Error('Identity review unavailable');
    await authority(town);
    const item = await getBusinessIdentityReviewItem(db, town, businessId);
    await authority(town);
    return item;
  }
  async function identityReviewUndo(
    town: string,
    businessId: string,
    value: {
      decisionId: string;
      undoOf: string;
      expectedVersionToken: string;
      actorId: string;
      reason: string;
    }
  ) {
    if (!uuid.test(town) || !uuid.test(businessId) || !db.transaction)
      throw Error('Identity review unavailable');
    await authority(town);
    const { replayed, businessIds } = await undoBusinessIdentityDecision(
      db as DataSource,
      {
        decisionId: value.decisionId,
        townId: town,
        businessId,
        undoOf: value.undoOf,
        expectedVersionToken: value.expectedVersionToken,
        actor: { id: value.actorId, domain: 'profile' },
        reason: value.reason,
      }
    );
    await authority(town);
    return { replayed, businesses: businessIds.length };
  }
  async function identityReviewQueue(town: string) {
    if (!uuid.test(town) || !db.transaction)
      throw Error('Identity review unavailable');
    await authority(town);
    const result = {
      health: await businessIdentityHealth(db),
      queue: await listIdentityReviewQueue(db, town),
    };
    await authority(town);
    return result;
  }
  async function identityReviewDecision(
    town: string,
    value: {
      decisionId: string;
      action: DecisionAction;
      businessId: string;
      otherBusinessId?: string;
      rows?: DecisionRow[];
      actorId: string;
      reason: string;
      expectedVersionToken: string;
    }
  ) {
    if (!uuid.test(town) || !db.transaction)
      throw Error('Identity review unavailable');
    await authority(town);
    const {
      decisionId,
      action,
      businessId,
      otherBusinessId,
      rows,
      actorId,
      reason,
      expectedVersionToken,
    } = value;
    const { replayed, businessIds, restoredLinks } =
      await decideBusinessIdentity(db as DataSource, {
        decisionId,
        townId: town,
        action,
        businessId,
        otherBusinessId,
        rows,
        actor: { id: actorId, domain: 'profile' },
        reason,
        expectedVersionToken,
      });
    await authority(town);
    return { replayed, businesses: businessIds.length, restoredLinks };
  }
  async function suppressionList(town: string) {
    if (!uuid.test(town) || !db.transaction)
      throw Error('Listing suppression unavailable');
    await authority(town);
    const result = await listSuppressions(db, town);
    await authority(town);
    return result;
  }
  async function duplicateList(town: string, query: DuplicateListQuery = {}) {
    if (!uuid.test(town) || !db.transaction)
      throw Error(DUPLICATE_CASE_INVALID);
    await authority(town);
    const result = await listDuplicateCases(db, town, query);
    await authority(town);
    return result;
  }
  async function duplicateDetail(town: string, caseId: string) {
    if (!uuid.test(town) || !db.transaction)
      throw Error(DUPLICATE_CASE_INVALID);
    await authority(town);
    const result = await getDuplicateCase(db, town, caseId);
    await authority(town);
    return result;
  }
  async function duplicateDecide(
    town: string,
    caseId: string,
    value: {
      action: string;
      reason: string;
      actorId: string;
      expectedState?: string;
      expectedKept?: { scanId: string; sourceFileRowNumber: string };
    }
  ) {
    if (!uuid.test(town) || !db.transaction)
      throw Error(DUPLICATE_CASE_INVALID);
    await authority(town);
    const result = await decideDuplicateCase(db as never, {
      caseId,
      townId: town,
      action: value.action as (typeof DUPLICATE_ACTIONS)[number],
      actorId: value.actorId,
      reason: value.reason,
      ...(value.expectedState ? { expectedState: value.expectedState } : {}),
      ...(value.expectedKept ? { expectedKept: value.expectedKept } : {}),
    });
    await authority(town);
    return result;
  }
  async function duplicateSample(route: DuplicateRoute, body: any) {
    if (!uuid.test(route.townId) || !db.transaction)
      throw Error(DUPLICATE_CASE_INVALID);
    await authority(route.townId);
    let result: unknown;
    if (route.kind === 'samples')
      result = await listDuplicateSamples(db, route.townId);
    else if (route.kind === 'sample')
      result = await getDuplicateSample(db, route.townId, route.sampleId);
    else if (route.kind === 'sample-draw')
      result = await drawDuplicateSample(db as never, {
        townId: route.townId,
        round: body.round,
        actorId: body.actorId,
        ...(body.size === undefined ? {} : { size: body.size }),
        ...(body.seed === undefined ? {} : { seed: body.seed }),
      });
    else if (route.kind === 'sample-judge')
      result = await judgeSampleItem(db as never, {
        townId: route.townId,
        sampleId: route.sampleId,
        caseId: body.caseId,
        verdict: body.verdict,
        actorId: body.actorId,
      });
    else throw Error(DUPLICATE_CASE_INVALID);
    await authority(route.townId);
    return result;
  }
  async function suppressionCreate(
    town: string,
    value: {
      suppressionId: string;
      listingId: string;
      reasonCode: SuppressionReason;
      note?: string;
      actorId: string;
    }
  ) {
    if (!uuid.test(town) || !db.transaction)
      throw Error('Listing suppression unavailable');
    await authority(town);
    const result = await suppressListing(db as DataSource, {
      ...value,
      townId: town,
    });
    await authority(town);
    return result;
  }
  async function suppressionLift(
    town: string,
    suppressionId: string,
    value: { reasonCode: LiftReason; actorId: string }
  ) {
    if (!uuid.test(town) || !db.transaction)
      throw Error('Listing suppression unavailable');
    await authority(town);
    const result = await liftSuppression(db as DataSource, {
      ...value,
      suppressionId,
      townId: town,
    });
    await authority(town);
    return result;
  }
  async function reportCreate(
    town: string,
    value: {
      listingId: string;
      reasonCode: ReportReason;
      note?: string;
      email?: string;
    }
  ) {
    if (
      !uuid.test(town) ||
      !db.transaction ||
      !cursorSecret ||
      Buffer.byteLength(cursorSecret) < 32
    )
      throw Error(REPORT_BUSY);
    validateReport({ ...value, townId: town });
    // The report keys on the stable listing id and only a listing this town currently serves can be reported.
    const listing = await localDetail(town, value.listingId, true);
    if (!listing || !uuid.test(listing.id || '')) throw Error(REPORT_NOT_FOUND);
    return createReport(db as DataSource, contactKeyFrom(cursorSecret), {
      ...value,
      listingId: listing.id as string,
      townId: town,
      listingName: typeof listing.name === 'string' ? listing.name : null,
    });
  }
  async function reportLookup(receipt: string) {
    return lookupReceipt(db, receipt);
  }
  async function reportList(town: string, status?: string) {
    if (!uuid.test(town)) throw Error(REPORT_INVALID);
    await authority(town);
    return listReports(db, town, status);
  }
  async function reportTransition(
    town: string,
    reportId: string,
    value: {
      action: ReportAction;
      actorId: string;
      note?: string;
      suppressionId?: string;
    }
  ) {
    if (!uuid.test(town) || !db.transaction) throw Error(REPORT_INVALID);
    await authority(town);
    const result = await transitionReport(db as DataSource, {
      ...value,
      townId: town,
      reportId,
    });
    await authority(town);
    return result;
  }
  // Rights cases and withdrawals are global operator records, not town facts, so no town authority applies.
  const rightsDb = db as unknown as Parameters<typeof syncRightsCases>[0];
  const rights = {
    rightsList: (o: Parameters<typeof listRightsCases>[1]) =>
      listRightsCases(db, o),
    rightsDetail: (id: string) => getRightsCase(db, id),
    rightsSync: async (v: {
      syncId: string;
      actorId: string;
      releaseId?: string;
      operation?: string;
    }) => {
      // The release an operator names wins; otherwise the one a stage run recorded.
      await primePromotedRights(rightsDb as never).catch(() => undefined);
      const releaseId = v.releaseId ?? (await discoverRightsRelease(rightsDb));
      if (!releaseId) throw Error('Invalid rights sync: no release recorded');
      return syncRightsCases(rightsDb, {
        ...v,
        releaseId,
        operation: v.operation as never,
        policy: loadRightsPolicy(releaseId),
      });
    },
    rightsDecide: (caseId: string, v: any) =>
      decideRightsCase(rightsDb, { ...v, caseId }),
    rightsUndo: (caseId: string, v: any) =>
      undoRightsDecision(rightsDb, { ...v, caseId }),
    withdrawalCreate: (v: any) => createWithdrawal(rightsDb, v),
    withdrawalList: (o: Parameters<typeof listWithdrawals>[1]) =>
      listWithdrawals(db, o),
    withdrawalGet: (id: string) => getWithdrawal(db, id),
  };
  // Taxonomy classification is likewise a global operator record (S7d).
  const taxonomyDb = db as unknown as Parameters<typeof raiseTaxonomyCase>[0];
  const taxonomy = {
    taxonomyMappings: () => listTaxonomyMappings(db),
    taxonomyInstall: (v: {
      version: string;
      activate: boolean;
      actorId: string;
    }) => installTaxonomyMapping(taxonomyDb, v),
    taxonomyCases: (o: Parameters<typeof listTaxonomyCases>[1]) =>
      listTaxonomyCases(db, o),
    taxonomyRaise: (v: any) => raiseTaxonomyCase(taxonomyDb, v),
    taxonomyCase: (id: string) => getTaxonomyCase(db, id),
    taxonomyDecide: (caseId: string, v: any) =>
      decideTaxonomyCase(taxonomyDb, { ...v, caseId }),
    taxonomyDismiss: (caseId: string, v: any) =>
      decideTaxonomyCase(taxonomyDb, { ...v, caseId, action: 'dismiss' }),
    taxonomyUndo: (caseId: string, v: any) =>
      undoTaxonomyDecision(taxonomyDb, { ...v, caseId }),
    taxonomyRuns: (o: Parameters<typeof listTaxonomyRuns>[1]) =>
      listTaxonomyRuns(db, o),
    taxonomyRunCreate: (v: any) => createTaxonomyRun(taxonomyDb, v),
    taxonomyRun: (id: string) => getTaxonomyRun(db, id),
    taxonomyRunCancel: (id: string, v: any) =>
      cancelTaxonomyRun(taxonomyDb, { ...v, id }),
    taxonomyRunRollback: (id: string, v: any) =>
      rollbackTaxonomyRun(taxonomyDb, {
        id,
        actorId: v.actorId,
        reason: v.reason,
      }),
  };
  // Acquisition runs are a global operator record (S7e); the stage scripts write them, operators observe and request.
  const acquisitionDb = db as unknown as Parameters<
    typeof cancelAcquisitionRun
  >[0];
  const acquisition = {
    acquisitionRuns: (o: Parameters<typeof listAcquisitionRuns>[1]) =>
      listAcquisitionRuns(db, o),
    acquisitionLatest: () => latestAcquisitionRun(db),
    acquisitionBudget: () => acquisitionBudgetPanel(db),
    acquisitionRun: (id: string) => getAcquisitionRun(db, id),
    acquisitionAction: (
      action: 'cancel' | 'resume' | 'retry',
      id: string,
      v: any
    ) =>
      (action === 'cancel'
        ? cancelAcquisitionRun
        : action === 'resume'
        ? resumeAcquisitionRun
        : retryAcquisitionJob)(acquisitionDb, { ...v, id }),
    acquisitionReleases: () => overtureReleasePanel(acquisitionDb as never),
    acquisitionReleaseAction: (
      action: 'retry' | 'reject',
      release: string,
      v: any
    ) =>
      (action === 'retry' ? retryReleaseCandidate : rejectReleaseCandidate)(
        acquisitionDb as never,
        { ...v, release }
      ),
    acquisitionTownRun: (townId: string, v: any) =>
      requestTownAcquisition(db as never, { ...v, communityId: townId }),
    acquisitionImportHistory: (v: any) => {
      // A declared release must be one an approved rights policy covers, so a typo cannot label history.
      if (v.release !== undefined && !loadRightsPolicy(v.release))
        throw Error('Invalid acquisition run: no rights policy for release');
      return importAcquisitionHistory(acquisitionDb, v);
    },
  };
  // Operator export (S8): jobs are global operator records. Without DIRECTORY_EXPORT_DIR nothing can be written, so
  // create, retry and download answer 503 rather than queueing a job no worker will run.
  const exportDir = process.env.DIRECTORY_EXPORT_DIR;
  const requireExportDir = () => {
    if (!exportDir) throw new ExportUnavailableError();
    return exportDir;
  };
  const exportOps = {
    exportCreate: async (v: Parameters<typeof createExportJob>[1]) => {
      requireExportDir();
      return (await createExportJob(rightsDb as never, v)).job;
    },
    exportList: (o: Parameters<typeof listExportJobs>[1]) =>
      listExportJobs(db, o),
    exportGet: (id: string) => getExportJob(db, id),
    exportRetry: (id: string, v: { actorId: string }) => {
      requireExportDir();
      return retryExportJob(db, { id, actorId: v.actorId });
    },
    exportArtifact: (v: { id: string; actorId: string }) =>
      openExportArtifact(db, { ...v, dir: requireExportDir() }),
  };
  // Operations (S9a): restricted metrics and pause switches. Global operator records, so no town authority applies.
  const ops = {
    opsMetrics: () => collectOpsMetrics(db, process.env),
    opsControls: () => listControls(db),
    opsSetControl: (v: Parameters<typeof setControl>[1]) =>
      setControl(db as unknown as Parameters<typeof setControl>[0], v),
  };
  return {
    ...rights,
    ...exportOps,
    ...ops,
    ...taxonomy,
    ...acquisition,
    reportCreate,
    reportLookup,
    reportList,
    reportTransition,
    suppressionList,
    duplicateList,
    duplicateDetail,
    duplicateDecide,
    duplicateSample,
    suppressionCreate,
    suppressionLift,
    ready,
    bindingHealth,
    spatialHealth,
    sourceFreshnessHealth,
    businessIdentityHealth: businessIdentityHealthCheck,
    status,
    candidate,
    approximate,
    decision,
    containment,
    boundary,
    publicExport,
    localListings,
    localDetail,
    localLinkAction,
    localLinkRead,
    localLinkRequests,
    localTownLinkRequests,
    localOwnerLinks,
    addressReviewList,
    addressReviewDecision,
    addressReviewDetail,
    addressReviewUndo,
    identityReviewQueue,
    identityReviewDecision,
    identityReviewDetail,
    identityReviewUndo,
  };
}

export function pendingServer(
  checks: ReturnType<typeof pendingChecks>,
  reviewSecret?: string,
  pendingSecret?: string,
  decisionSecret?: string,
  containmentSecret?: string,
  localSecret?: string,
  linkSecret?: string,
  lifecycle?: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>
): Server {
  let active = 0;
  return createServer(async (req, res) => {
    if (await handleRightsRoute(req, res, checks, localSecret)) return;
    if (await handleExportRoute(req, res, checks, localSecret)) return;
    if (await handlePublicExportRoute(req, res, checks, localSecret)) return;
    if (await handleOpsRoute(req, res, checks, localSecret)) return;
    if (await handleTaxonomyRoute(req, res, checks, localSecret)) return;
    if (await handleAcquisitionRoute(req, res, checks, localSecret)) return;
    if (
      lifecycle &&
      req.url?.startsWith('/internal/account-') &&
      (await lifecycle(req, res))
    )
      return;
    if (req.method === 'GET' && req.url === '/health/live') {
      res.writeHead(200, { 'cache-control': 'no-store' }).end('ok');
      return;
    }
    const localUrl = req.url ? new URL(req.url, 'http://localhost') : null;
    const ownerLinkMatch =
      req.method === 'GET' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/business-links\/([0-9a-f-]{36})\/owner\/([0-9a-f-]{36})$/
      );
    if (ownerLinkMatch) {
      const expected = Buffer.from(linkSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (localUrl!.search) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const requests = await checks.localOwnerLinks(
          ownerLinkMatch[1],
          ownerLinkMatch[2],
          ownerLinkMatch[3]
        );
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify({ requests }));
      } catch {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
      } finally {
        active--;
      }
      return;
    }
    const townLinkQueueMatch =
      req.method === 'GET' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/business-link-requests$/
      );
    if (townLinkQueueMatch) {
      const expected = Buffer.from(linkSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      const params = localUrl!.searchParams,
        cursors = params.getAll('cursor');
      if (
        [...params.keys()].some((k) => k !== 'cursor') ||
        cursors.length > 1 ||
        (cursors.length && !uuid.test(cursors[0]))
      ) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const result = await checks.localTownLinkRequests(
          townLinkQueueMatch[1],
          cursors[0]
        );
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
      } finally {
        active--;
      }
      return;
    }
    const linkQueueMatch =
      req.method === 'GET' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/business-links\/([0-9a-f-]{36})\/requests$/
      );
    if (linkQueueMatch) {
      const expected = Buffer.from(linkSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (localUrl!.search) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const requests = await checks.localLinkRequests(
          linkQueueMatch[1],
          linkQueueMatch[2]
        );
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify({ requests }));
      } catch {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
      } finally {
        active--;
      }
      return;
    }
    const linkReadMatch =
      req.method === 'GET' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/business-links\/([0-9a-f-]{36})$/
      );
    if (linkReadMatch) {
      const expected = Buffer.from(linkSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      const params = localUrl!.searchParams,
        adults = params.getAll('adult');
      if (
        [...params.keys()].some((k) => k !== 'adult') ||
        adults.length > 1 ||
        (adults.length && adults[0] !== '1')
      ) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const link = await checks.localLinkRead(
          linkReadMatch[1],
          linkReadMatch[2],
          adults.length === 1
        );
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify({ link }));
      } catch {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
      } finally {
        active--;
      }
      return;
    }
    const linkMatch =
      req.method === 'POST' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/business-links$/
      );
    if (linkMatch) {
      const expected = Buffer.from(linkSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (localUrl!.search) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      req.setTimeout(5000, () => req.destroy());
      try {
        let body = Buffer.alloc(0);
        for await (const chunk of req) {
          body = Buffer.concat([body, Buffer.from(chunk)]);
          if (body.length > 8192) {
            res.writeHead(413, { 'cache-control': 'no-store' }).end();
            return;
          }
        }
        let parsed: any;
        try {
          parsed = JSON.parse(body.toString('utf8'));
        } catch {
          res.writeHead(400, { 'cache-control': 'no-store' }).end();
          return;
        }
        if (
          !parsed ||
          !['request', 'review', 'revoke'].includes(parsed.action) ||
          !parsed.value ||
          typeof parsed.value !== 'object' ||
          Array.isArray(parsed.value)
        ) {
          res.writeHead(400, { 'cache-control': 'no-store' }).end();
          return;
        }
        await checks.localLinkAction(linkMatch[1], parsed.action, parsed.value);
        res.writeHead(204, { 'cache-control': 'no-store' }).end();
      } catch {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
      } finally {
        active--;
      }
      return;
    }
    const addressReviewListMatch =
      req.method === 'GET' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/address-review-candidates$/
      );
    if (addressReviewListMatch) {
      const expected = Buffer.from(localSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      const params = localUrl!.searchParams,
        statuses = params.getAll('status'),
        limits = params.getAll('limit'),
        offsets = params.getAll('offset');
      const status = statuses.length ? statuses[0] : '';
      if (
        [...params.keys()].some(
          (k) => !['status', 'limit', 'offset'].includes(k)
        ) ||
        statuses.length > 1 ||
        limits.length > 1 ||
        offsets.length > 1 ||
        (status &&
          ![
            'needs_human',
            'auto_approved',
            'approved',
            'published',
            'rejected',
            'revoked',
            'archived',
          ].includes(status)) ||
        (limits.length && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limits[0])) ||
        (offsets.length && !/^(0|[1-9][0-9]{0,6})$/.test(offsets[0]))
      ) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const result = await checks.addressReviewList(
          addressReviewListMatch[1],
          status,
          limits.length ? Number(limits[0]) : 25,
          offsets.length ? Number(offsets[0]) : 0
        );
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
      } finally {
        active--;
      }
      return;
    }
    const addressReviewDecisionMatch =
      req.method === 'POST' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/address-review-candidates\/([0-9a-f-]{36})\/decisions$/
      );
    if (addressReviewDecisionMatch) {
      const expected = Buffer.from(localSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (localUrl!.search) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      req.setTimeout(5000, () => req.destroy());
      try {
        let body = Buffer.alloc(0);
        for await (const chunk of req) {
          body = Buffer.concat([body, Buffer.from(chunk)]);
          if (body.length > 16384) {
            res.writeHead(413, { 'cache-control': 'no-store' }).end();
            return;
          }
        }
        let value: any;
        try {
          value = JSON.parse(body.toString('utf8'));
        } catch {
          res.writeHead(400, { 'cache-control': 'no-store' }).end();
          return;
        }
        const decision = value?.decision,
          actorId = value?.actorId,
          evidenceUrl = value?.evidenceUrl,
          evidenceHash = value?.evidenceHash,
          reason = value?.reason,
          reviewChecks = value?.checks,
          policyVersion = value?.policyVersion;
        const validUrl = (input: unknown) => {
          try {
            if (typeof input !== 'string' || input.length > 2048) return false;
            const url = new URL(input),
              host = url.hostname.toLowerCase().replace(/\.$/, '');
            return (
              url.protocol === 'https:' &&
              !url.username &&
              !url.password &&
              host.includes('.') &&
              !/(?:^|\.)(localhost|local|internal)$/.test(host)
            );
          } catch {
            return false;
          }
        };
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          !uuid.test(actorId || '') ||
          !uuid.test(value?.decisionId || '') ||
          typeof value?.expectedVersionToken !== 'string' ||
          !VERSION_TOKEN.test(value.expectedVersionToken) ||
          !['approve', 'reject', 'needs_info', 'revoke'].includes(decision) ||
          (evidenceUrl !== undefined &&
            evidenceUrl !== '' &&
            !validUrl(evidenceUrl)) ||
          (decision === 'approve' && !validUrl(evidenceUrl)) ||
          (evidenceHash !== undefined &&
            (typeof evidenceHash !== 'string' ||
              !/^[a-f0-9]{64}$/.test(evidenceHash))) ||
          (reason !== undefined &&
            (typeof reason !== 'string' || reason.length > 2048)) ||
          (reviewChecks !== undefined &&
            (typeof reviewChecks !== 'object' ||
              reviewChecks === null ||
              Array.isArray(reviewChecks))) ||
          (policyVersion !== undefined &&
            (typeof policyVersion !== 'string' || policyVersion.length > 64))
        ) {
          res.writeHead(400, { 'cache-control': 'no-store' }).end();
          return;
        }
        const result = await checks.addressReviewDecision(
          addressReviewDecisionMatch[1],
          addressReviewDecisionMatch[2],
          {
            decisionId: value.decisionId,
            expectedVersionToken: value.expectedVersionToken,
            actorId,
            decision,
            evidenceUrl,
            evidenceHash,
            reason,
            checks: reviewChecks,
            policyVersion,
          }
        );
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch (error) {
        reviewFailure(res, error);
      } finally {
        active--;
      }
      return;
    }
    const reviewItemMatch = localUrl?.pathname.match(
      /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/(address-review-candidates|business-identity-review)\/([0-9a-f-]{36})(\/undo)?$/
    );
    if (
      reviewItemMatch &&
      req.method === (reviewItemMatch[4] ? 'POST' : 'GET')
    ) {
      const expected = Buffer.from(localSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (localUrl!.search) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      req.setTimeout(5000, () => req.destroy());
      try {
        const [, town, kind, itemId, undoSuffix] = reviewItemMatch;
        const address = kind === 'address-review-candidates';
        if (!undoSuffix) {
          const item = address
            ? await checks.addressReviewDetail(town, itemId)
            : await checks.identityReviewDetail(town, itemId);
          if (!item) {
            res.writeHead(404, { 'cache-control': 'no-store' }).end();
            return;
          }
          res
            .writeHead(200, {
              'content-type': 'application/json',
              'cache-control': 'no-store',
            })
            .end(JSON.stringify(item));
          return;
        }
        let body = Buffer.alloc(0);
        for await (const chunk of req) {
          body = Buffer.concat([body, Buffer.from(chunk)]);
          if (body.length > 16384) {
            res.writeHead(413, { 'cache-control': 'no-store' }).end();
            return;
          }
        }
        let value: any;
        try {
          value = JSON.parse(body.toString('utf8'));
        } catch {
          res.writeHead(400, { 'cache-control': 'no-store' }).end();
          return;
        }
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          !uuid.test(value.actorId || '') ||
          !uuid.test(value.decisionId || '') ||
          !uuid.test(value.undoOf || '') ||
          typeof value.expectedVersionToken !== 'string' ||
          !VERSION_TOKEN.test(value.expectedVersionToken) ||
          typeof value.reason !== 'string' ||
          !value.reason.trim() ||
          value.reason.length > 1024
        ) {
          res.writeHead(400, { 'cache-control': 'no-store' }).end();
          return;
        }
        const undo = {
          decisionId: value.decisionId,
          undoOf: value.undoOf,
          expectedVersionToken: value.expectedVersionToken,
          actorId: value.actorId,
          reason: value.reason,
        };
        const result = address
          ? await checks.addressReviewUndo(town, itemId, undo)
          : await checks.identityReviewUndo(town, itemId, undo);
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch (error) {
        reviewFailure(res, error);
      } finally {
        active--;
      }
      return;
    }
    const identityReviewListMatch =
      req.method === 'GET' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/business-identity-review$/
      );
    if (identityReviewListMatch) {
      const expected = Buffer.from(localSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (localUrl!.search || !uuid.test(identityReviewListMatch[1])) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const result = await checks.identityReviewQueue(
          identityReviewListMatch[1]
        );
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
      } finally {
        active--;
      }
      return;
    }
    const identityReviewDecisionMatch =
      req.method === 'POST' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/business-identity-review\/decisions$/
      );
    if (identityReviewDecisionMatch) {
      const expected = Buffer.from(localSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (localUrl!.search || !uuid.test(identityReviewDecisionMatch[1])) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      req.setTimeout(5000, () => req.destroy());
      try {
        let body = Buffer.alloc(0);
        for await (const chunk of req) {
          body = Buffer.concat([body, Buffer.from(chunk)]);
          if (body.length > 16384) {
            res.writeHead(413, { 'cache-control': 'no-store' }).end();
            return;
          }
        }
        let value: any;
        try {
          value = JSON.parse(body.toString('utf8'));
        } catch {
          res.writeHead(400, { 'cache-control': 'no-store' }).end();
          return;
        }
        const {
          decisionId,
          actorId,
          action,
          businessId,
          otherBusinessId,
          rows,
          reason,
        } = value || {};
        const validRows =
          Array.isArray(rows) &&
          rows.length >= 1 &&
          rows.length <= 100 &&
          rows.every(
            (r: any) =>
              r &&
              typeof r === 'object' &&
              !Array.isArray(r) &&
              typeof r.scanId === 'string' &&
              (/^[0-9a-f]{64}$/.test(r.scanId) ||
                /^[\w.-]{1,64}$/.test(r.scanId)) &&
              typeof r.sourceFileRowNumber === 'string' &&
              /^[0-9]{1,18}$/.test(r.sourceFileRowNumber)
          );
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          !uuid.test(actorId || '') ||
          !uuid.test(decisionId || '') ||
          typeof value?.expectedVersionToken !== 'string' ||
          !VERSION_TOKEN.test(value.expectedVersionToken) ||
          !uuid.test(businessId || '') ||
          !['confirm', 'retire', 'merge', 'split'].includes(action) ||
          typeof reason !== 'string' ||
          !reason.trim() ||
          reason.length > 1024 ||
          (action === 'merge'
            ? !uuid.test(otherBusinessId || '')
            : otherBusinessId !== undefined) ||
          (action === 'split' ? !validRows : rows !== undefined)
        ) {
          res.writeHead(400, { 'cache-control': 'no-store' }).end();
          return;
        }
        const result = await checks.identityReviewDecision(
          identityReviewDecisionMatch[1],
          {
            decisionId,
            action,
            businessId,
            otherBusinessId,
            rows,
            actorId,
            reason,
            expectedVersionToken: value.expectedVersionToken,
          }
        );
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch (error) {
        reviewFailure(res, error);
      } finally {
        active--;
      }
      return;
    }
    const reportMatch = localUrl?.pathname.match(
      /^\/internal\/local-evaluation\/(?:towns\/([0-9a-f-]{36})\/listing-reports(?:\/([0-9a-f-]{36})\/(review|decline|resolve))?|listing-reports\/([A-Za-z0-9_-]{32}))$/
    );
    if (
      reportMatch &&
      (reportMatch[4]
        ? req.method === 'GET'
        : reportMatch[3]
        ? req.method === 'POST'
        : req.method === 'GET' || req.method === 'POST')
    ) {
      const noStore = { 'cache-control': 'no-store' };
      const expected = Buffer.from(localSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, noStore).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, noStore).end();
        return;
      }
      const statusParams = localUrl!.searchParams.getAll('status');
      if (
        [...localUrl!.searchParams.keys()].some((k) => k !== 'status') ||
        statusParams.length > 1 ||
        (statusParams.length && (reportMatch[4] || req.method !== 'GET'))
      ) {
        res.writeHead(400, noStore).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, noStore).end();
        return;
      }
      active++;
      const isRead = req.method === 'GET';
      if (!isRead) req.setTimeout(5000, () => req.destroy());
      try {
        let result: unknown;
        if (reportMatch[4]) {
          result = await checks.reportLookup(reportMatch[4]);
        } else if (isRead) {
          result = await checks.reportList(
            reportMatch[1],
            statusParams.length ? statusParams[0] : undefined
          );
        } else {
          let body = Buffer.alloc(0);
          for await (const chunk of req) {
            body = Buffer.concat([body, Buffer.from(chunk)]);
            if (body.length > 8192) {
              res.writeHead(413, noStore).end();
              return;
            }
          }
          let value: any;
          try {
            value = JSON.parse(body.toString('utf8'));
          } catch {
            res.writeHead(400, noStore).end();
            return;
          }
          const shape = (allowed: string[]) =>
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            Object.keys(value).every((k) => allowed.includes(k));
          if (reportMatch[3]) {
            if (
              !shape(['actorId', 'note', 'suppressionId']) ||
              !uuid.test(value.actorId || '') ||
              (value.note !== undefined && typeof value.note !== 'string') ||
              (value.suppressionId !== undefined &&
                !uuid.test(value.suppressionId || ''))
            ) {
              res.writeHead(400, noStore).end();
              return;
            }
            result = await checks.reportTransition(
              reportMatch[1],
              reportMatch[2],
              {
                action: reportMatch[3] as ReportAction,
                actorId: value.actorId,
                ...(value.note === undefined ? {} : { note: value.note }),
                ...(value.suppressionId === undefined
                  ? {}
                  : { suppressionId: value.suppressionId }),
              }
            );
          } else {
            if (
              !shape(['listingId', 'reasonCode', 'note', 'email']) ||
              !uuid.test(value.listingId || '') ||
              !(REPORT_REASONS as readonly string[]).includes(
                value.reasonCode
              ) ||
              (value.note !== undefined && typeof value.note !== 'string') ||
              (value.email !== undefined && typeof value.email !== 'string')
            ) {
              res.writeHead(400, noStore).end();
              return;
            }
            result = await checks.reportCreate(reportMatch[1], {
              listingId: value.listingId,
              reasonCode: value.reasonCode,
              ...(value.note === undefined ? {} : { note: value.note }),
              ...(value.email === undefined ? {} : { email: value.email }),
            });
          }
        }
        res
          .writeHead(200, {
            'content-type': 'application/json',
            ...noStore,
          })
          .end(JSON.stringify(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        res
          .writeHead(
            message === REPORT_INVALID
              ? 400
              : message === REPORT_CONFLICT ||
                message === 'ACCOUNT_DELETION_FENCED'
              ? 409
              : message === REPORT_NOT_FOUND
              ? 404
              : 503,
            noStore
          )
          .end();
      } finally {
        active--;
      }
      return;
    }
    const suppressionMatch = localUrl?.pathname.match(
      /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/listing-suppressions(?:\/([0-9a-f-]{36})\/(lift))?$/
    );
    if (
      suppressionMatch &&
      (suppressionMatch[3]
        ? req.method === 'POST'
        : req.method === 'GET' || req.method === 'POST')
    ) {
      const isList = req.method === 'GET';
      const expected = Buffer.from(localSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (localUrl!.search || !uuid.test(suppressionMatch[1])) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      if (!isList) req.setTimeout(5000, () => req.destroy());
      try {
        let result: unknown;
        if (isList) {
          result = await checks.suppressionList(suppressionMatch[1]);
        } else {
          let body = Buffer.alloc(0);
          for await (const chunk of req) {
            body = Buffer.concat([body, Buffer.from(chunk)]);
            if (body.length > 16384) {
              res.writeHead(413, { 'cache-control': 'no-store' }).end();
              return;
            }
          }
          let value: any;
          try {
            value = JSON.parse(body.toString('utf8'));
          } catch {
            res.writeHead(400, { 'cache-control': 'no-store' }).end();
            return;
          }
          const shape = (allowed: string[]) =>
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            Object.keys(value).every((k) => allowed.includes(k));
          if (suppressionMatch[3]) {
            if (
              !shape(['reasonCode', 'actorId']) ||
              !uuid.test(value.actorId || '') ||
              !(LIFT_REASONS as readonly string[]).includes(value.reasonCode)
            ) {
              res.writeHead(400, { 'cache-control': 'no-store' }).end();
              return;
            }
            result = await checks.suppressionLift(
              suppressionMatch[1],
              suppressionMatch[2],
              { reasonCode: value.reasonCode, actorId: value.actorId }
            );
          } else {
            if (
              !shape([
                'suppressionId',
                'listingId',
                'reasonCode',
                'note',
                'actorId',
              ]) ||
              !uuid.test(value.actorId || '') ||
              !uuid.test(value.suppressionId || '') ||
              !uuid.test(value.listingId || '') ||
              !(SUPPRESSION_REASONS as readonly string[]).includes(
                value.reasonCode
              ) ||
              (value.note !== undefined &&
                (typeof value.note !== 'string' ||
                  !value.note.trim() ||
                  value.note.length > 1024))
            ) {
              res.writeHead(400, { 'cache-control': 'no-store' }).end();
              return;
            }
            result = await checks.suppressionCreate(suppressionMatch[1], {
              suppressionId: value.suppressionId,
              listingId: value.listingId,
              reasonCode: value.reasonCode,
              ...(value.note === undefined ? {} : { note: value.note }),
              actorId: value.actorId,
            });
          }
        }
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        res
          .writeHead(
            message === SUPPRESSION_CONFLICT ||
              message === 'ACCOUNT_DELETION_FENCED'
              ? 409
              : message === SUPPRESSION_NOT_FOUND
              ? 404
              : 503,
            { 'cache-control': 'no-store' }
          )
          .end();
      } finally {
        active--;
      }
      return;
    }
    const duplicateRoute = localUrl
      ? parseDuplicateRoute(
          req.method ?? '',
          localUrl.pathname,
          localUrl.search
        )
      : null;
    if (duplicateRoute) {
      const reads = ['list', 'detail', 'samples', 'sample'];
      const isRead = reads.includes(duplicateRoute.kind);
      const expected = Buffer.from(localSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      const listQuery =
        duplicateRoute.kind === 'list'
          ? parseListQuery(localUrl!.search.replace(/^\?/, ''))
          : {};
      if (!uuid.test(duplicateRoute.townId) || listQuery === null) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      if (!isRead) req.setTimeout(5000, () => req.destroy());
      try {
        let result: unknown;
        if (duplicateRoute.kind === 'list') {
          result = await checks.duplicateList(duplicateRoute.townId, listQuery);
        } else if (duplicateRoute.kind === 'detail') {
          result = await checks.duplicateDetail(
            duplicateRoute.townId,
            duplicateRoute.caseId
          );
        } else if (isRead) {
          result = await checks.duplicateSample(duplicateRoute, {});
        } else {
          let body = Buffer.alloc(0);
          for await (const chunk of req) {
            body = Buffer.concat([body, Buffer.from(chunk)]);
            if (body.length > 16384) {
              res.writeHead(413, { 'cache-control': 'no-store' }).end();
              return;
            }
          }
          let value: unknown;
          try {
            value = JSON.parse(body.toString('utf8'));
          } catch {
            res.writeHead(400, { 'cache-control': 'no-store' }).end();
            return;
          }
          const parsed =
            duplicateRoute.kind === 'decide'
              ? parseDecideBody(value)
              : duplicateRoute.kind === 'sample-draw'
              ? parseDrawBody(value)
              : parseJudgeBody(value);
          if (!parsed) {
            res.writeHead(400, { 'cache-control': 'no-store' }).end();
            return;
          }
          result =
            duplicateRoute.kind === 'decide'
              ? await checks.duplicateDecide(
                  duplicateRoute.townId,
                  duplicateRoute.caseId,
                  parsed as DecideBody
                )
              : await checks.duplicateSample(duplicateRoute, parsed);
        }
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        res
          .writeHead(
            message === DUPLICATE_CASE_INVALID || message === SAMPLE_INVALID
              ? 400
              : message === 'ACCOUNT_DELETION_FENCED' ||
                message === DUPLICATE_CASE_STALE
              ? 409
              : message === DUPLICATE_CASE_NOT_FOUND ||
                message === SAMPLE_NOT_FOUND
              ? 404
              : 503,
            { 'cache-control': 'no-store' }
          )
          .end();
      } finally {
        active--;
      }
      return;
    }
    const detailMatch =
      req.method === 'GET' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/listings\/([A-Za-z0-9_-]{1,2048})$/
      );
    if (detailMatch) {
      const expected = Buffer.from(localSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      const params = localUrl!.searchParams,
        adults = params.getAll('adult');
      if (
        [...params.keys()].some((key) => key !== 'adult') ||
        adults.length > 1 ||
        (adults.length && adults[0] !== '1')
      ) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const listing = await checks.localDetail(
          detailMatch[1],
          detailMatch[2],
          adults.length === 1
        );
        if (!listing) {
          res.writeHead(404, { 'cache-control': 'no-store' }).end();
          return;
        }
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify({ listing }));
      } catch (error) {
        res
          .writeHead(
            error instanceof Error && error.message === 'Invalid reference'
              ? 404
              : 503,
            { 'cache-control': 'no-store' }
          )
          .end();
      } finally {
        active--;
      }
      return;
    }
    const localMatch =
      req.method === 'GET' &&
      localUrl?.pathname.match(
        /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/listings$/
      );
    if (localMatch) {
      const expected = Buffer.from(localSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      const params = localUrl!.searchParams,
        offsets = params.getAll('offset'),
        searches = params.getAll('q'),
        adults = params.getAll('adult'),
        categories = params.getAll('category'),
        paginations = params.getAll('pagination'),
        cursors = params.getAll('cursor'),
        bounds = params.getAll('bounds'),
        identities = params.getAll('identities');
      if (
        [...params.keys()].some(
          (key) =>
            ![
              'offset',
              'q',
              'adult',
              'category',
              'pagination',
              'cursor',
              'bounds',
              'identities',
            ].includes(key)
        ) ||
        offsets.length > 1 ||
        searches.length > 1 ||
        adults.length > 1 ||
        categories.length > 1 ||
        paginations.length > 1 ||
        cursors.length > 1 ||
        bounds.length > 1 ||
        identities.length > 1 ||
        (identities.length && identities[0] !== '1') ||
        (bounds.length && (!paginations.length || !bounds[0])) ||
        (paginations.length && paginations[0] !== 'cursor') ||
        (cursors.length &&
          (!paginations.length ||
            !/^[A-Za-z0-9_-]{1,2048}$/.test(cursors[0]))) ||
        (paginations.length && offsets.length && offsets[0] !== '0') ||
        (categories.length &&
          (categories[0].length > 100 ||
            !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(categories[0]))) ||
        (adults.length && adults[0] !== '1') ||
        (searches.length &&
          (searches[0].length > 100 || /[\x00-\x1f\x7f]/.test(searches[0]))) ||
        (offsets.length && !/^(0|[1-9][0-9]{0,6})$/.test(offsets[0]))
      ) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      const offset = offsets.length ? Number(offsets[0]) : 0;
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const result = await checks.localListings(
          localMatch[1],
          offset,
          searches[0] || '',
          adults.length === 1,
          categories[0] || '',
          paginations.length === 1,
          cursors[0] || '',
          undefined,
          bounds[0] || '',
          identities.length === 1
        );
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch (error) {
        if (
          error instanceof DirectoryAuthorityError &&
          error.kind === 'town-ineligible'
        ) {
          // Healthy authority, town not eligible: a truthful empty answer, not an outage.
          res
            .writeHead(200, {
              'content-type': 'application/json',
              'cache-control': 'no-store',
            })
            .end(
              JSON.stringify({
                listings: [],
                hasMore: false,
                ...(paginations.length === 1 ? { nextCursor: null } : {}),
                coverage: BLOCKED_TOWN_INELIGIBLE,
              })
            );
          return;
        }
        res
          .writeHead(
            error instanceof Error &&
              ['Invalid cursor', 'Invalid bounds'].includes(error.message)
              ? 400
              : 503,
            { 'cache-control': 'no-store' }
          )
          .end();
      } finally {
        active--;
      }
      return;
    }
    const registerMatch =
      req.method === 'GET' &&
      req.url?.match(/^\/internal\/register-towns\/([0-9a-f-]{36})\/status$/);
    if (registerMatch) {
      const expected = Buffer.from(pendingSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const result = await checks.approximate(registerMatch[1]);
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch (error) {
        res
          .writeHead(error instanceof TownUnavailable ? 404 : 503, {
            'cache-control': 'no-store',
          })
          .end();
      } finally {
        active--;
      }
      return;
    }
    const parsedUrl = req.url ? new URL(req.url, 'http://localhost') : null;
    const containmentMatch =
      req.method === 'GET' &&
      parsedUrl?.pathname.match(
        /^\/internal\/towns\/([0-9a-f-]{36})\/containment$/
      );
    if (containmentMatch) {
      const expected = Buffer.from(containmentSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      const params = parsedUrl!.searchParams,
        lon = params.getAll('longitude'),
        lat = params.getAll('latitude');
      if (
        [...params.keys()].length !== 2 ||
        lon.length !== 1 ||
        lat.length !== 1 ||
        !lon[0].trim() ||
        !lat[0].trim() ||
        !Number.isFinite(Number(lon[0])) ||
        !Number.isFinite(Number(lat[0])) ||
        Math.abs(Number(lon[0])) > 180 ||
        Math.abs(Number(lat[0])) > 90
      ) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const result = await checks.containment(
          containmentMatch[1],
          Number(lon[0]),
          Number(lat[0])
        );
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch (error) {
        res
          .writeHead(error instanceof TownUnavailable ? 404 : 503, {
            'cache-control': 'no-store',
          })
          .end();
      } finally {
        active--;
      }
      return;
    }
    const boundaryMatch =
      req.method === 'GET' &&
      parsedUrl?.pathname.match(
        /^\/internal\/towns\/([0-9a-f-]{36})\/boundary$/
      );
    if (boundaryMatch) {
      const expected = Buffer.from(containmentSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (parsedUrl!.search) {
        res.writeHead(400, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const result = await checks.boundary(boundaryMatch[1]);
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify(result));
      } catch (error) {
        res
          .writeHead(error instanceof TownUnavailable ? 404 : 503, {
            'cache-control': 'no-store',
          })
          .end();
      } finally {
        active--;
      }
      return;
    }
    const decisionMatch =
      req.method === 'POST' &&
      req.url?.match(
        /^\/internal\/towns\/([0-9a-f-]{36})\/boundary-decisions$/
      );
    if (decisionMatch) {
      const expected = Buffer.from(decisionSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      req.setTimeout(5000, () => req.destroy());
      try {
        const body = await new Promise<Buffer | null>((resolve, reject) => {
          let size = 0,
            overflow = false;
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > 8192) overflow = true;
            else chunks.push(chunk);
          });
          req.on('end', () => resolve(overflow ? null : Buffer.concat(chunks)));
          req.on('error', reject);
        });
        if (body === null) {
          res.writeHead(413, { 'cache-control': 'no-store' }).end();
          return;
        }
        let value: BoundaryDecision;
        try {
          value = JSON.parse(body.toString('utf8'));
        } catch {
          res.writeHead(400, { 'cache-control': 'no-store' }).end();
          return;
        }
        await checks.decision(decisionMatch[1], value);
        res.writeHead(204, { 'cache-control': 'no-store' }).end();
      } catch {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
      } finally {
        active--;
      }
      return;
    }
    const candidateMatch =
      req.method === 'GET' &&
      req.url?.match(
        /^\/internal\/towns\/([0-9a-f-]{36})\/boundary-candidate$/
      );
    if (candidateMatch) {
      const expected = Buffer.from(reviewSecret || ''),
        provided = Buffer.from(
          req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : ''
        );
      if (expected.length < 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        res.writeHead(401, { 'cache-control': 'no-store' }).end();
        return;
      }
      if (active >= 32) {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return;
      }
      active++;
      try {
        const candidate = await checks.candidate(candidateMatch[1]);
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(JSON.stringify({ candidate }));
      } catch {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
      } finally {
        active--;
      }
      return;
    }
    const match =
      req.method === 'GET' &&
      req.url?.match(/^\/internal\/towns\/([0-9a-f-]{36})\/status$/);
    const readiness = req.method === 'GET' && req.url === '/health/ready';
    if (!match && !readiness) {
      res.writeHead(404, { 'cache-control': 'no-store' }).end();
      return;
    }
    let ok = false;
    if (active < 32) {
      active++;
      try {
        if (match) await checks.status(match[1]);
        else await checks.ready();
        ok = true;
      } catch {
        /* unavailable */
      } finally {
        active--;
      }
    }
    let reviewedBindings: object | undefined;
    if (readiness && ok && typeof checks.bindingHealth === 'function') {
      try {
        reviewedBindings = await checks.bindingHealth();
      } catch {
        /* counts are best-effort */
      }
    }
    let reviewedSpatial: object | undefined;
    if (readiness && ok && typeof checks.spatialHealth === 'function') {
      try {
        reviewedSpatial = await checks.spatialHealth();
      } catch {
        reviewedSpatial = { ready: false };
      }
    }
    let businessIdentity: object | undefined;
    if (
      readiness &&
      ok &&
      typeof checks.businessIdentityHealth === 'function'
    ) {
      try {
        businessIdentity = await checks.businessIdentityHealth();
      } catch {
        /* label-only, best-effort */
      }
    }
    let sourceFreshness: object | undefined;
    if (readiness && ok && typeof checks.sourceFreshnessHealth === 'function') {
      try {
        sourceFreshness = await checks.sourceFreshnessHealth();
      } catch {
        /* label-only, best-effort */
      }
    }
    res
      .writeHead(ok ? 200 : 503, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      })
      .end(
        JSON.stringify(
          match
            ? { status: ok ? 'pending' : 'unavailable' }
            : {
                ready: ok,
                ...(reviewedBindings ? { reviewedBindings } : {}),
                ...(reviewedSpatial ? { reviewedSpatial } : {}),
                ...(sourceFreshness ? { sourceFreshness } : {}),
                ...(businessIdentity ? { businessIdentity } : {}),
              }
        )
      );
  });
}

export async function runPendingRuntime(): Promise<void> {
  const config = pendingRuntimeConfig(process.env);
  const db = new DataSource({
    type: 'postgres',
    url: config.databaseUrl,
    extra: {
      max: 8,
      connectionTimeoutMillis: 2000,
      statement_timeout: 2000,
      query_timeout: 3000,
    },
  });
  const source = new RegisterDeliveryV2(
    config.host,
    config.port,
    config.secret
  );
  let server: Server | undefined;
  let stopWithdrawals: (() => void) | undefined;
  let stopTaxonomy: (() => void) | undefined;
  let stopExports: (() => void) | undefined;
  let stopping = false;
  const stop = () => {
    stopping = true;
    server?.close();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await db.initialize();
    if (stopping) return;
    server = pendingServer(
      pendingChecks(db, source, config.identity, config.localSecret),
      config.reviewSecret,
      config.pendingSecret,
      config.decisionSecret,
      config.containmentSecret,
      config.localSecret,
      config.linkSecret,
      config.lifecycle &&
        (
          await import('./account-lifecycle-runtime')
        ).createDirectoryLifecycleHandler(db, config.lifecycle)
    );
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(config.listenPort, '0.0.0.0', resolve);
    });
    // Durable withdrawal requests: the worker resumes pending and running ones after a restart.
    const exportDir = process.env.DIRECTORY_EXPORT_DIR;
    stopWithdrawals = startWithdrawalWorker(db as never, {
      ...(exportDir ? { exportDir } : {}),
      onError: () =>
        console.error('Directory withdrawal pass failed; retrying'),
    });
    // Operator exports run only when DIRECTORY_EXPORT_DIR names a writable directory.
    if (exportDir) {
      await primePromotedRights(db as never).catch(() => undefined);
      const primer = setInterval(
        () => void primePromotedRights(db as never).catch(() => undefined),
        60_000
      );
      primer.unref?.();
      const hours = Number(process.env.DIRECTORY_EXPORT_RETENTION_HOURS);
      stopExports = startExportWorker(db as never, {
        dir: exportDir,
        policyFor: loadRightsPolicy as never,
        retentionHours: Number.isFinite(hours) && hours > 0 ? hours : 24,
        onError: () => console.error('Directory export pass failed; retrying'),
      });
    }
    // Durable reclassification runs resume the same way.
    stopTaxonomy = startTaxonomyWorker(db as never, {
      onError: () => console.error('Directory taxonomy pass failed; retrying'),
    });
    await new Promise<void>((resolve) => server!.once('close', resolve));
  } finally {
    stopWithdrawals?.();
    stopExports?.();
    stopTaxonomy?.();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    source.close();
    if (db.isInitialized) await db.destroy();
  }
}
