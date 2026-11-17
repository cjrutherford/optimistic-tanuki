import {
  Column,
  Entity,
  PrimaryColumn,
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
  @Column({ type: 'timestamptz', nullable: true }) invalidatedAt!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
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
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
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
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
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
export class DirectoryAddressReviewDecision {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' }) id!: string;
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
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
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
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
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
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
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
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
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
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
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
  `"kind" IN ('created','carried','corroborated','confirmed','unresolved','retired','merged','split')`
)
export class DirectoryBusinessEvent {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
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
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
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
@Check(
  'CHK_directory_business_identity_decision_action',
  `"action" IN ('confirm','merge','split','retire')`
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
