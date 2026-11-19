/** Local-evaluation projection. Only reviewed business addresses have coordinates. */
export interface LocalDirectoryListing {
  /**
   * Stable public id. For a business carried across source releases this is the business id and keeps resolving
   * to the new release's row; otherwise it is scoped to one imported row. Clients cannot tell which, it is not an
   * ownership claim, and an id that no longer resolves is a 404. Resolution returns the canonical id, so clients
   * should store the id from the response. Cursors and references are not durable and end at a release cutover.
   */
  id?: string;
  name: string;
  category: string;
  attribution: string[];
  notices: string[];
  termsUrls?: string[];
  website?: string;
  phone?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  /** Short-lived opaque reference, available only in cursor mode. */
  reference?: string;
}

/** Label only: where the data came from and how old the upstream object was. Never filters a page. */
export interface LocalDirectorySourceFreshness {
  state: 'fresh' | 'due' | 'stale' | 'unknown';
  /** Overture release label, e.g. 2026-10-21.0. Null when state is unknown. */
  releaseId: string | null;
  /** Upstream object timestamp (Last-Modified), not a release publication date. */
  sourcePublishedAt: string | null;
  /** When Directory recorded the scan completion. */
  acquiredAt: string | null;
  thresholds: { freshDays: number; staleDays: number };
}

/**
 * What Directory can prove about a town's coverage, from persisted facts only. Independent of `sourceFreshness`
 * and never used to hide listings. A failed request is not a coverage state: it is an HTTP error.
 *
 *  - available: at least one listing is served.
 *  - empty: a completed, unrevoked, policy-active scan targeted this town and no listing remains.
 *  - acquiring: a scan targeting this town has started and none targeting it has completed.
 *  - partial: listings are served from a completed scan while a newer scan targeting the town is still acquiring.
 *  - blocked: the town is not served by policy (`reason` says which).
 *  - unknown: Directory has no recorded scan target for this town, so it cannot say whether it was scanned.
 *  - unconfigured: no active (non-revoked) source policy exists at all, because nothing is configured or publication
 *    is paused globally. A fact about Directory, not the town; it outranks unknown, empty and acquiring, but never
 *    blocked/town-ineligible and never a page that serves listings.
 */
export type LocalDirectoryCoverageState =
  | 'available'
  | 'empty'
  | 'acquiring'
  | 'partial'
  | 'blocked'
  | 'unknown'
  | 'unconfigured';

/** `town-ineligible`: the town is not eligible for the directory. `policy-withdrawn`: every scan covering it was withdrawn. */
export type LocalDirectoryCoverageReason =
  | 'town-ineligible'
  | 'policy-withdrawn';

export interface LocalDirectoryCoverage {
  state: LocalDirectoryCoverageState;
  /** Present only when state is `blocked`. */
  reason?: LocalDirectoryCoverageReason;
  /**
   * Count of served listings whose reviewed details (address, contact, map point) are withheld until their source
   * binding is re-verified. The listings themselves are still served. Count only: no ids, no causes.
   */
  withheldReviewedDetails: number;
}

export interface LocalDirectoryPage {
  listings: LocalDirectoryListing[];
  hasMore: boolean;
  /** Optional so older gateway and Local Hub builds ignore it. */
  sourceFreshness?: LocalDirectorySourceFreshness;
  /** Optional so older gateway and Local Hub builds ignore it. Absent means the same as `unknown`. */
  coverage?: LocalDirectoryCoverage;
  /**
   * Opaque label that changes whenever the set of policies or policy generations producing the page changes.
   * Not a policy id and not parseable: clients may only compare it for equality. Optional for older builds.
   */
  policyVersion?: string;
}

export interface LocalDirectoryCursorPage extends LocalDirectoryPage {
  nextCursor: string | null;
}

/** Public listing report / correction request (S6). Reasons match the reviewer suppression reasons. */
export type ListingReportReasonCode =
  | 'rights-request'
  | 'incorrect-details'
  | 'closed-business'
  | 'safety'
  | 'duplicate'
  | 'other';

/** The only four statuses a report can have; public labels are Received, Under review, Resolved, Declined. */
export type ListingReportStatus =
  | 'received'
  | 'under_review'
  | 'resolved'
  | 'declined';

/** POST /api/directory/towns/:townId/listing-reports (anonymous). Nothing is hidden by filing a report. */
export interface CreateListingReportRequest {
  /** The listing's stable public `id`, not its short-lived `reference`. */
  listingId: string;
  reasonCode: ListingReportReasonCode;
  /** Optional detail, at most 1000 characters. */
  note?: string;
  /** Optional contact email; stored only as a keyed hash, never shown or returned. */
  email?: string;
  /** Honeypot: leave empty. A non-empty value is silently discarded. */
  website?: string;
}

/** The receipt code is shown once; keep it to check the status later. */
export interface CreateListingReportResponse {
  receipt: string;
}

/** GET /api/directory/listing-reports/:receipt. Nothing else about the report is ever returned. */
export interface ListingReportReceiptStatus {
  status: ListingReportStatus;
  reasonCode: ListingReportReasonCode;
  createdAt: string;
}

/** Reviewer queue item (authenticated Owner Console routes). Never carries any reporter contact. */
export interface ListingReportReviewItem {
  reportId: string;
  listingId: string;
  listingName: string | null;
  reasonCode: ListingReportReasonCode;
  note: string | null;
  status: ListingReportStatus;
  /** True for safety and rights-request reports; the queue lists these first. */
  priority: boolean;
  createdAt: string;
  decidedById: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  suppressionId: string | null;
}

export type ListingReportReviewAction = 'review' | 'decline' | 'resolve';

/**
 * Owner Console permissions for Directory operator routes. Granted in the
 * owner-console app scope to the owner roles; `review` covers identity,
 * address, link and boundary review, listing reports and suppression.
 */
export const DIRECTORY_PERMISSIONS = {
  review: 'directory.review',
  rights: 'directory.rights',
  operate: 'directory.operate',
  export: 'directory.export',
} as const;
export type DirectoryPermission =
  (typeof DIRECTORY_PERMISSIONS)[keyof typeof DIRECTORY_PERMISSIONS];

/** Machine codes a review decision or undo can be refused with (HTTP 409). */
export type DirectoryReviewConflictCode =
  | 'stale_decision'
  | 'not_latest'
  | 'decision_conflict'
  | 'invalid_state';

/** The body of a 409 from a review decision or undo route. */
export interface DirectoryReviewConflict {
  code: DirectoryReviewConflictCode;
  message: string;
}

/** An undo names the decision it reverses; only the latest non-undone decision is reversible. */
export interface DirectoryReviewUndoRequest {
  /** New client-generated id; a retry with the same id and payload replays. */
  decisionId: string;
  undoOf: string;
  /** The item's `versionToken` as the reviewer last saw it. */
  expectedVersionToken: string;
  reason: string;
}

export interface DirectoryReviewHistoryEntry {
  decisionId: string;
  actorId: string;
  reason: string | null;
  createdAt: string;
  /** Set on an undo entry: the decision it reverses. */
  undoOf: string | null;
  /** Set on a reversed decision: the undo that reversed it. */
  undoneBy: string | null;
  /** True only on the latest non-undone decision. */
  reversible: boolean;
}

export type BusinessIdentityReviewAction =
  | 'confirm'
  | 'retire'
  | 'merge'
  | 'split'
  | 'undo';

export interface BusinessIdentityHistoryEntry
  extends DirectoryReviewHistoryEntry {
  action: BusinessIdentityReviewAction;
  businessId: string;
  otherBusinessId: string | null;
  actorDomain: string;
}

export interface BusinessIdentityReviewDetail {
  businessId: string;
  state: 'active' | 'retired' | 'merged' | 'split';
  successorId: string | null;
  stateCause: string | null;
  versionToken: string;
  history: BusinessIdentityHistoryEntry[];
}

/** Every identity decision carries the version token of the business it decides. */
export interface BusinessIdentityDecisionRequest {
  decisionId: string;
  expectedVersionToken: string;
  action: Exclude<BusinessIdentityReviewAction, 'undo'>;
  businessId: string;
  otherBusinessId?: string;
  rows?: Array<{ scanId: string; sourceFileRowNumber: string }>;
  reason: string;
  attested: true;
}

export type AddressReviewDecision =
  | 'approve'
  | 'reject'
  | 'needs_info'
  | 'revoke'
  | 'undo';

export interface AddressReviewHistoryEntry extends DirectoryReviewHistoryEntry {
  actorKind: string;
  decision: AddressReviewDecision;
}

export interface AddressReviewCandidateDetail {
  id: string;
  status: string;
  versionToken: string;
  history: AddressReviewHistoryEntry[];
}

/** Every address decision has a client id (idempotent) and the candidate's version token. */
export interface AddressReviewDecisionRequest {
  decisionId: string;
  expectedVersionToken: string;
  decision: Exclude<AddressReviewDecision, 'undo'>;
  evidenceUrl?: string;
  evidenceHash?: string;
  reason?: string;
  attested: true;
}

export type RightsCaseStatus = 'review' | 'excluded' | 'resolved' | 'withdrawn';
export type RightsCaseScope = 'release' | 'field' | 'source' | 'policy';
export type RightsDecisionAction =
  | 'exclude_field'
  | 'confirm_terms'
  | 'defer'
  | 'reopen';

/**
 * A decision never grants public display; it records evidence or removes a field from what could be shown.
 * `defer` records a note and leaves the case in review.
 */
export interface RightsCaseSummary {
  id: string;
  scope: RightsCaseScope;
  subjectKey: string;
  provider: string;
  releaseId: string | null;
  field: string | null;
  dataset: string | null;
  license: string | null;
  sourcePointer: string | null;
  ambiguous: boolean;
  reasons: string[];
  observedRows: number;
  status: RightsCaseStatus;
  createdAt: string;
  updatedAt: string;
  versionToken: string;
}

export interface RightsHistoryEntry extends DirectoryReviewHistoryEntry {
  action: RightsDecisionAction | 'open' | 'undo' | 'withdraw';
  statusBefore: RightsCaseStatus;
  statusAfter: RightsCaseStatus;
  evidence: { termsUrl: string; termsSha256: string } | null;
}

export interface RightsCaseDetail extends RightsCaseSummary {
  history: RightsHistoryEntry[];
}

export interface RightsDecisionRequest {
  decisionId: string;
  action: RightsDecisionAction;
  expectedVersionToken: string;
  reason: string;
  /** confirm_terms only: an https terms URL and the sha-256 of the terms text that was read. */
  termsUrl?: string;
  termsSha256?: string;
}

export interface RightsUndoRequest {
  decisionId: string;
  undoOf: string;
  expectedVersionToken: string;
  reason: string;
}

export interface RightsSyncRequest {
  syncId: string;
  /** Optional override; otherwise the release recorded on the newest Overture acquisition run. */
  releaseId?: string;
}

export interface RightsSyncResult {
  created: number;
  existing: number;
  lineages: number;
  /** Cases in review that an approved rights policy resolved during this sync. */
  resolved?: number;
}

export type WithdrawalKind = 'scan' | 'policy' | 'row';
export type WithdrawalStatus = 'pending' | 'running' | 'complete' | 'failed';
export const WITHDRAWAL_CONFIRMATION = 'WITHDRAW';

/** Withdrawal is one way: nothing in the contract restores withdrawn rows. */
export interface WithdrawalRequest {
  id: string;
  kind: WithdrawalKind;
  /** scan: scan id; policy: policy id; row: `<scanId>:<sourceFileRowNumber>`. */
  target: string;
  reason: string;
  confirm: typeof WITHDRAWAL_CONFIRMATION;
  rightsCaseId?: string;
}

export interface WithdrawalRecord {
  id: string;
  kind: WithdrawalKind;
  target: string;
  reason: string;
  /** Null once the requesting operator's account has been erased. */
  actorId: string | null;
  rightsCaseId: string | null;
  status: WithdrawalStatus;
  attempts: number;
  steps: number;
  progress: Record<string, number>;
  lastError: string | null;
  requestedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/**
 * Directory taxonomy (S7d). The controlled category ids and place types an operator can assign. They are the ids
 * the public category filter accepts once a listing is classified; a listing that has not been classified keeps
 * its stored (Overture basic) category.
 */
export const DIRECTORY_TAXONOMY_CATEGORIES = [
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'activities', label: 'Activities' },
  { id: 'services', label: 'Services' },
  { id: 'stores', label: 'Stores' },
  { id: 'places_and_landmarks', label: 'Places & landmarks' },
  { id: 'adult', label: 'Adult businesses' },
  { id: 'education', label: 'Education' },
  { id: 'places_of_worship', label: 'Places of worship' },
] as const;
export type DirectoryTaxonomyCategoryId =
  (typeof DIRECTORY_TAXONOMY_CATEGORIES)[number]['id'];

/** Explicit refinements of a category; a place type belongs to exactly one category. */
export const DIRECTORY_TAXONOMY_PLACE_TYPES = [
  { id: 'radio_station', label: 'Radio station', categoryId: 'services' },
  { id: 'auto_dealer', label: 'Auto dealership', categoryId: 'stores' },
] as const;
export type DirectoryTaxonomyPlaceTypeId =
  (typeof DIRECTORY_TAXONOMY_PLACE_TYPES)[number]['id'];

export function isTaxonomyPlaceTypeForCategory(
  placeTypeId: string,
  categoryId: string
): boolean {
  return DIRECTORY_TAXONOMY_PLACE_TYPES.some(
    (p) => p.id === placeTypeId && p.categoryId === categoryId
  );
}

export type TaxonomyExclusionReason =
  | 'missing_basic_category'
  | 'missing_taxonomy'
  | 'unmapped_taxonomy'
  | 'adult_restricted';
export type TaxonomyClassificationBasis = 'override' | 'mapping' | 'legacy';

export interface TaxonomyMappingVersion {
  id: string;
  sourceHash: string;
  unmappedPolicy: 'keep_legacy' | 'exclude';
  active: boolean;
  installedById: string | null;
  createdAt: string;
  activatedAt: string | null;
  rowCount: number;
}
export interface TaxonomyMappingList {
  versions: TaxonomyMappingVersion[];
  /** Versions the build carries and an operator could install. */
  available: { id: string; installed: boolean }[];
}
export interface TaxonomyMappingInstallRequest {
  version: string;
  activate: boolean;
}
export interface TaxonomyMappingInstallResult {
  replayed: boolean;
  version: TaxonomyMappingVersion;
}

export type TaxonomyCaseStatus =
  | 'open'
  | 'assigned'
  | 'rejected'
  | 'deferred'
  | 'dismissed';
export type TaxonomyCaseReason =
  | 'operator_raised'
  | 'unmapped_taxonomy'
  | 'ambiguous_taxonomy';
export type TaxonomyDecisionAction =
  | 'assign'
  | 'reject'
  | 'defer'
  | 'reopen'
  | 'dismiss';

export interface TaxonomyCaseSummary {
  id: string;
  townId: string;
  listingId: string;
  reason: TaxonomyCaseReason;
  name: string;
  observedCategory: string;
  status: TaxonomyCaseStatus;
  /** The category currently assigned by this case's override, when one is in force. */
  assignedCategoryId: string | null;
  assignedPlaceTypeId: string | null;
  createdAt: string;
  updatedAt: string;
  versionToken: string;
}
export interface TaxonomyHistoryEntry extends DirectoryReviewHistoryEntry {
  action: TaxonomyDecisionAction | 'open' | 'undo';
  categoryId: string | null;
  placeTypeId: string | null;
  statusBefore: TaxonomyCaseStatus;
  statusAfter: TaxonomyCaseStatus;
}
export interface TaxonomyCaseDetail extends TaxonomyCaseSummary {
  history: TaxonomyHistoryEntry[];
}
export interface TaxonomyDecisionRequest {
  decisionId: string;
  action: TaxonomyDecisionAction;
  expectedVersionToken: string;
  reason: string;
  /** assign only. */
  categoryId?: string;
  placeTypeId?: string;
}
/** Dismisses an automatically raised case (`unmapped_taxonomy` or `ambiguous_taxonomy`): nothing is served differently. */
export interface TaxonomyDismissRequest {
  decisionId: string;
  expectedVersionToken: string;
  reason: string;
}
export interface TaxonomyUndoRequest {
  decisionId: string;
  undoOf: string;
  expectedVersionToken: string;
  reason: string;
}
export interface TaxonomyRaiseCaseRequest {
  caseId: string;
  townId: string;
  /** A business id (or a superseded one) or a row-scoped listing id. */
  listingId: string;
  reason: string;
}
export interface TaxonomyDecisionResult {
  replayed: boolean;
  status: TaxonomyCaseStatus;
}
export interface TaxonomyRaiseCaseResult {
  /** True when the id was already used, or the listing already had an open case, and that case was returned. */
  replayed: boolean;
  case: TaxonomyCaseSummary;
}

export type TaxonomyRunScope = 'town' | 'all';
export type TaxonomyRunMode = 'dry_run' | 'apply';
export type TaxonomyRunPhase = 'plan' | 'apply' | 'rollback';
export type TaxonomyRunStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'canceled'
  | 'failed'
  | 'rolling_back'
  | 'rolled_back';
export const TAXONOMY_APPLY_CONFIRMATION = 'APPLY';

export interface TaxonomyTransition {
  from: string;
  to: string;
  count: number;
  samples: { scanId: string; row: string; name: string }[];
}
export interface TaxonomyRunSummary {
  transitions: TaxonomyTransition[];
  unchanged: number;
  unmapped: number;
  excluded: number;
  /** Transitions beyond the cap are counted here rather than listed. */
  truncatedTransitions: number;
}
export interface TaxonomyRunRecord {
  id: string;
  mappingVersion: string;
  scope: TaxonomyRunScope;
  townId: string | null;
  mode: TaxonomyRunMode;
  phase: TaxonomyRunPhase;
  status: TaxonomyRunStatus;
  /** Null once the creating operator's account has been erased. */
  actorId: string | null;
  reason: string;
  expectedPlanHash: string | null;
  planHash: string | null;
  scannedRows: number;
  changedRows: number;
  appliedRows: number;
  restoredRows: number;
  /** Rows the apply phase skipped because they changed after the plan pass; they are reported, never overwritten. */
  driftedRows: number;
  attempts: number;
  cancelRequested: boolean;
  summary: TaxonomyRunSummary;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
export interface TaxonomyRunRequest {
  id: string;
  mappingVersion: string;
  scope: TaxonomyRunScope;
  townId?: string;
  mode: TaxonomyRunMode;
  reason: string;
  /** apply only: the plan hash of the dry run being applied, and the deliberate confirmation. */
  expectedPlanHash?: string;
  confirm?: typeof TAXONOMY_APPLY_CONFIRMATION;
}
export interface TaxonomyRunCancelRequest {
  reason: string;
}
export interface TaxonomyRunRollbackRequest {
  reason: string;
  confirm: 'ROLLBACK';
}

/** Acquisition run ledger (S7e). Runs are written by local stage scripts; operators observe and request. */
export type AcquisitionRunKind =
  | 'overture-stage'
  | 'poc-import'
  | 'census-stage'
  | 'historical';
export type AcquisitionRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'succeeded_empty'
  | 'partial'
  | 'blocked'
  | 'failed_retryable'
  | 'failed_permanent'
  | 'cancel_requested'
  | 'cancelled';
export type AcquisitionJobStatus = Exclude<
  AcquisitionRunStatus,
  'cancel_requested'
>;
export type AcquisitionBlockedReason =
  | 'policy_blocked'
  | 'unconfigured_provider'
  | 'budget_exhausted'
  | 'quota_exhausted'
  | 'invalid_geometry'
  | 'acquisition_unauthorized'
  | 'provider_paused'
  | 'geometry_pending';
export type AcquisitionRunAction = 'cancel' | 'resume' | 'retry';

export interface AcquisitionRunSummary {
  id: string;
  provider: string;
  release: string | null;
  kind: AcquisitionRunKind;
  townIds: string[];
  status: AcquisitionRunStatus;
  blockedReason: AcquisitionBlockedReason | null;
  /** `system` for a script or a historical import; otherwise the operator profile (null once erased). */
  startedBy: 'system' | 'operator';
  startedById: string | null;
  reason: string;
  createdAt: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
  /** True when a `running` run has not heartbeated within the stale window. */
  stale: boolean;
  observed: number;
  accepted: number;
  rejected: number;
  budgetReservedCents: number;
  budgetUsedCents: number;
  lastError: string | null;
  /** `quality_limit` when the run was failed by its quality scorecard (D28); otherwise null. */
  failureReason: 'quality_limit' | null;
  /** The run's quality scorecard, or null for a run that never reached the gate (older runs, errors, cancels). */
  quality: AcquisitionRunQuality | null;
}
/** Per-run quality scorecard (D28). Rates and completeness are shares between 0 and 1. */
export interface AcquisitionRunQuality {
  version: string;
  normalizerVersion: string;
  computedAt: string;
  rows: number;
  completeness: {
    name: number;
    address: number;
    phone: number;
    website: number;
    category: number;
    hours: number;
  };
  invalid: {
    address: number;
    phone: number;
    addressRate: number;
    phoneRate: number;
  };
  outOfBoundary: { count: number; rate: number };
  duplicates: { count: number; rate: number };
  /** The limits applied to this run, by name. */
  limits: Record<string, number>;
  /** The limits the run is past. A run with any breach is failed with reason `quality_limit`. */
  breaches: string[];
  passed: boolean;
}
export interface AcquisitionJobRecord {
  unitKey: string;
  townId: string | null;
  scanId: string | null;
  status: AcquisitionJobStatus;
  blockedReason: AcquisitionBlockedReason | null;
  checkpoint: object | null;
  attempt: number;
  observed: number;
  accepted: number;
  rejected: number;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}
export interface AcquisitionEventRecord {
  id: string;
  action: AcquisitionRunAction | 'import_history' | 'consumed';
  actorId: string | null;
  reason: string;
  unitKey: string | null;
  statusBefore: AcquisitionRunStatus | null;
  statusAfter: AcquisitionRunStatus | null;
  ofEventId: string | null;
  createdAt: string;
}
export interface AcquisitionRunDetail extends AcquisitionRunSummary {
  jobs: AcquisitionJobRecord[];
  events: AcquisitionEventRecord[];
  /** Jobs finished (any terminal status) over jobs total. */
  completeness: { done: number; total: number };
  /** Opaque token an operator action must echo; a changed run makes it stale (409). */
  versionToken: string;
  /** Present while a resume/retry request is pending for the local stage to consume. */
  pendingRequest: boolean;
  resumeCommand: string | null;
}
export interface AcquisitionRunList {
  runs: AcquisitionRunSummary[];
  total: number;
}
export interface AcquisitionBudgetPanel {
  period: string;
  ceilingCents: number;
  reservedCents: number;
  /**
   * Geoapify is metered in credits on its own daily ledger (owner decision D30: free plan, 3,000 credits per UTC day),
   * so it never counts against `reservedCents`.
   */
  geoapifyCreditsToday?: number;
  geoapifyDailyCreditLimit?: number;
  usedCents: number;
  remainingCents: number;
  anonymousAttempts: number;
  /** True once reserved spend reaches the ceiling: no further provider reservation succeeds this period. */
  hardStop: boolean;
  /** Real acquisition is not authorised; no worker acquires automatically. */
  acquisitionAuthorized: boolean;
  /** Per-provider authorisation: acquisition providers, and private-enrichment-only providers (never public). */
  providers?: Array<{
    provider: string;
    acquisition: boolean;
    privateEnrichment: boolean;
    publicDisplayAndExport: boolean;
    scope: 'acquisition' | 'private-enrichment-only';
  }>;
  /** Last recorded state of providers that report one (Geoapify: not_configured, ok, paused, ...). */
  providerStatus?: Array<{
    provider: string;
    status: string;
    detail: string;
    checkedAt: string;
  }>;
}
export interface AcquisitionRunActionRequest {
  decisionId: string;
  reason: string;
  expectedVersionToken: string;
  /** retry only: the single job to re-queue. */
  unitKey?: string;
  /** cancel/resume/retry carry a deliberate confirmation. */
  confirm: 'CANCEL' | 'RESUME' | 'RETRY';
}
export interface AcquisitionRunActionResult {
  replayed: boolean;
  run: AcquisitionRunDetail;
  /** resume/retry: the command the operator runs locally; the stage consumes the pending request. */
  resumeCommand: string | null;
}
export interface AcquisitionImportHistoryRequest {
  decisionId: string;
  reason: string;
}
export interface AcquisitionImportHistoryResult {
  replayed: boolean;
  created: number;
  existing: number;
}

/** Lifecycle of an operator export job. */
export type DirectoryExportStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'failed'
  | 'expired'
  | 'withdrawn'
  | 'revoked';

export const DIRECTORY_EXPORT_STATUSES: readonly DirectoryExportStatus[] = [
  'queued',
  'running',
  'complete',
  'failed',
  'expired',
  'withdrawn',
  'revoked',
];

/** An export job as the Gateway returns it. It never carries a file path. */
export interface DirectoryExportJob {
  id: string;
  actorId: string;
  releaseId: string;
  scope: { communityId?: string };
  format: 'jsonl';
  status: DirectoryExportStatus;
  attempts: number;
  errorCode: string | null;
  rowCount: number | null;
  excludedRows: number | null;
  byteCount: number | null;
  sha256: string | null;
  schemaVersion: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  withdrawnAt: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The request body of POST /directory/exports. */
export interface DirectoryExportRequest {
  id: string;
  releaseId: string;
  communityId?: string;
}

/** Workers and provider paths an operator can pause. The withdrawal worker is deliberately not pausable. */
export type DirectoryOperatingControlKey =
  | 'provider_acquisition'
  | 'export_worker'
  | 'taxonomy_worker';

export const DIRECTORY_OPERATING_CONTROL_KEYS: readonly DirectoryOperatingControlKey[] =
  ['provider_acquisition', 'export_worker', 'taxonomy_worker'];

/** One operating control. An absent row reads as running with version 0. */
export interface DirectoryOperatingControl {
  key: DirectoryOperatingControlKey;
  paused: boolean;
  reason: string | null;
  /** 0 when nothing was ever set; otherwise increments on every change. */
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** The request body of POST /directory/ops/controls/:key. */
export interface DirectoryOperatingControlUpdate {
  paused: boolean;
  /** Required (non-empty, at most 500 characters) when pausing. */
  reason?: string | null;
  expectedVersion: number;
}

export interface DirectoryOpsQueueMetrics {
  queued: number;
  running: number;
  failedLast24h: number;
  oldestQueuedSeconds: number | null;
}

/**
 * Restricted operator metrics. Each section is collected independently; a section that failed is null and its name
 * is listed in `errors`. See apps/directory/src/ops-metrics.ts for the exact definition of each number.
 */
export interface DirectoryOpsMetrics {
  generatedAt: string;
  infrastructure: {
    database: 'ok';
    postgis: boolean;
    migrationsApplied: number;
    latestMigration: string | null;
    exportStorage: 'configured' | 'unconfigured';
  } | null;
  towns: {
    total: number;
    onboarded: number;
    byStatus: Record<string, number>;
  } | null;
  coverage: { townsWithListings: number; publishedListings: number } | null;
  freshness: {
    refreshDueListings: number;
    staleListings: number;
    /** Live listings with no freshness evidence: neither fresh nor stale. */
    unknownFreshnessListings: number;
    oldestListingAgeDays: number | null;
  } | null;
  policy: {
    activePolicies: number;
    revokedPolicies: number;
    publicationPaused: boolean;
    openRightsCases: number;
    openTaxonomyCases: number;
    /** Listing reports not acknowledged or triaged within 3 days (owner decision D17). */
    reportsUntriagedOver3Days: number;
  } | null;
  spend: {
    period: string;
    reservedCents: number;
    limitCents: number;
    /** Geoapify credits used today (UTC) against the daily limit (D30). */
    geoapifyCreditsToday?: number;
    geoapifyDailyCreditLimit?: number;
    alertCents: number;
    alert: boolean;
    exhausted: boolean;
  } | null;
  queues: Record<
    'export' | 'taxonomy' | 'withdrawal',
    DirectoryOpsQueueMetrics
  > | null;
  /**
   * D15 fill-time target: an eligible town reaches a terminal acquisition state (filled, zero, blocked or failed)
   * within `targetDays` of registration or of its boundary changing.
   */
  fillTime?: {
    targetDays: number;
    /** Eligible towns with no terminal state yet whose wait already exceeds the target. */
    waitingOverTarget: number;
    /** Eligible towns that reached a terminal state, but after more than the target. */
    resolvedLate: number;
    /** waitingOverTarget + resolvedLate. */
    overTargetTowns: number;
    /** Eligible towns whose clock is still running. */
    waiting: number;
    /** True while a town is still waiting past the target. */
    alert: boolean;
  } | null;
  /** D28: acquisition runs failed on the quality scorecard (`quality_limit`). */
  runQuality?: {
    failedTotal: number;
    failedLast24h: number;
  } | null;
  /** D29: the active Overture release and the state of candidate releases. */
  overtureReleases?: {
    active: string;
    counts: Record<string, number>;
    held: { release: string; reason: string | null } | null;
  } | null;
  controls: DirectoryOperatingControl[] | null;
  errors: string[];
}

/** D29: one canary run of a candidate Overture release. */
export interface OvertureReleaseCanary {
  townId: string;
  townName: string;
  runId: string | null;
  status: string | null;
  outcome: 'ok' | 'pending' | 'failed';
  /** `quality_limit` when the run failed the quality scorecard. */
  reason: string | null;
}

/** D29: a candidate Overture release and how far it got. */
export interface OvertureReleaseCandidateSummary {
  release: string;
  status: 'detected' | 'canary_running' | 'held' | 'rejected' | 'promoted';
  rightsStatus: 'approved' | 'mismatch';
  holdReason: string | null;
  lastError: string | null;
  canary: OvertureReleaseCanary[];
  canaryTownCount: number;
  detectedAt: string;
  updatedAt: string;
  decidedAt: string | null;
}

export interface OvertureReleasePanel {
  active: { release: string; source: 'pinned' | 'promoted' };
  candidates: OvertureReleaseCandidateSummary[];
}

export interface OvertureReleaseDecisionRequest {
  decisionId: string;
  reason: string;
}
