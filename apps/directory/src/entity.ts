import {
  Column,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  Check,
  Index,
} from 'typeorm';

// Identifies the installation; business and locality records arrive in later slices.
@Entity({ name: 'directory_installation' })
export class DirectoryInstallation {
  @PrimaryColumn({ type: 'varchar', length: 64 }) id!: string;
  @Column({ type: 'uuid', nullable: true }) recoveryEpoch!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

// Community IDs are owned by Social; names and slugs are descriptive, never identity.
@Entity({ name: 'directory_town' })
export class DirectoryTown {
  @PrimaryColumn('uuid') communityId!: string;
  @Column({ type: 'varchar' }) name!: string;
  @Column({ type: 'varchar', nullable: true }) slug!: string | null;
  @Column({ type: 'varchar', nullable: true }) administrativeArea!:
    | string
    | null;
  @Column({ type: 'boolean' }) eligible!: boolean;
  @Column({ type: 'varchar', default: 'pending' }) geometryStatus!: string;
  @Column({ type: 'integer', default: 0 }) geometryVersion!: number;
  /**
   * Set when the owner merged this town into another (decision D19-D25). The town is ineligible and keeps no
   * boundary of its own; the pointer survives Social reconciliation until Social reports the town eligible again.
   */
  @Column({ type: 'uuid', nullable: true }) mergedIntoCommunityId!:
    | string
    | null;
  /** When Directory first registered the town; selection sweeps take the newest first. */
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  registeredAt!: Date;
}

@Entity({ name: 'directory_town_geometry' })
export class DirectoryTownGeometry {
  @PrimaryColumn('uuid') communityId!: string;
  @PrimaryColumn('integer') version!: number;
  @Column({ type: 'geometry', spatialFeatureType: 'Geometry', srid: 4326 })
  boundary!: object;
  @Column({ type: 'varchar' }) source!: string;
  @Column({ type: 'varchar' }) vintage!: string;
  @Column({ type: 'varchar' }) rights!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

// Private, unreviewed candidate. It is never a public geometry or an approval.
@Entity({ name: 'directory_boundary_candidate' })
export class DirectoryBoundaryCandidate {
  @PrimaryColumn('uuid') communityId!: string;
  @Column('uuid') sourceEpoch!: string;
  @Column('uuid') activationId!: string;
  @Column('bigint') socialGeneration!: string;
  @Column('uuid') changeToken!: string;
  @Column({ type: 'varchar', length: 10 }) geoid!: string;
  @Column({ type: 'varchar', length: 6 }) layer!: string;
  @Column({ type: 'varchar', length: 4 }) vintage!: string;
  @Column({ type: 'varchar', length: 2 }) stateFips!: string;
  @Column({ type: 'varchar', length: 64 }) archiveSha256!: string;
  @Column({ type: 'varchar', length: 64, default: '' }) geographyHash!: string;
}

// Append-only reviewer evidence; this record does not authorize public serving.
@Entity({ name: 'directory_boundary_decision' })
export class DirectoryBoundaryDecision {
  @PrimaryColumn('uuid') requestId!: string;
  @Column('uuid') communityId!: string;
  @Column({ type: 'uuid', nullable: true }) reviewerId!: string | null;
  @Column({ type: 'varchar', length: 16 }) decision!: string;
  @Column({ type: 'varchar', length: 2048, nullable: true }) sourceUrl!:
    | string
    | null;
  @Column('uuid') sourceEpoch!: string;
  @Column('uuid') activationId!: string;
  @Column('bigint') socialGeneration!: string;
  @Column('uuid') recoveryEpoch!: string;
  @Column('bigint') directoryGeneration!: string;
  @Column('uuid') changeToken!: string;
  @Column({ type: 'varchar', length: 10 }) geoid!: string;
  @Column({ type: 'varchar', length: 6 }) layer!: string;
  @Column({ type: 'varchar', length: 4 }) vintage!: string;
  @Column({ type: 'varchar', length: 2 }) stateFips!: string;
  @Column({ type: 'varchar', length: 64 }) archiveSha256!: string;
  @Column({ type: 'varchar', length: 64 }) geographyHash!: string;
  /** True for a system decision made by the geometry sweep; reviewerId is then null. */
  @Column({ type: 'boolean', default: false }) automatic!: boolean;
  @Column({ type: 'varchar', length: 120, nullable: true }) reason!:
    | string
    | null;
  @Column({ type: 'timestamptz', nullable: true }) invalidatedAt!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/**
 * Outcome of the automatic Census TIGER geometry sweep for one town: what it did, or why the town stays pending
 * for a human (ambiguous or missing match). It is evidence for the review queue, never authority to serve.
 */
@Entity({ name: 'directory_boundary_auto_attempt' })
@Check(
  'CHK_directory_boundary_auto_status',
  "status IN ('installed','ambiguous','unmatched','unsupported','undone','error')"
)
export class DirectoryBoundaryAutoAttempt {
  @PrimaryColumn('uuid') communityId!: string;
  @Column({ type: 'varchar', length: 16 }) status!: string;
  @Column({ type: 'varchar', length: 120 }) reason!: string;
  @Column({ type: 'uuid', nullable: true }) changeToken!: string | null;
  @Column({ type: 'uuid', nullable: true }) requestId!: string | null;
  @Column({ type: 'jsonb', default: () => `'[]'` }) candidates!: unknown;
  @Column({ type: 'integer', default: 1 }) attempts!: number;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  attemptedAt!: Date;
}

/**
 * Owner lock on a town's boundary: the town is bound to one researched Census geometry that the geometry sweep, the
 * register re-reconcile and every other automatic path leave alone (they neither replace it nor reset the town to
 * pending). Only a reviewer decision through the boundary review routes may change the installed geometry. The row
 * keeps the provenance of the locked install: the Census entity, the archive digest, the geometry hash and a hash of
 * the whole evidence record.
 */
@Entity({ name: 'directory_boundary_lock' })
export class DirectoryBoundaryLock {
  @PrimaryColumn('uuid') communityId!: string;
  @Column('integer') version!: number;
  @Column({ type: 'varchar', length: 10 }) geoid!: string;
  @Column({ type: 'varchar', length: 6 }) layer!: string;
  @Column({ type: 'varchar', length: 4 }) vintage!: string;
  @Column({ type: 'varchar', length: 2 }) stateFips!: string;
  @Column({ type: 'varchar', length: 64 }) archiveSha256!: string;
  @Column({ type: 'varchar', length: 64 }) geometryHash!: string;
  @Column({ type: 'varchar', length: 64 }) evidenceHash!: string;
  @Column({ type: 'varchar', length: 2048 }) sourceUrl!: string;
  @Column({ type: 'jsonb' }) evidence!: unknown;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lockedAt!: Date;
}

// Active private binding only; historical geometry and decision rows remain audit evidence.
@Entity({ name: 'directory_reviewed_geometry' })
export class DirectoryReviewedGeometry {
  @PrimaryColumn('uuid') communityId!: string;
  @Column('uuid') requestId!: string;
  @Column('integer') version!: number;
  @Column('uuid') changeToken!: string;
  @Column({ type: 'varchar', length: 64 }) geographyHash!: string;
  @Column({ type: 'varchar', length: 64 }) geometryHash!: string;
  @Column('uuid') recoveryEpoch!: string;
  @Column('bigint') directoryGeneration!: string;
}

// Conservative reservations are retained even when an attempt's billing result is unknown.
@Entity({ name: 'directory_provider_budget_attempt' })
@Check(
  'CHK_directory_provider_budget_cost',
  '"reservedCents" BETWEEN 1 AND 2500'
)
@Check(
  'CHK_directory_provider_budget_period',
  "period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'"
)
@Index('IDX_directory_provider_budget_period', ['period'])
export class DirectoryProviderBudgetAttempt {
  @PrimaryColumn('uuid') attemptId!: string;
  @Column({ type: 'varchar', length: 7 }) period!: string;
  @Column({ type: 'varchar', length: 64 }) provider!: string;
  @Column({ type: 'varchar', length: 64 }) operation!: string;
  @Column('integer') reservedCents!: number;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/**
 * Daily credit ledger for credit-metered providers (Geoapify, free plan: 3,000 credits per UTC day, owner decision
 * D30). One row per request, counted before the request is made, so a failed or timed-out call still counts.
 */
@Entity({ name: 'directory_provider_credit_attempt' })
@Check('CHK_directory_provider_credit_credits', '"credits" BETWEEN 1 AND 3000')
@Index('IDX_directory_provider_credit_day', ['provider', 'day'])
export class DirectoryProviderCreditAttempt {
  @PrimaryColumn('uuid') attemptId!: string;
  /** UTC calendar day the credits count against. */
  @Column({ type: 'date' }) day!: string;
  @Column({ type: 'varchar', length: 64 }) provider!: string;
  @Column({ type: 'varchar', length: 64 }) operation!: string;
  @Column('integer') credits!: number;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/**
 * A newer Overture release the worker found (owner decision D29). It is recorded with its rights check, run on a few
 * canary towns and promoted (becomes the pinned release the refresh rule acquires) only when every canary succeeded.
 * A promoted row is the active release; the newest promoted row wins. Held and rejected rows stay as the record.
 */
@Entity({ name: 'directory_overture_release_candidate' })
@Check(
  'CHK_directory_overture_release_status',
  "\"status\" IN ('detected','canary_running','held','rejected','promoted')"
)
@Check(
  'CHK_directory_overture_release_rights',
  "\"rightsStatus\" IN ('approved','mismatch')"
)
@Index('IDX_directory_overture_release_status', ['status', 'detectedAt'])
export class DirectoryOvertureReleaseCandidate {
  @PrimaryColumn({ type: 'varchar', length: 64 }) release!: string;
  @Column({ type: 'varchar', length: 16, default: 'detected' }) status!: string;
  @Column({ type: 'varchar', length: 16 }) rightsStatus!: string;
  /** What the licence check compared: the licence the release declares and the ones the pinned policy approves. */
  @Column({ type: 'jsonb' }) rightsDetail!: Record<string, unknown>;
  /** The pinned policy re-labelled for this release; only present when the licence check matched. */
  @Column({ type: 'jsonb', nullable: true }) rightsPolicy!: unknown | null;
  @Column({ type: 'jsonb', nullable: true }) inventory!: unknown | null;
  @Column({ type: 'jsonb', default: () => "'[]'" }) canaryTownIds!: string[];
  /** Canary runs created before this instant belong to an earlier attempt (an operator retry resets it). */
  @Column({ type: 'timestamptz', nullable: true })
  canaryStartedAt!: Date | null;
  @Column({ type: 'jsonb', default: () => "'[]'" }) canaryResults!: unknown[];
  @Column({ type: 'varchar', length: 64, nullable: true }) holdReason!:
    | string
    | null;
  @Column({ type: 'varchar', length: 1024, nullable: true }) lastError!:
    | string
    | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  detectedAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) decidedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) decidedBy!: string | null;
  @Column({ type: 'uuid', nullable: true }) decisionId!: string | null;
  @Column({ type: 'varchar', length: 1024, nullable: true })
  decisionReason!: string | null;
}

/** Replay fence for anonymous, non-billed Overture S3 reads in local evaluation. */
@Entity({ name: 'directory_anonymous_overture_attempt' })
@Check(
  'CHK_directory_anonymous_overture_method',
  "\"method\" IN ('GET', 'HEAD')"
)
@Check(
  'CHK_directory_anonymous_overture_period',
  '"period" ~ \'^[0-9]{4}-(0[1-9]|1[0-2])$\''
)
export class DirectoryAnonymousOvertureAttempt {
  @PrimaryColumn('uuid') attemptId!: string;
  @Column({ type: 'varchar', length: 7 }) period!: string;
  @Column({ type: 'varchar', length: 64 }) policyId!: string;
  @Column({ type: 'varchar', length: 64 }) assetSha256!: string;
  @Column({ type: 'varchar', length: 4 }) method!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

@Entity({ name: 'directory_receipt_slot' })
export class DirectoryReceiptSlot {
  @PrimaryColumn('integer') id!: number;
}

// Receipts are identities, never a high-water mark: sequence allocation is not commit order.
@Entity({ name: 'directory_reconciliation_receipt' })
export class DirectoryReconciliationReceipt {
  @PrimaryColumn({ type: 'bigint' }) eventId!: string;
  @Column('uuid') communityId!: string;
  @Column({ type: 'uuid', nullable: true }) eventNonce!: string | null;
  @Column({ type: 'uuid', nullable: true }) sourceEpoch!: string | null;
  @Column({ type: 'uuid', nullable: true }) recoveryEpoch!: string | null;
  @OneToOne(() => DirectoryReceiptSlot, { nullable: false })
  @JoinColumn({ name: 'slotId' })
  slot!: DirectoryReceiptSlot;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  appliedAt!: Date;
}

/**
 * Write-only register bookkeeping: reconciliation stamps a registered town 'blocked' and removes the row when the
 * town leaves the register. No runtime code reads it, so 'blocked' gates nothing; acquisition is driven by
 * directory_acquisition_run and the town scan targets. Kept because the lifecycle dispositions and restore fence
 * still enumerate the table; drop it (entity, writers, those two lists) in one migration if it is ever retired.
 */
@Entity({ name: 'directory_provider_work' })
export class DirectoryProviderWork {
  @PrimaryColumn('uuid') communityId!: string;
  @Column({ type: 'varchar' }) status!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/** Restartable traversal of Social's census and the directory's existing towns. */
@Entity({ name: 'directory_census_progress' })
export class DirectoryCensusProgress {
  @PrimaryColumn({ type: 'varchar', length: 32 }) id!: string;
  @Column({ type: 'varchar', length: 16 }) phase!: string;
  @Column({ type: 'varchar', length: 32, default: 'legacy' }) protocol!: string;
  @Column({ type: 'jsonb', nullable: true }) registerRequest!: object | null;
  @Column({ type: 'uuid', nullable: true }) cursor!: string | null;
  @Column({ type: 'uuid', nullable: true }) sourceEpoch!: string | null;
  @Column({ type: 'uuid', nullable: true }) recoveryEpoch!: string | null;
  @Column({ type: 'uuid', nullable: true }) owner!: string | null;
  @Column({ type: 'uuid', nullable: true }) activationId!: string | null;
  @Column({ type: 'bigint', nullable: true }) socialGeneration!: string | null;
  @Column({ type: 'bigint', nullable: true }) directoryGeneration!:
    | string
    | null;
  @Column({ type: 'jsonb', nullable: true }) enabledPayload!: object | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/** Private pilot data; these tables are not exposed through public routes. */
@Entity({ name: 'directory_overture_private_checkpoint' })
export class DirectoryOverturePrivateCheckpoint {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @Column('bigint') sourceFileRowNumber!: string;
}

@Entity({ name: 'directory_overture_private_row' })
@Index('IDX_directory_overture_private_row_region', ['regionId'])
export class DirectoryOverturePrivateRow {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @PrimaryColumn('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'varchar', nullable: true }) regionId!: string | null;
  @Column({ type: 'jsonb', nullable: true }) listing!: object | null;
}

/** Durable denial record for a withdrawn private scan. */
@Entity({ name: 'directory_overture_private_revocation' })
export class DirectoryOverturePrivateRevocation {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
}

/** Per-scan serialization row, retained even after withdrawal. */
@Entity({ name: 'directory_overture_private_scan_lock' })
export class DirectoryOverturePrivateScanLock {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
}

/** Durable denial for an individual source row. */
@Entity({ name: 'directory_overture_private_row_revocation' })
export class DirectoryOverturePrivateRowRevocation {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @PrimaryColumn('bigint') sourceFileRowNumber!: string;
}

/**
 * A town's rows from one scan taken out of service (for example rows that carry no source provenance). The row is
 * the audit record: who, why, when and how many rows were revoked. Acquisition does not count a retired
 * (town, scan) as acquired, so the automatic sweeps fetch the town again.
 */
@Entity({ name: 'directory_town_scan_retirement' })
export class DirectoryTownScanRetirement {
  @PrimaryColumn('uuid') communityId!: string;
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @Column({ type: 'text' }) reason!: string;
  @Column({ type: 'varchar', length: 64 }) actor!: string;
  @Column({ type: 'int' }) rowsRevoked!: number;
  @Column({ type: 'timestamptz', default: () => 'now()' }) retiredAt!: Date;
}

/** Completed scans remain private and can still be withdrawn. */
@Entity({ name: 'directory_overture_private_completion' })
export class DirectoryOverturePrivateCompletion {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
}

/**
 * Which towns a scan was aimed at, so Directory can tell "scanned and empty" from "never scanned".
 * `recorded` rows are written when a scan begins; `backfill-rows` rows are inferred from a completed scan's rows
 * and carry a NULL completedAt. A scan is complete when its completion row exists, never by this table's completedAt.
 */
@Entity({ name: 'directory_town_scan_target' })
@Index('IDX_directory_town_scan_target_scan', ['scanId'])
@Check(
  'CHK_directory_town_scan_target_provenance',
  `"provenance" IN ('recorded','backfill-rows')`
)
export class DirectoryTownScanTarget {
  @PrimaryColumn('uuid') communityId!: string;
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @Column({ type: 'timestamptz', default: () => 'now()' }) targetedAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) completedAt!: Date | null;
  @Column({ type: 'int', nullable: true }) rowCount!: number | null;
  @Column({ type: 'varchar', length: 24 }) provenance!: string;
  /**
   * The town's geometry version when the scan began (recorded targets only). A newer town geometry than this means
   * the boundary changed after the scan, so the town is refilled. NULL for backfilled scans: unknown, never a trigger.
   */
  @Column({ type: 'int', nullable: true }) geometryVersion!: number | null;
}

/**
 * An operator's "run this town now" request (D15 follow-up). Pending while `consumedAt` is NULL; at most one pending
 * request per (town, provider). The next acquisition sweep puts the town first (it still passes authorization, the
 * kill switch and the budget ledger), and begins its run, which marks the request consumed. The row is the audit:
 * who asked, why and when. `id` is the client's decision id, so a replay finds its own row.
 */
@Entity({ name: 'directory_acquisition_town_request' })
@Index(
  'UQ_directory_acquisition_town_request_pending',
  ['communityId', 'provider'],
  {
    unique: true,
    where: '"consumedAt" IS NULL',
  }
)
@Check(
  'CHK_directory_acquisition_town_request_provider',
  `"provider" IN ('overture','alltheplaces')`
)
export class DirectoryAcquisitionTownRequest {
  @PrimaryColumn('uuid') id!: string;
  @PrimaryColumn({ type: 'varchar', length: 16 }) provider!: string;
  @Column('uuid') communityId!: string;
  /** Operator profile; NULL once the profile's account was erased. */
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 1024 }) reason!: string;
  @Column({ type: 'timestamptz', default: () => 'now()' }) requestedAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) consumedAt!: Date | null;
  /** The run that satisfied the request. */
  @Column({ type: 'uuid', nullable: true }) runId!: string | null;
}

/**
 * Immutable upstream provenance for one scan. Written only by the private sink in
 * the completion transaction (or by the attach script); never updated.
 * The only age clock is upstreamLastModified; recordedAt is the trusted DB clock.
 */
@Entity({ name: 'directory_overture_source_evidence' })
@Check(
  'CHK_directory_source_evidence_kind',
  `"kind" IN ('captured','attached_verified')`
)
@Check(
  'CHK_directory_source_evidence_release',
  `"releaseId" ~ '^\\d{4}-\\d{2}-\\d{2}\\.\\d+$'`
)
@Check(
  'CHK_directory_source_evidence_modified',
  `"upstreamLastModified" IS NULL OR "upstreamLastModified" <= "recordedAt"`
)
@Check(
  'CHK_directory_source_evidence_observed',
  `"observedAt" IS NULL OR "observedAt" <= "recordedAt" + interval '5 minutes'`
)
@Check(
  'CHK_directory_source_evidence_attached',
  `"kind" = 'captured' OR "observedAt" IS NULL`
)
export class DirectoryOvertureSourceEvidence {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @Column({ type: 'int' }) evidenceVersion!: number;
  @Column({ type: 'varchar', length: 24 }) kind!: string;
  @Column({ type: 'varchar', length: 32 }) releaseId!: string;
  @Column({ type: 'text' }) artifactUrl!: string;
  @Column({ type: 'varchar', length: 100 }) artifactEtag!: string;
  @Column({ type: 'bigint', nullable: true }) artifactBytes!: string | null;
  @Column({ type: 'timestamptz', nullable: true })
  upstreamLastModified!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) observedAt!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) recordedAt!: Date;
  @Column({ type: 'varchar', length: 160 }) recorder!: string;
  @Column({ type: 'varchar', length: 64 }) inventorySha256!: string;
  @Column({ type: 'varchar', length: 64 }) evidenceSha256!: string;
}

/** Durable policy serialization and revocation state. */
@Entity({ name: 'directory_overture_private_policy' })
export class DirectoryOverturePrivatePolicy {
  @PrimaryColumn({ type: 'varchar', length: 64 }) policyId!: string;
  @Column({ type: 'boolean', default: false }) revoked!: boolean;
}

/** Immutable scan-to-policy membership, including empty scans. */
@Entity({ name: 'directory_overture_private_membership' })
export class DirectoryOverturePrivateMembership {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @Column({ type: 'varchar', length: 64 }) policyId!: string;
}

/** Stable directory identity for an exact imported record within one town. */
@Entity({ name: 'directory_listing_identity' })
@Index(
  'UQ_directory_listing_identity_source',
  ['communityId', 'scanId', 'sourceFileRowNumber'],
  { unique: true }
)
export class DirectoryListingIdentity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('uuid') communityId!: string;
  @Column({ type: 'varchar', length: 64 }) scanId!: string;
  @Column('bigint') sourceFileRowNumber!: string;
}

/** Private address-review candidate. It is never exposed through public routes. */
@Entity({ name: 'directory_address_review_candidate' })
@Index(
  'UQ_directory_address_review_candidate_source',
  ['scanId', 'sourceFileRowNumber'],
  { unique: true }
)
@Index('IDX_directory_address_review_candidate_status', ['status'])
export class DirectoryAddressReviewCandidate {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') communityId!: string;
  @Column({ type: 'varchar', length: 64 }) scanId!: string;
  @Column('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'varchar', length: 2000 }) name!: string;
  @Column({ type: 'varchar', length: 2000 }) category!: string;
  @Column({ type: 'jsonb' }) point!: object;
  @Column({ type: 'jsonb' }) addresses!: object;
  @Column({ type: 'jsonb' }) websites!: object;
  @Column({ type: 'jsonb' }) phones!: object;
  @Column({ type: 'varchar', length: 16 }) rights!: string;
  @Column({ type: 'jsonb' }) risk!: object;
  @Column({ type: 'jsonb', nullable: true }) geocode!: object | null;
  @Column({ type: 'jsonb', nullable: true }) officialEvidence!: object | null;
  @Column({ type: 'varchar', length: 16 }) verdict!: string;
  @Column({ type: 'jsonb' }) reasons!: object;
  @Column({ type: 'jsonb' }) checks!: object;
  @Column({ type: 'varchar', length: 64 }) policyVersion!: string;
  @Column({ type: 'varchar', length: 16, default: 'needs_human' })
  status!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/** Append-only address-review decision, including automated decisions. */
@Entity({ name: 'directory_address_review_decision' })
@Index('IDX_directory_address_review_decision_candidate', ['candidateId'])
@Index('UQ_directory_address_review_decision_undo', ['undoOf'], {
  unique: true,
  where: '"undoOf" IS NOT NULL',
})
export class DirectoryAddressReviewDecision {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') candidateId!: string;
  @Column({ type: 'varchar', length: 16 }) actorKind!: string;
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 16 }) decision!: string;
  @Column({ type: 'text', nullable: true }) evidenceUrl!: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) evidenceHash!:
    | string
    | null;
  @Column({ type: 'varchar', length: 2048, nullable: true }) reason!:
    | string
    | null;
  @Column({ type: 'jsonb' }) checks!: object;
  @Column({ type: 'varchar', length: 64 }) policyVersion!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) appliedAt!: Date | null;
  /** A reviewer undo names the human decision it reverses; at most one undo exists per decision. */
  @Column({ type: 'uuid', nullable: true }) undoOf!: string | null;
}

/** A page owner requests a match; approval is a separate reviewer decision. */
@Entity({ name: 'directory_business_link_request' })
@Index('IDX_directory_business_link_listing', ['listingId'])
@Index('IDX_directory_business_link_request_business', ['businessId'])
export class DirectoryBusinessLinkRequest {
  @PrimaryColumn('uuid') requestId!: string;
  @Column('uuid') townId!: string;
  @Column('uuid') listingId!: string;
  @Column('uuid') businessCommunityId!: string;
  @Column({ type: 'uuid', nullable: true }) ownerId!: string | null;
  /** Canonical business of the listing when the request was made or carried; null for a row-scoped listing. */
  @Column({ type: 'uuid', nullable: true }) businessId!: string | null;
  @Column({ type: 'varchar', length: 16 }) status!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/** At most one approved business page is attached to a listing at a time. */
@Entity({ name: 'directory_business_link_active' })
@Index('UQ_directory_business_link_active_request', ['requestId'], {
  unique: true,
})
export class DirectoryBusinessLinkActive {
  @PrimaryColumn('uuid') listingId!: string;
  @Column('uuid') requestId!: string;
}

/** Append-only record of owner and reviewer actions. */
@Entity({ name: 'directory_business_link_event' })
@Index('IDX_directory_business_link_event_request', ['requestId'])
export class DirectoryBusinessLinkEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('uuid') requestId!: string;
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) actorDomain!:
    | string
    | null;
  @Column({ type: 'varchar', length: 16 }) action!: string;
  @Column({ type: 'text', nullable: true }) evidenceUrl!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/**
 * Durable source binding for one publication of reviewed fields. It holds
 * hashes and identifiers only, never a copy of stage content, and no account,
 * profile or reviewer identifier (human actions are reached through decisionId).
 */
@Entity({ name: 'directory_reviewed_binding' })
@Index(
  'UQ_directory_reviewed_binding_live_row',
  ['scanId', 'sourceFileRowNumber'],
  { unique: true, where: `"state" <> 'retired'` }
)
@Index('IDX_directory_reviewed_binding_stage_row', [
  'stageScanId',
  'stageSourceFileRowNumber',
])
@Index('IDX_directory_reviewed_binding_stage_policy', ['stagePolicyId'])
@Index('IDX_directory_reviewed_binding_sweep', ['state', 'verifiedUntil'])
@Check(
  'CHK_directory_reviewed_binding_provenance',
  `"provenance" IN ('contact_stage','source_file','unknown_legacy')`
)
@Check(
  'CHK_directory_reviewed_binding_state',
  `"state" IN ('pending','active','suspended','retired')`
)
@Check(
  'CHK_directory_reviewed_binding_contact_stage',
  `"provenance" <> 'contact_stage' OR ("stageScanId" IS NOT NULL AND "stagePolicyId" IS NOT NULL AND "stageContentHash" IS NOT NULL AND "reviewedHash" IS NOT NULL AND "decisionId" IS NOT NULL)`
)
@Check(
  'CHK_directory_reviewed_binding_source_file',
  `"provenance" <> 'source_file' OR ("stageContentHash" IS NOT NULL AND "reviewedHash" IS NOT NULL AND "decisionId" IS NOT NULL)`
)
@Check(
  'CHK_directory_reviewed_binding_legacy_hidden',
  `"provenance" <> 'unknown_legacy' OR "state" IN ('suspended','retired')`
)
@Check(
  'CHK_directory_reviewed_binding_active_lease',
  `"state" <> 'active' OR "verifiedUntil" IS NOT NULL`
)
export class DirectoryReviewedBinding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('uuid') candidateId!: string;
  @Column({ type: 'uuid', nullable: true }) decisionId!: string | null;
  @Column('uuid') communityId!: string;
  @Column({ type: 'varchar', length: 64 }) scanId!: string;
  @Column('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) livePolicyId!:
    | string
    | null;
  @Column({ type: 'varchar', length: 24 }) provenance!: string;
  @Column({ type: 'varchar', length: 64, nullable: true })
  stageInstallationId!: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) stageScanId!:
    | string
    | null;
  @Column({ type: 'bigint', nullable: true }) stageSourceFileRowNumber!:
    | string
    | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) stagePolicyId!:
    | string
    | null;
  @Column({ type: 'varchar', length: 64, nullable: true })
  displayPolicyReleaseId!: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) displayPolicyHash!:
    | string
    | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) stageContentHash!:
    | string
    | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) reviewedHash!:
    | string
    | null;
  @Column({ type: 'jsonb', nullable: true }) fieldHashes!: object | null;
  @Column({ type: 'uuid', nullable: true }) assignmentChangeToken!:
    | string
    | null;
  @Column({ type: 'varchar', length: 16 }) state!: string;
  @Column({ type: 'varchar', length: 40, nullable: true }) stateCause!:
    | string
    | null;
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) verifiedUntil!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) suspendedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) retiredAt!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/** Append-only binding transitions; the unique key makes each transition idempotent. */
@Entity({ name: 'directory_reviewed_binding_event' })
@Index(
  'UQ_directory_reviewed_binding_event_transition',
  ['bindingId', 'kind', 'cause'],
  { unique: true }
)
@Check(
  'CHK_directory_reviewed_binding_event_kind',
  `"kind" IN ('published','confirmed','suspended','reconfirmed','retired')`
)
export class DirectoryReviewedBindingEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('uuid') bindingId!: string;
  @Column({ type: 'varchar', length: 16 }) kind!: string;
  @Column({ type: 'varchar', length: 40 }) cause!: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) observedStageHash!:
    | string
    | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) runId!:
    | string
    | null;
  @Column({ type: 'uuid', nullable: true }) decisionId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/**
 * Candidate index of reviewed listings that have a map point. It authorises
 * nothing: every read re-joins the live binding, row, policy and revocation
 * tables, so a stale or extra row can never disclose anything. It holds source
 * keys, a content digest and a public business point; no account, profile or
 * reviewer identifier.
 */
@Entity({ name: 'directory_reviewed_spatial' })
@Index('UQ_directory_reviewed_spatial_binding', ['bindingId'], { unique: true })
@Index('IDX_directory_reviewed_spatial_town_keyset', [
  'communityId',
  'scanId',
  'sourceFileRowNumber',
])
export class DirectoryReviewedSpatial {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @PrimaryColumn('bigint') sourceFileRowNumber!: string;
  @Column('uuid') bindingId!: string;
  @Column('uuid') communityId!: string;
  @Index('IDX_directory_reviewed_spatial_point', { spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  point!: object | null;
  @Column({ type: 'varchar', length: 32 }) listingDigest!: string;
  @Column('integer') validatorVersion!: number;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/** Singleton (`id='current'`) written only by the rebuild and reconcile command. */
@Entity({ name: 'directory_reviewed_spatial_state' })
@Check('CHK_directory_reviewed_spatial_state_singleton', `"id" = 'current'`)
export class DirectoryReviewedSpatialState {
  @PrimaryColumn({ type: 'varchar', length: 16 }) id!: string;
  @Column('integer') validatorVersion!: number;
  @Column({ type: 'timestamptz', nullable: true })
  rebuildStartedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true })
  rebuildCompletedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) reconciledAt!: Date | null;
  @Column({ type: 'integer', default: 0 }) missing!: number;
  @Column({ type: 'integer', default: 0 }) stale!: number;
  @Column({ type: 'integer', default: 0 }) orphaned!: number;
}

/**
 * Keyed hash of the upstream Overture id of one imported row. Written by the
 * private sink in the batch-commit transaction and read only by the identity
 * carry-forward; no read path touches it and it is never copied into `listing`.
 * The raw id is never persisted.
 */
@Entity({ name: 'directory_overture_source_key' })
@Index('IDX_directory_overture_source_key_hash', ['upstreamKeyHash'])
export class DirectoryOvertureSourceKey {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @PrimaryColumn('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'varchar', length: 64 }) upstreamKeyHash!: string;
  @Column('integer') keyVersion!: number;
}

/**
 * Last-known status of one provider's optional capability (for example Geoapify private enrichment reporting
 * `not_configured` while no key is set). Operational state only: no listing, account or profile data.
 */
@Entity({ name: 'directory_provider_status' })
export class DirectoryProviderStatus {
  @PrimaryColumn({ type: 'varchar', length: 32 }) provider!: string;
  @Column({ type: 'varchar', length: 24 }) status!: string;
  @Column({ type: 'varchar', length: 256, default: '' }) detail!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  checkedAt!: Date;
}

/**
 * Private Geoapify Places details for one already-staged listing (owner decision D4). Never read by a public
 * projection or the public export; deleted by the retention scheduler once `expiresAt` passes or the scan is
 * revoked. Holds provider-derived opening hours and contact only, no account or profile identifier.
 */
@Entity({ name: 'directory_geoapify_enrichment' })
@Index('IDX_directory_geoapify_enrichment_expiry', ['expiresAt'])
export class DirectoryGeoapifyEnrichment {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @PrimaryColumn('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'jsonb' }) details!: Record<string, unknown>;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fetchedAt!: Date;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
}

/** Canonical business within one town. It holds no listing content and no account identifier. */
@Entity({ name: 'directory_business' })
@Index('IDX_directory_business_town', ['communityId'])
@Check(
  'CHK_directory_business_state',
  `"state" IN ('active','retired','merged','split')`
)
@Check(
  'CHK_directory_business_successor',
  `"successorId" IS NULL OR "state" IN ('merged','split')`
)
export class DirectoryBusiness {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('uuid') communityId!: string;
  @Column({ type: 'varchar', length: 16, default: 'active' }) state!: string;
  @Column({ type: 'uuid', nullable: true }) successorId!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) stateCause!:
    | string
    | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) retiredAt!: Date | null;
}

/** "This row of this scan is this business." Holds keyed hashes only. */
@Entity({ name: 'directory_business_assertion' })
@Index(
  'UQ_directory_business_assertion_row',
  ['scanId', 'sourceFileRowNumber'],
  { unique: true }
)
@Index('UQ_directory_business_assertion_current', ['businessId', 'policyId'], {
  unique: true,
  where: `"state" = 'current'`,
})
@Index('IDX_directory_business_assertion_hash', [
  'communityId',
  'upstreamKeyHash',
])
@Check(
  'CHK_directory_business_assertion_evidence',
  `"evidence" IN ('origin','upstream_id','owner_confirmed','reviewer_confirmed','artifact_reread')`
)
@Check(
  'CHK_directory_business_assertion_confidence',
  `"confidence" IN ('origin','carried','corroborated','confirmed')`
)
@Check(
  'CHK_directory_business_assertion_state',
  `"state" IN ('current','superseded','withdrawn')`
)
export class DirectoryBusinessAssertion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('uuid') businessId!: string;
  @Column('uuid') communityId!: string;
  @Column({ type: 'varchar', length: 64 }) scanId!: string;
  @Column('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'varchar', length: 64 }) policyId!: string;
  @Column({ type: 'varchar', length: 24 }) evidence!: string;
  @Column({ type: 'varchar', length: 16 }) confidence!: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) upstreamKeyHash!:
    | string
    | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) nameHash!:
    | string
    | null;
  @Column({ type: 'varchar', length: 16, default: 'current' }) state!: string;
  @Column({ type: 'uuid', nullable: true }) predecessorAssertionId!:
    | string
    | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/** Append-only identity transitions; the unique key makes each transition idempotent. No actor column. */
@Entity({ name: 'directory_business_event' })
@Index(
  'UQ_directory_business_event_transition',
  ['businessId', 'kind', 'scanId', 'sourceFileRowNumber'],
  { unique: true }
)
@Check(
  'CHK_directory_business_event_kind',
  `"kind" IN ('created','carried','corroborated','confirmed','unresolved','retired','merged','split','undone')`
)
export class DirectoryBusinessEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('uuid') businessId!: string;
  @Column({ type: 'varchar', length: 16 }) kind!: string;
  @Column({ type: 'varchar', length: 40 }) cause!: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) scanId!:
    | string
    | null;
  @Column({ type: 'bigint', nullable: true }) sourceFileRowNumber!:
    | string
    | null;
  @Column({ type: 'uuid', nullable: true }) otherBusinessId!: string | null;
  @Column({ type: 'uuid', nullable: true }) decisionId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/** Progress of one carry-forward from one policy to the next in one town. */
@Entity({ name: 'directory_business_carry_state' })
@Check(
  'CHK_directory_business_carry_state',
  `"state" IN ('planned','running','complete')`
)
export class DirectoryBusinessCarryState {
  @PrimaryColumn('uuid') communityId!: string;
  @PrimaryColumn({ type: 'varchar', length: 64 }) fromPolicyId!: string;
  @PrimaryColumn({ type: 'varchar', length: 64 }) toPolicyId!: string;
  @Column({ type: 'varchar', length: 64 }) planDigest!: string;
  @Column({ type: 'varchar', length: 16 }) state!: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) cursorScanId!:
    | string
    | null;
  @Column({ type: 'bigint', nullable: true }) cursorRow!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/**
 * An approved owner link that a carry has proposed to move to the business's new listing identity. It stays
 * `awaiting_confirmation` (link hidden at the new row) until a human or an independent corroboration restores it.
 * Holds identifiers only; the owner is reached through the request.
 */
@Entity({ name: 'directory_business_link_carry' })
@Index(
  'UQ_directory_business_link_carry_target',
  ['requestId', 'toListingId'],
  { unique: true }
)
@Index('IDX_directory_business_link_carry_state', ['state'])
@Check(
  'CHK_directory_business_link_carry_state',
  `"state" IN ('awaiting_confirmation','restored','closed')`
)
export class DirectoryBusinessLinkCarry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('uuid') requestId!: string;
  @Column('uuid') businessId!: string;
  @Column('uuid') fromListingId!: string;
  @Column('uuid') toListingId!: string;
  @Column({ type: 'varchar', length: 24, default: 'awaiting_confirmation' })
  state!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/**
 * A reviewer or operator decision about a business: confirm, merge, split or retire. The only identity table that
 * can name a person. `decisionId` on a business event points here; the id is the caller's idempotency key.
 */
@Entity({ name: 'directory_business_identity_decision' })
@Index('IDX_directory_business_identity_decision_business', ['businessId'])
@Index('UQ_directory_business_identity_decision_undo', ['undoOf'], {
  unique: true,
  where: '"undoOf" IS NOT NULL',
})
@Check(
  'CHK_directory_business_identity_decision_action',
  `"action" IN ('confirm','merge','split','retire','undo')`
)
export class DirectoryBusinessIdentityDecision {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') communityId!: string;
  @Column({ type: 'varchar', length: 16 }) action!: string;
  @Column('uuid') businessId!: string;
  @Column({ type: 'uuid', nullable: true }) otherBusinessId!: string | null;
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) actorDomain!:
    | string
    | null;
  @Column({ type: 'varchar', length: 1024 }) reason!: string;
  /** An `undo` decision names the decision it reverses; at most one undo exists per decision. */
  @Column({ type: 'uuid', nullable: true }) undoOf!: string | null;
  /** What the decision overwrote, so an undo can put it back (confirm: prior confidence; split: moved rows). */
  @Column({ type: 'jsonb', nullable: true }) snapshot!: object | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/**
 * Reviewer-set suppression of one served listing. Append-only history: a lift sets the lift fields on the same
 * row, a later suppression of the same listing is a new row. It never touches source provenance (the private row,
 * scan, completion and revocation tables); public reads exclude a row while an un-lifted suppression names it.
 * `actorId` and `liftedById` are reviewer profile ids; `note` is reviewer free text.
 */
@Entity({ name: 'directory_listing_suppression' })
@Index('IDX_directory_listing_suppression_town', ['communityId', 'createdAt'])
@Index('IDX_directory_listing_suppression_business', ['businessId'])
@Index(
  'UQ_directory_listing_suppression_open_row',
  ['scanId', 'sourceFileRowNumber'],
  { unique: true, where: '"liftedAt" IS NULL' }
)
@Check(
  'CHK_directory_listing_suppression_reason',
  `"reasonCode" IN ('rights-request','incorrect-details','closed-business','safety','duplicate','other')`
)
@Check(
  'CHK_directory_listing_suppression_lift_reason',
  `"liftReasonCode" IS NULL OR "liftReasonCode" IN ('resolved','mistaken-suppression','other')`
)
@Check(
  'CHK_directory_listing_suppression_lift_pair',
  `("liftedAt" IS NULL) = ("liftReasonCode" IS NULL)`
)
export class DirectoryListingSuppression {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') communityId!: string;
  @Column('uuid') listingId!: string;
  @Column({ type: 'varchar', length: 64 }) scanId!: string;
  @Column('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'uuid', nullable: true }) businessId!: string | null;
  @Column({ type: 'varchar', length: 24 }) reasonCode!: string;
  @Column({ type: 'varchar', length: 1024, nullable: true }) note!:
    | string
    | null;
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) liftedAt!: Date | null;
  @Column({ type: 'varchar', length: 24, nullable: true }) liftReasonCode!:
    | string
    | null;
  @Column({ type: 'uuid', nullable: true }) liftedById!: string | null;
}

/**
 * An uncertain duplicate pair (owner decision D13). The weaker listing (`hidden*`) is hidden through an ordinary
 * suppression (`suppressionId`) and the pair waits here for a reviewer: keep separate restores it, merge keeps it
 * hidden. Every change writes a `directory_duplicate_case_event`; the pair is unique in either order.
 */
@Entity({ name: 'directory_duplicate_case' })
@Index('IDX_directory_duplicate_case_town_state', ['communityId', 'state'])
@Index(
  'UQ_directory_duplicate_case_pair',
  ['communityId', 'keptScanId', 'keptRow', 'hiddenScanId', 'hiddenRow'],
  { unique: true }
)
@Check(
  'CHK_directory_duplicate_case_state_v2',
  `"state" IN ('queued','kept_separate','merged','stale')`
)
@Check(
  'CHK_directory_duplicate_case_rule',
  `"rule" IN ('same_name_near','similar_name')`
)
@Check(
  'CHK_directory_duplicate_case_basis',
  `"weakerBasis" IN ('sources','confidence','fields','updated','order')`
)
@Check(
  'CHK_directory_duplicate_case_decided_by',
  `"decidedBy" IS NULL OR "decidedBy" IN ('reviewer','auto','system')`
)
export class DirectoryDuplicateCase {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') communityId!: string;
  @Column({ type: 'varchar', length: 64 }) keptScanId!: string;
  @Column('bigint') keptRow!: string;
  @Column({ type: 'varchar', length: 64 }) hiddenScanId!: string;
  @Column('bigint') hiddenRow!: string;
  @Column({ type: 'uuid', nullable: true }) suppressionId!: string | null;
  @Column({ type: 'varchar', length: 16 }) rule!: string;
  @Column({ type: 'varchar', length: 16 }) weakerBasis!: string;
  @Column({ type: 'int' }) distanceMeters!: number;
  @Column({ type: 'varchar', length: 16, default: 'queued' }) state!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) decidedAt!: Date | null;
  /** Who closed the case: a reviewer, the automatic same-place rule, or the stale cleanup. Null while open. */
  @Column({ type: 'varchar', length: 16, nullable: true }) decidedBy!:
    | string
    | null;
  /** The automatic rule that resolved the case (only while `decidedBy` is 'auto'), else null. */
  @Column({ type: 'varchar', length: 48, nullable: true }) autoRule!:
    | string
    | null;
}

/** Append-only audit of a duplicate case. `actorId` is a reviewer profile id (null for the automatic queue step). */
@Entity({ name: 'directory_duplicate_case_event' })
@Index('IDX_directory_duplicate_case_event_case', ['caseId', 'createdAt'])
@Check(
  'CHK_directory_duplicate_case_event_kind_v2',
  `"kind" IN ('queued','kept_separate','merged','undone','auto_merged','closed_stale','swapped')`
)
@Check(
  'CHK_directory_duplicate_case_event_actor_kind',
  `"actorKind" IN ('reviewer','auto','system')`
)
export class DirectoryDuplicateCaseEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') caseId!: string;
  @Column({ type: 'varchar', length: 16 }) kind!: string;
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  /** 'reviewer' (actorId set), 'auto' (an automatic rule, see `ruleId`) or 'system' (queue and cleanup steps). */
  @Column({ type: 'varchar', length: 16, default: 'system' })
  actorKind!: string;
  @Column({ type: 'varchar', length: 48, nullable: true }) ruleId!:
    | string
    | null;
  @Column({ type: 'varchar', length: 1024, nullable: true }) note!:
    | string
    | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/**
 * A fixed random sample of duplicate pairs for one review round (owner decision D18). The wrong-merge limit is
 * measured on this sample, not on every merge. `seed` and `populationSize` make the draw reproducible and the
 * sample is stored, so it does not change when the queue does. One sample per town and round.
 */
@Entity({ name: 'directory_duplicate_sample' })
@Index('UQ_directory_duplicate_sample_round', ['communityId', 'round'], {
  unique: true,
})
export class DirectoryDuplicateSample {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') communityId!: string;
  @Column({ type: 'varchar', length: 64 }) round!: string;
  @Column({ type: 'varchar', length: 64 }) seed!: string;
  @Column({ type: 'int' }) sampleSize!: number;
  @Column({ type: 'int' }) populationSize!: number;
  @Column({ type: 'uuid', nullable: true }) createdById!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/** One sampled pair. `verdict` is the reviewer's judgement of the pair: a true duplicate or two distinct businesses. */
@Entity({ name: 'directory_duplicate_sample_item' })
@Check(
  'CHK_directory_duplicate_sample_item_verdict',
  `"verdict" IS NULL OR "verdict" IN ('duplicate','distinct')`
)
export class DirectoryDuplicateSampleItem {
  @PrimaryColumn('uuid') sampleId!: string;
  @PrimaryColumn('uuid') caseId!: string;
  @Column({ type: 'varchar', length: 16, nullable: true }) verdict!:
    | string
    | null;
  @Column({ type: 'uuid', nullable: true }) judgedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) judgedAt!: Date | null;
}

/**
 * A public, anonymous report or correction request about one served listing. Nothing about a report hides a
 * listing; a reviewer decides, and may open a suppression from it (`suppressionId`). `receiptTokenHash` is the
 * hash of the random receipt token shown once to the reporter; the token itself is never stored.
 * `contactEmailHash` is a keyed hash of the optional contact email, never the address, and is cleared on closed
 * reports by the retention purge. `decidedById` is a reviewer profile id; `decisionNote` is reviewer free text.
 */
@Entity({ name: 'directory_listing_report' })
@Index('UQ_directory_listing_report_receipt', ['receiptTokenHash'], {
  unique: true,
})
@Index('IDX_directory_listing_report_town_status', ['communityId', 'status'])
@Index('IDX_directory_listing_report_queue', [
  'communityId',
  'priority',
  'createdAt',
])
@Index('IDX_directory_listing_report_listing', ['communityId', 'listingId'])
@Check(
  'CHK_directory_listing_report_reason',
  `"reasonCode" IN ('rights-request','incorrect-details','closed-business','safety','duplicate','other')`
)
@Check(
  'CHK_directory_listing_report_status',
  `"status" IN ('received','under_review','resolved','declined')`
)
@Check(
  'CHK_directory_listing_report_note',
  `"note" IS NULL OR char_length("note") <= 1000`
)
export class DirectoryListingReport {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') communityId!: string;
  @Column('uuid') listingId!: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) listingName!:
    | string
    | null;
  @Column({ type: 'varchar', length: 24 }) reasonCode!: string;
  @Column({ type: 'varchar', length: 1000, nullable: true }) note!:
    | string
    | null;
  @Column({ type: 'varchar', length: 16, default: 'received' }) status!: string;
  @Column({ type: 'boolean', default: false }) priority!: boolean;
  @Column({ type: 'char', length: 64 }) receiptTokenHash!: string;
  @Column({ type: 'char', length: 64, nullable: true }) contactEmailHash!:
    | string
    | null;
  @Column({ type: 'uuid', nullable: true }) suppressionId!: string | null;
  @Column({ type: 'uuid', nullable: true }) decidedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) decidedAt!: Date | null;
  @Column({ type: 'varchar', length: 1000, nullable: true }) decisionNote!:
    | string
    | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/**
 * A rights case (S7c): one unresolved field/source lineage, release or policy that an operator with
 * `directory.rights` reviews. A case records evidence and a decision; it never grants public display, which stays
 * governed by the approved policy files and signed grants.
 */
@Entity({ name: 'directory_rights_case' })
@Index('UQ_directory_rights_case_subject', ['subjectKey'], { unique: true })
@Index('IDX_directory_rights_case_status', ['status', 'updatedAt'])
@Check(
  'CHK_directory_rights_case_scope',
  `"scope" IN ('field','source','release','policy')`
)
@Check(
  'CHK_directory_rights_case_status',
  `"status" IN ('review','excluded','resolved','withdrawn')`
)
export class DirectoryRightsCase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column({ type: 'varchar', length: 16 }) scope!: string;
  /** Natural key of the lineage, so a sync can run any number of times. */
  @Column({ type: 'varchar', length: 700 }) subjectKey!: string;
  @Column({ type: 'varchar', length: 64, default: 'overture' })
  provider!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) releaseId!:
    | string
    | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) field!:
    | string
    | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) dataset!:
    | string
    | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) license!:
    | string
    | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) sourcePointer!:
    | string
    | null;
  /** The source's pointer cannot be tied to one field, so terms cannot be confirmed for it. */
  @Column({ type: 'boolean', default: false }) ambiguous!: boolean;
  @Column({ type: 'jsonb', default: () => `'[]'` }) reasons!: string[];
  @Column({ type: 'integer', default: 0 }) observedRows!: number;
  @Column({ type: 'varchar', length: 16, default: 'review' }) status!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/** Append-only rights event. `id` is the client decision id, so a retry replays instead of repeating. */
@Entity({ name: 'directory_rights_event' })
@Index('IDX_directory_rights_event_case', ['caseId', 'createdAt'])
@Index('UQ_directory_rights_event_undo', ['undoOf'], {
  unique: true,
  where: '"undoOf" IS NOT NULL',
})
@Check(
  'CHK_directory_rights_event_action_v2',
  `"action" IN ('open','exclude_field','confirm_terms','defer','reopen','undo','withdraw','policy_resolved')`
)
@Check(
  'CHK_directory_rights_event_evidence',
  `("termsUrl" IS NULL) = ("termsSha256" IS NULL)`
)
export class DirectoryRightsEvent {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') caseId!: string;
  @Column({ type: 'varchar', length: 16 }) action!: string;
  /** Reviewer profile id; NULL once that profile's account has been erased. */
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 1024 }) reason!: string;
  @Column({ type: 'varchar', length: 2048, nullable: true }) termsUrl!:
    | string
    | null;
  @Column({ type: 'char', length: 64, nullable: true }) termsSha256!:
    | string
    | null;
  @Column({ type: 'varchar', length: 16 }) statusBefore!: string;
  @Column({ type: 'varchar', length: 16 }) statusAfter!: string;
  @Column({ type: 'uuid', nullable: true }) undoOf!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/**
 * A durable, authenticated withdrawal request (S7c). The Directory's own worker drives the private sink's
 * withdraw calls until complete, resuming `pending` and `running` requests after a restart. Withdrawal is one-way.
 */
@Entity({ name: 'directory_withdrawal_request' })
@Index('IDX_directory_withdrawal_request_status', ['status', 'updatedAt'])
@Check(
  'CHK_directory_withdrawal_request_kind',
  `"kind" IN ('scan','policy','row')`
)
@Check(
  'CHK_directory_withdrawal_request_status',
  `"status" IN ('pending','running','complete','failed')`
)
export class DirectoryWithdrawalRequest {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 8 }) kind!: string;
  /** scan or policy: 64 lowercase hex; row: `<scanId>:<sourceFileRowNumber>`. */
  @Column({ type: 'varchar', length: 128 }) target!: string;
  @Column({ type: 'varchar', length: 1024 }) reason!: string;
  /** Requesting operator profile id; NULL once that profile's account has been erased. */
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'uuid', nullable: true }) rightsCaseId!: string | null;
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status!: string;
  @Column({ type: 'integer', default: 0 }) attempts!: number;
  @Column({ type: 'integer', default: 0 }) steps!: number;
  @Column({ type: 'jsonb', default: () => `'{}'` }) progress!: object;
  @Column({ type: 'varchar', length: 512, nullable: true }) lastError!:
    | string
    | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  requestedAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) completedAt!: Date | null;
}

/**
 * Operator export job (S8). `id` is the client idempotency id; `requestHash` pins the request so a replay with a
 * different request is refused. The artifact file lives outside the database; `artifactName` is never exposed.
 */
@Entity({ name: 'directory_export_job' })
@Index('IDX_directory_export_job_status', ['status', 'updatedAt'])
@Check(
  'CHK_directory_export_job_status_v2',
  `"status" IN ('queued','running','complete','failed','expired','withdrawn','revoked')`
)
export class DirectoryExportJob {
  @PrimaryColumn('uuid') id!: string;
  /** Requesting operator profile id; NULL once that profile's account has been erased. */
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 100 }) releaseId!: string;
  @Column({ type: 'jsonb', default: () => `'{}'` }) scope!: object;
  @Column({ type: 'varchar', length: 16, default: 'jsonl' }) format!: string;
  @Column({ type: 'char', length: 64 }) requestHash!: string;
  @Column({ type: 'varchar', length: 16, default: 'queued' }) status!: string;
  @Column({ type: 'integer', default: 0 }) attempts!: number;
  @Column({ type: 'uuid', nullable: true }) leaseToken!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) leaseExpiresAt!: Date | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) errorCode!:
    | string
    | null;
  @Column({ type: 'integer', default: 0 }) rowCount!: number;
  @Column({ type: 'integer', default: 0 }) excludedRows!: number;
  @Column({ type: 'bigint', default: 0 }) byteCount!: string;
  @Column({ type: 'char', length: 64, nullable: true }) sha256!: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) artifactName!:
    | string
    | null;
  @Column({
    type: 'varchar',
    length: 64,
    default: 'town-square-directory-export/v1',
  })
  schemaVersion!: string;
  @Column({ type: 'jsonb', default: () => `'[]'` }) scanIds!: string[];
  /** What the artifact carries, as `[{dataset, license, fields: [exportKey]}]`; rights revocation reads it. */
  @Column({ type: 'jsonb', default: () => `'[]'` }) exportedSources!: object[];
  @Column({ type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) withdrawnAt!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/** Every download attempt of an export artifact, including refused ones. */
@Entity({ name: 'directory_export_download' })
@Index('IDX_directory_export_download_job', ['jobId', 'createdAt'])
@Check(
  'CHK_directory_export_download_outcome_v2',
  `"outcome" IN ('served','not_ready','expired','withdrawn','revoked','integrity_failed')`
)
export class DirectoryExportDownload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('uuid') jobId!: string;
  /** Downloading operator profile id; NULL once that profile's account has been erased. */
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 16 }) outcome!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/**
 * A checked-in taxonomy mapping, installed by an operator (S7d). `sourceHash` is the SHA-256 of the mapping's
 * canonical JSON, so installing the same version twice is a no-op and a changed file under an old version id is
 * refused. At most one version is active.
 */
@Entity({ name: 'directory_taxonomy_mapping_version' })
@Index('UQ_directory_taxonomy_mapping_active', ['active'], {
  unique: true,
  where: '"active" = true',
})
@Check(
  'CHK_directory_taxonomy_mapping_unmapped',
  `"unmappedPolicy" IN ('keep_legacy','exclude')`
)
export class DirectoryTaxonomyMappingVersion {
  @PrimaryColumn({ type: 'varchar', length: 100 }) id!: string;
  @Column({ type: 'char', length: 64 }) sourceHash!: string;
  @Column({ type: 'varchar', length: 16, default: 'keep_legacy' })
  unmappedPolicy!: string;
  @Column({ type: 'boolean', default: false }) active!: boolean;
  /** Operator profile that installed the version; NULL once that profile's account has been erased. */
  @Column({ type: 'uuid', nullable: true }) installedById!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) activatedAt!: Date | null;
}

/** One Overture category or taxonomy node of a mapping version and where it goes (or why it is excluded). */
@Entity({ name: 'directory_taxonomy_mapping_row' })
@Index(
  'UQ_directory_taxonomy_mapping_row_key',
  ['versionId', 'kind', 'overtureKey'],
  { unique: true }
)
@Check(
  'CHK_directory_taxonomy_mapping_row_kind',
  `"kind" IN ('basic_category','taxonomy_node')`
)
@Check(
  'CHK_directory_taxonomy_mapping_row_target',
  `("excluded" = true AND "categoryId" IS NULL AND "placeTypeId" IS NULL AND "exclusionReason" IS NOT NULL) OR ("excluded" = false AND "categoryId" IS NOT NULL AND "exclusionReason" IS NULL)`
)
export class DirectoryTaxonomyMappingRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column({ type: 'varchar', length: 100 }) versionId!: string;
  @Column({ type: 'varchar', length: 16 }) kind!: string;
  @Column({ type: 'varchar', length: 200 }) overtureKey!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) categoryId!:
    | string
    | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) placeTypeId!:
    | string
    | null;
  @Column({ type: 'boolean', default: false }) excluded!: boolean;
  @Column({ type: 'varchar', length: 40, nullable: true }) exclusionReason!:
    | string
    | null;
}

/**
 * The computed classification of one served source row. Public reads label and filter by it; a row with no
 * projection keeps its stored category, so nothing disappears before a reclassification run has covered it.
 */
@Entity({ name: 'directory_listing_classification' })
@Index('IDX_directory_listing_classification_run', ['runId'])
@Check(
  'CHK_directory_listing_classification_basis',
  `"basis" IN ('override','mapping','legacy')`
)
export class DirectoryListingClassification {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @PrimaryColumn('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'varchar', length: 100 }) mappingVersion!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) categoryId!:
    | string
    | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) placeTypeId!:
    | string
    | null;
  @Column({ type: 'varchar', length: 16 }) basis!: string;
  @Column({ type: 'boolean', default: false }) excluded!: boolean;
  @Column({ type: 'varchar', length: 40, nullable: true }) exclusionReason!:
    | string
    | null;
  @Column({ type: 'uuid', nullable: true }) runId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/**
 * An operator's per-listing category. It is keyed by the stable listing identity (the business id once the row has
 * one, else the row-scoped listing id), never by scan row, so a rescan or re-import of the same listing keeps it.
 */
@Entity({ name: 'directory_listing_category_override' })
@Index(
  'UQ_directory_listing_category_override_key',
  ['communityId', 'listingKey'],
  {
    unique: true,
  }
)
export class DirectoryListingCategoryOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('uuid') communityId!: string;
  @Column('uuid') listingKey!: string;
  @Column({ type: 'varchar', length: 100 }) categoryId!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) placeTypeId!:
    | string
    | null;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  /** The classification case and event that last set this override. */
  @Column({ type: 'uuid', nullable: true }) caseId!: string | null;
  @Column({ type: 'uuid', nullable: true }) eventId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/** A classification case: a listing whose category an operator must decide (ambiguous, unmapped or operator-raised). */
@Entity({ name: 'directory_taxonomy_case' })
@Index('IDX_directory_taxonomy_case_status', ['status', 'updatedAt'])
@Index('UQ_directory_taxonomy_case_open', ['communityId', 'listingKey'], {
  unique: true,
  where: `"status" IN ('open','deferred')`,
})
@Check(
  'CHK_directory_taxonomy_case_status_v2',
  `"status" IN ('open','assigned','rejected','deferred','dismissed')`
)
@Check(
  'CHK_directory_taxonomy_case_reason',
  `"reason" IN ('operator_raised','unmapped_taxonomy','ambiguous_taxonomy')`
)
export class DirectoryTaxonomyCase {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') communityId!: string;
  @Column('uuid') listingKey!: string;
  @Column({ type: 'varchar', length: 64 }) scanId!: string;
  @Column('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'varchar', length: 24 }) reason!: string;
  @Column({ type: 'varchar', length: 2000 }) name!: string;
  @Column({ type: 'varchar', length: 200 }) observedCategory!: string;
  @Column({ type: 'varchar', length: 16, default: 'open' }) status!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/** Append-only case event. `id` is the client decision id, so a retry replays instead of repeating. */
@Entity({ name: 'directory_taxonomy_event' })
@Index('IDX_directory_taxonomy_event_case', ['caseId', 'createdAt'])
@Index('UQ_directory_taxonomy_event_undo', ['undoOf'], {
  unique: true,
  where: '"undoOf" IS NOT NULL',
})
@Check(
  'CHK_directory_taxonomy_event_action_v2',
  `"action" IN ('open','assign','reject','defer','reopen','dismiss','undo')`
)
export class DirectoryTaxonomyEvent {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') caseId!: string;
  @Column({ type: 'varchar', length: 16 }) action!: string;
  /** Reviewer profile id; NULL once that profile's account has been erased. */
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 1024 }) reason!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) categoryId!:
    | string
    | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) placeTypeId!:
    | string
    | null;
  @Column({ type: 'varchar', length: 16 }) statusBefore!: string;
  @Column({ type: 'varchar', length: 16 }) statusAfter!: string;
  /** The listing's override as it stood before this decision (`null` = none), so an undo can restore it. */
  @Column({ type: 'jsonb', nullable: true }) overrideBefore!: object | null;
  @Column({ type: 'uuid', nullable: true }) undoOf!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/** A reclassification run: dry run or apply of a mapping version over a scope, resumable by its durable cursor. */
@Entity({ name: 'directory_taxonomy_run' })
@Index('IDX_directory_taxonomy_run_status', ['status', 'updatedAt'])
@Check('CHK_directory_taxonomy_run_scope', `"scope" IN ('town','all')`)
@Check('CHK_directory_taxonomy_run_mode', `"mode" IN ('dry_run','apply')`)
@Check(
  'CHK_directory_taxonomy_run_phase',
  `"phase" IN ('plan','apply','rollback')`
)
@Check(
  'CHK_directory_taxonomy_run_status',
  `"status" IN ('pending','running','complete','canceled','failed','rolling_back','rolled_back')`
)
@Check(
  'CHK_directory_taxonomy_run_town',
  `("scope" = 'town') = ("communityId" IS NOT NULL)`
)
export class DirectoryTaxonomyRun {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 100 }) mappingVersion!: string;
  @Column({ type: 'varchar', length: 8 }) scope!: string;
  @Column({ type: 'uuid', nullable: true }) communityId!: string | null;
  @Column({ type: 'varchar', length: 8 }) mode!: string;
  @Column({ type: 'varchar', length: 12, default: 'plan' }) phase!: string;
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status!: string;
  /** Operator profile that created the run; NULL once that profile's account has been erased. */
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 1024 }) reason!: string;
  /** For an apply run: the plan hash the operator saw in a dry run and confirmed. */
  @Column({ type: 'char', length: 64, nullable: true }) expectedPlanHash!:
    | string
    | null;
  @Column({ type: 'char', length: 64, nullable: true }) planHash!:
    | string
    | null;
  /** Running digest chain of the plan pass; the hash once that pass completes. */
  @Column({ type: 'char', length: 64, nullable: true }) planAccumulator!:
    | string
    | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) cursorScanId!:
    | string
    | null;
  @Column({ type: 'bigint', nullable: true }) cursorRow!: string | null;
  @Column({ type: 'integer', default: 0 }) scannedRows!: number;
  @Column({ type: 'integer', default: 0 }) changedRows!: number;
  @Column({ type: 'integer', default: 0 }) appliedRows!: number;
  @Column({ type: 'integer', default: 0 }) restoredRows!: number;
  /** Apply-phase rows skipped because they no longer matched the plan pass. */
  @Column({ type: 'integer', default: 0 }) driftedRows!: number;
  @Column({ type: 'integer', default: 0 }) attempts!: number;
  @Column({ type: 'jsonb', default: () => `'{}'` }) summary!: object;
  @Column({ type: 'varchar', length: 512, nullable: true }) lastError!:
    | string
    | null;
  @Column({ type: 'boolean', default: false }) cancelRequested!: boolean;
  @Column({ type: 'uuid', nullable: true }) canceledById!: string | null;
  @Column({ type: 'varchar', length: 1024, nullable: true })
  cancelReason!: string | null;
  @Column({ type: 'uuid', nullable: true }) rollbackById!: string | null;
  @Column({ type: 'varchar', length: 1024, nullable: true })
  rollbackReason!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) completedAt!: Date | null;
}

/** The projection row as it stood before a run changed it, so a rollback restores exactly that. */
@Entity({ name: 'directory_taxonomy_run_before' })
export class DirectoryTaxonomyRunBefore {
  @PrimaryColumn('uuid') runId!: string;
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @PrimaryColumn('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'boolean' }) hadProjection!: boolean;
  @Column({ type: 'jsonb', nullable: true }) before!: object | null;
}

/**
 * What the plan pass of an apply run computed for each row it would change, so the apply phase can re-check a row
 * against the plan and skip it (as `drifted`) when it moved in between.
 */
@Entity({ name: 'directory_taxonomy_run_plan' })
export class DirectoryTaxonomyRunPlan {
  @PrimaryColumn('uuid') runId!: string;
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @PrimaryColumn('bigint') sourceFileRowNumber!: string;
  @Column({ type: 'char', length: 64 }) digest!: string;
}

/**
 * Acquisition run ledger (S7e). One row per invocation of a local acquisition stage script (or a historical
 * import of what earlier scripts already did). The stage writes it; operators read it and request cancel/resume/retry.
 * No provider call is made from this table: it records, it does not authorise.
 */
@Entity({ name: 'directory_acquisition_run' })
@Index('IDX_directory_acquisition_run_status', ['status', 'createdAt'])
@Check(
  'CHK_directory_acquisition_run_status',
  `"status" IN ('queued','running','succeeded','succeeded_empty','partial','blocked','failed_retryable','failed_permanent','cancel_requested','cancelled')`
)
@Check(
  'CHK_directory_acquisition_run_kind',
  `"kind" IN ('overture-stage','poc-import','census-stage','historical')`
)
export class DirectoryAcquisitionRun {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 32 }) provider!: string;
  @Column({ type: 'varchar', length: 32, nullable: true }) release!:
    | string
    | null;
  @Column({ type: 'varchar', length: 24 }) kind!: string;
  /** Town ids the run is aimed at. */
  @Column({ type: 'jsonb', default: () => `'[]'` }) townIds!: string[];
  @Column({ type: 'varchar', length: 24, default: 'queued' }) status!: string;
  @Column({ type: 'varchar', length: 32, nullable: true }) blockedReason!:
    | string
    | null;
  /** Operator profile that started the run; NULL for a script (`system`) or a historical import. */
  @Column({ type: 'uuid', nullable: true }) startedById!: string | null;
  @Column({ type: 'varchar', length: 1024, default: '' }) reason!: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) startedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) heartbeatAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
  @Column({ type: 'bigint', default: 0 }) observedCount!: string;
  @Column({ type: 'bigint', default: 0 }) acceptedCount!: string;
  @Column({ type: 'bigint', default: 0 }) rejectedCount!: string;
  @Column({ type: 'integer', default: 0 }) budgetReservedCents!: number;
  @Column({ type: 'integer', default: 0 }) budgetUsedCents!: number;
  /** Redacted: a short code or message, never a credential, host or path. */
  @Column({ type: 'varchar', length: 256, nullable: true }) lastError!:
    | string
    | null;
  /**
   * The run's quality scorecard (D28, `run-quality.ts`): completeness, invalid values, out-of-boundary and duplicate
   * rates, the limits applied and the breaches. NULL for a run that never reached the gate.
   */
  @Column({ type: 'jsonb', nullable: true }) quality!: object | null;
}

/**
 * The normalizer version a scan's rows carry (D27, `normalize.ts`). A scan with no row here, or an older version, is
 * re-normalised from its stored rows by `renormalizeScan`; nothing is re-acquired.
 */
@Entity({ name: 'directory_scan_normalization' })
export class DirectoryScanNormalization {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @Column({ type: 'varchar', length: 32 }) normalizerVersion!: string;
  @Column({ type: 'int', default: 0 }) rowCount!: number;
  @Column({ type: 'timestamptz', default: () => 'now()' }) normalizedAt!: Date;
}

/** One unit of a run: a town, or a source asset aimed at towns. */
@Entity({ name: 'directory_acquisition_run_job' })
@Index('IDX_directory_acquisition_run_job_town', ['townId'])
@Check(
  'CHK_directory_acquisition_run_job_status',
  `"status" IN ('queued','running','succeeded','succeeded_empty','partial','blocked','failed_retryable','failed_permanent','cancelled')`
)
export class DirectoryAcquisitionRunJob {
  @PrimaryColumn('uuid') runId!: string;
  @PrimaryColumn({ type: 'varchar', length: 64 }) unitKey!: string;
  @Column({ type: 'uuid', nullable: true }) townId!: string | null;
  /** The scan this job's rows belong to; with `townId` it names a `directory_town_scan_target` row. */
  @Column({ type: 'varchar', length: 64, nullable: true }) scanId!:
    | string
    | null;
  @Column({ type: 'varchar', length: 24, default: 'queued' }) status!: string;
  @Column({ type: 'varchar', length: 32, nullable: true }) blockedReason!:
    | string
    | null;
  /** Opaque resume cursor the stage wrote; the next attempt starts from it. */
  @Column({ type: 'jsonb', nullable: true }) checkpoint!: object | null;
  @Column({ type: 'integer', default: 0 }) attempt!: number;
  @Column({ type: 'bigint', default: 0 }) observedCount!: string;
  @Column({ type: 'bigint', default: 0 }) acceptedCount!: string;
  @Column({ type: 'bigint', default: 0 }) rejectedCount!: string;
  @Column({ type: 'varchar', length: 256, nullable: true }) lastError!:
    | string
    | null;
  @Column({ type: 'timestamptz', nullable: true }) startedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

/**
 * Append-only audit of operator requests against a run. The event id is the client's decisionId, so a replay
 * finds its own row. A resume or retry stays pending until the stage appends a `consumed` event naming it.
 */
@Entity({ name: 'directory_acquisition_run_event' })
@Index('IDX_directory_acquisition_run_event_run', ['runId', 'createdAt'])
@Index('UQ_directory_acquisition_run_event_consumed', ['ofEventId'], {
  unique: true,
  where: '"ofEventId" IS NOT NULL',
})
@Check(
  'CHK_directory_acquisition_run_event_action',
  `"action" IN ('cancel','resume','retry','import_history','consumed')`
)
export class DirectoryAcquisitionRunEvent {
  @PrimaryColumn('uuid') id!: string;
  /** NULL for an `import_history` event, which belongs to no single run. */
  @Column({ type: 'uuid', nullable: true }) runId!: string | null;
  @Column({ type: 'varchar', length: 16 }) action!: string;
  /** Operator profile; NULL for the stage's own `consumed` event or once the profile's account was erased. */
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 1024 }) reason!: string;
  /** The job a retry targets. */
  @Column({ type: 'varchar', length: 64, nullable: true }) unitKey!:
    | string
    | null;
  @Column({ type: 'varchar', length: 24, nullable: true }) statusBefore!:
    | string
    | null;
  @Column({ type: 'varchar', length: 24, nullable: true }) statusAfter!:
    | string
    | null;
  /** For `consumed`: the resume or retry request it satisfied. */
  @Column({ type: 'uuid', nullable: true }) ofEventId!: string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

/**
 * Operator pause switches (S9a). An absent row means running. `version` is the optimistic-concurrency token: every
 * change increments it. The withdrawal worker has no key here on purpose; rights obligations are never pausable.
 */
@Entity({ name: 'directory_operating_control' })
@Check(
  'CHK_directory_operating_control_key',
  `"key" IN ('provider_acquisition','export_worker','taxonomy_worker')`
)
@Check(
  'CHK_directory_operating_control_reason_length',
  `"reason" IS NULL OR char_length("reason") <= 500`
)
@Check(
  'CHK_directory_operating_control_paused_reason',
  `"paused" = false OR ("reason" IS NOT NULL AND char_length(btrim("reason")) > 0)`
)
export class DirectoryOperatingControl {
  @PrimaryColumn({ type: 'text' }) key!: string;
  @Column({ type: 'boolean', default: false }) paused!: boolean;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ type: 'integer', default: 1 }) version!: number;
  /** Operator profile that made the last change. */
  @Column({ type: 'uuid', nullable: true }) updatedBy!: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) updatedAt!: Date;
}

/** Append-only audit of every operating-control change. */
@Entity({ name: 'directory_operating_control_event' })
@Index('IDX_directory_operating_control_event_key', ['key', 'at'])
export class DirectoryOperatingControlEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text' }) key!: string;
  @Column({ type: 'boolean' }) paused!: boolean;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'integer' }) previousVersion!: number;
  @Column({ type: 'timestamptz', default: () => 'now()' }) at!: Date;
}

/**
 * Append-only audit of owner-console operator actions that have no case or run of their own: mapping activation,
 * boundary locks, binding revalidation and maintenance jobs. `subjectId` is the mapping version id, town id, binding
 * id or job id, as text.
 */
@Entity({ name: 'directory_operator_event' })
@Index('IDX_directory_operator_event_subject', ['kind', 'subjectId', 'at'])
export class DirectoryOperatorEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 32 }) kind!: string;
  @Column({ type: 'varchar', length: 100 }) subjectId!: string;
  @Column({ type: 'varchar', length: 32 }) action!: string;
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ type: 'jsonb', nullable: true }) detail!: Record<
    string,
    unknown
  > | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) at!: Date;
}
