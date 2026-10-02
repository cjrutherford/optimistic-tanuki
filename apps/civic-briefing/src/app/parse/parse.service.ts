import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  canonicalUrl,
  CivicItemSchema,
  enrichDraft,
  getAdapter,
  isDayInContextWindow,
  itemHash,
  itemLocalDate,
  loadVersionPayload,
  RawDocumentSchema,
  resolveItemScope,
  type BlobStore,
  type DraftItem,
  type HttpClient,
  type LocalityConfig,
  type LocalityRegistry,
  type SourceConfig,
} from '@optimistic-tanuki/civic-core';
import { BLOB_STORE, HTTP_CLIENT } from '../tokens';
import { QuarantineService } from '../quarantine/quarantine.service';
import type { GatherSourceOutcome } from '../gather/gather.service';

/**
 * Turns stored responses into civic items.
 *
 * Parsing is per raw record and failure is per raw record: one unreadable PDF
 * must not cost a town the rest of its agenda. A source counts as successful
 * only when every record it produced parsed, so a partially broken source is
 * visible as a coverage gap rather than silently thinned.
 *
 * Items are keyed by a content hash, which makes re-parsing idempotent: a
 * replay writes the same rows rather than duplicates.
 */

export interface ParseRequest {
  locality: LocalityConfig;
  registry?: LocalityRegistry;
  runId?: number;
  scopeSlug?: string;
  successfulSourceOutcomes?: readonly GatherSourceOutcome[];
  currentRawDocumentIds?: readonly number[];
  contextRange?: { start: string; end: string };
  httpClient?: HttpClient;
  blobStore?: BlobStore;
}

export interface ParseResult {
  parsed: number;
  inserted: number;
  successfulSources: number;
  successfulRecords: number;
  currentItemIds: number[];
  errors: { sourceId: string; error: string }[];
}

@Injectable()
export class ParseService {
  constructor(
    @InjectRepository(RawDocumentSchema)
    private readonly rawDocuments: Repository<Record<string, any>>,
    @InjectRepository(CivicItemSchema)
    private readonly items: Repository<Record<string, any>>,
    private readonly quarantine: QuarantineService,
    @Inject(HTTP_CLIENT) private readonly defaultHttpClient: HttpClient,
    @Inject(BLOB_STORE) private readonly defaultBlobStore: BlobStore
  ) {}

  async parse(request: ParseRequest): Promise<ParseResult> {
    const result: ParseResult = {
      parsed: 0,
      inserted: 0,
      successfulSources: 0,
      successfulRecords: 0,
      currentItemIds: [],
      errors: [],
    };
    const sources = new Map<string, SourceConfig>(
      request.locality.sources
        .filter((source) => source.enabled !== false)
        .map((source) => [source.sourceKey, source])
    );
    const raws = request.currentRawDocumentIds
      ? request.currentRawDocumentIds.length
        ? await this.rawDocuments.find({
            where: { id: In([...request.currentRawDocumentIds]) },
            order: { id: 'ASC' },
          })
        : []
      : await this.rawDocuments.find();

    const rawCounts = new Map<string, number>();
    for (const raw of raws)
      if (sources.has(raw['sourceId']))
        rawCounts.set(
          raw['sourceId'],
          (rawCounts.get(raw['sourceId']) ?? 0) + 1
        );

    const successfulSources = new Set<string>();
    const successfulRecordCounts = new Map<string, number>();
    const failedSources = new Set<string>();
    // A source that returned nothing still completed; it has no raw records
    // to parse, so its success is carried over from the gather outcome.
    for (const outcome of request.successfulSourceOutcomes ?? []) {
      if (
        outcome.outcome === 'empty' &&
        sources.has(outcome.sourceKey) &&
        !rawCounts.has(outcome.sourceKey)
      ) {
        successfulSources.add(outcome.sourceKey);
      }
    }

    for (const raw of raws) {
      const source = sources.get(raw['sourceId']);
      if (!source) continue;
      try {
        await this.parseRaw(raw, source, request, result);
        result.successfulRecords += 1;
        successfulRecordCounts.set(
          source.sourceKey,
          (successfulRecordCounts.get(source.sourceKey) ?? 0) + 1
        );
      } catch (error) {
        result.errors.push({
          sourceId: source.sourceKey,
          error: error instanceof Error ? error.message : String(error),
        });
        failedSources.add(source.sourceKey);
        try {
          await this.quarantine.record(
            source.sourceKey,
            'parse',
            error,
            raw['url'],
            request,
            `raw:${raw['id'] ?? 'unknown'}:version:${
              raw['activeVersionId'] ?? 'unknown'
            }:url:${canonicalUrl(raw['url'])}`
          );
        } catch {
          // The record error is what matters; losing its diagnostic must not replace it.
        }
      }
    }

    for (const [sourceKey, count] of rawCounts) {
      if (
        count === (successfulRecordCounts.get(sourceKey) ?? 0) &&
        !failedSources.has(sourceKey)
      )
        successfulSources.add(sourceKey);
    }
    result.successfulSources = successfulSources.size;
    return result;
  }

  private async parseRaw(
    raw: Record<string, any>,
    source: SourceConfig,
    request: ParseRequest,
    result: ParseResult
  ): Promise<void> {
    const adapter = getAdapter(source.adapter);
    if (raw['activeVersionId'] == null)
      throw new Error('raw document has no active content version');
    const payload = await loadVersionPayload(
      this.items.manager.connection,
      raw['activeVersionId']
    );
    const drafts: DraftItem[] = await adapter.parse(
      {
        url: raw['url'],
        contentType: raw['contentType'],
        payload,
        fetchedAt: raw['fetchedAt'],
      },
      source,
      { blobStore: request.blobStore ?? this.defaultBlobStore }
    );
    for (const draft of drafts)
      await this.storeDraft(draft, source, request, result);
  }

  /** Enriches a news draft with its article text, then stores it if it is new. */
  private async storeDraft(
    draft: DraftItem,
    source: SourceConfig,
    request: ParseRequest,
    result: ParseResult
  ): Promise<void> {
    const httpClient = request.httpClient ?? this.defaultHttpClient;
    const enriched =
      draft.kind === 'news' &&
      (source.adapter === 'rss' || source.adapter === 'news-discover')
        ? await enrichDraft(draft, { httpClient }, source, draft.observedAt)
        : null;
    const item: DraftItem = enriched
      ? {
          ...draft,
          body: enriched.body,
          originalSnippet: enriched.originalSnippet,
          publisher: enriched.publisher,
          originalUrl: draft.originalUrl ?? draft.uris?.[0],
          canonicalUrl: enriched.canonicalUrl,
          articleProvenance: enriched.provenance,
          contentChecksum: enriched.provenance.checksum,
          uris: [
            ...new Set([
              ...(draft.uris ?? []),
              ...(enriched.canonicalUrl ? [enriched.canonicalUrl] : []),
              enriched.provenance.resolvedUrl,
              ...(enriched.provenance.redirectChain ?? []),
            ]),
          ],
          ...(enriched.accessMode ? { accessMode: enriched.accessMode } : {}),
          ...(enriched.accessRestrictionReason !== undefined
            ? { accessRestrictionReason: enriched.accessRestrictionReason }
            : {}),
          ...(enriched.restrictionPolicyUrl !== undefined
            ? { restrictionPolicyUrl: enriched.restrictionPolicyUrl }
            : {}),
          ...(enriched.aggregateUrl !== undefined
            ? { aggregateUrl: enriched.aggregateUrl }
            : {}),
          ...(enriched.aggregateProvenance !== undefined
            ? { aggregateProvenance: enriched.aggregateProvenance }
            : {}),
          ...(enriched.unresolvedAggregateLink !== undefined
            ? { unresolvedAggregateLink: enriched.unresolvedAggregateLink }
            : {}),
          ...(enriched.observedAt !== undefined
            ? { observedAt: enriched.observedAt }
            : {}),
        }
      : draft;

    const date = item.eventDate ?? item.publishedAt;
    if (
      request.contextRange &&
      date &&
      !isDayInContextWindow(
        itemLocalDate(
          {
            eventDate: item.eventDate ?? null,
            publishedAt: item.publishedAt ?? null,
          },
          request.locality.timezone
        ),
        request.contextRange,
        item.kind
      )
    )
      return;

    const scope = request.registry
      ? resolveItemScope(source, item.jurisdictionSlug, request.registry)
      : null;
    result.parsed += 1;
    const hash = itemHash(
      source.sourceKey,
      item.title,
      date,
      scope?.scopeSlug ?? request.locality.slug,
      item.externalId ?? item.canonicalUrl ?? item.originalUrl
    );
    const existing = await this.items.find({ where: { hash } });
    if (existing.length) {
      for (const row of existing)
        if (row['id'] !== undefined) result.currentItemIds.push(row['id']);
      return;
    }
    await this.items.save({
      sourceId: source.sourceKey,
      // An item belongs to the source's owner, so every edition sharing that
      // source sees the same row whichever town ran first.
      localitySlug: source.ownerSlug ?? request.locality.slug,
      scopeSlug: scope?.scopeSlug ?? null,
      scopeKind: scope?.scopeKind ?? null,
      jurisdictionSlug: item.jurisdictionSlug ?? null,
      kind: item.kind,
      title: item.title,
      body: item.body,
      summary: null,
      publishedAt: item.publishedAt ?? null,
      eventDate: item.eventDate ?? null,
      topics: item.topics ? JSON.stringify(item.topics) : null,
      uris: item.uris ? JSON.stringify(item.uris) : null,
      originalSnippet: item.originalSnippet ?? null,
      publisher: item.publisher ?? null,
      canonicalUrl: item.canonicalUrl ?? null,
      articleProvenance: item.articleProvenance
        ? JSON.stringify(item.articleProvenance)
        : null,
      contentChecksum: item.contentChecksum ?? null,
      caseId: item.caseId ?? null,
      matterId: item.matterId ?? null,
      permitId: item.permitId ?? null,
      externalId: item.externalId ?? null,
      entity: item.entity ?? null,
      action: item.action ?? null,
      accessMode: item.accessMode ?? null,
      accessRestrictionReason: item.accessRestrictionReason ?? null,
      restrictionPolicyUrl: item.restrictionPolicyUrl ?? null,
      aggregateDiscovery: item.aggregateDiscovery ?? null,
      aggregateUrl: item.aggregateUrl ?? null,
      unresolvedAggregateLink: item.unresolvedAggregateLink ?? null,
      observedAt: item.observedAt ?? null,
      hash,
      createdAt: new Date().toISOString(),
    });
    result.inserted += 1;
    const saved = await this.items.findOneBy({ hash });
    if (saved?.['id'] !== undefined) result.currentItemIds.push(saved['id']);
  }
}
