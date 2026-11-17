# S0 source file ledger — 2026-11-07

Read-only inventory of production TypeScript files in the named POC areas. Source HEAD `9948a2371fee6051c49932bfae7dcf6e732efc0a` has uncommitted changes; the selected 165-file snapshot matches its recorded hashes. Listed class/interface/function names are navigation aids, not proof of active wiring, target parity, approval or source rights. The generic target disposition is a starting point and remaining untraced behavior stays open. Tests, generated artifacts and source data are not enumerated.

## API (35 files)

Disposition: S1/S5/S7/S9: see route disposition; verify runtime and authorization.

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `apps/directory-api/src/app/app.controller.ts` | AppController | Directory / gateway · S1 health and S5 public root |
| `apps/directory-api/src/app/app.module.ts` | AppModule | Directory service composition · S1/S9 |
| `apps/directory-api/src/app/app.service.ts` | AppService | Directory service root behavior · S1/S5 |
| `apps/directory-api/src/app/businesses/businesses.controller.ts` | BusinessesController | Directory / gateway · S5 open |
| `apps/directory-api/src/app/businesses/businesses.module.ts` | BusinessesModule | Directory / gateway · S5 open |
| `apps/directory-api/src/app/businesses/businesses.service.ts` | BusinessesService | Directory / gateway · S5 open |
| `apps/directory-api/src/app/discovery/discovery.controller.ts` | DiscoveryController | Directory worker / Directory · S4 open |
| `apps/directory-api/src/app/discovery/discovery.module.ts` | DiscoveryModule | Directory worker / Directory · S4 open |
| `apps/directory-api/src/app/discovery/discovery.service.ts` | DiscoveryService | Directory worker / Directory · S4 open |
| `apps/directory-api/src/app/discovery/overture-full-scan-manifest.ts` | OVERTURE_FULL_SCAN_ARTIFACT, OVERTURE_FULL_SCAN_MANIFEST, OVERTURE_FULL_SCAN_SEATS, OVERTURE_FULL_SCAN_CATEGORIES, OVERTURE_FULL_SCAN_PLACE_TYPES, OvertureFullScanManifest | Directory worker · S4a open |
| `apps/directory-api/src/app/documentation.module.ts` | DocumentationModule | Gateway API documentation · S5/S9 |
| `apps/directory-api/src/app/dto/operator.dto.ts` | DiscoveryRunRequestDto, RunIdempotencyDto, ReviewDecisionDto, ReviewUndoDto, ExportFilterDto, ExportRequestDto | Directory contracts and owner console · S4/S7/S8 |
| `apps/directory-api/src/app/dto/public.dto.ts` | PublicBusinessQueryDto, PublicPointLocationDto, PublicApproximateLocationDto, PublicFieldProvenanceDto, PublicFieldPolicyDto, PublicFieldResponseDto | Shared Directory public contracts · S5 |
| `apps/directory-api/src/app/exports/exports.controller.ts` | ExportsController | Directory / owner console · S8 open |
| `apps/directory-api/src/app/exports/exports.module.ts` | ExportsModule | Directory / owner console · S8 open |
| `apps/directory-api/src/app/exports/exports.service.ts` | ExportsService | Directory / owner console · S8 open |
| `apps/directory-api/src/app/health/health.controller.ts` | HealthController | Directory / gateway · S9 open |
| `apps/directory-api/src/app/health/health.module.ts` | HealthModule, healthModule | Directory / gateway · S9 open |
| `apps/directory-api/src/app/health/health.service.ts` | HealthService | Directory / gateway · S9 open |
| `apps/directory-api/src/app/health/startup-readiness.ts` | StartupReadiness | Directory / gateway · S9 open |
| `apps/directory-api/src/app/listeners.ts` | PublicListenerModule, OperatorListenerModule, listenerConfiguration | Gateway-only ingress and deployment configuration · S1/S9 |
| `apps/directory-api/src/app/metrics.controller.ts` | MetricsController | Directory / gateway · S9 open |
| `apps/directory-api/src/app/operator/operator.module.ts` | OperatorModule | Gateway and owner console operator composition · S7/S8 |
| `apps/directory-api/src/app/public/public.module.ts` | PublicModule | Directory public API through gateway · S5 |
| `apps/directory-api/src/app/review/review.controller.ts` | ReviewController | Directory / owner console · S7 open |
| `apps/directory-api/src/app/review/review.module.ts` | ReviewModule | Directory / owner console · S7 open |
| `apps/directory-api/src/app/review/review.service.ts` | ReviewService | Directory / owner console · S7 open |
| `apps/directory-api/src/app/rights/overture-rights.controller.ts` | OvertureRightsController | Directory / owner console · S4a/S7 open |
| `apps/directory-api/src/app/rights/overture-rights.dto.ts` | OvertureRightsListQueryDto, OvertureTermsEvidenceDto, OvertureRightsDecisionDto, OvertureRightsEventDto, OvertureRightsCaseReasonsDto, OvertureRightsCaseDto | Directory / owner console · S4a/S7 open |
| `apps/directory-api/src/app/rights/overture-rights.module.ts` | OvertureRightsModule | Directory / owner console · S4a/S7 open |
| `apps/directory-api/src/app/rights/overture-rights.service.ts` | OvertureRightsService | Directory / owner console · S4a/S7 open |
| `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.controller.ts` | OvertureTaxonomyClassificationController | Directory / owner console · S4a/S7 open |
| `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.dto.ts` | OVERTURE_TAXONOMY_CLASSIFICATION_CATEGORIES, OVERTURE_TAXONOMY_CLASSIFICATION_PLACE_TYPES, OVERTURE_TAXONOMY_CLASSIFICATION_STATUSES, OvertureTaxonomyClassificationListQueryDto, OvertureTaxonomyClassificationDecisionDto, OvertureTaxonomyClassificationSourceDto | Directory / owner console · S4a/S7 open |
| `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.module.ts` | OvertureTaxonomyClassificationApiModule | Directory / owner console · S4a/S7 open |
| `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.service.ts` | OvertureTaxonomyClassificationService | Directory / owner console · S4a/S7 open |

## Worker (21 files)

Disposition: S3/S4/S7/S9: trace bindings and classify fixture vs real.

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `apps/directory-worker/src/app/app.controller.ts` | AppController | Directory worker · S3/S4 review |
| `apps/directory-worker/src/app/app.module.ts` | AppModule | Directory worker · S3/S4 review |
| `apps/directory-worker/src/app/app.service.ts` | AppService | Directory worker · S3/S4 review |
| `apps/directory-worker/src/app/health/worker-health.service.ts` | WorkerHealthService | Directory / gateway · S9 open |
| `apps/directory-worker/src/app/queues/dedupe.processor.ts` | DedupeProcessor | Directory worker · S3/S4 review |
| `apps/directory-worker/src/app/queues/discovery-plan.processor.ts` | DiscoveryPlanCreatedJob, DiscoveryPlanProcessor | Directory worker / Directory · S4 open |
| `apps/directory-worker/src/app/queues/export.processor.ts` | ExportProcessor | Directory / owner console · S8 open |
| `apps/directory-worker/src/app/queues/fixture-provider-fetch.handler.ts` | FixtureProviderFetchHandler | Directory worker / Directory · S4 open |
| `apps/directory-worker/src/app/queues/fixture-provider-registry.ts` | FixtureProviderRegistry | Directory worker / Directory · S4 open |
| `apps/directory-worker/src/app/queues/geoapify-dev-policy.ts` | GeoapifyDevPolicyManifest, readGeoapifyDevPolicyManifest, geoapifyDevLiveRequested, assertGeoapifyDevLiveEnabled, geoapifyDevSearchGeometry, assertGeoapifyDevScope | Directory worker · S4b open |
| `apps/directory-worker/src/app/queues/geoapify-dev-retention.scheduler.ts` | GeoapifyDevRetentionScheduler | Directory worker · S4b open |
| `apps/directory-worker/src/app/queues/normalize.processor.ts` | HandoffJob, NormalizeProcessor | Directory worker · S3/S4 review |
| `apps/directory-worker/src/app/queues/outbox-relay.processor.ts` | OutboxRelayProcessor | Directory worker / Directory · S3/S9 open |
| `apps/directory-worker/src/app/queues/outbox-relay.scheduler.ts` | module / re-exports | Directory worker / Directory · S3/S9 open |
| `apps/directory-worker/src/app/queues/overture-full-release-provider-fetch.handler.ts` | validateOvertureWorkerManifest, OvertureFullReleaseProviderFetchHandler | Directory worker · S4a open |
| `apps/directory-worker/src/app/queues/overture-full-release-reader.ts` | OvertureFullReleaseReaderOptions, OvertureFullReleaseReader | Directory worker · S4a open |
| `apps/directory-worker/src/app/queues/overture-sample-provider-fetch.handler.ts` | privateOvertureRecord, OvertureSampleProviderFetchHandler | Directory worker · S4a open |
| `apps/directory-worker/src/app/queues/provider-fetch.processor.ts` | ProviderFetchJob, ProviderFetchHandler, ProviderFetchProcessor | Directory worker / Directory · S4 open |
| `apps/directory-worker/src/app/queues/search-index.processor.ts` | SearchIndexProcessor | Directory worker · S3/S4 review |
| `apps/directory-worker/src/app/queues/worker-outbox-relay.handler.ts` | WorkerOutboxRelayHandler | Directory worker / Directory · S3/S9 open |
| `apps/directory-worker/src/app/worker.module.ts` | WorkerModule | Directory worker · S3/S4 review |

## Providers (22 files)

Disposition: S4/S10: review each source, field and operation before use.

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/providers/src/lib/alltheplaces/alltheplaces-staging.ts` | AllThePlacesArchiveMember, AllThePlacesArchiveReader, StagedBatch, StagedSnapshot, SnapshotQuarantineReason, SnapshotQuarantineError | Directory worker · S4c open |
| `libs/providers/src/lib/alltheplaces/alltheplaces.adapter.ts` | AllThePlacesScanInput, AllThePlacesAdapter, createAllThePlacesAdapter | Directory worker · S4c open |
| `libs/providers/src/lib/crawl-safety.ts` | CrawlSafetyDenialReason, CrawlAllowed, CrawlDenied, CrawlSafetyResult, SourceAllowlist, CrawlSourceRegistration | Directory worker · S10 open: live web source not approved |
| `libs/providers/src/lib/exhaustion-proof.ts` | PageCheckpoint, BulkCheckpoint, ProviderCheckpoint, ExhaustionProofInput, ExhaustionProofRejectionReason, ExhaustionProofRejectedError | Directory worker / Directory · S4 open |
| `libs/providers/src/lib/fixture-adapter-types.ts` | TurfModule, ProviderPolicyMetadata, ProviderRecord, ProviderRecordInput, canonicalIdentity, sha256 | Directory worker / Directory · S4 open |
| `libs/providers/src/lib/geoapify/geoapify-places.adapter.ts` | GeoapifyHttpResponse, GeoapifyHttpTransport, GeoapifyPageInput, GeoapifyPlacesAdapter, createGeoapifyPlacesAdapter | Directory worker · S4b open |
| `libs/providers/src/lib/overture/overture-address.ts` | OvertureAddressComponents, formatOvertureAddress | Directory worker · S4a open |
| `libs/providers/src/lib/overture/overture-bulk-reader.ts` | DuckDbModule, OverturePartition, OvertureRow, OvertureBulkDatasetReader, OverturePartitionMetadata, OvertureBatch | Directory worker · S4a open |
| `libs/providers/src/lib/overture/overture-checkpoint.ts` | OvertureScanCheckpoint, advanceOvertureScanCheckpoint, overtureResumeRowGroups | Directory worker · S4a open |
| `libs/providers/src/lib/overture/overture-official-row.ts` | ParsedOvertureOfficialRow, parseOvertureOfficialRow | Directory worker · S4a open |
| `libs/providers/src/lib/overture/overture-places.adapter.ts` | OvertureScanInput, createOvertureSchemaValidator, OverturePlacesAdapter, createOverturePlacesAdapter | Directory worker · S4a open |
| `libs/providers/src/lib/overture/overture-regional-policy.ts` | OVERTURE_V2_SCAN_CATEGORY_IDS, OVERTURE_REGIONAL_SCAN_POLICY, OVERTURE_V3_REGIONAL_SCAN_POLICY | Directory worker · S4a open |
| `libs/providers/src/lib/overture/overture-release-scan.ts` | OvertureSourceEnvelope, OvertureRowGroupBounds, selectOvertureCandidateRowGroups | Directory worker · S4a open |
| `libs/providers/src/lib/overture/overture-rights-policy.ts` | OVERTURE_RIGHTS_POLICY_VERSION, OvertureRightsSource, OVERTURE_RIGHTS_FIELDS, OvertureRightsResolutionOverlay, overtureRightsSourceKey, lookupOvertureTerms | Directory / owner console · S4a/S7 open |
| `libs/providers/src/lib/overture/overture-sample-policy.ts` | OVERTURE_SAMPLE_SOURCE_POLICY, OvertureSampleSourcePolicy, OvertureSampleScope, assertOvertureSampleIngestionEnabled | Directory worker · S4a open |
| `libs/providers/src/lib/overture/overture-sample-reader.ts` | PinnedOvertureSample, OvertureRightsReviewInput, buildOvertureRightsReviewCases, verifyPinnedOvertureSampleArtifacts | Directory worker · S4a open |
| `libs/providers/src/lib/provider-adapter.ts` | AdapterTerminalReason, PageResult, PageResultInput, BulkCompletion, BulkCheckpointReference, BulkResult | Directory worker / Directory · S4 open |
| `libs/providers/src/lib/provider-policy.ts` | DEFAULT_PROVIDER_POLICIES, ProviderPolicyRegistry, createProviderPolicyRegistry, resolveProviderAvailability, policyDenial | Directory worker / Directory · S4 open |
| `libs/providers/src/lib/provider-types.ts` | ProviderFamily, ProviderPolicyDenialReason, ProviderPolicyDenied, ProviderUnconfigured, ProviderReady, ProviderAvailability | Directory worker / Directory · S4 open |
| `libs/providers/src/lib/providers.ts` | providers | Directory worker / Directory · S4 open |
| `libs/providers/src/lib/taxonomy/taxonomy-v1.ts` | TAXONOMY_V1_VERSION, TAXONOMY_CATEGORY_IDS, TaxonomyCategoryId, TaxonomyCategory, TaxonomyMapping, TaxonomyMappingResult | Directory worker / Directory · S4 open |
| `libs/providers/src/lib/web/allowlisted-public-web.adapter.ts` | PublicWebResponse, PublicWebTransport, PublicWebExtractedRecord, PublicWebExtractor, REGISTERED_ALLOWLISTED_WEB_SOURCE_ID, REGISTERED_ALLOWLISTED_WEB_REGISTRATION | Directory worker · S10 open: live web source not approved |

## Orchestration (13 files)

Disposition: S3/S4/S7/S9: verify target behavior, recovery and cost controls.

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/orchestration/src/lib/checkpoint.service.ts` | CheckpointState, checkpointState, CheckpointService | Directory worker / Directory · S3/S9 open |
| `libs/orchestration/src/lib/discovery-orchestrator.service.ts` | ProviderPlanBinding, DiscoverySafetySettings, DiscoveryPlanConfiguration, DiscoveryPlanInput, DiscoveryPlanResult, DiscoveryPlanQueues | Directory worker / Directory · S4 open |
| `libs/orchestration/src/lib/geoapify-dev-retention.service.ts` | GeoapifyDevRetentionResult, GeoapifyDevRetentionService | Directory worker · S4b open |
| `libs/orchestration/src/lib/normalization-dedupe.service.ts` | NormalizationDedupeInput, NormalizationDedupeResult, OvertureAddressCorrectionInput, OvertureAddressCorrectionResult, NormalizationDedupeService | Directory / worker · S4/S7 lineage, merge and reversible review |
| `libs/orchestration/src/lib/orchestration.ts` | DISCOVERY_QUEUES, orchestration, DiscoveryQueueName, QueueLike, deterministicJobId, providerJobKey | Directory worker · S4/S9 job identity and retry |
| `libs/orchestration/src/lib/outbox-claimer.service.ts` | OutboxClaimerService | Directory worker / Directory · S3/S9 open |
| `libs/orchestration/src/lib/outbox-publisher.service.ts` | OutboxPublisherService | Directory worker / Directory · S3/S9 open |
| `libs/orchestration/src/lib/outbox-relay-scheduler.ts` | OUTBOX_RELAY_SCHEDULER_ID, OutboxRelayScheduler | Directory worker / Directory · S3/S9 open |
| `libs/orchestration/src/lib/outbox-relay.service.ts` | OutboxRelayOptions, OutboxRelayResult, DISCOVERY_OUTBOX_EVENT_TYPES, SEARCH_OUTBOX_EVENT_TYPES, EXPORT_OUTBOX_EVENT_TYPES, RELAY_OUTBOX_EVENT_TYPES | Directory worker / Directory · S3/S9 open |
| `libs/orchestration/src/lib/provider-fetch.service.ts` | ProviderFetchRequest, ProviderFetchResult, ProviderFetchAdapter, ProviderFetchAdapters, ProviderFetchCancelledError, ProviderFetchRetryableError | Directory worker / Directory · S4 open |
| `libs/orchestration/src/lib/retry-policy.ts` | RetryClassification, RetryDecision, RetryPolicyOptions, RetryPolicy | Directory worker / Directory · S3/S9 open |
| `libs/orchestration/src/lib/safety-breaker.service.ts` | BreakerState, ProviderSafetyBreaker | Directory worker / Directory · S3/S9 open |
| `libs/orchestration/src/lib/stage-ledger.service.ts` | AcquiredStageReceipt, CompletedStageReceipt, InProgressStageReceipt, StageReceipt, StageLedger, StageLedgerRedis | Directory worker / Directory · S3/S9 open |

## Persistence (94 files)

Disposition: S2/S4/S5/S7/S8: map data ownership, lifecycle and migration.

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/persistence/src/lib/business/business-persistence.module.ts` | BusinessPersistenceModule | Directory / gateway · S5 open |
| `libs/persistence/src/lib/business/business-source-link.service.ts` | BusinessSourceLinkService | Directory / gateway · S5 open |
| `libs/persistence/src/lib/business/business-source.repository.ts` | ActiveBusinessSourceConflictError, BusinessSourceRepository | Directory / gateway · S5 open |
| `libs/persistence/src/lib/business/business-spatial.repository.ts` | BusinessSpatialRepository | Directory / gateway · S5 open |
| `libs/persistence/src/lib/business/business.repository.ts` | BusinessUpdate, AddressCorrectionBusinessSnapshot, BusinessRepository | Directory / gateway · S5 open |
| `libs/persistence/src/lib/business/field-evidence.repository.ts` | EvidencePolicyValidationError, FieldEvidenceRepository | Directory / gateway · S5 open |
| `libs/persistence/src/lib/business/geography.repository.ts` | GeographyValidationError, LocalityRepository, ServiceRegionRepository | Directory / gateway · S5 open |
| `libs/persistence/src/lib/business/index.ts` | module / re-exports | Directory / gateway · S5 open |
| `libs/persistence/src/lib/business/search.repository.ts` | SearchBusinessRow, SearchPage, SearchMapPoint, SearchMapPage, ExportRegionMetadata, ExportProviderMetadata | Directory / gateway · S5 open |
| `libs/persistence/src/lib/business/taxonomy-reclassification-plan.ts` | TaxonomyReclassificationSnapshot, TaxonomyReclassificationPlan, DIRECTORY_TAXONOMY_RECLASSIFICATION_VERSION, planTaxonomyReclassification | Directory / gateway · S5 open |
| `libs/persistence/src/lib/business/taxonomy-reclassification-protocol.ts` | TaxonomyBatchReceipt, TaxonomyBatchLog, TaxonomyPlanPayload, taxonomyPlanSha256, assertTaxonomyPlanHash, assertTaxonomyBatchCursor | Directory / gateway · S5 open |
| `libs/persistence/src/lib/discovery-persistence.module.ts` | DiscoveryPersistenceModule | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/entities/business-source.entity.ts` | BusinessSourceEntity | Directory / gateway · S5 open |
| `libs/persistence/src/lib/entities/business.entity.ts` | BusinessEntity | Directory / gateway · S5 open |
| `libs/persistence/src/lib/entities/discovery-run.entity.ts` | DiscoveryRunEntity | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/entities/exhaustion-proof.entity.ts` | ExhaustionProofEntity | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/entities/export-job.entity.ts` | ExportJobEntity | Directory / owner console · S8 open |
| `libs/persistence/src/lib/entities/fetch-attempt.entity.ts` | FetchAttemptEntity | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/entities/field-evidence.entity.ts` | FieldEvidenceEntity | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/entities/index.ts` | persistenceEntities | Directory persistence · S4/S5/S7/S8 entity registration |
| `libs/persistence/src/lib/entities/locality.entity.ts` | LocalityEntity | Social / Directory · S2 open |
| `libs/persistence/src/lib/entities/match-candidate.entity.ts` | MatchCandidateEntity | Directory / owner console · S7 open |
| `libs/persistence/src/lib/entities/merge-event.entity.ts` | MergeEventEntity | Directory / owner console · S7 open |
| `libs/persistence/src/lib/entities/outbox-event.entity.ts` | OutboxEventEntity | Directory worker / Directory · S3/S9 open |
| `libs/persistence/src/lib/entities/overture-rights-case.entity.ts` | OvertureRightsCaseEntity | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/entities/overture-rights-event.entity.ts` | OvertureRightsEventEntity | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/entities/overture-taxonomy-classification-case.entity.ts` | OvertureTaxonomyClassificationCategory, OvertureTaxonomyClassificationStatus, OvertureTaxonomyClassificationReason, OvertureTaxonomyClassificationSource, OvertureTaxonomyClassificationCaseEntity | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/entities/overture-taxonomy-classification-event.entity.ts` | OvertureTaxonomyClassificationEventEntity | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/entities/overture-taxonomy-quality-exclusion.entity.ts` | OvertureTaxonomyQualityExclusionEntity | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/entities/provider-job.entity.ts` | ProviderJobEntity | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/entities/review-decision.entity.ts` | ReviewDecisionEntity | Directory / owner console · S7 open |
| `libs/persistence/src/lib/entities/review-task.entity.ts` | ReviewTaskEntity | Directory / owner console · S7 open |
| `libs/persistence/src/lib/entities/service-region.entity.ts` | ServiceRegionEntity | Social / Directory · S2 open |
| `libs/persistence/src/lib/entities/source-observation.entity.ts` | SourceObservationEntity | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/export-outbox/canonical-json.ts` | canonicalJson, sameCanonicalJson | Directory / owner console · S8 open |
| `libs/persistence/src/lib/export-outbox/export-job.repository.ts` | ExportJobTerminalTransition, ExportJobRepository | Directory / owner console · S8 open |
| `libs/persistence/src/lib/export-outbox/export-outbox.module.ts` | ExportOutboxPersistenceModule | Directory / owner console · S8 open |
| `libs/persistence/src/lib/export-outbox/export-outbox.service.ts` | OUTBOX_RETRY_POLICY, CreateExportJobInput, ExportJobAndEvent, ProductionClaimDueOptions, ExportOutboxService | Directory / owner console · S8 open |
| `libs/persistence/src/lib/export-outbox/index.ts` | module / re-exports | Directory / owner console · S8 open |
| `libs/persistence/src/lib/export-outbox/outbox-event.repository.ts` | ClaimDueOptions, OutboxFailureOptions, OutboxTestClock, OutboxRetryPolicy, OutboxEventRepository | Directory / owner console · S8 open |
| `libs/persistence/src/lib/export-outbox/outbox.errors.ts` | OutboxEventPayloadConflictError, OutboxEventConsistencyConflictError, OutboxEventNotFoundError, OutboxLeaseConflictError, OutboxReplayConflictError, ExportJobPolicyError | Directory / owner console · S8 open |
| `libs/persistence/src/lib/idempotency/discovery-request-fingerprint.ts` | DiscoveryRequestFingerprintInput, createDiscoveryRequestFingerprint | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/idempotency/discovery-run.repository.ts` | DiscoveryRunRepository | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/idempotency/discovery-state.service.ts` | DiscoveryRunAggregateStatus, aggregateDiscoveryRunStatus, DiscoveryStateService | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/idempotency/exhaustion-proof-validation.error.ts` | ExhaustionProofValidationError | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/idempotency/exhaustion-proof.repository.ts` | ExhaustionProofRepository | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/idempotency/fetch-attempt.repository.ts` | FetchAttemptRepository | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/idempotency/idempotency-conflict.error.ts` | IdempotencyConflictError | Directory worker / Directory · S3/S9 open |
| `libs/persistence/src/lib/idempotency/index.ts` | module / re-exports | Directory worker / Directory · S3/S9 open |
| `libs/persistence/src/lib/idempotency/persistence-identity-conflict.error.ts` | PersistenceIdentityConflictError | Directory worker / Directory · S3/S9 open |
| `libs/persistence/src/lib/idempotency/provider-job.repository.ts` | ProviderJobRepository | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/idempotency/source-observation-validation.error.ts` | SourceObservationValidationError | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/idempotency/source-observation.repository.ts` | SourceObservationRepository | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/migrations/1710000000000-InitialDirectory.ts` | InitialDirectory1710000000000 | Directory · S4/S5/S7/S8 generated schema, do not replay POC migration |
| `libs/persistence/src/lib/migrations/1710000002000-DiscoveryIdempotency.ts` | DiscoveryIdempotency1710000002000 | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/migrations/1710000003000-ImmutableIngestion.ts` | ImmutableIngestion1710000003000 | Directory · S4 source/job provenance constraints |
| `libs/persistence/src/lib/migrations/1710000004000-CompletenessAndObservationAssociation.ts` | CompletenessAndObservationAssociation1710000004000 | Directory · S4/S9 ingestion completeness evidence |
| `libs/persistence/src/lib/migrations/1710000005000-BusinessPersistenceConstraints.ts` | BusinessPersistenceConstraints1710000005000 | Directory · S4/S5 business persistence uniqueness |
| `libs/persistence/src/lib/migrations/1710000006000-BusinessSourceHistoryGuards.ts` | BusinessSourceHistoryGuards1710000006000 | Directory · S4/S7 source-history integrity |
| `libs/persistence/src/lib/migrations/1710000007000-ReviewAdjudicationConstraints.ts` | ReviewAdjudicationConstraints1710000007000 | Directory / owner console · S7 open |
| `libs/persistence/src/lib/migrations/1710000008000-OutboxClaimTokenLeases.ts` | OutboxClaimTokenLeases1710000008000 | Directory worker / Directory · S3/S9 open |
| `libs/persistence/src/lib/migrations/1710000009000-ServiceRegionGenerationMetadata.ts` | ServiceRegionGenerationMetadata1710000009000 | Directory · S2/S4 region generation metadata |
| `libs/persistence/src/lib/migrations/1710000010000-NormalizationResolutionConstraints.ts` | NormalizationResolutionConstraints1710000010000 | Directory · S4/S7 normalization and match constraints |
| `libs/persistence/src/lib/migrations/1710000011000-AutomaticPendingMergeConstraint.ts` | AutomaticPendingMergeConstraint1710000011000 | Directory · S4/S7 pending merge and undo constraints |
| `libs/persistence/src/lib/migrations/1710000012000-SearchAndExportArtifacts.ts` | SearchAndExportArtifacts1710000012000 | Directory / owner console · S8 open |
| `libs/persistence/src/lib/migrations/1710000013000-GeoapifyDevRetention.ts` | GeoapifyDevRetention1710000013000 | Directory worker · S4b open |
| `libs/persistence/src/lib/migrations/1710000014000-GeoapifyOpaqueRetentionTombstones.ts` | GeoapifyOpaqueRetentionTombstones1710000014000 | Directory worker · S4b open |
| `libs/persistence/src/lib/migrations/1710000015000-ReversibleReviewDecisionEvents.ts` | ReversibleReviewDecisionEvents1710000015000 | Directory / owner console · S7 open |
| `libs/persistence/src/lib/migrations/1710000016000-OvertureRightsReview.ts` | OvertureRightsReview1710000016000 | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/migrations/1710000017000-OvertureTaxonomyQualityExclusions.ts` | OvertureTaxonomyQualityExclusion1710000017000 | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/migrations/1710000018000-OvertureTaxonomyClassificationCases.ts` | OvertureTaxonomyClassificationCases1710000018000 | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/migrations/1710000019000-DirectoryTaxonomyClassificationOptions.ts` | DirectoryTaxonomyClassificationOptions1710000019000 | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/migrations/1710000020000-DirectoryBusinessTaxonomyFacet.ts` | DirectoryBusinessTaxonomyFacet1710000020000 | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/migrations/1710000021000-TaxonomyEvidenceReplayIdentity.ts` | TaxonomyEvidenceReplayIdentity1710000021000 | Directory worker / Directory · S4 open |
| `libs/persistence/src/lib/migrations/1710000022000-DirectoryPlaceTypeEvidenceLookup.ts` | DirectoryPlaceTypeEvidenceLookup1710000022000 | Directory · S4/S7 classification evidence lookup |
| `libs/persistence/src/lib/persistence.module.ts` | PersistenceModuleOptions, createPersistenceDataSourceOptions, PersistenceModule | Directory · S1/S9 configuration and persistence wiring |
| `libs/persistence/src/lib/persistence.ts` | persistence | Directory · S1/S9 persistence entrypoint disposition |
| `libs/persistence/src/lib/ports/index.ts` | module / re-exports | Directory contracts · S4/S5/S7/S8 repository interfaces |
| `libs/persistence/src/lib/ports/transaction-runner.port.ts` | TransactionCallback, TransactionRunnerPort | Directory worker / Directory · S3/S9 open |
| `libs/persistence/src/lib/quality/overture-taxonomy-classification.module.ts` | OvertureTaxonomyClassificationModule | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/quality/overture-taxonomy-classification.repository.ts` | OvertureTaxonomyClassificationCaseInput, OvertureTaxonomyClassificationDecisionInput, OvertureTaxonomyClassificationListOptions, OvertureTaxonomyClassificationRepository | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/quality/overture-taxonomy-quality.repository.ts` | OvertureTaxonomyQualityReason, OvertureTaxonomyQualityExclusionInput, OvertureTaxonomyQualityRepository | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/review/index.ts` | module / re-exports | Directory / owner console · S7 open |
| `libs/persistence/src/lib/review/match-candidate.repository.ts` | MatchCandidateRepository | Directory / owner console · S7 open |
| `libs/persistence/src/lib/review/merge-event.repository.ts` | MergeEventRepository | Directory / owner console · S7 open |
| `libs/persistence/src/lib/review/overture-rights-case.repository.ts` | OvertureRightsCaseIdentity, OvertureRightsCaseRepository | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/review/overture-rights-review.module.ts` | OvertureRightsReviewModule | Directory / owner console · S4a/S7 open |
| `libs/persistence/src/lib/review/review-adjudication.service.ts` | DecisionOutcome, DecisionPayload, ReviewDecisionInput, ReviewUndoInput, AutomaticPendingMergeInput, AutomaticOverturePublicationInput | Directory / owner console · S7 open |
| `libs/persistence/src/lib/review/review-decision.repository.ts` | ReviewDecisionRepository | Directory / owner console · S7 open |
| `libs/persistence/src/lib/review/review-persistence.module.ts` | ReviewPersistenceModule | Directory / owner console · S7 open |
| `libs/persistence/src/lib/review/review-task.repository.ts` | ReviewTaskRepository | Directory / owner console · S7 open |
| `libs/persistence/src/lib/tokens.ts` | TRANSACTION_RUNNER | Directory · S1/S9 transaction injection boundary |
| `libs/persistence/src/lib/transaction/index.ts` | module / re-exports | Directory worker / Directory · S3/S9 open |
| `libs/persistence/src/lib/transaction/transaction-runner.service.ts` | TransactionRunnerService | Directory worker / Directory · S3/S9 open |

## Additional shared POC libraries

The following inventory covers `src` only, excluding tests and dependency folders. Assignments are provisional; file presence does not establish parity.

### Configuration (2 files)

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/config/src/index.ts` | module / re-exports | Directory / worker · S4/S9 configuration review |
| `libs/config/src/lib/configuration.ts` | ProviderName, ProviderKind, ProviderStatus, ListenerConfiguration, ProviderConfiguration, DirectoryConfiguration | Directory / worker · S4/S9 configuration review |

### Contracts (15 files)

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/contracts/src/generated/openapi.ts` | paths, webhooks, components, $defs, operations | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/index.ts` | module / re-exports | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/contracts.ts` | module / re-exports | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/index.ts` | module / re-exports | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/business.contracts.ts` | AdultClassification, FieldValue, SourceObservation, NormalizedBusinessFields, PublicBusinessProjection, PublicBusinessField | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/completeness.contracts.ts` | RetrievalCompletenessStatus, ExhaustionTerminalReason, RetrievalTerminalReason, ExhaustionScope, ResultWindowEvidence, ExhaustionProof | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/discovery.contracts.ts` | CONTRACT_VERSION, ContractVersion, OneToFour, toOneToFour, LocalityInput, DerivedServiceRegion | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/export.contracts.ts` | ExportFormat, ExportFilterRequest, ExportRequest, PublicExportProjection, ExportSourceMapping, ExportRegionMetadata | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/index.ts` | module / re-exports | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/provenance.contracts.ts` | FieldVisibility, RETENTION_POLICIES, RetentionPolicy, PublicRetentionPolicy, FieldPolicy, PublicReadableFieldPolicy | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/provider-policy.contracts.ts` | ProviderId, ProviderAccessMode, ProviderPolicy | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/review.contracts.ts` | MergeReviewActionPayload, SplitReviewActionPayload, ReviewActionPayload, ReviewDecision, ReviewUndoMetadata, ReviewTask | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/search.contracts.ts` | DEFAULT_ADULT_OPT_IN, TypoToleranceIntent, SearchRequest, SearchResultPage | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/taxonomy.contracts.ts` | DIRECTORY_TAXONOMY_CATEGORIES, DirectoryTaxonomyCategoryId, DIRECTORY_TAXONOMY_PLACE_TYPES, DirectoryTaxonomyPlaceTypeId, DIRECTORY_TAXONOMY_CATEGORY_QUERY_IDS, DIRECTORY_TAXONOMY_PUBLIC_CATEGORIES | Shared contracts / gateway · S2/S5/S7 review |
| `libs/contracts/src/lib/v1/telemetry.contracts.ts` | DurableTelemetryEnvelope, sanitizeDurableTelemetry | Shared contracts / gateway · S2/S5/S7 review |

### Directory data access (7 files)

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/directory-data-access/src/index.ts` | module / re-exports | Shared data access / gateway · S5 review |
| `libs/directory-data-access/src/lib/directory-api.client.ts` | PublicBusiness, PublicBusinessPage, PublicMapPoint, PublicMapPointPage, Region, DiscoveryRequest | Shared data access / gateway · S5 review |
| `libs/directory-data-access/src/lib/directory-data-access/directory-data-access.ts` | DirectoryDataAccess | Shared data access / gateway · S5 review |
| `libs/directory-data-access/src/lib/directory-store.ts` | LoadState, DirectoryStore | Shared data access / gateway · S5 review |
| `libs/directory-data-access/src/lib/error-normalizer.ts` | DirectoryErrorContext, errorStatus, safeBackendErrorReason, normalizeDirectoryError | Shared data access / gateway · S5 review |
| `libs/directory-data-access/src/lib/idempotency-keys.ts` | newClientRequestId, StableIdempotencyKeys | Shared data access / gateway · S5 review |
| `libs/directory-data-access/src/test-setup.ts` | module / re-exports | Shared data access / gateway · S5 review |

### Directory UI (18 files)

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/directory-ui/src/index.ts` | module / re-exports | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/detail/business-detail.component.ts` | BusinessDetailComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/directory-ui/directory-ui.ts` | DirectoryUi | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/evidence/evidence-panel.component.ts` | EvidencePanelComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/export/export-controls.component.ts` | ExportControlsComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/map/directory-map.component.ts` | DirectoryMapComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/map/directory-map.provider.ts` | DirectoryMapCoordinate, DIRECTORY_MAP_MAX_FEATURES, DIRECTORY_MAP_MAX_COORDINATES, DIRECTORY_MAP_MAX_RING_POINTS, DIRECTORY_MAP_MAX_RINGS, DIRECTORY_MAP_GEOMETRY_DIAGNOSTICS | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/map/maplibre-directory-map.provider.ts` | MapLibreModuleLoader, DIRECTORY_MAPLIBRE_LOADER, normalizeMapLibreModule, MapLibreDirectoryMapProvider | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/models.ts` | BusinessResultView, AttributionCreditView, BusinessDetailView, RegionCardView, SearchQueryView, RunProgressView | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/regions/region-list.component.ts` | RegionListComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/results/business-results.component.ts` | BusinessResultsComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/review/merge-review.component.ts` | MergeReviewComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/review/overture-rights-review.component.ts` | OvertureRightsReviewComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/review/overture-taxonomy-classification-review.component.ts` | OvertureTaxonomyClassificationCategory, OvertureTaxonomyClassificationStatus, OvertureTaxonomyClassificationSourceView, OvertureTaxonomyClassificationHistoryView, OvertureTaxonomyClassificationCaseView, OvertureTaxonomyClassificationDecisionDraft | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/review/review-queue.component.ts` | ReviewQueueComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/run/run-progress.component.ts` | RunProgressComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/lib/search/directory-search.component.ts` | DirectorySearchComponent | Shared UI library / owner console · S6/S7 review |
| `libs/directory-ui/src/test-setup.ts` | module / re-exports | Shared UI library / owner console · S6/S7 review |

### Domain (11 files)

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/domain/src/index.ts` | module / re-exports | Shared contracts / Directory · S2/S4/S5 review |
| `libs/domain/src/lib/dedupe/entity-resolution.service.ts` | ResolutionRecord, ResolutionMatch, RESOLUTION_RULESET_VERSION, resolveEntityMatch, deterministicBusinessKey | Shared contracts / Directory · S2/S4/S5 review |
| `libs/domain/src/lib/dedupe/merge-policy.ts` | EvidenceCandidate, CanonicalFieldSelection, chooseCanonicalFields | Shared contracts / Directory · S2/S4/S5 review |
| `libs/domain/src/lib/dedupe/merge.service.ts` | MergePlanInput, MergePlan, createMergePlan | Shared contracts / Directory · S2/S4/S5 review |
| `libs/domain/src/lib/domain.ts` | module / re-exports | Shared contracts / Directory · S2/S4/S5 review |
| `libs/domain/src/lib/geometry/geometry-types.ts` | Position, PointGeometry, LinearRing, PolygonCoordinates, PolygonGeometry, MultiPolygonGeometry | Shared contracts / Directory · S2/S4/S5 review |
| `libs/domain/src/lib/identity/identity-types.ts` | IdentityKey, IdentityMatchTier, IdentitySignalName, IdentityMatch, CanonicalIdentity | Shared contracts / Directory · S2/S4/S5 review |
| `libs/domain/src/lib/normalization/normalize-business.ts` | AdultClassification, NORMALIZATION_CONFIG_VERSION, NORMALIZATION_RULESET_VERSION, NORMALIZATION_PARSER_VERSION, NORMALIZATION_TAXONOMY_VERSION, NormalizationInput | Shared contracts / Directory · S2/S4/S5 review |
| `libs/domain/src/lib/stable-serialization.ts` | stableSerialize | Shared contracts / Directory · S2/S4/S5 review |
| `libs/domain/src/lib/statuses.ts` | RUN_STATUSES, RunStatus, PROVIDER_JOB_STATUSES, ProviderJobStatus, COMPLETENESS_STATUSES, CompletenessStatus | Shared contracts / Directory · S2/S4/S5 review |
| `libs/domain/src/types.ts` | module / re-exports | Shared contracts / Directory · S2/S4/S5 review |

### Evaluation (3 files)

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/evaluation/src/index.ts` | module / re-exports | Directory quality / owner console · S4/S7 review |
| `libs/evaluation/src/lib/adjudication-score.ts` | AdjudicationOutcome, RetrievalStatus, RetrievalMeasure, RetrievalSamplingFrame, Tier1Adjudication, AdjudicationRow | Directory quality / owner console · S4/S7 review |
| `libs/evaluation/src/lib/evaluation.ts` | evaluation | Directory quality / owner console · S4/S7 review |

### Exports (2 files)

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/exports/src/index.ts` | module / re-exports | Directory / owner console · S8 open |
| `libs/exports/src/lib/exports.ts` | ExportRow, ExportFormat, ExportRowsRequest, ExportRowsOptions, ExportRowsResult, ExportSerializationError | Directory / owner console · S8 open |

### Geography (7 files)

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/geo/src/index.ts` | module / re-exports | Directory / Social · S2 open |
| `libs/geo/src/lib/geo.ts` | geo | Directory / Social · S2 open |
| `libs/geo/src/lib/geometry-types.ts` | Coordinate, Ring, PolygonCoordinates, PointGeometry, PolygonGeometry, MultiPolygonGeometry | Directory / Social · S2 open |
| `libs/geo/src/lib/geometry-validation.service.ts` | HOLE_PROVENANCE_EPSILON_SQUARE_METERS, GeometryValidationInput, GeometryValidationService, planarArea | Directory / Social · S2 open |
| `libs/geo/src/lib/input-manifest.ts` | GeoSourceKind, GeoAuthority, GeoInputManifestEntry, VerifiedGeoInputManifest, RegionGenerationProvenance, ProxyArtifactProvenance | Directory / Social · S2 open |
| `libs/geo/src/lib/region-geometry.service.ts` | RegionGeometryService | Directory / Social · S2 open |
| `libs/geo/src/lib/seat-points.ts` | SeatPoint, DEFAULT_SEAT_POINTS, PROXY_COUNTY_FIPS, PlaceFeatureLike, extractSeatPoints | Directory / Social · S2 open |

### Observability (5 files)

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/observability/src/index.ts` | module / re-exports | Directory / gateway · S9 review |
| `libs/observability/src/lib/observability.module.ts` | ObservabilityModule | Directory / gateway · S9 review |
| `libs/observability/src/lib/observability.ts` | CorrelationContext, CorrelationPatch, runWithActivationSync, validateCorrelationId, CorrelationContextService, SafeTelemetryEnvelope | Directory / gateway · S9 review |
| `libs/observability/src/lib/request-observability.interceptor.ts` | RequestObservabilityInterceptor | Directory / gateway · S9 review |
| `libs/observability/src/lib/request-observability.middleware.ts` | RequestObservabilityMiddleware | Directory / gateway · S9 review |

### Search (2 files)

| POC source path | Exported declarations | Proposed target owner / slice |
| --- | --- | --- |
| `libs/search/src/index.ts` | module / re-exports | Directory / gateway · S5 open |
| `libs/search/src/lib/search.ts` | SearchCursor, SearchCursorError, fingerprintSearchRequest, encodeSearchCursor, decodeSearchCursor, buildSearchOrder | Directory / gateway · S5 open |

## POC application shell and pages (16 additional production TypeScript files)

Read-only source inspection on 2026-11-07 found these files outside the 257 shared/API/worker entries above. This extends the file inventory to 273 entries in the reviewed areas. The listed disposition assigns the behavior; it does not assert target implementation, accessibility, rights or runtime parity.

| POC source path | Capability | Target owner / disposition |
| --- | --- | --- |
| `apps/directory-poc/src/main.ts` | Bootstraps the POC Angular shell. | Existing target app bootstrap; do not transplant a second shell. S6. |
| `apps/directory-poc/src/app/app.ts` | POC application root. | Existing target app owns app structure; pages only in the final app. S6. |
| `apps/directory-poc/src/app/app.config.ts` | Router, HTTP and map configuration wiring. | Target app composition and shared data access; re-evaluate map credentials and attribution. S6/S9. |
| `apps/directory-poc/src/app/app.routes.ts` | Lazy public and operator routes. | Public pages in Local Hub; private operator pages in Owner Console, with guarded gateway APIs. S6/S7. |
| `apps/directory-poc/src/app/corridor-selection.ts` | Browser location selection for four hardcoded POC seats and an accuracy limit. | Replace the four-seat assumption with the S2 town identity/geometry and explicit approximate fallback; do not present a nearest POC seat as a verified town. S2/S6. |
| `apps/directory-poc/src/app/presentation-mappers.ts` | Maps search, detail, regions, rights and map configuration into view data. | Shared Directory data-access/UI libraries; preserve field policy and distinguish pending, approximate and empty states. S5/S6/S7. |
| `apps/directory-poc/src/app/nx-welcome.ts` | Generated Nx welcome component; no production import found in the inspected application source. | Do not migrate as a product capability; confirm any future use independently. S10 disposition. |
| `apps/directory-poc/src/app/pages/search-page.component.ts` | Search, town selection, list and map. | Local Hub page using reusable Directory UI/data access. S5/S6. |
| `apps/directory-poc/src/app/pages/detail-page.component.ts` | Listing detail and evidence. | Local Hub page using shared Directory UI; source and field policy still apply. S5/S6. |
| `apps/directory-poc/src/app/pages/regions-page.component.ts` | Geography and region listing. | Local Hub page and shared geography UI. S2/S6. |
| `apps/directory-poc/src/app/pages/run-page.component.ts` | Operator discovery runs. | Authenticated Owner Console page and Directory worker controls. S7. |
| `apps/directory-poc/src/app/pages/review-page.component.ts` | Operator review decisions and undo. | Authenticated Owner Console page and audited Directory actions. S7. |
| `apps/directory-poc/src/app/pages/overture-rights-review-page.component.ts` | Overture rights review. | Authenticated Owner Console and source-specific policy services. S4a/S7. |
| `apps/directory-poc/src/app/pages/taxonomy-classification-review-page.component.ts` | Taxonomy/classification review. | Authenticated Owner Console and audited classification services. S4/S7. |
| `apps/directory-poc/src/environments/environment.ts` | POC environment and map configuration. | Target app configuration; no POC environment secrets or map terms assumed. S6/S9. |
| `apps/directory-poc/src/environments/environment.development.ts` | POC development environment and map configuration. | Target local development configuration; fixture-only defaults need explicit labeling. S6/S9. |

On 2026-11-08, the 16 rows previously marked only `S0/S10 disposition review` were assigned a target responsibility by capability: source/job provenance, completeness, business uniqueness, source history, region metadata, matching/merge constraints, classification evidence, or persistence wiring. The nine POC migration files are reference behavior, not target migrations to replay: any target schema change must use the owning service's generated TypeORM migration. These assignments do not establish that those future capabilities have been implemented or accepted. POC source was not imported; the selected snapshot, any required exclusions and exact transfer list still require a fresh check if a later import is authorized.

## Additional entrypoints and operational tools, 2026-11-08

A read-only `rg --files` comparison of the POC's visible `apps/**/src` and `libs/**/src` TypeScript found six production entrypoint/barrel files not individually listed above. Nine additional matches were E2E specs or test setup/teardown and are test material rather than production code. The resulting visible production-source count is **279**, not the earlier 273; this does not include ignored files or claim a clean checkout.

| Source path | Capability and target disposition |
| --- | --- |
| `apps/directory-api/src/main.ts` | Separate public/operator listeners, request validation, readiness and shutdown; Directory/gateway S5/S7, operations S9. |
| `apps/directory-worker/src/main.ts` | Actual WorkerModule bootstrap and coordinated shutdown; Directory Worker S4/S9. |
| `apps/directory-worker/src/readiness.ts` | Process identity/heartbeat and worker readiness; Directory Worker S9. |
| `libs/orchestration/src/index.ts` | Re-exports orchestration contracts; Directory Worker S4/S9. |
| `libs/persistence/src/index.ts` | Re-exports entities, repositories and persistence contracts; Directory S4/S5/S7/S8. |
| `libs/providers/src/index.ts` | Re-exports provider, policy, crawl and taxonomy contracts; Directory Worker S4. |

The following **21 operational TypeScript tools**, plus root `jest.config.ts`, are outside that `apps`/`libs` source count. They are not an instruction to run or copy them. Their target ownership is:

| Source path | Capability and disposition |
| --- | --- |
| `tools/evaluation/score-adjudication.ts` | Quality/adjudication scoring; S4a quality protocol and S7 review. |
| `tools/verify/compose-smoke.ts` | Compose service smoke checks; S9 deployment evidence. |
| `tools/verify/public-operator-isolation.ts` | Public/operator listener isolation check; S7/S9 authorization and deployment evidence. |
| `tools/verify/observability-smoke.ts` | Metrics/logging smoke check; S9 observability. |
| `tools/overture/reclassify-four-seat-scan-v3.ts` | Historical staged cohort reclassification; S4a classification, only after exact source/use approval. |
| `tools/overture/reclassify-four-seat-scan.ts` | Earlier staged cohort reclassification; S4a, historical reference only. |
| `tools/overture/fetch-four-seat-scan.ts` | Historical four-seat source extraction and staging, including network requests; S4a approved acquisition and budget controls. Do not run on this disposition. |
| `tools/overture/geoapify-reverse-locality.ts` | Geoapify locality enrichment logic; separate S4b rights, cost and retention decision. |
| `tools/overture/geoapify-reverse-locality-runner.ts` | Geoapify enrichment execution against staged data and database; S4b/S9, not authorized by this inventory. |
| `tools/overture/address-correction-runner.ts` | Address correction execution and evidence; S4/S7 authenticated correction and lineage. |
| `tools/overture/taxonomy-reclassification-runner.ts` | Taxonomy reclassification execution; S4/S7 classification and audited decisions. |
| `tools/generate-openapi.ts` | POC OpenAPI generation; gateway/Directory contract generation in S5/S7. |
| `tools/testing/no-live-provider-calls.ts` | Test-environment guard; S4/S9 test isolation. |
| `tools/geo/build-service-regions.ts` | Historical region assembly; S2 reviewed, identity-preserving geography. |
| `tools/geo/seed-canonical-geography.ts` | Historical geography seeding; S2 governed Social identity and generated target migrations. |
| `tools/geo/build-census-proxy-boundary.ts` | Historical Census proxy-boundary construction; S2 source review and explicitly labeled approximate fallback. |
| `tools/geo/shapefile-archive.ts` | Local bounded archive handling; S2 source reader, with pinned hash and validation. |
| `tools/geo/acquire-inputs.ts` | Input download/staging; S2 source-specific approval and safe resource limits. |
| `tools/typeorm/data-source.ts` | POC migration datasource; S1/S9 target service datasource. |
| `tools/typeorm/run-migrations.ts` | POC migration runner; owning service's Nx migration target and S9 operations. |
| `tools/typeorm/verify-schema.ts` | Schema verification; owning service migration validation and S9 upgrade proof. |
| `jest.config.ts` | Test configuration only; target workspace test configuration. |

The list identifies responsibilities, not implementation or legal clearance. Test harness files, ignored files, generated output, provider records and secrets remain outside this census. Any later import still needs a freshly checked source state, exact transfer list and relevant exclusion review.
