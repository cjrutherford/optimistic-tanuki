import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  assertSourceRuntimeAccess,
  buildCoverageRange,
  canonicalUrl,
  FetchAttemptSchema,
  FetchLedgerSchema,
  getAdapter,
  observedDatesFromPayload,
  persistEmptyFetch,
  persistFetchCoverage,
  persistFetchResult,
  RawDocumentSchema,
  readFetchLedger,
  type BlobStore,
  type CoverageRange,
  type FetchResult,
  type HttpClient,
  type LocalityConfig,
  type SourceConfig,
} from '@optimistic-tanuki/civic-core';
import { BLOB_STORE, HTTP_CLIENT } from '../tokens';
import { QuarantineService } from '../quarantine/quarantine.service';

/**
 * Fetches every source a town's edition draws on and records what came back.
 *
 * The stage is unchanged in behaviour and rewritten in shape: repositories
 * and collaborators arrive by injection rather than through a DataSource
 * passed down the call chain, which is how the destination's services are
 * built and what lets the pieces be tested and replaced individually.
 *
 * Fetching is deliberately forgiving and recording is not. A source that
 * fails is still a source cycle that happened: the failure is quarantined,
 * the attempt is written to the ledger, and the edition reports the gap
 * rather than pretending the source was quiet.
 */

export interface GatherRequest {
  locality: LocalityConfig;
  runId?: number;
  scopeSlug?: string;
  coverageRange?: Pick<CoverageRange, 'requestedStart' | 'requestedEnd'>;
  httpClient?: HttpClient;
  blobStore?: BlobStore;
}

export type SourceProcessingOutcome = 'records' | 'empty' | 'failed';

export interface GatherSourceOutcome {
  sourceKey: string;
  outcome: SourceProcessingOutcome;
  rawDocumentIds: number[];
  rawVersionIds: number[];
  fetchAttemptIds: number[];
  ledgerIds: number[];
  coverageRange?: CoverageRange;
}

export interface GatherResult {
  fetched: number;
  stored: number;
  successfulSources: number;
  successfulRecords: number;
  sourceOutcomes: GatherSourceOutcome[];
  coverageRanges: Record<string, CoverageRange>;
  currentRawDocumentIds: number[];
  currentRawVersionIds: number[];
  currentFetchAttemptIds: number[];
  currentLedgerIds: number[];
  errors: { sourceId: string; error: string }[];
}

/** A transport failure is classified from its message, as the adapters report it. */
function normalizeFetchError(error: unknown): {
  kind: 'network' | 'timeout' | 'http';
  message: string;
  retryable: boolean;
} {
  const message = error instanceof Error ? error.message : String(error);
  const kind = /timeout|abort/iu.test(message)
    ? 'timeout'
    : /HTTP\s+\d+/iu.test(message)
    ? 'http'
    : 'network';
  return { kind, message, retryable: kind === 'network' || kind === 'timeout' };
}

@Injectable()
export class GatherService {
  private readonly logger = new Logger(GatherService.name);

  constructor(
    @InjectRepository(RawDocumentSchema)
    private readonly rawDocuments: Repository<Record<string, unknown>>,
    @InjectRepository(FetchAttemptSchema)
    private readonly fetchAttempts: Repository<Record<string, unknown>>,
    @InjectRepository(FetchLedgerSchema)
    private readonly fetchLedger: Repository<Record<string, unknown>>,
    private readonly quarantine: QuarantineService,
    @Inject(HTTP_CLIENT) private readonly defaultHttpClient: HttpClient,
    @Inject(BLOB_STORE) private readonly defaultBlobStore: BlobStore
  ) {}

  async gather(request: GatherRequest): Promise<GatherResult> {
    const result: GatherResult = {
      fetched: 0,
      stored: 0,
      successfulSources: 0,
      successfulRecords: 0,
      sourceOutcomes: [],
      coverageRanges: {},
      currentRawDocumentIds: [],
      currentRawVersionIds: [],
      currentFetchAttemptIds: [],
      currentLedgerIds: [],
      errors: [],
    };
    for (const source of request.locality.sources.filter(
      (candidate) => candidate.enabled !== false
    )) {
      result.sourceOutcomes.push(
        await this.gatherSource(source, request, result)
      );
    }
    return result;
  }

  private async gatherSource(
    source: SourceConfig,
    request: GatherRequest,
    result: GatherResult
  ): Promise<GatherSourceOutcome> {
    const httpClient = request.httpClient ?? this.defaultHttpClient;
    const blobStore = request.blobStore ?? this.defaultBlobStore;
    const rawDocumentIds: number[] = [];
    const rawVersionIds: number[] = [];
    const fetchAttemptIds: number[] = [];
    const ledgerIds: number[] = [];
    const observedDates: string[] = [];
    let sourceSucceeded = false;
    let sourceHadSuccessfulRecord = false;
    let currentRecordCount = 0;

    try {
      // A SourceConfig can arrive from a stored row rather than the config
      // parser, so the restricted-publisher rule is re-checked here, right
      // before the adapter runs, and not only where sources are loaded.
      assertSourceRuntimeAccess(source);
      const adapter = getAdapter(source.adapter);
      let raws: FetchResult[];
      try {
        const ledger = await readFetchLedger(
          this.dataSource,
          source.sourceKey,
          source.url
        );
        raws = await adapter.fetch(source, {
          locality: request.locality,
          blobStore,
          httpClient,
          ...(request.coverageRange
            ? { coverageRange: request.coverageRange }
            : {}),
          ...(ledger
            ? {
                conditional: {
                  etag: ledger.etag ?? undefined,
                  lastModified: ledger.lastModified ?? undefined,
                },
              }
            : {}),
        });
        // No records is a completed cycle, not a failure: the source was
        // reached and had nothing to say.
        sourceSucceeded = raws.length === 0;
        if (raws.length === 0) {
          const empty = await persistEmptyFetch(
            this.dataSource,
            source.sourceKey,
            source.url,
            new Date().toISOString()
          );
          fetchAttemptIds.push(empty.attemptId);
          ledgerIds.push(empty.ledgerId);
        }
      } catch (error) {
        raws = [
          {
            kind: 'failed',
            status: null,
            url: source.url,
            requestUrl: source.url,
            contentType: 'application/octet-stream',
            fetchedAt: new Date().toISOString(),
            error: normalizeFetchError(error),
          },
        ];
      }

      for (const raw of raws) {
        result.fetched += 1;
        observedDates.push(
          ...observedDatesFromPayload(raw, request.locality.timezone)
        );
        try {
          const outcome = await persistFetchResult(
            this.dataSource,
            source.sourceKey,
            raw
          );
          if (outcome === 'changed') result.stored += 1;
          if (raw.kind === 'failed') {
            result.errors.push({
              sourceId: source.sourceKey,
              error: raw.error.message,
            });
            await this.quarantine.record(
              source.sourceKey,
              'gather',
              raw.error,
              raw.requestUrl,
              request,
              `url:${canonicalUrl(raw.url)}`
            );
            continue;
          }
          currentRecordCount += 1;
          const url = canonicalUrl(raw.url);
          const persisted = await this.rawDocuments.findOneBy({
            sourceId: source.sourceKey,
            url,
          });
          const attempt = await this.fetchAttempts.findOne({
            where: {
              sourceId: source.sourceKey,
              url,
              attemptedAt: raw.fetchedAt,
            },
            order: { id: 'DESC' },
          });
          const ledger = await this.fetchLedger.findOneBy({
            sourceId: source.sourceKey,
            url,
          });
          if (typeof persisted?.['id'] === 'number')
            rawDocumentIds.push(persisted['id']);
          if (typeof persisted?.['activeVersionId'] === 'number')
            rawVersionIds.push(persisted['activeVersionId']);
          if (typeof attempt?.['id'] === 'number')
            fetchAttemptIds.push(attempt['id']);
          if (typeof ledger?.['id'] === 'number') ledgerIds.push(ledger['id']);
          result.successfulRecords += 1;
          sourceSucceeded = true;
          sourceHadSuccessfulRecord = true;
        } catch (error) {
          result.errors.push({
            sourceId: source.sourceKey,
            error: error instanceof Error ? error.message : String(error),
          });
          await this.quarantine.record(
            source.sourceKey,
            'gather',
            error,
            undefined,
            request,
            `url:${canonicalUrl(raw.url)}`
          );
        }
      }
    } catch (error) {
      result.errors.push({
        sourceId: source.sourceKey,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.quarantine.record(
        source.sourceKey,
        'gather',
        error,
        undefined,
        request,
        'source-cycle'
      );
    }

    const coverage = request.coverageRange
      ? buildCoverageRange({
          requestedStart: request.coverageRange.requestedStart,
          requestedEnd: request.coverageRange.requestedEnd,
          observedDates,
          sourceFailed: !sourceSucceeded,
          capabilitySupported: Boolean(
            source.coverageCapabilities?.dateQuery ||
              source.coverageCapabilities?.pagination
          ),
          source,
          restrictedAggregateOnly:
            source.kind === 'news' &&
            source.adapter === 'news-discover' &&
            source.accessMode === 'snippet-only' &&
            source.aggregateDiscovery === true,
          currentRecordCount,
        })
      : undefined;
    if (coverage) {
      result.coverageRanges[source.sourceKey] = coverage;
      await persistFetchCoverage(this.dataSource, source.sourceKey, coverage, {
        ledgerIds,
        attemptIds: fetchAttemptIds,
      });
    }
    result.currentRawDocumentIds.push(...rawDocumentIds);
    result.currentRawVersionIds.push(...rawVersionIds);
    result.currentFetchAttemptIds.push(...fetchAttemptIds);
    result.currentLedgerIds.push(...ledgerIds);
    if (sourceSucceeded) result.successfulSources += 1;

    return {
      sourceKey: source.sourceKey,
      outcome: sourceSucceeded
        ? sourceHadSuccessfulRecord
          ? 'records'
          : 'empty'
        : 'failed',
      rawDocumentIds,
      rawVersionIds,
      fetchAttemptIds,
      ledgerIds,
      ...(coverage ? { coverageRange: coverage } : {}),
    };
  }

  /** The ledger helpers still take a DataSource; repositories expose theirs. */
  private get dataSource() {
    return this.rawDocuments.manager.connection;
  }
}
