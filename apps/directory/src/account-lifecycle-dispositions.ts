/**
 * Account deletion and export disposition of every Directory column.
 *
 * `class`     what the column holds.
 * `deletion`  what erase does to a row matched for the deleted account.
 * `export`    whether an account export receipt carries the column.
 * A column that is not listed fails the parity test and blocks erase
 * (DIRECTORY_DELETION_CATALOG_DRIFT), so new columns must be classified first.
 */
export type DirectoryColumnClass =
  | 'identity'
  | 'identity-domain'
  | 'actor-input'
  | 'history'
  | 'operational'
  | 'source-data';
export type DirectoryDeletionDisposition =
  | 'null-when-domain-matches'
  | 'clear'
  | 'clear-on-owned-request'
  | 'clear-when-human'
  | 'revoke-when-live'
  | 'delete-row-when-owned'
  | 'preserve';
export type DirectoryExportDisposition = 'include' | 'exclude';

export interface DirectoryColumnGroup {
  fields: readonly string[];
  class: DirectoryColumnClass;
  deletion: DirectoryDeletionDisposition;
  export: DirectoryExportDisposition;
  /** Identity domain: fixed, or the name of the per-row column that records it. */
  domain?: 'account' | 'profile' | 'tagged:actorDomain';
  note?: string;
}
export interface DirectoryTableDisposition {
  table: string;
  entity: string;
  subject: 'none' | 'account' | 'profile' | 'account-or-profile';
  rule: string;
  columns: readonly DirectoryColumnGroup[];
}
export interface DirectoryLifecycleInventory {
  version: 1;
  policy: string;
  /** Physical tables that are not Directory entities and hold no account data. */
  nonEntityTables: readonly string[];
  tables: readonly DirectoryTableDisposition[];
}

const none = (
  table: string,
  entity: string,
  fields: readonly string[],
  rule: string,
  cls: DirectoryColumnClass = 'operational'
): DirectoryTableDisposition => ({
  table,
  entity,
  subject: 'none',
  rule,
  columns: [{ fields, class: cls, deletion: 'preserve', export: 'exclude' }],
});

const inventory: DirectoryLifecycleInventory = {
  version: 1,
  policy:
    'N04: keep minimal history, clear identities matched in their own domain and the free-form input supplied with them; block on any match whose domain is unknown',
  nonEntityTables: ['migrations', 'spatial_ref_sys'],
  tables: [
    {
      table: 'directory_business_link_request',
      entity: 'DirectoryBusinessLinkRequest',
      subject: 'account',
      rule: 'ownerId is the requesting owner account. A match on a profile or legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['ownerId'],
          class: 'identity',
          domain: 'account',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
          note: 'The export subject is the account itself; its id is not repeated per row.',
        },
        {
          fields: ['status'],
          class: 'history',
          deletion: 'revoke-when-live',
          export: 'include',
          note: 'pending and approved become revoked; a system revoke event is appended.',
        },
        {
          fields: ['businessId'],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Canonical business identifier (source data, no person); not part of the owner export.',
        },
        {
          fields: [
            'requestId',
            'townId',
            'listingId',
            'businessCommunityId',
            'createdAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'include',
          note: 'businessCommunityId is a Social community id; Social owns its disposition.',
        },
      ],
    },
    {
      table: 'directory_business_link_active',
      entity: 'DirectoryBusinessLinkActive',
      subject: 'account',
      rule: 'Reached only through the owned request; holds no identifier of its own.',
      columns: [
        {
          fields: ['listingId', 'requestId'],
          class: 'operational',
          deletion: 'delete-row-when-owned',
          export: 'exclude',
          note: 'The request status already states whether the link was approved.',
        },
      ],
    },
    {
      table: 'directory_business_link_event',
      entity: 'DirectoryBusinessLinkEvent',
      subject: 'account-or-profile',
      rule: 'actorId is matched only in the domain recorded in actorDomain. NULL (legacy) or unknown actorDomain with a matching actorId blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'tagged:actorDomain',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['actorDomain'],
          class: 'identity-domain',
          deletion: 'preserve',
          export: 'include',
          note: 'account | profile | system; NULL on legacy rows means unknown and is never backfilled by inference.',
        },
        {
          fields: ['evidenceUrl'],
          class: 'actor-input',
          deletion: 'clear-on-owned-request',
          export: 'include',
          note: "Cleared on events of the deleted owner's requests. Kept on a deleted reviewer's events for other owners: it is evidence about that business.",
        },
        {
          fields: ['id', 'requestId', 'action', 'createdAt'],
          class: 'history',
          deletion: 'preserve',
          export: 'include',
        },
      ],
    },
    {
      table: 'directory_business_identity_decision',
      entity: 'DirectoryBusinessIdentityDecision',
      subject: 'account-or-profile',
      rule: 'actorId is matched only in the domain recorded in actorDomain, as for link events. NULL (operator or unknown) or an unknown actorDomain with a matching actorId blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'tagged:actorDomain',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['reason'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the reviewer supplied; cleared on rows the deleted actor matched. Not exported: owner decision 2026-11-16, reviewer decisions are operational audit records, not the own data of the actor; on deletion the record is kept with the actor removed.',
        },
        {
          fields: ['actorDomain'],
          class: 'identity-domain',
          deletion: 'preserve',
          export: 'exclude',
          note: 'account | profile | system; NULL means unknown and is never backfilled by inference.',
        },
        {
          fields: [
            'id',
            'communityId',
            'action',
            'businessId',
            'otherBusinessId',
            'undoOf',
            'snapshot',
            'createdAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Business identifiers and the decision kind (including the decision an undo reverses and the assertion ids it restores): an audit trail of identity changes, kept after the actor is erased.',
        },
      ],
    },
    {
      table: 'directory_boundary_decision',
      entity: 'DirectoryBoundaryDecision',
      subject: 'profile',
      rule: 'reviewerId is the reviewer profile supplied by Gateway. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['reviewerId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['sourceUrl'],
          class: 'history',
          deletion: 'preserve',
          export: 'include',
          note: 'Validated official .gov source without credentials, query or fragment; not free-form input.',
        },
        {
          fields: ['requestId', 'communityId', 'decision', 'createdAt'],
          class: 'history',
          deletion: 'preserve',
          export: 'include',
        },
        {
          fields: ['automatic', 'reason'],
          class: 'history',
          deletion: 'preserve',
          export: 'include',
          note: 'Marks the automatic Census decision and its fixed system reason; no actor, so nothing to erase.',
        },
        {
          fields: [
            'sourceEpoch',
            'activationId',
            'socialGeneration',
            'recoveryEpoch',
            'directoryGeneration',
            'changeToken',
            'geoid',
            'layer',
            'vintage',
            'stateFips',
            'archiveSha256',
            'geographyHash',
            'invalidatedAt',
          ],
          class: 'operational',
          deletion: 'preserve',
          export: 'exclude',
        },
      ],
    },
    {
      table: 'directory_address_review_decision',
      entity: 'DirectoryAddressReviewDecision',
      subject: 'profile',
      rule: 'actorId is the reviewer profile on human rows and the approving reviewer on auto rows; system rows have none. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['reason', 'checks'],
          class: 'actor-input',
          deletion: 'clear-when-human',
          export: 'include',
          note: 'Unreviewed free text and checklist from a human reviewer; automated rows hold system values and are kept.',
        },
        {
          fields: ['evidenceUrl', 'evidenceHash'],
          class: 'history',
          deletion: 'preserve',
          export: 'include',
          note: 'Evidence about the listed business that authorized a publication.',
        },
        {
          fields: [
            'id',
            'candidateId',
            'actorKind',
            'decision',
            'policyVersion',
            'undoOf',
            'createdAt',
            'appliedAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'include',
        },
      ],
    },
    {
      table: 'directory_listing_suppression',
      entity: 'DirectoryListingSuppression',
      subject: 'profile',
      rule: 'actorId and liftedById are reviewer profile ids. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId', 'liftedById'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['note'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the suppressing reviewer supplied; cleared on rows that reviewer authored. Not exported: reviewer actions are operational audit records, not the own data of the actor.',
        },
        {
          fields: [
            'id',
            'communityId',
            'listingId',
            'scanId',
            'sourceFileRowNumber',
            'businessId',
            'reasonCode',
            'createdAt',
            'liftedAt',
            'liftReasonCode',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Which listing was suppressed, why and when: an audit trail kept after the actor is erased.',
        },
      ],
    },
    {
      table: 'directory_duplicate_case',
      entity: 'DirectoryDuplicateCase',
      subject: 'none',
      rule: 'Holds no actor: who decided is recorded in directory_duplicate_case_event.',
      columns: [
        {
          fields: [
            'id',
            'communityId',
            'keptScanId',
            'keptRow',
            'hiddenScanId',
            'hiddenRow',
            'suppressionId',
            'rule',
            'weakerBasis',
            'distanceMeters',
            'state',
            'createdAt',
            'decidedAt',
          ],
          class: 'operational',
          deletion: 'preserve',
          export: 'exclude',
        },
      ],
    },
    {
      table: 'directory_duplicate_case_event',
      entity: 'DirectoryDuplicateCaseEvent',
      subject: 'profile',
      rule: 'actorId is a reviewer profile id (null for the automatic queue step). A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['note'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the deciding reviewer supplied; cleared on rows that reviewer authored. Not exported: reviewer actions are operational audit records.',
        },
        {
          fields: ['id', 'caseId', 'kind', 'createdAt'],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'What happened to the case and when, kept after the actor is erased.',
        },
      ],
    },
    {
      table: 'directory_duplicate_sample',
      entity: 'DirectoryDuplicateSample',
      subject: 'profile',
      rule: 'createdById is the reviewer profile id that drew the sample. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['createdById'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: [
            'id',
            'communityId',
            'round',
            'seed',
            'sampleSize',
            'populationSize',
            'createdAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'The recorded draw, kept after the reviewer is erased so the wrong-merge rate stays reproducible.',
        },
      ],
    },
    {
      table: 'directory_duplicate_sample_item',
      entity: 'DirectoryDuplicateSampleItem',
      subject: 'profile',
      rule: 'judgedById is the reviewer profile id that judged the pair. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['judgedById'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['sampleId', 'caseId', 'verdict', 'judgedAt'],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'The verdict is the measurement; it is kept after the reviewer is erased.',
        },
      ],
    },
    none(
      'directory_rights_case',
      'DirectoryRightsCase',
      [
        'id',
        'scope',
        'subjectKey',
        'provider',
        'releaseId',
        'field',
        'dataset',
        'license',
        'sourcePointer',
        'ambiguous',
        'reasons',
        'observedRows',
        'status',
        'createdAt',
        'updatedAt',
      ],
      'Dataset rights case keyed by source scope, not by a person. Holds no actor, owner or account column.',
      'history'
    ),
    {
      table: 'directory_rights_event',
      entity: 'DirectoryRightsEvent',
      subject: 'profile',
      rule: 'actorId is the operator profile that decided the case. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['reason'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the operator supplied; cleared to an empty string on rows that operator authored.',
        },
        {
          fields: [
            'id',
            'caseId',
            'action',
            'termsUrl',
            'termsSha256',
            'statusBefore',
            'statusAfter',
            'undoOf',
            'createdAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Which case moved, how and when: the audit trail kept after the actor is erased.',
        },
      ],
    },
    {
      table: 'directory_withdrawal_request',
      entity: 'DirectoryWithdrawalRequest',
      subject: 'profile',
      rule: 'actorId is the operator profile that requested the withdrawal. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['reason'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the operator supplied; cleared to an empty string on requests that operator made.',
        },
        {
          fields: [
            'id',
            'kind',
            'target',
            'rightsCaseId',
            'status',
            'attempts',
            'steps',
            'progress',
            'lastError',
            'requestedAt',
            'updatedAt',
            'completedAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'What was withdrawn and how far it got: kept as the irreversible-action audit record.',
        },
      ],
    },
    {
      table: 'directory_export_job',
      entity: 'DirectoryExportJob',
      subject: 'profile',
      rule: 'actorId is the operator profile that requested the export. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: [
            'id',
            'releaseId',
            'scope',
            'format',
            'requestHash',
            'status',
            'attempts',
            'leaseToken',
            'leaseExpiresAt',
            'errorCode',
            'rowCount',
            'excludedRows',
            'byteCount',
            'sha256',
            'artifactName',
            'schemaVersion',
            'scanIds',
            'expiresAt',
            'completedAt',
            'withdrawnAt',
            'revokedAt',
            'exportedSources',
            'createdAt',
            'updatedAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'What was exported, from which scans and how it ended: kept as the operator-export audit record.',
        },
      ],
    },
    {
      table: 'directory_export_download',
      entity: 'DirectoryExportDownload',
      subject: 'profile',
      rule: 'actorId is the operator profile that downloaded (or was refused) an export artifact. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['id', 'jobId', 'outcome', 'createdAt'],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Which export was fetched, when and with what outcome: kept as the download audit trail.',
        },
      ],
    },
    none(
      'directory_taxonomy_mapping_row',
      'DirectoryTaxonomyMappingRow',
      [
        'id',
        'versionId',
        'kind',
        'overtureKey',
        'categoryId',
        'placeTypeId',
        'excluded',
        'exclusionReason',
      ],
      'Checked-in Overture category mapping, not about a person. Holds no actor, owner or account column.',
      'history'
    ),
    none(
      'directory_listing_classification',
      'DirectoryListingClassification',
      [
        'scanId',
        'sourceFileRowNumber',
        'mappingVersion',
        'categoryId',
        'placeTypeId',
        'basis',
        'excluded',
        'exclusionReason',
        'runId',
        'updatedAt',
      ],
      'Computed category of a source row. Holds no actor, owner or account column.',
      'history'
    ),
    none(
      'directory_listing_category_override',
      'DirectoryListingCategoryOverride',
      [
        'id',
        'communityId',
        'listingKey',
        'categoryId',
        'placeTypeId',
        'active',
        'caseId',
        'eventId',
        'updatedAt',
      ],
      'Operator-chosen category of a listing, keyed by listing identity. The deciding actor is recorded only on the taxonomy event.',
      'history'
    ),
    none(
      'directory_taxonomy_case',
      'DirectoryTaxonomyCase',
      [
        'id',
        'communityId',
        'listingKey',
        'scanId',
        'sourceFileRowNumber',
        'reason',
        'name',
        'observedCategory',
        'status',
        'createdAt',
        'updatedAt',
      ],
      'Classification case about a listing (a business name and category), not a person. Holds no actor, owner or account column.',
      'history'
    ),
    none(
      'directory_taxonomy_run_before',
      'DirectoryTaxonomyRunBefore',
      ['runId', 'scanId', 'sourceFileRowNumber', 'hadProjection', 'before'],
      'Before-image of a projection row a reclassification run changed. Holds no actor, owner or account column.',
      'history'
    ),
    none(
      'directory_taxonomy_run_plan',
      'DirectoryTaxonomyRunPlan',
      ['runId', 'scanId', 'sourceFileRowNumber', 'digest'],
      'Per-row digest a reclassification plan pass computed, for the apply-phase re-check. Holds no actor, owner or account column.',
      'history'
    ),
    {
      table: 'directory_taxonomy_mapping_version',
      entity: 'DirectoryTaxonomyMappingVersion',
      subject: 'profile',
      rule: 'installedById is the operator profile that installed the version. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['installedById'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: [
            'id',
            'sourceHash',
            'unmappedPolicy',
            'active',
            'createdAt',
            'activatedAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Which mapping version existed, whether it is active and when: kept after the installer is erased.',
        },
      ],
    },
    {
      table: 'directory_taxonomy_event',
      entity: 'DirectoryTaxonomyEvent',
      subject: 'profile',
      rule: 'actorId is the operator profile that decided the case. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['reason'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the operator supplied; cleared to an empty string on rows that operator authored.',
        },
        {
          fields: [
            'id',
            'caseId',
            'action',
            'categoryId',
            'placeTypeId',
            'statusBefore',
            'statusAfter',
            'overrideBefore',
            'undoOf',
            'createdAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Which case moved, to which category, how and when: the audit trail kept after the actor is erased.',
        },
      ],
    },
    {
      table: 'directory_taxonomy_run',
      entity: 'DirectoryTaxonomyRun',
      subject: 'profile',
      rule: 'actorId, canceledById and rollbackById are operator profile ids. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId', 'canceledById', 'rollbackById'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['reason', 'cancelReason', 'rollbackReason'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the operator supplied; cleared on runs that operator created, canceled or rolled back.',
        },
        {
          fields: [
            'id',
            'mappingVersion',
            'scope',
            'communityId',
            'mode',
            'phase',
            'status',
            'expectedPlanHash',
            'planHash',
            'planAccumulator',
            'cursorScanId',
            'cursorRow',
            'scannedRows',
            'changedRows',
            'appliedRows',
            'restoredRows',
            'driftedRows',
            'attempts',
            'summary',
            'lastError',
            'cancelRequested',
            'createdAt',
            'updatedAt',
            'completedAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'What a run changed and how far it got: kept as the bulk-change audit record.',
        },
      ],
    },
    none(
      'directory_acquisition_run_job',
      'DirectoryAcquisitionRunJob',
      [
        'runId',
        'unitKey',
        'townId',
        'scanId',
        'status',
        'blockedReason',
        'checkpoint',
        'attempt',
        'observedCount',
        'acceptedCount',
        'rejectedCount',
        'lastError',
        'startedAt',
        'finishedAt',
        'updatedAt',
      ],
      'Progress of one town or asset in an acquisition run. Holds no actor, owner or account column.',
      'history'
    ),
    {
      table: 'directory_acquisition_run',
      entity: 'DirectoryAcquisitionRun',
      subject: 'profile',
      rule: 'startedById is the operator profile that started the run (NULL for a script or a historical import). A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['startedById'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['reason'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the operator supplied; cleared to an empty string on runs that operator started.',
        },
        {
          fields: [
            'id',
            'provider',
            'release',
            'kind',
            'townIds',
            'status',
            'blockedReason',
            'createdAt',
            'startedAt',
            'heartbeatAt',
            'finishedAt',
            'updatedAt',
            'observedCount',
            'acceptedCount',
            'rejectedCount',
            'budgetReservedCents',
            'budgetUsedCents',
            'lastError',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'What a run was aimed at, how far it got and what it spent: kept as the acquisition audit record.',
        },
      ],
    },
    {
      table: 'directory_acquisition_run_event',
      entity: 'DirectoryAcquisitionRunEvent',
      subject: 'profile',
      rule: 'actorId is the operator profile that cancelled, resumed or retried a run. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['reason'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the operator supplied; cleared to an empty string on rows that operator authored.',
        },
        {
          fields: [
            'id',
            'runId',
            'action',
            'unitKey',
            'statusBefore',
            'statusAfter',
            'ofEventId',
            'createdAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Which run moved, how and when: the audit trail kept after the actor is erased.',
        },
      ],
    },
    {
      table: 'directory_acquisition_town_request',
      entity: 'DirectoryAcquisitionTownRequest',
      subject: 'profile',
      rule: 'actorId is the operator profile that asked for a town to be acquired now. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['reason'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the operator supplied; cleared to an empty string on requests that operator made.',
        },
        {
          fields: [
            'id',
            'provider',
            'communityId',
            'requestedAt',
            'consumedAt',
            'runId',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Which town was asked for, when, and which run served it: kept as the audit trail after the actor is erased.',
        },
      ],
    },
    {
      table: 'directory_operating_control',
      entity: 'DirectoryOperatingControl',
      subject: 'profile',
      rule: 'updatedBy is the operator profile that last changed a pause switch. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['updatedBy'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['key', 'paused', 'reason', 'version', 'updatedAt'],
          class: 'operational',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Whether a worker is paused and why. A paused switch must keep its reason, so it is not cleared when the operator is erased.',
        },
      ],
    },
    {
      table: 'directory_operating_control_event',
      entity: 'DirectoryOperatingControlEvent',
      subject: 'profile',
      rule: 'actorId is the operator profile that paused or resumed a switch. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['actorId'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['reason'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the operator supplied; cleared on events that operator authored.',
        },
        {
          fields: ['id', 'key', 'paused', 'previousVersion', 'at'],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Which switch moved, to what, and when: the audit trail kept after the actor is erased.',
        },
      ],
    },
    {
      table: 'directory_listing_report',
      entity: 'DirectoryListingReport',
      subject: 'profile',
      rule: 'decidedById is the reviewer profile that moved the report. The reporter is anonymous: no account or profile id is stored, and the contact email exists only as a keyed hash that is cleared when the report closes and after the retention window. A match on the account or a legacy identifier is ambiguous and blocks.',
      columns: [
        {
          fields: ['decidedById'],
          class: 'identity',
          domain: 'profile',
          deletion: 'null-when-domain-matches',
          export: 'exclude',
        },
        {
          fields: ['decisionNote'],
          class: 'actor-input',
          deletion: 'clear',
          export: 'exclude',
          note: 'Free text the deciding reviewer supplied; cleared on rows that reviewer decided.',
        },
        {
          fields: ['note', 'contactEmailHash', 'receiptTokenHash'],
          class: 'operational',
          deletion: 'preserve',
          export: 'exclude',
          note: 'Anonymous reporter input; no identity links it to an account. contactEmailHash is cleared on close and by the retention purge.',
        },
        {
          fields: [
            'id',
            'communityId',
            'listingId',
            'listingName',
            'reasonCode',
            'status',
            'priority',
            'suppressionId',
            'decidedAt',
            'createdAt',
            'updatedAt',
          ],
          class: 'history',
          deletion: 'preserve',
          export: 'exclude',
        },
      ],
    },
    none(
      'directory_address_review_candidate',
      'DirectoryAddressReviewCandidate',
      [
        'id',
        'communityId',
        'scanId',
        'sourceFileRowNumber',
        'name',
        'category',
        'point',
        'addresses',
        'websites',
        'phones',
        'rights',
        'risk',
        'geocode',
        'officialEvidence',
        'verdict',
        'reasons',
        'checks',
        'policyVersion',
        'status',
        'createdAt',
        'updatedAt',
      ],
      'Imported business listing data and automated checks; no account or profile identifier.',
      'source-data'
    ),
    none(
      'directory_listing_identity',
      'DirectoryListingIdentity',
      ['id', 'communityId', 'scanId', 'sourceFileRowNumber'],
      'Listing identity derived from the import source, not from an account.',
      'source-data'
    ),
    none(
      'directory_overture_source_key',
      'DirectoryOvertureSourceKey',
      ['scanId', 'sourceFileRowNumber', 'upstreamKeyHash', 'keyVersion'],
      'Keyed hash of an upstream source id; no account or profile identifier, and never readable by a request path.',
      'source-data'
    ),
    none(
      'directory_provider_status',
      'DirectoryProviderStatus',
      ['provider', 'status', 'detail', 'checkedAt'],
      'Last-known status of an optional provider capability; no listing, account or profile data.',
      'operational'
    ),
    none(
      'directory_geoapify_enrichment',
      'DirectoryGeoapifyEnrichment',
      ['scanId', 'sourceFileRowNumber', 'details', 'fetchedAt', 'expiresAt'],
      'Private provider-derived opening hours and contact for a staged listing; never public, deleted by the retention scheduler, no account or profile identifier.',
      'source-data'
    ),
    none(
      'directory_business',
      'DirectoryBusiness',
      [
        'id',
        'communityId',
        'state',
        'successorId',
        'stateCause',
        'createdAt',
        'retiredAt',
      ],
      'Canonical business identity within a town; no listing content and no account or profile identifier.',
      'source-data'
    ),
    none(
      'directory_business_assertion',
      'DirectoryBusinessAssertion',
      [
        'id',
        'businessId',
        'communityId',
        'scanId',
        'sourceFileRowNumber',
        'policyId',
        'evidence',
        'confidence',
        'upstreamKeyHash',
        'nameHash',
        'state',
        'predecessorAssertionId',
        'createdAt',
      ],
      'Binds an imported row to a business with keyed hashes and identifiers only.',
      'source-data'
    ),
    none(
      'directory_business_event',
      'DirectoryBusinessEvent',
      [
        'id',
        'businessId',
        'kind',
        'cause',
        'scanId',
        'sourceFileRowNumber',
        'otherBusinessId',
        'decisionId',
        'createdAt',
      ],
      'Append-only identity transitions; carries no actor column.',
      'source-data'
    ),
    none(
      'directory_business_carry_state',
      'DirectoryBusinessCarryState',
      [
        'communityId',
        'fromPolicyId',
        'toPolicyId',
        'planDigest',
        'state',
        'cursorScanId',
        'cursorRow',
        'updatedAt',
      ],
      'Operator progress of a carry-forward between two policies.'
    ),
    none(
      'directory_business_link_carry',
      'DirectoryBusinessLinkCarry',
      [
        'id',
        'requestId',
        'businessId',
        'fromListingId',
        'toListingId',
        'state',
        'createdAt',
        'updatedAt',
      ],
      "A proposed move of an approved link to a business's new listing identity: identifiers and a state only. Erasing the owner closes their rows so a later carry cannot restore the link.",
      'source-data'
    ),
    none(
      'directory_overture_private_row',
      'DirectoryOverturePrivateRow',
      ['scanId', 'sourceFileRowNumber', 'regionId', 'listing'],
      'Imported listing and its reviewed fields; the reviewed object carries no actor identifier.',
      'source-data'
    ),
    none(
      'directory_reviewed_binding',
      'DirectoryReviewedBinding',
      [
        'id',
        'candidateId',
        'decisionId',
        'communityId',
        'scanId',
        'sourceFileRowNumber',
        'livePolicyId',
        'provenance',
        'stageInstallationId',
        'stageScanId',
        'stageSourceFileRowNumber',
        'stagePolicyId',
        'displayPolicyReleaseId',
        'displayPolicyHash',
        'stageContentHash',
        'reviewedHash',
        'fieldHashes',
        'assignmentChangeToken',
        'state',
        'stateCause',
        'verifiedAt',
        'verifiedUntil',
        'suspendedAt',
        'retiredAt',
        'createdAt',
      ],
      'Source binding of a publication: identifiers and keyed hashes only, no account, profile or reviewer identifier. Human actions are reached through the decision row.',
      'source-data'
    ),
    none(
      'directory_reviewed_binding_event',
      'DirectoryReviewedBindingEvent',
      [
        'id',
        'bindingId',
        'kind',
        'cause',
        'observedStageHash',
        'runId',
        'decisionId',
        'createdAt',
      ],
      'Append-only binding transitions; no actor column, so nothing to erase.',
      'source-data'
    ),
    none(
      'directory_reviewed_spatial',
      'DirectoryReviewedSpatial',
      [
        'scanId',
        'sourceFileRowNumber',
        'bindingId',
        'communityId',
        'point',
        'listingDigest',
        'validatorVersion',
        'createdAt',
      ],
      'Candidate index of source keys, a content digest and a public business point; no account, profile or reviewer identifier.',
      'source-data'
    ),
    none(
      'directory_reviewed_spatial_state',
      'DirectoryReviewedSpatialState',
      [
        'id',
        'validatorVersion',
        'rebuildStartedAt',
        'rebuildCompletedAt',
        'reconciledAt',
        'missing',
        'stale',
        'orphaned',
      ],
      'Singleton rebuild and drift counters; no personal data.',
      'source-data'
    ),
    none(
      'directory_overture_private_checkpoint',
      'DirectoryOverturePrivateCheckpoint',
      ['scanId', 'sourceFileRowNumber'],
      'Import progress.'
    ),
    none(
      'directory_overture_private_revocation',
      'DirectoryOverturePrivateRevocation',
      ['scanId'],
      'Scan withdrawal.'
    ),
    none(
      'directory_overture_private_scan_lock',
      'DirectoryOverturePrivateScanLock',
      ['scanId'],
      'Scan serialization.'
    ),
    none(
      'directory_overture_private_row_revocation',
      'DirectoryOverturePrivateRowRevocation',
      ['scanId', 'sourceFileRowNumber'],
      'Source row withdrawal.'
    ),
    none(
      'directory_overture_private_completion',
      'DirectoryOverturePrivateCompletion',
      ['scanId'],
      'Scan completion marker.'
    ),
    none(
      'directory_town_scan_target',
      'DirectoryTownScanTarget',
      [
        'communityId',
        'scanId',
        'targetedAt',
        'completedAt',
        'rowCount',
        'provenance',
        'geometryVersion',
      ],
      'Town scan target record.'
    ),
    none(
      'directory_town_scan_retirement',
      'DirectoryTownScanRetirement',
      ['communityId', 'scanId', 'reason', 'actor', 'rowsRevoked', 'retiredAt'],
      'Operator/system audit of a town scan taken out of service; actor is a fixed operator or system label, never an account.'
    ),
    none(
      'directory_overture_source_evidence',
      'DirectoryOvertureSourceEvidence',
      [
        'scanId',
        'evidenceVersion',
        'kind',
        'releaseId',
        'artifactUrl',
        'artifactEtag',
        'artifactBytes',
        'upstreamLastModified',
        'observedAt',
        'recordedAt',
        'recorder',
        'inventorySha256',
        'evidenceSha256',
      ],
      'Upstream source release evidence; holds no personal data.'
    ),
    none(
      'directory_overture_private_policy',
      'DirectoryOverturePrivatePolicy',
      ['policyId', 'revoked'],
      'Display policy state.'
    ),
    none(
      'directory_overture_private_membership',
      'DirectoryOverturePrivateMembership',
      ['scanId', 'policyId'],
      'Scan to policy membership.'
    ),
    none(
      'directory_installation',
      'DirectoryInstallation',
      ['id', 'recoveryEpoch', 'createdAt'],
      'Installation identity.'
    ),
    none(
      'directory_town',
      'DirectoryTown',
      [
        'communityId',
        'name',
        'slug',
        'administrativeArea',
        'eligible',
        'geometryStatus',
        'geometryVersion',
        'registeredAt',
      ],
      'Town communities owned by Social; a town is not an account.'
    ),
    none(
      'directory_town_geometry',
      'DirectoryTownGeometry',
      [
        'communityId',
        'version',
        'boundary',
        'source',
        'vintage',
        'rights',
        'createdAt',
      ],
      'Town boundary geometry.'
    ),
    none(
      'directory_boundary_auto_attempt',
      'DirectoryBoundaryAutoAttempt',
      [
        'communityId',
        'status',
        'reason',
        'changeToken',
        'requestId',
        'candidates',
        'attempts',
        'attemptedAt',
      ],
      'Automatic Census boundary ledger: per-town outcome and review reason, no actor.'
    ),
    none(
      'directory_boundary_candidate',
      'DirectoryBoundaryCandidate',
      [
        'communityId',
        'sourceEpoch',
        'activationId',
        'socialGeneration',
        'changeToken',
        'geoid',
        'layer',
        'vintage',
        'stateFips',
        'archiveSha256',
        'geographyHash',
      ],
      'Census boundary candidate.'
    ),
    none(
      'directory_reviewed_geometry',
      'DirectoryReviewedGeometry',
      [
        'communityId',
        'requestId',
        'version',
        'changeToken',
        'geographyHash',
        'geometryHash',
        'recoveryEpoch',
        'directoryGeneration',
      ],
      'Binding to a boundary decision by request id; the reviewer is recorded only on the decision.'
    ),
    none(
      'directory_provider_budget_attempt',
      'DirectoryProviderBudgetAttempt',
      [
        'attemptId',
        'period',
        'provider',
        'operation',
        'reservedCents',
        'createdAt',
      ],
      'Provider budget reservations.'
    ),
    none(
      'directory_anonymous_overture_attempt',
      'DirectoryAnonymousOvertureAttempt',
      ['attemptId', 'period', 'policyId', 'assetSha256', 'method', 'createdAt'],
      'Anonymous source read replay fence.'
    ),
    none(
      'directory_receipt_slot',
      'DirectoryReceiptSlot',
      ['id'],
      'Receipt capacity slot.'
    ),
    none(
      'directory_reconciliation_receipt',
      'DirectoryReconciliationReceipt',
      [
        'eventId',
        'communityId',
        'eventNonce',
        'sourceEpoch',
        'recoveryEpoch',
        'slotId',
        'appliedAt',
      ],
      'Social community reconciliation receipts.'
    ),
    none(
      'directory_provider_work',
      'DirectoryProviderWork',
      ['communityId', 'status', 'updatedAt'],
      'Provider work state per town.'
    ),
    none(
      'directory_census_progress',
      'DirectoryCensusProgress',
      [
        'id',
        'phase',
        'protocol',
        'registerRequest',
        'cursor',
        'sourceEpoch',
        'recoveryEpoch',
        'owner',
        'activationId',
        'socialGeneration',
        'directoryGeneration',
        'enabledPayload',
        'updatedAt',
      ],
      'Census traversal state; owner is a runtime instance identity, not an account.'
    ),
    none(
      'account_deletion_write_fence',
      'AccountDeletionWriteFenceEntity',
      ['key', 'kind', 'operationId', 'installedAt'],
      'Shared deletion write fence: SHA-256 identity hashes only, retained after erase so the identity stays refused.'
    ),
  ],
};
export const DIRECTORY_ACCOUNT_LIFECYCLE_INVENTORY: DirectoryLifecycleInventory =
  Object.freeze(inventory);

type EntityShape = {
  name: string;
  tableName: string;
  columns: ReadonlyArray<{ databaseName: string }>;
};

function tableErrors(
  label: string,
  expected: readonly string[],
  actual: readonly string[]
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const field of expected) {
    if (seen.has(field)) errors.push(`${label}.${field} classified twice`);
    seen.add(field);
    if (!actual.includes(field))
      errors.push(`${label}.${field} is not a column`);
  }
  for (const field of actual)
    if (!seen.has(field)) errors.push(`${label}.${field} is unclassified`);
  return errors;
}

const fieldsOf = (table: DirectoryTableDisposition) =>
  table.columns.flatMap((group) => [...group.fields]);

/** Entity metadata and inventory must describe exactly the same tables and columns. */
export function validateDirectoryDispositions(
  entities: readonly EntityShape[],
  inventory: DirectoryLifecycleInventory
): string[] {
  const errors: string[] = [];
  const byTable = new Map<string, DirectoryTableDisposition>();
  for (const table of inventory.tables) {
    if (byTable.has(table.table)) errors.push(`${table.table} listed twice`);
    byTable.set(table.table, table);
    const identities = table.columns.filter((g) => g.class === 'identity');
    // A table with no identifier of its own still has a subject when its rows follow an owned parent.
    const reached = table.columns.some((g) =>
      g.deletion.endsWith('-when-owned')
    );
    if ((table.subject === 'none') !== (identities.length === 0 && !reached))
      errors.push(`${table.table} subject does not match its identity columns`);
    if (identities.some((g) => !g.domain || g.export !== 'exclude'))
      errors.push(
        `${table.table} identity column needs a domain and is never exported`
      );
  }
  for (const entity of entities) {
    const table = byTable.get(entity.tableName);
    if (!table) {
      errors.push(`${entity.tableName} is unclassified`);
      continue;
    }
    if (table.entity !== entity.name)
      errors.push(`${entity.tableName} entity name mismatch`);
    errors.push(
      ...tableErrors(
        entity.tableName,
        fieldsOf(table),
        entity.columns.map((column) => column.databaseName)
      )
    );
  }
  const known = new Set(entities.map((entity) => entity.tableName));
  for (const table of byTable.keys())
    if (!known.has(table)) errors.push(`${table} has no entity`);
  return errors;
}

/** Fails on any base table or column the inventory does not classify. */
export function validateDirectoryPhysicalCatalog(
  inventory: DirectoryLifecycleInventory,
  physical: unknown
): string[] {
  if (
    !Array.isArray(physical) ||
    physical.some(
      (t) =>
        !t ||
        typeof t.table !== 'string' ||
        !Array.isArray(t.columns) ||
        t.columns.some((c: unknown) => typeof c !== 'string')
    )
  )
    return ['invalid physical catalog'];
  const errors: string[] = [];
  const catalog = new Map<string, string[]>(
    physical.map((t) => [t.table as string, t.columns as string[]])
  );
  for (const table of inventory.tables) {
    const columns = catalog.get(table.table);
    if (!columns) errors.push(`${table.table} is missing`);
    else errors.push(...tableErrors(table.table, fieldsOf(table), columns));
  }
  const known = new Set([
    ...inventory.tables.map((t) => t.table),
    ...inventory.nonEntityTables,
  ]);
  for (const table of catalog.keys())
    if (!known.has(table)) errors.push(`${table} is unclassified`);
  return errors;
}
