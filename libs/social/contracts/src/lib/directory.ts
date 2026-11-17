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
