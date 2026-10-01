import { createHash } from 'node:crypto';
import { join, isAbsolute, basename } from 'node:path';
import type { DataSource } from 'typeorm';
import { In } from 'typeorm';
import type {
  Cadence,
  CivicKind,
  DraftItem,
  FetchResult,
  RawDocumentInput,
  BlobStore,
  LocalityConfig,
  HttpClient,
  SourceConfig,
  Summarizer,
  CoverageRange,
} from './types.js';
import {
  CivicItemSchema,
  LocalitySchema,
  QuarantineSchema,
  RawDocumentSchema,
  BriefingSchema,
  SourceSchema,
  AgendaItemSchema,
  EditionItemSchema,
  CanonicalStorySchema,
  CanonicalStoryItemSchema,
  EditionStorySchema,
  CanonicalStoryRevisionSchema,
  StoryRevisionCitationSchema,
  FoundationSourceSchema,
  FoundationQuarantineSchema,
  FetchLedgerSchema,
  FetchAttemptSchema,
  LlmGenerationSchema,
  type AgendaItemRow,
  type CivicItemRow,
  type SourceRow,
  type CanonicalStoryRow,
  type CanonicalStoryRevisionRow,
  RawDocumentVersionSchema,
} from './schema.js';
import type { LocalityRegistry } from './locality-registry.js';
import { resolveItemScope } from './geography.js';
import { createLocalBlobStore } from './blob-store.js';
import { deriveSourceFreshness, type FreshnessScope } from './freshness.js';
import { OutboundPolicy } from './outbound-policy.js';
import { assertSourceRuntimeAccess } from './config.js';
import {
  canonicalUrl,
  persistEmptyFetch,
  persistFetchCoverage,
  persistFetchResult,
  readFetchLedger,
} from './fetch-ledger.js';
import { getAdapter } from './registry.js';
import { assembleMarkdown } from './briefing.js';
import {
  buildThreads,
  extractAgendaItems as ruleExtract,
  isOutlineAgenda,
  agendaHeader,
  extractOutcome,
  meetingDateFromTitle,
  topicKey,
  type AgendaItemDraft,
  type ThreadRow,
  type Thread,
} from './agenda.js';
import {
  assembleStory,
  LLM_CLAIM_GROUNDING_DISCLOSURE,
  assertAgendaActionAttribution,
  assertAgendaOnlyPublicField,
  assertDistinctStoryNarratives,
  deriveNarrativeFromClaims,
  isAgendaOnlyEvidence,
  selectStoryTimelineEvents,
  storyFilename,
} from './story.js';
import {
  assembleArticleEdition,
  assembleOutsiderBriefing,
  DETERMINISTIC_NEWS_DISCLOSURE,
  DETERMINISTIC_QUIET_DAY_DISCLOSURE,
  INITIAL_BRIEFING_DISCLOSURE,
  proseDate,
  type ArticleClaim,
  type ArticleSource,
  type OutsiderThread,
} from './briefing2.js';
import {
  communityForEdition,
  readCommunitySnapshot,
} from './community-evidence.js';
import { storyTitle as evidenceTitle } from './story-engine.js';
import { loadLocalityConfig } from './config.js';
import {
  cleanEditorialBody,
  enrichDraft,
  isEditoriallyEligibleBody,
} from './article-enrichment.js';
import { truncate, truncateSentences } from './text.js';
import { backfillSince, localDate } from './calendar.js';
import {
  isDayInContextWindow,
  itemEvidenceLocalDate,
  itemLocalDate,
  isItemInEvidenceRange,
  isItemInLocalRange,
  projectStories,
} from './edition.js';
import { isNotCivicRecord, scoreNewsworthiness } from './newsworthiness.js';
import { buildCoverageRange } from './coverage.js';
import {
  defaultPublicationLockPath,
  prepareImmutableMarkdown,
  prepareMarkdown,
  type PreparedMarkdown,
  withPublicationLock,
} from './publication.js';
import {
  appendCanonicalStoryRevisions,
  type CanonicalStoryRevisionInput,
} from './store.js';
import {
  QUIET_DAY_SYNTHESIS_CONTRACT_VERSION,
  STORY_SYNTHESIS_CONTRACT_VERSION,
  SYNTHESIS_CONTRACT_VERSION,
} from './synthesis-contract.js';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Content-addressed receipt identity for strict story artifacts. Keeping the
 * contract in the token makes old revisions visibly ineligible for briefing
 * reuse even if their model input happened to collide with a newer run. */
export function storyArtifactToken(inputSha256: string): string {
  return `story-${STORY_SYNTHESIS_CONTRACT_VERSION}-${inputSha256}`;
}

export function isCurrentStoryArtifactToken(
  token: string | null | undefined
): boolean {
  return (
    typeof token === 'string' &&
    token.startsWith(`story-${STORY_SYNTHESIS_CONTRACT_VERSION}-`)
  );
}

/** The URI list persisted with an item, tolerating malformed JSON. */
export function parseUris(value?: string | null): string[] {
  try {
    return value ? (JSON.parse(value) as string[]) : [];
  } catch {
    return [];
  }
}

/** The URL a reader should follow for an item: canonical first, then stored URIs. */
export function preferredItemUrl(
  item: Pick<CivicItemRow, 'canonicalUrl' | 'uris'>
): string | undefined {
  const canonical = item.canonicalUrl?.trim();
  if (canonical) return canonical;
  return parseUris(item.uris)[0];
}

/** Validate agenda-parser/fixup labels against the original CivicItem text.
 * Section labels are navigation metadata, but a specific event type or past
 * outcome in a timeline heading still makes a factual assertion. */
export function validateAgendaHeadingAgainstSource(
  heading: string,
  source: Pick<CivicItemRow, 'title' | 'body'>
): void {
  const sourceText = `${source.title} ${source.body}`;
  const typePatterns: readonly [string, RegExp][] = [
    ['workshop', /\bworkshops?\b/iu],
    ['town-hall', /\btown[\s-]+halls?\b/iu],
    ['public-hearing', /\bpublic[\s-]+hearings?\b/iu],
  ];
  for (const [type, pattern] of typePatterns) {
    if (pattern.test(heading) && !pattern.test(sourceText))
      throw new Error(
        `agenda heading event type is not supported by original source: ${type}`
      );
  }
  if (
    /\b(?:approved|authorized|passed|adopted|denied|tabled|carried|rejected|voted)\b/iu.test(
      heading
    ) &&
    !/\b(?:approved|authorized|passed|adopted|denied|tabled|carried|rejected|voted)\b/iu.test(
      sourceText
    )
  ) {
    throw new Error(
      'agenda heading asserts an outcome absent from original source'
    );
  }
  if (isAgendaOnlyEvidence(source.title, source.body)) {
    try {
      assertAgendaOnlyPublicField(heading, 'heading');
    } catch {
      throw new Error(
        'agenda heading asserts an unsupported meeting occurrence or outcome absent from original source'
      );
    }
  }
}

/** Source metadata used by strict evidence prompts must come from the
 * persisted source catalog, never from a source key or model-authored text. */
/** Human-readable source names, keyed by source key. */
export async function loadStoredSourceNames(
  ds: DataSource
): Promise<ReadonlyMap<string, string>> {
  const schema = ds.hasMetadata(FoundationSourceSchema)
    ? FoundationSourceSchema
    : SourceSchema;
  const rows = (await ds.getRepository(schema).find()) as SourceRow[];
  return new Map(
    rows.flatMap((row) => {
      const key = row.sourceKey ?? row.id;
      return key && row.name.trim() ? [[key, row.name.trim()] as const] : [];
    })
  );
}

/** Source keys as stored, for mapping persisted rows back to configured sources. */
export async function loadStoredSourceKeys(
  ds: DataSource
): Promise<ReadonlyMap<string, string>> {
  const schema = ds.hasMetadata(FoundationSourceSchema)
    ? FoundationSourceSchema
    : SourceSchema;
  const rows = (await ds.getRepository(schema).find()) as SourceRow[];
  return new Map(
    rows.flatMap((row) =>
      row.sourceKey?.trim() ? [[row.id, row.sourceKey.trim()] as const] : []
    )
  );
}

function summarizerEvidenceForItem(
  item: CivicItemRow,
  sourceNames: ReadonlyMap<string, string>,
  overrides: {
    heading?: string;
    body?: string;
    date?: string;
    truncateBody?: boolean;
    agendaItemId?: number;
    sourceKey?: string;
    parentDocumentContext?: { title?: string; body?: string };
  } = {}
): import('./types.js').SummarizerEvidenceItem & { heading?: string } {
  const evidenceBody = cleanEditorialBody(overrides.body ?? item.body);
  return {
    sourceKey: overrides.sourceKey ?? item.sourceId,
    civicItemId: item.id,
    evidenceKind:
      overrides.agendaItemId !== undefined ? 'agenda-row' : 'source-item',
    ...(overrides.agendaItemId !== undefined
      ? { agendaItemId: overrides.agendaItemId }
      : {}),
    title: item.title,
    body:
      overrides.truncateBody === false
        ? evidenceBody
        : evidenceBody.slice(0, 1500),
    date: overrides.date ?? item.eventDate ?? item.publishedAt ?? undefined,
    // A page that never states when it was written cannot date its own contents.
    ...(overrides.date ?? item.eventDate ?? item.publishedAt
      ? {}
      : { undated: true }),
    snippetOnly: item.accessMode === 'snippet-only',
    accessMode: item.accessMode ?? undefined,
    articleUrl: preferredItemUrl(item),
    ...(overrides.heading ? { heading: overrides.heading } : {}),
    ...(sourceNames.get(item.sourceId)
      ? { sourceName: sourceNames.get(item.sourceId) }
      : {}),
    publisher: item.publisher ?? null,
    localitySlug: item.localitySlug,
    ...(item.scopeSlug ? { scopeSlug: item.scopeSlug } : {}),
    ...(item.scopeKind ? { scopeKind: item.scopeKind } : {}),
    ...(overrides.parentDocumentContext
      ? { parentDocumentContext: overrides.parentDocumentContext }
      : {}),
  };
}

/** Project cluster/brief transport evidence to the exact agenda row body.
 * Parent meeting documents remain a restricted context envelope only. */
export function buildClusterEvidenceItems(
  items: readonly CivicItemRow[],
  agendaRowsByItemId: ReadonlyMap<number, readonly AgendaItemRow[]>,
  sourceNames: ReadonlyMap<string, string>
): (import('./types.js').SummarizerEvidenceItem & { heading?: string })[] {
  return items.flatMap((item) => {
    const rows = (agendaRowsByItemId.get(item.id as number) ?? []).filter(
      (row) => !row.procedural
    );
    if (!rows.length) return [summarizerEvidenceForItem(item, sourceNames)];
    return rows.map((row) =>
      summarizerEvidenceForItem(item, sourceNames, {
        heading: row.heading,
        body: row.body,
        truncateBody: false,
        agendaItemId: row.id,
        parentDocumentContext: {
          title: item.title,
          body: agendaHeader(item.body),
        },
      })
    );
  });
}

/** Bind each agenda row's own extracted body to the shared original CivicItem
 * citation.  A meeting document is one source record, but its agenda rows
 * are distinct evidence excerpts; using the full document for every row
 * makes every timeline entry repeat the first item's outcome. */
export function buildAgendaEvidenceEvents(
  items: readonly ThreadRow[],
  originals: ReadonlyMap<number, CivicItemRow>,
  sourceNames: ReadonlyMap<string, string>,
  sourceKeys: ReadonlyMap<string, string> = new Map()
): (import('./types.js').SummarizerEvidenceItem & { heading: string })[] {
  return items.map((item) => {
    const original =
      item.itemId === undefined ? undefined : originals.get(item.itemId);
    // A news article or other whole record is its own evidence: its real title,
    // not an "Agenda item" row with a parent-document envelope.
    if (
      original &&
      item.agendaItemId === undefined &&
      original.kind !== 'meeting'
    ) {
      return {
        ...summarizerEvidenceForItem(original, sourceNames, {
          sourceKey: sourceKeys.get(original.sourceId) ?? item.sourceKey,
        }),
        heading: item.heading,
      };
    }
    if (original) {
      // Agenda headings are navigation metadata and cannot self-authorize an
      // action verb; only the extracted row body is row evidence.
      validateAgendaHeadingAgainstSource(item.heading, original);
      assertAgendaActionAttribution(
        item.heading,
        item.body,
        'agenda row heading'
      );
      return {
        ...summarizerEvidenceForItem(original, sourceNames, {
          heading: item.heading,
          date: item.meetingDate ?? undefined,
          body: item.body,
          truncateBody: false,
          agendaItemId: item.agendaItemId,
          sourceKey: sourceKeys.get(original.sourceId) ?? item.sourceKey,
          parentDocumentContext: {
            title: original.title,
            body: agendaHeader(original.body),
          },
        }),
        // The row body is the item-specific evidence. Keep the persisted
        // document title only in the restricted context envelope; a neutral
        // title prevents parent-document dates/numbers/outcomes from entering
        // ordinary claim grounding, and the synthetic navigation heading stays
        // metadata-only.
        title: 'Agenda item',
        heading: item.heading,
      };
    }
    return {
      sourceKey: item.sourceKey,
      civicItemId: item.itemId,
      agendaItemId: item.agendaItemId,
      evidenceKind: 'agenda-row',
      snippetOnly: item.snippetOnly,
      accessMode: (item.snippetOnly
        ? 'snippet-only'
        : 'full') as import('./types.js').SourceAccessMode,
      date: item.meetingDate ?? undefined,
      title: 'Agenda item',
      body: cleanEditorialBody(item.body).slice(0, 1500),
      heading: item.heading,
      ...(item.canonicalUrl ? { articleUrl: item.canonicalUrl } : {}),
    };
  });
}

const SNIPPET_DISCLOSURE =
  'Limited-access source: the publisher’s crawler policy blocks automated AI retrieval of the article body. This briefing analyzed only the headline and third-party snippet; details may be incomplete.';
/** The crawler-policy disclosure shown beside a snippet-only item. */
export function snippetDisclosure(
  item:
    | Pick<CivicItemRow, 'canonicalUrl' | 'uris'>
    | { canonicalUrl?: string | null; uris?: string | readonly string[] | null }
): string {
  const canonical = item.canonicalUrl?.trim();
  const urls = Array.isArray(item.uris)
    ? item.uris
    : typeof item.uris === 'string'
    ? parseUris(item.uris)
    : [];
  const url = canonical || urls[0];
  return `${SNIPPET_DISCLOSURE}${
    url ? ` Read the full article directly: [article](${url})` : ''
  }`;
}

export function loadLocality(slugOrPath: string): LocalityConfig {
  const path =
    slugOrPath.endsWith('.yaml') || slugOrPath.endsWith('.yml')
      ? slugOrPath
      : join(process.cwd(), 'localities', `${slugOrPath}.yaml`);
  const file = isAbsolute(path) ? path : join(process.cwd(), path);
  return loadLocalityConfig(file);
}

export async function ensureLocality(
  ds: DataSource,
  locality: LocalityConfig,
  registry?: LocalityRegistry
): Promise<void> {
  if (
    'sourceOverrides' in (locality as unknown as Record<string, unknown>) ||
    'disabled' in (locality as unknown as Record<string, unknown>)
  ) {
    throw new Error(
      'per-locality source enablement overrides are not supported'
    );
  }
  const foundation = registry !== undefined;
  const sources = registry
    ? registry.sourcesForRun(locality.slug)
    : locality.sources;
  // The places around the edition are stored with it — those containing it
  // and those inside it — because the store checks a story's citations
  // against the stored map of places. With only the edition stored, a City
  // of Groton record in a Groton story was refused as unrelated, though the
  // story engine, reading the full registry, had rightly linked it.
  const places = registry
    ? [
        locality,
        ...registry.ancestors(locality.slug),
        ...registry.descendants(locality.slug),
      ]
    : [locality];
  for (const place of places) {
    await ds.getRepository(LocalitySchema).upsert(
      {
        slug: place.slug,
        name: place.name,
        state: place.state,
        timezone: place.timezone,
        lat: place.lat,
        lon: place.lon,
        ...(place.kind === undefined
          ? {}
          : {
              kind: place.kind,
              parents: JSON.stringify(place.parents ?? []),
              edition: place.edition === true,
              aliases: JSON.stringify(place.aliases ?? []),
              ruleVersion: place.ruleVersion ?? null,
            }),
      },
      ['slug']
    );
  }
  for (const s of sources) {
    const row = {
      id: s.sourceKey,
      sourceKey: s.sourceKey,
      ownerSlug: s.ownerSlug,
      coverage: s.coverage,
      adapter: s.adapter,
      name: s.name,
      url: s.url,
      kind: s.kind,
      config: s.config === undefined ? null : JSON.stringify(s.config),
      enabled: s.enabled !== false,
      desk: s.desk ?? null,
      accessMode: s.accessMode ?? null,
      accessRestrictionReason: s.accessRestrictionReason ?? null,
      restrictionPolicyUrl: s.restrictionPolicyUrl ?? null,
      aggregateDiscovery: s.aggregateDiscovery ?? null,
      aggregateUrl: s.aggregateUrl ?? null,
      coverageCapabilities:
        s.coverageCapabilities === undefined
          ? null
          : JSON.stringify(s.coverageCapabilities),
      observedAt: null,
    };
    await ds
      .getRepository(foundation ? FoundationSourceSchema : SourceSchema)
      .upsert(
        {
          ...row,
          ...(foundation ? {} : { localitySlug: locality.slug }),
        },
        foundation ? ['sourceKey'] : ['id']
      );
  }
}

async function quarantine(
  ds: DataSource,
  sourceId: string,
  stage: string,
  error: unknown,
  payload?: string,
  metadata?: { runId?: number; scopeSlug?: string },
  recordIdentity?: string
): Promise<void> {
  const row = {
    sourceId,
    stage,
    error:
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : typeof error === 'object'
        ? JSON.stringify(error)
        : String(error),
    createdAt: new Date().toISOString(),
  };
  if (ds.hasMetadata(FoundationQuarantineSchema)) {
    const repository = ds.getRepository(FoundationQuarantineSchema);
    const targetKey = `${stage}:${sourceId}:${
      metadata?.runId ?? 'diagnostic'
    }:${recordIdentity ?? 'cycle'}:${sha256(row.error)}`;
    if (await repository.findOneBy({ targetType: 'pipeline', targetKey }))
      return;
    try {
      await repository.save({
        ...row,
        targetType: 'pipeline',
        targetKey,
        scopeSlug: metadata?.scopeSlug ?? null,
        runId: metadata?.runId === undefined ? null : String(metadata.runId),
        retryable: false,
        payloadRef: payload ?? null,
      });
    } catch (error) {
      if (!/unique|constraint|duplicate/i.test(String(error))) throw error;
      // A concurrent/repeated diagnostic with the same stable identity is
      // already represented; never let that race replace the source error.
    }
  } else {
    await ds
      .getRepository(QuarantineSchema)
      .save({ ...row, payload: payload ?? null });
  }
}

export type SourceProcessingOutcome = 'empty' | 'records' | 'failed';

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
  /** Sources/records completed without an error, even when they emitted no items. */
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

/** Dates an adapter payload claims to cover, used for coverage reporting. */
export function observedDatesFromPayload(
  raw: FetchResult,
  timezone: string
): string[] {
  const values: string[] = [];
  for (const value of raw.observedDates ?? []) {
    try {
      values.push(
        /^\d{4}-\d{2}-\d{2}$/u.test(value)
          ? value
          : localDate(new Date(value), timezone)
      );
    } catch {
      /* malformed metadata is ignored */
    }
  }
  if (raw.kind !== 'fetched' || raw.payload.kind !== 'text') return values;
  let payload: unknown;
  try {
    payload = JSON.parse(raw.payload.body);
  } catch {
    return values;
  }
  const dateKeys = new Set([
    'observedDate',
    'pubDate',
    'publishedAt',
    'eventDate',
    'date',
  ]);
  const visit = (value: unknown, key?: string): void => {
    if (typeof value === 'string' && key && dateKeys.has(key)) {
      try {
        const date = /^\d{4}-\d{2}-\d{2}$/u.test(value)
          ? value
          : localDate(new Date(value), timezone);
        if (/^\d{4}-\d{2}-\d{2}$/u.test(date)) values.push(date);
      } catch {
        /* malformed source dates do not become coverage evidence */
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [entryKey, entry] of Object.entries(value))
        visit(entry, entryKey);
    }
  };
  visit(payload);
  return [...new Set(values)];
}

export async function gather(
  ds: DataSource,
  locality: LocalityConfig,
  options?: {
    blobStore?: BlobStore;
    httpClient?: import('./types.js').HttpClient;
    runId?: number;
    scopeSlug?: string;
    coverageRange?: Pick<CoverageRange, 'requestedStart' | 'requestedEnd'>;
  }
): Promise<GatherResult> {
  if (!ds.hasMetadata(FetchLedgerSchema)) {
    throw new Error(
      'gather requires an explicit foundation data source with fetch-ledger migrations; legacy civic.db is read-only for migration safety'
    );
  }
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
  const blobStore =
    options?.blobStore ??
    createLocalBlobStore(join(process.cwd(), 'data', 'blobs'));
  const httpClient = options?.httpClient ?? new OutboundPolicy();
  for (const source of locality.sources.filter((s) => s.enabled !== false)) {
    let sourceSucceeded = false;
    let sourceHadSuccessfulRecord = false;
    let currentRecordCount = 0;
    const observedDates: string[] = [];
    const rawDocumentIds: number[] = [];
    const rawVersionIds: number[] = [];
    const fetchAttemptIds: number[] = [];
    const ledgerIds: number[] = [];
    try {
      // SourceConfig can arrive from a persisted/rebuild row rather than the
      // config parser. Re-check the restricted-domain invariant immediately
      // before adapter invocation so direct-fetch adapters cannot bypass it.
      assertSourceRuntimeAccess(source);
      const adapter = getAdapter(source.adapter);
      let raws: FetchResult[];
      try {
        const ledger = await readFetchLedger(ds, source.sourceKey, source.url);
        raws = await adapter.fetch(source, {
          locality,
          blobStore,
          httpClient,
          ...(options?.coverageRange
            ? { coverageRange: options.coverageRange }
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
        // An adapter returning no records has still successfully completed a
        // source cycle; this is distinct from a fetch that failed.
        sourceSucceeded = raws.length === 0;
        if (raws.length === 0) {
          const empty = await persistEmptyFetch(
            ds,
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
        observedDates.push(...observedDatesFromPayload(raw, locality.timezone));
        try {
          const outcome = await persistFetchResult(ds, source.sourceKey, raw);
          if (outcome === 'changed') result.stored += 1;
          if (raw.kind === 'failed') {
            result.errors.push({
              sourceId: source.sourceKey,
              error: raw.error.message,
            });
            await quarantine(
              ds,
              source.sourceKey,
              'gather',
              raw.error,
              raw.requestUrl,
              options,
              `url:${canonicalUrl(raw.url)}`
            );
          } else {
            currentRecordCount += 1;
            const normalizedUrl = canonicalUrl(raw.url);
            const persistedRaw = await ds
              .getRepository(RawDocumentSchema)
              .findOneBy({ sourceId: source.sourceKey, url: normalizedUrl });
            const attempt = await ds
              .getRepository(FetchAttemptSchema)
              .findOne({
                where: {
                  sourceId: source.sourceKey,
                  url: normalizedUrl,
                  attemptedAt: raw.fetchedAt,
                },
                order: { id: 'DESC' },
              });
            const ledger = await ds
              .getRepository(FetchLedgerSchema)
              .findOneBy({ sourceId: source.sourceKey, url: normalizedUrl });
            if (persistedRaw?.id !== undefined)
              rawDocumentIds.push(persistedRaw.id);
            if (
              persistedRaw?.activeVersionId !== undefined &&
              persistedRaw.activeVersionId !== null
            )
              rawVersionIds.push(persistedRaw.activeVersionId);
            if (attempt?.id !== undefined) fetchAttemptIds.push(attempt.id);
            if (ledger?.id !== undefined) ledgerIds.push(ledger.id);
            result.successfulRecords += 1;
            sourceSucceeded = true;
            sourceHadSuccessfulRecord = true;
          }
        } catch (error) {
          result.errors.push({
            sourceId: source.sourceKey,
            error: error instanceof Error ? error.message : String(error),
          });
          await quarantine(
            ds,
            source.sourceKey,
            'gather',
            error,
            undefined,
            options,
            `url:${canonicalUrl(raw.url)}`
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ sourceId: source.sourceKey, error: message });
      await quarantine(
        ds,
        source.sourceKey,
        'gather',
        error,
        undefined,
        options,
        'source-cycle'
      );
    }
    const coverage = options?.coverageRange
      ? buildCoverageRange({
          requestedStart: options.coverageRange.requestedStart,
          requestedEnd: options.coverageRange.requestedEnd,
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
    if (coverage) result.coverageRanges[source.sourceKey] = coverage;
    if (coverage)
      await persistFetchCoverage(ds, source.sourceKey, coverage, {
        ledgerIds,
        attemptIds: fetchAttemptIds,
      });
    result.currentRawDocumentIds.push(...rawDocumentIds);
    result.currentRawVersionIds.push(...rawVersionIds);
    result.currentFetchAttemptIds.push(...fetchAttemptIds);
    result.currentLedgerIds.push(...ledgerIds);
    const outcome: SourceProcessingOutcome = sourceSucceeded
      ? sourceHadSuccessfulRecord
        ? 'records'
        : 'empty'
      : 'failed';
    result.sourceOutcomes.push({
      sourceKey: source.sourceKey,
      outcome,
      rawDocumentIds,
      rawVersionIds,
      fetchAttemptIds,
      ledgerIds,
      ...(coverage ? { coverageRange: coverage } : {}),
    });
    if (sourceSucceeded) result.successfulSources += 1;
  }
  return result;
}

function normalizeFetchError(error: unknown): {
  kind: 'network' | 'timeout' | 'http' | 'decode' | 'size' | 'policy';
  message: string;
  retryable: boolean;
} {
  const message = error instanceof Error ? error.message : String(error);
  const kind = /timeout|abort/i.test(message)
    ? 'timeout'
    : /HTTP\s+\d+/i.test(message)
    ? 'http'
    : 'network';
  return { kind, message, retryable: kind === 'network' || kind === 'timeout' };
}

export function itemHash(
  sourceId: string,
  title: string,
  date?: string,
  scopeSlug?: string,
  stableIdentity?: string
): string {
  return sha256(
    [
      sourceId,
      scopeSlug ?? '',
      stableIdentity?.trim().toLowerCase() ?? title.trim().toLowerCase(),
      stableIdentity ? '' : (date ?? '').trim(),
    ].join('|')
  );
}

export interface ParseResult {
  parsed: number;
  inserted: number;
  /** Successful raw-record parses, including parsers that emit no drafts. */
  successfulSources: number;
  successfulRecords: number;
  /** Civic items represented by the current gather, including idempotent hits. */
  currentItemIds?: number[];
  errors: { sourceId: string; error: string }[];
}

/** Re-parses all raw docs; inserts are idempotent via item hash. */
export async function parseAll(
  ds: DataSource,
  locality: LocalityConfig,
  options?: {
    httpClient?: HttpClient;
    blobStore?: BlobStore;
    runId?: number;
    scopeSlug?: string;
    registry?: LocalityRegistry;
    successfulSourceOutcomes?: readonly GatherSourceOutcome[];
    currentRawDocumentIds?: readonly number[];
    contextRange?: { start: string; end: string };
  }
): Promise<ParseResult> {
  const result: ParseResult = {
    parsed: 0,
    inserted: 0,
    successfulSources: 0,
    successfulRecords: 0,
    currentItemIds: [],
    errors: [],
  };
  const successfulSources = new Set<string>();
  const successfulRecordCounts = new Map<string, number>();
  const failedSources = new Set<string>();
  const rawRepo = ds.getRepository(RawDocumentSchema);
  const itemRepo = ds.getRepository(CivicItemSchema);
  const bySource = new Map<string, SourceConfig>(
    locality.sources
      .filter((s) => s.enabled !== false)
      .map((s) => [s.sourceKey, s])
  );
  const raws = options?.currentRawDocumentIds
    ? options.currentRawDocumentIds.length
      ? await rawRepo.find({
          where: { id: In(options.currentRawDocumentIds) },
          order: { id: 'ASC' },
        })
      : []
    : await rawRepo.find();
  const rawCounts = new Map<string, number>();
  for (const raw of raws)
    if (bySource.has(raw.sourceId))
      rawCounts.set(raw.sourceId, (rawCounts.get(raw.sourceId) ?? 0) + 1);
  for (const outcome of options?.successfulSourceOutcomes ?? []) {
    if (
      outcome.outcome === 'empty' &&
      bySource.has(outcome.sourceKey) &&
      !rawCounts.has(outcome.sourceKey)
    )
      successfulSources.add(outcome.sourceKey);
  }
  const httpClient = options?.httpClient ?? new OutboundPolicy();
  for (const raw of raws) {
    const source = bySource.get(raw.sourceId);
    if (!source) continue;
    try {
      const adapter = getAdapter(source.adapter);
      if (raw.activeVersionId == null) {
        throw new Error('raw document has no active content version');
      }
      const payload = await loadVersionPayload(ds, raw.activeVersionId);
      const drafts: DraftItem[] = await adapter.parse(
        {
          url: raw.url,
          contentType: raw.contentType,
          payload,
          fetchedAt: raw.fetchedAt,
        },
        source,
        {
          blobStore:
            options?.blobStore ??
            createLocalBlobStore(join(process.cwd(), 'data', 'blobs')),
        }
      );
      for (const originalDraft of drafts) {
        const enriched =
          originalDraft.kind === 'news' &&
          (source.adapter === 'rss' || source.adapter === 'news-discover')
            ? await enrichDraft(
                originalDraft,
                { httpClient },
                source,
                originalDraft.observedAt
              )
            : null;
        const d: DraftItem = enriched
          ? {
              ...originalDraft,
              body: enriched.body,
              originalSnippet: enriched.originalSnippet,
              publisher: enriched.publisher,
              originalUrl: originalDraft.originalUrl ?? originalDraft.uris?.[0],
              canonicalUrl: enriched.canonicalUrl,
              articleProvenance: enriched.provenance,
              contentChecksum: enriched.provenance.checksum,
              uris: [
                ...new Set([
                  ...(originalDraft.uris ?? []),
                  ...(enriched.canonicalUrl ? [enriched.canonicalUrl] : []),
                  enriched.provenance.resolvedUrl,
                  ...(enriched.provenance.redirectChain ?? []),
                ]),
              ],
              ...(enriched.accessMode
                ? { accessMode: enriched.accessMode }
                : {}),
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
          : originalDraft;
        const date = d.eventDate ?? d.publishedAt;
        if (
          options?.contextRange &&
          date &&
          !isDayInContextWindow(
            itemLocalDate(
              {
                eventDate: d.eventDate ?? null,
                publishedAt: d.publishedAt ?? null,
              },
              locality.timezone
            ),
            options.contextRange,
            d.kind
          )
        )
          continue;
        const scope = options?.registry
          ? resolveItemScope(source, d.jurisdictionSlug, options.registry)
          : null;
        result.parsed += 1;
        const hash = itemHash(
          source.sourceKey,
          d.title,
          date,
          scope?.scopeSlug ?? locality.slug,
          d.externalId ?? d.canonicalUrl ?? d.originalUrl
        );
        const exists = await itemRepo.find({ where: { hash } });
        if (exists.length) {
          for (const item of exists)
            if (item.id !== undefined) result.currentItemIds!.push(item.id);
          continue;
        }
        await itemRepo.save({
          sourceId: source.sourceKey,
          // Items belong to the source owner, so every edition that shares
          // the source sees the same row regardless of which ran first.
          localitySlug: source.ownerSlug ?? locality.slug,
          scopeSlug: scope?.scopeSlug ?? null,
          scopeKind: scope?.scopeKind ?? null,
          jurisdictionSlug: d.jurisdictionSlug ?? null,
          kind: d.kind,
          title: d.title,
          body: d.body,
          summary: null,
          publishedAt: d.publishedAt ?? null,
          eventDate: d.eventDate ?? null,
          topics: d.topics ? JSON.stringify(d.topics) : null,
          uris: d.uris ? JSON.stringify(d.uris) : null,
          originalSnippet: d.originalSnippet ?? null,
          publisher: d.publisher ?? null,
          canonicalUrl: d.canonicalUrl ?? null,
          articleProvenance: d.articleProvenance
            ? JSON.stringify(d.articleProvenance)
            : null,
          contentChecksum: d.contentChecksum ?? null,
          caseId: d.caseId ?? null,
          matterId: d.matterId ?? null,
          permitId: d.permitId ?? null,
          externalId: d.externalId ?? null,
          entity: d.entity ?? null,
          action: d.action ?? null,
          accessMode: d.accessMode ?? null,
          accessRestrictionReason: d.accessRestrictionReason ?? null,
          restrictionPolicyUrl: d.restrictionPolicyUrl ?? null,
          aggregateDiscovery: d.aggregateDiscovery ?? null,
          aggregateUrl: d.aggregateUrl ?? null,
          unresolvedAggregateLink: d.unresolvedAggregateLink ?? null,
          observedAt: d.observedAt ?? null,
          hash,
          createdAt: new Date().toISOString(),
        });
        result.inserted += 1;
        const saved = await itemRepo.findOneBy({ hash });
        if (saved?.id !== undefined) result.currentItemIds!.push(saved.id);
      }
      // Credit the raw record only after enrichment and every durable item
      // write for it has completed. An empty draft list is a successful parse.
      result.successfulRecords += 1;
      successfulRecordCounts.set(
        source.sourceKey,
        (successfulRecordCounts.get(source.sourceKey) ?? 0) + 1
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ sourceId: source.sourceKey, error: message });
      failedSources.add(source.sourceKey);
      try {
        await quarantine(
          ds,
          source.sourceKey,
          'parse',
          error,
          raw.url,
          options,
          `raw:${raw.id ?? 'unknown'}:version:${
            raw.activeVersionId ?? 'unknown'
          }:url:${canonicalUrl(raw.url)}`
        );
      } catch {
        // Preserve the original record error if diagnostic persistence itself fails.
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

/** The stored content for a raw document version: inline text or a blob reference. */
export async function loadVersionPayload(
  ds: DataSource,
  versionId: number
): Promise<RawDocumentInput['payload']> {
  const version = await ds
    .getRepository(RawDocumentVersionSchema)
    .findOneBy({ id: versionId });
  if (!version) return { kind: 'text', body: '' };
  if (version.payloadKind === 'text')
    return { kind: 'text', body: version.body ?? '' };
  return { kind: 'blob-ref', ref: JSON.parse(version.blobRef ?? '{}') };
}

export interface Cluster {
  kind: CivicKind;
  topic: string;
  items: CivicItemRow[];
}

/** Stable identity of the evidence window used to synthesize an edition.
 * Include policy-relevant fields and body content so a newly discovered or
 * reclassified historical item invalidates strict publication reuse even when
 * the daily item IDs are unchanged. */
export function contextEvidenceFingerprint(
  items: readonly CivicItemRow[],
  contextStart: string,
  contextEnd: string
): string {
  const evidence = items
    .map((item) => ({
      sourceKey: item.sourceId,
      civicItemId: item.id,
      hash: item.hash,
      bodySha256: sha256(item.body),
      title: item.title,
      eventDate: item.eventDate,
      publishedAt: item.publishedAt,
      accessMode: item.accessMode,
      accessRestrictionReason: item.accessRestrictionReason,
      restrictionPolicyUrl: item.restrictionPolicyUrl,
      aggregateDiscovery: item.aggregateDiscovery,
      aggregateUrl: item.aggregateUrl,
      geographyDecision: item.geographyDecision,
      geographyEvidence: item.geographyEvidence,
      scopeSlug: item.scopeSlug,
      scopeKind: item.scopeKind,
      jurisdictionSlug: item.jurisdictionSlug,
      unresolvedAggregateLink: item.unresolvedAggregateLink,
      canonicalUrl: item.canonicalUrl,
    }))
    .sort(
      (a, b) =>
        a.sourceKey.localeCompare(b.sourceKey) ||
        (a.civicItemId ?? 0) - (b.civicItemId ?? 0)
    );
  return sha256(
    JSON.stringify({
      synthesisContractVersion: SYNTHESIS_CONTRACT_VERSION,
      storySynthesisContractVersion: STORY_SYNTHESIS_CONTRACT_VERSION,
      contextStart,
      contextEnd,
      evidence,
    })
  );
}

/** LLM repair hook. Strict callers must receive the complete evidence
 * identity; the legacy string form is retained only for fixture callers. */
export interface AgendaFixupInput {
  body: string;
  sourceKey: string;
  civicItemId: number;
  runId?: string;
}
export type AgendaFixup = (
  input: AgendaFixupInput
) => Promise<
  {
    section: string;
    heading: string;
    body: string;
    citations?: import('./types.js').LlmCitation[];
  }[]
>;

export interface ExtractResult {
  items: number;
  threads: number;
  fixedByLlm: number;
  /** Optional diagnostic: deterministic agenda extraction remains usable. */
  fixupFailures: number;
}

/**
 * Agenda documents are often OCR'd and can repeat a numbered item inside one
 * section.  The database identity is (item, section, ordinal), so blindly
 * persisting those drafts makes a valid document abort the whole extraction.
 * Keep exact repeats out, while assigning the next deterministic ordinal to
 * a distinct draft that reuses an ordinal.  This preserves both pieces of
 * agenda evidence instead of silently dropping one or relying on a database
 * constraint error.
 */
/** Orders and renumbers extracted rows so a document's rows are stable. */
export function normalizeAgendaDrafts(
  drafts: readonly AgendaItemDraft[]
): AgendaItemDraft[] {
  const used = new Map<string, Set<number>>();
  const contentKeys = new Set<string>();
  const normalized: AgendaItemDraft[] = [];
  for (const draft of drafts) {
    const section = draft.section.trim() || 'General';
    const requestedOrdinal =
      Number.isInteger(draft.ordinal) && draft.ordinal > 0 ? draft.ordinal : 1;
    const contentKey = [
      section.toLowerCase(),
      requestedOrdinal,
      draft.heading.trim().toLowerCase(),
      draft.body.trim(),
    ].join('\u0000');
    if (contentKeys.has(contentKey)) continue;
    contentKeys.add(contentKey);
    const sectionOrdinals = used.get(section) ?? new Set<number>();
    let ordinal = requestedOrdinal;
    while (sectionOrdinals.has(ordinal)) ordinal += 1;
    sectionOrdinals.add(ordinal);
    used.set(section, sectionOrdinals);
    normalized.push({ ...draft, section, ordinal });
  }
  return normalized;
}

/** A row's identity within its document: section plus position. */
export function agendaIdentity(section: string, ordinal: number): string {
  return `${section}\u0000${ordinal}`;
}

/** Reconcile one document's derived agenda rows as one atomic unit.  This is
 * intentionally scoped by civic item ID: a corrupt/partial extraction cannot
 * affect another meeting, while retrying can repair rows left by older
 * per-row persistence. */
async function persistAgendaDocument(
  ds: DataSource,
  itemId: number,
  localitySlug: string,
  meetingDate: string | null,
  drafts: readonly AgendaItemDraft[]
): Promise<number> {
  return ds.transaction(async (manager) => {
    const repo = manager.getRepository(AgendaItemSchema);
    const existing = await repo.find({
      where: { itemId },
      order: { id: 'ASC' },
    });
    const byIdentity = new Map<string, AgendaItemRow>();
    const duplicateIds: number[] = [];
    for (const row of existing) {
      const key = agendaIdentity(row.section, row.ordinal);
      if (byIdentity.has(key)) {
        if (row.id !== undefined) duplicateIds.push(row.id);
      } else {
        byIdentity.set(key, row);
      }
    }
    const expected = new Map(
      drafts.map((draft) => [
        agendaIdentity(draft.section, draft.ordinal),
        draft,
      ])
    );
    const staleIds = existing
      .filter(
        (row) =>
          row.id !== undefined &&
          !expected.has(agendaIdentity(row.section, row.ordinal))
      )
      .map((row) => row.id as number);
    const deleteIds = [...new Set([...staleIds, ...duplicateIds])];
    if (deleteIds.length) await repo.delete(deleteIds);

    let inserted = 0;
    for (const draft of drafts) {
      const existingRow = byIdentity.get(
        agendaIdentity(draft.section, draft.ordinal)
      );
      const values = {
        localitySlug,
        meetingDate,
        section: draft.section,
        ordinal: draft.ordinal,
        heading: draft.heading,
        body: draft.body,
        topicKey: topicKey(`${draft.heading} ${draft.body}`),
        procedural: draft.procedural,
      };
      if (existingRow?.id !== undefined) {
        await repo.update(existingRow.id, values);
      } else {
        await repo.insert({
          itemId,
          ...values,
          createdAt: new Date().toISOString(),
        });
        inserted += 1;
      }
    }
    return inserted;
  });
}

/**
 * One article can arrive twice (a publisher feed and a search result that
 * resolved to it); show it once, keeping the copy with a lead. Agenda lines
 * share their document URL and are all kept.
 */
/** Wording that reports a decision rather than a scheduled item. */
export const STORY_DECISION =
  /\b(?:approved?|approves|adopted?|adopts|denied|denies|rejected?|rejects|passed|voted?|votes|terminated?|terminates|appointed?|appoints|awarded?|awards|authorized?|authorizes|hired?|hires|fired?|fires)\b|\bsets?\s+(?:the\s+)?(?:millage|tax|rate|rates|budget|fee|fees)\b/iu;

/** A story's claim on the reader: its subject plus its strongest piece of evidence. */
export function storyImportance(view: ProjectedStoryView): number {
  const subject = scoreNewsworthiness({ title: view.story.title }).score;
  const evidence = view.items.length
    ? Math.max(
        ...view.items.map(
          (item) =>
            scoreNewsworthiness({
              title: item.title,
              body: item.body,
              kind: item.kind,
            }).score
        )
      )
    : 0;
  return subject + evidence;
}

export function dedupeArticleUpdates<
  T extends { url?: string; detail?: string; article: boolean }
>(updates: readonly T[]): Omit<T, 'article'>[] {
  const byArticleUrl = new Map<string, number>();
  const kept: T[] = [];
  for (const update of updates) {
    const seen =
      update.article && update.url ? byArticleUrl.get(update.url) : undefined;
    if (seen === undefined) {
      if (update.article && update.url)
        byArticleUrl.set(update.url, kept.length);
      kept.push(update);
    } else if (update.detail && !kept[seen]!.detail) kept[seen] = update;
  }
  return kept.map(({ article: _article, ...update }) => update);
}

/** Rule extraction for meeting docs; LLM fixup only when rules find <2 items. */
export async function extractAgenda(
  ds: DataSource,
  /** An edition (its run sources select the documents) or an owner slug. */
  locality: string | Pick<LocalityConfig, 'slug' | 'sources'>,
  fixup?: AgendaFixup,
  contextRange?: { start: string; end: string },
  timezone = 'UTC',
  runId?: number
): Promise<ExtractResult> {
  const result: ExtractResult = {
    items: 0,
    threads: 0,
    fixedByLlm: 0,
    fixupFailures: 0,
  };
  const itemRepo = ds.getRepository(CivicItemSchema);
  const localitySlug = typeof locality === 'string' ? locality : locality.slug;
  const sourceKeys =
    typeof locality === 'string'
      ? []
      : locality.sources.map((source) => source.sourceKey);
  const docs = (
    await itemRepo.find({
      where: sourceKeys.length
        ? { sourceId: In(sourceKeys), kind: 'meeting' }
        : { localitySlug, kind: 'meeting' },
    })
  ).filter((doc) => {
    const day = itemLocalDate(doc, timezone);
    return (
      !contextRange || !day || isDayInContextWindow(day, contextRange, doc.kind)
    );
  });
  let fixupBudget = 6;
  for (const doc of docs) {
    let drafts = ruleExtract(doc.body).map((d) => ({ ...d }));
    // LLM fixup only when rules fail structurally (not when they correctly
    // filter boilerplate). Budgeted per run to bound LLM time.
    if (
      drafts.length < 2 &&
      doc.body.length > 500 &&
      !isOutlineAgenda(doc.body) &&
      fixup &&
      fixupBudget > 0
    ) {
      fixupBudget -= 1;
      try {
        const repaired = await fixup({
          body: doc.body,
          sourceKey: doc.sourceId,
          civicItemId: doc.id as number,
          ...(runId !== undefined ? { runId: String(runId) } : {}),
        });
        const norm = doc.body.toLowerCase().replace(/\s+/g, ' ');
        const valid = repaired.filter((r) =>
          norm.includes(
            r.heading.toLowerCase().replace(/\s+/g, ' ').slice(0, 60)
          )
        );
        if (valid.length >= 2) {
          drafts = valid.map((v, i) => ({
            section: v.section || 'General',
            ordinal: i + 1,
            heading: v.heading.slice(0, 150),
            body: v.body.slice(0, 800),
            procedural: false,
          }));
          result.fixedByLlm += 1;
        }
      } catch {
        result.fixupFailures += 1;
        // keep rule output
      }
    }
    const meetingDate =
      meetingDateFromTitle(doc.title) ?? itemLocalDate(doc, timezone) ?? null;
    const eligibleDrafts = drafts.filter((d) => {
      // Quality floor: an item needs at least two words of text. Agenda item
      // titles are legitimately short ("2. Recovery Proclamation").
      // A section without numbered items is judged by its text.
      const text =
        d.heading === d.section
          ? d.body
          : d.heading.replace(/^\d{1,2}\.\s*/, '');
      if ((text.match(/\p{L}{2,}/gu) ?? []).length < 2) return false;
      if (
        d.body.trim().length < 120 &&
        /^(session\s+)?meeting agenda\b/i.test(
          d.heading.replace(/^[^a-z]+/i, '')
        )
      ) {
        return false;
      }
      return true;
    });
    result.items += await persistAgendaDocument(
      ds,
      doc.id as number,
      doc.localitySlug,
      meetingDate,
      normalizeAgendaDrafts(eligibleDrafts)
    );
  }
  result.threads = (
    await loadThreads(
      ds,
      localitySlug,
      false,
      undefined,
      undefined,
      contextRange,
      timezone,
      sourceKeys
    )
  ).length;
  return result;
}

/** Civic item ids the current rule version projects into this edition. */
export async function projectedStoryItemIds(
  ds: DataSource,
  localitySlug: string,
  ruleVersion: string
): Promise<Set<number>> {
  const editionStories = await ds
    .getRepository(EditionStorySchema)
    .find({ where: { localitySlug, ruleVersion } });
  if (!editionStories.length) return new Set();
  const storyIds = editionStories.map((story) => story.canonicalStoryId);
  const links = await ds
    .getRepository(CanonicalStoryItemSchema)
    .find({ where: { canonicalStoryId: In(storyIds) } });
  const includeRows = await ds
    .getRepository(EditionItemSchema)
    .find({ where: { localitySlug, decision: 'include', ruleVersion } });
  const included = new Set(includeRows.map((row) => row.civicItemId));
  return new Set(
    links.map((link) => link.civicItemId).filter((id) => included.has(id))
  );
}

export interface ProjectedStoryView {
  story: {
    id: number;
    storyKey: string;
    title: string;
    status?: string | null;
  };
  items: ProjectedStoryItem[];
}

/** A projected item retains the canonical link's exact derived agenda row.
 * Agenda rows share one parent CivicItem, so callers must never assume the
 * parent body represents the row-bound evidence. */
export interface ProjectedStoryItem extends CivicItemRow {
  agendaItemId?: number | null;
  /** Title of the meeting document an agenda row came from. */
  documentTitle?: string;
}

function substantiveUndatedItem(item: CivicItemRow): boolean {
  const body = `${item.title} ${item.body}`.trim();
  if (body.length < 80) return false;
  // Generic instructional/navigation fragments have no civic event or
  // outcome to carry into story history without date provenance.
  return !/\b(?:please\s+have\s+your\s+child|complete\s+the\s+following\s+activities|e[-\s]?board\s+directory|navigation|subscribe\s+home)\b/iu.test(
    body
  );
}

/**
 * Whether a projected story is rendered as a story: evidence from two or more
 * records or dates, or a developed revision. A single article is a new item
 * and a single meeting's agenda lines are listed under that meeting.
 */
export function isStoryWorthy(
  view: ProjectedStoryView,
  hasRevision: boolean,
  timezone: string
): boolean {
  if (hasRevision) return true;
  const dates = new Set(
    view.items
      .map((item) => itemEvidenceLocalDate(item, timezone))
      .filter(Boolean)
  );
  const records = new Set(view.items.map((item) => item.id));
  return dates.size >= 2 || records.size >= 2;
}

/** Group lone agenda lines by their meeting document, newest meeting first. */
export function agendaListings(
  views: readonly ProjectedStoryView[],
  timezone: string
): { title: string; date?: string; url?: string; items: string[] }[] {
  const meetings = new Map<
    number,
    { title: string; date?: string; url?: string; items: string[] }
  >();
  for (const item of views.flatMap((view) => view.items)) {
    if (item.kind !== 'meeting') continue;
    const meeting = meetings.get(item.id as number) ?? {
      title: truncate(item.documentTitle ?? item.title, 90),
      ...(itemEvidenceLocalDate(item, timezone)
        ? { date: itemEvidenceLocalDate(item, timezone)! }
        : {}),
      ...(preferredItemUrl(item) ? { url: preferredItemUrl(item)! } : {}),
      items: [],
    };
    const line = item.agendaItemId == null ? '' : evidenceTitle(item.title);
    // Section labels without items ("REGULAR AGENDA", "announcements") are not agenda lines.
    if (
      line &&
      (/^[\p{Lu}\d\s&/.,'-]+$/u.test(line) || line.split(/\s+/u).length < 2)
    ) {
      meetings.set(item.id as number, meeting);
      continue;
    }
    if (line && !meeting.items.includes(line)) meeting.items.push(line);
    meetings.set(item.id as number, meeting);
  }
  return [...meetings.values()]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 4)
    .map((meeting) => ({ ...meeting, items: meeting.items.slice(0, 8) }));
}

/** Read story output through the exact edition-story -> canonical-story-item
 * join.  This deliberately has no agenda/raw fallback. */
export async function loadProjectedStories(
  ds: DataSource,
  localitySlug: string,
  ruleVersion: string,
  timezone = 'UTC'
): Promise<ProjectedStoryView[]> {
  const projections = await ds.getRepository(EditionStorySchema).find({
    where: { localitySlug, ruleVersion },
    order: { canonicalStoryId: 'ASC' },
  });
  if (!projections.length) return [];
  const storyIds = projections.map((projection) => projection.canonicalStoryId);
  const stories = await ds
    .getRepository(CanonicalStorySchema)
    .find({ where: { id: In(storyIds) } });
  const storyById = new Map(
    stories.map((story) => [story.id as number, story])
  );
  const links = await ds
    .getRepository(CanonicalStoryItemSchema)
    .find({ where: { canonicalStoryId: In(storyIds) } });
  const includedItems = new Set(
    (
      await ds.getRepository(EditionItemSchema).find({
        where: { localitySlug, decision: 'include', ruleVersion },
      })
    ).map((row) => row.civicItemId)
  );
  const eligibleLinks = links.filter((link) =>
    includedItems.has(link.civicItemId)
  );
  const itemIds = [...new Set(eligibleLinks.map((link) => link.civicItemId))];
  const items = itemIds.length
    ? await ds
        .getRepository(CivicItemSchema)
        .find({ where: { id: In(itemIds) } })
    : [];
  const itemById = new Map(items.map((item) => [item.id as number, item]));
  const agendaIds = [
    ...new Set(
      eligibleLinks
        .map((link) => link.agendaItemId)
        .filter((id): id is number => id !== null && id !== undefined)
    ),
  ];
  const agendaRows = agendaIds.length
    ? await ds
        .getRepository(AgendaItemSchema)
        .find({ where: { id: In(agendaIds) } })
    : [];
  const agendaById = new Map(agendaRows.map((row) => [row.id as number, row]));
  const byStory = new Map<number, ProjectedStoryItem[]>();
  for (const link of eligibleLinks) {
    const parent = itemById.get(link.civicItemId);
    if (!parent) continue;
    if (link.agendaItemId !== null && link.agendaItemId !== undefined) {
      const agenda = agendaById.get(link.agendaItemId);
      // A deleted/unknown agenda row cannot be represented safely by its
      // parent document. Omit the link and let the story fail closed.
      if (!agenda || agenda.itemId !== link.civicItemId) continue;
      const item: ProjectedStoryItem = {
        ...parent,
        agendaItemId: link.agendaItemId,
        documentTitle: parent.title,
        title: agenda.heading,
        body: agenda.body,
        eventDate: agenda.meetingDate ?? parent.eventDate,
      };
      (
        byStory.get(link.canonicalStoryId) ??
        (byStory.set(link.canonicalStoryId, []),
        byStory.get(link.canonicalStoryId)!)
      ).push(item);
    } else {
      const item: ProjectedStoryItem = { ...parent, agendaItemId: null };
      (
        byStory.get(link.canonicalStoryId) ??
        (byStory.set(link.canonicalStoryId, []),
        byStory.get(link.canonicalStoryId)!)
      ).push(item);
    }
  }
  return projections.flatMap((projection) => {
    const story = storyById.get(projection.canonicalStoryId);
    if (!story || story.id === undefined) return [];
    const storyItems = (byStory.get(projection.canonicalStoryId) ?? []).filter(
      (item) =>
        isEditoriallyEligibleBody(`${item.title} ${item.body}`, item.kind)
    );
    // A durable canonical identity may exist for undated intake, but it is
    // not editorial history until at least one item carries content date or
    // explicit observation provenance.
    if (
      !storyItems.some((item) => itemEvidenceLocalDate(item, timezone)) &&
      !storyItems.some(substantiveUndatedItem)
    )
      return [];
    return [{ story: { ...story, id: story.id }, items: storyItems }];
  });
}

/** Quiet editions may carry only an already-successful, citation-backed story.
 * A canonical row or a raw projected fragment is not proof of a prior
 * verified publication. Every cited item must retain a substantive date (or
 * explicit adapter observation) inside the requested context and the exact
 * locality ancestry. */
/** Stories a quiet edition may carry forward: those whose evidence is still inside the context window. */
export async function filterQuietCarryForwardStories(
  ds: DataSource,
  stories: readonly ProjectedStoryView[],
  contextRange: { start: string; end: string },
  timezone: string,
  localitySlug: string,
  ancestry: readonly string[]
): Promise<ProjectedStoryView[]> {
  if (!stories.length) return [];
  const storyIds = stories.map((view) => view.story.id);
  const revisions = await ds
    .getRepository(CanonicalStoryRevisionSchema)
    .find({ where: { canonicalStoryId: In(storyIds), status: 'successful' } });
  const latest = new Map<number, CanonicalStoryRevisionRow>();
  for (const revision of revisions) {
    const current = latest.get(revision.canonicalStoryId);
    if (!current || (revision.revision ?? 0) > (current.revision ?? 0))
      latest.set(revision.canonicalStoryId, revision);
  }
  if (!latest.size) return [];
  const revisionIds = [...latest.values()]
    .map((revision) => revision.id as number)
    .filter(Number.isInteger);
  const citations = revisionIds.length
    ? await ds
        .getRepository(StoryRevisionCitationSchema)
        .find({ where: { revisionId: In(revisionIds) } })
    : [];
  const allowedScopes = new Set([localitySlug, ...ancestry]);
  return stories.filter((view) => {
    const revision = latest.get(view.story.id);
    if (!revision?.id) return false;
    const revisionCitations = citations.filter(
      (citation) => citation.revisionId === revision.id
    );
    // Citation identity must match the exact projected link. A parent
    // CivicItem citation cannot stand in for an agenda row, and a wrong row
    // ID must prevent quiet carry-forward entirely.
    const cited = revisionCitations.map((citation) =>
      view.items.find(
        (item) =>
          item.id === citation.civicItemId &&
          (citation.agendaItemId === undefined || citation.agendaItemId === null
            ? item.agendaItemId == null
            : item.agendaItemId === citation.agendaItemId)
      )
    );
    if (!cited.length || cited.some((item): item is undefined => !item))
      return false;
    const citedItems = cited as ProjectedStoryItem[];
    if (
      citedItems.some(
        (item) =>
          !allowedScopes.has(item.scopeSlug ?? '') ||
          !isEditoriallyEligibleBody(`${item.title} ${item.body}`, item.kind)
      )
    )
      return false;
    if (
      citedItems.some(
        (item) =>
          !isDayInContextWindow(
            itemEvidenceLocalDate(item, timezone),
            contextRange,
            item.kind
          )
      )
    )
      return false;
    return citedItems.length === revisionCitations.length;
  });
}

export async function loadThreads(
  ds: DataSource,
  localitySlug: string,
  includedOnly = true,
  ruleVersion?: string,
  storyItemIds?: ReadonlySet<number>,
  contextRange?: { start: string; end: string },
  timezone = 'UTC',
  /** When not limited to edition projections, the run's sources select items (otherwise the owner slug does). */
  runSourceKeys: readonly string[] = []
): Promise<Thread[]> {
  const agendaRepo = ds.getRepository(AgendaItemSchema);
  const itemRepo = ds.getRepository(CivicItemSchema);
  const sourceKeys = await loadStoredSourceKeys(ds);
  const exactRuleVersion = includedOnly ? ruleVersion ?? null : null;
  const includedIds = includedOnly
    ? new Set(
        exactRuleVersion
          ? (
              await ds
                .getRepository(EditionItemSchema)
                .find({
                  where: {
                    localitySlug,
                    decision: 'include',
                    ruleVersion: exactRuleVersion,
                  },
                })
            ).map((r) => r.civicItemId)
          : []
      )
    : null;
  if (storyItemIds)
    for (const id of [...(includedIds ?? new Set<number>())])
      if (!storyItemIds.has(id)) includedIds?.delete(id);
  const candidates = includedIds
    ? includedIds.size
      ? await itemRepo.find({ where: { id: In([...includedIds]) } })
      : []
    : await itemRepo.find({
        where: runSourceKeys.length
          ? { sourceId: In([...runSourceKeys]) }
          : { localitySlug },
      });
  if (!candidates.length) return [];
  const rows = await agendaRepo.find({
    where: {
      itemId: In(candidates.map((item) => item.id as number)),
      procedural: false,
    },
  });
  if (!rows.length) return [];
  const docs = new Map<number, CivicItemRow>(
    candidates
      .filter((d) => isEditoriallyEligibleBody(`${d.title} ${d.body}`, d.kind))
      .filter((d) => {
        const day = itemEvidenceLocalDate(d, timezone);
        return (
          !contextRange ||
          !day ||
          isDayInContextWindow(day, contextRange, d.kind)
        );
      })
      .map((d) => [d.id as number, d])
  );
  return buildThreads(
    rows
      .filter((r) => {
        if (!docs.has(r.itemId)) return false;
        if (!contextRange) return true;
        if (!r.meetingDate) return false;
        // Agenda rows belong to meeting documents, so upcoming meetings count.
        return isDayInContextWindow(
          r.meetingDate.slice(0, 10),
          contextRange,
          'meeting'
        );
      })
      .map((r) => {
        const doc = docs.get(r.itemId);
        const uris: string[] = doc?.uris ? JSON.parse(doc.uris) : [];
        return {
          itemId: r.itemId,
          agendaItemId: r.id,
          sourceKey: doc
            ? sourceKeys.get(doc.sourceId) ?? doc.sourceId
            : undefined,
          topicKey: r.topicKey,
          meetingDate: r.meetingDate ?? null,
          heading: r.heading,
          body: r.body,
          itemTitle: doc?.title ?? r.heading,
          uris,
          canonicalUrl: doc?.canonicalUrl ?? null,
          snippetOnly: doc?.accessMode === 'snippet-only',
        };
      })
  );
}

export async function collate(
  ds: DataSource,
  localitySlug: string,
  since?: string,
  /** ISO day (YYYY-MM-DD): news/alerts must be published on/after this. */
  publishedSince?: string,
  ruleVersion?: string,
  timezone = 'UTC',
  publishedEnd?: string,
  contextEnd?: string
): Promise<Cluster[]> {
  // Edition output is a projection, never a direct view over the intake
  // table.  This keeps withhold/uncertain items out even if a caller bypasses
  // the normal briefing orchestration.
  const exactRuleVersion = ruleVersion ?? null;
  if (!exactRuleVersion) return [];
  const editionRows = await ds.getRepository(EditionItemSchema).find({
    where: { localitySlug, decision: 'include', ruleVersion: exactRuleVersion },
    order: { id: 'ASC' },
  });
  const ids = [...new Set(editionRows.map((row) => row.civicItemId))];
  if (!ids.length) return [];
  const items = (
    await ds.getRepository(CivicItemSchema).find({ where: { id: In(ids) } })
  )
    .filter((item) => {
      if (!isEditoriallyEligibleBody(`${item.title} ${item.body}`, item.kind))
        return false;
      if (!since) return true;
      const itemDay = itemEvidenceLocalDate(item, timezone);
      // Context collation may retain undated rows for continuity; the fresh
      // daily filter below still excludes them unless they have observation
      // or content-date evidence.
      return (
        itemDay === null ||
        (itemDay >= since.slice(0, 10) && (!contextEnd || itemDay < contextEnd))
      );
    })
    .sort((a, b) => {
      const ad = a.eventDate ?? '\uffff';
      const bd = b.eventDate ?? '\uffff';
      return (
        ad.localeCompare(bd) ||
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') ||
        (a.id as number) - (b.id as number)
      );
    });
  const fresh = publishedSince
    ? items.filter((i) =>
        isItemInEvidenceRange(
          i,
          publishedSince,
          publishedEnd ?? '9999-12-31',
          timezone
        )
      )
    : items;
  const groups = new Map<string, Cluster>();
  for (const item of fresh) {
    const topics: string[] = item.topics ? JSON.parse(item.topics) : [];
    const key = `${item.kind}|${topics[0] ?? 'general'}`;
    const group = groups.get(key) ?? {
      kind: item.kind as CivicKind,
      topic: topics[0] ?? 'general',
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }
  const kindRank: Record<string, number> = {
    meeting: 0,
    legislation: 1,
    permit: 2,
    alert: 3,
    'open-data': 4,
    news: 5,
  };
  return [...groups.values()].sort(
    (a, b) => (kindRank[a.kind] ?? 9) - (kindRank[b.kind] ?? 9)
  );
}

/**
 * Evidence budget for one brief prompt. The model's context window must hold
 * the rules and every evidence block intact, so a brief cites at most this
 * many of the newest evidence excerpts, each cut to a fixed length. Parent
 * agenda documents are a restricted envelope and only need their header.
 */
export const BRIEF_EVIDENCE_MAX_ITEMS = 24;
export const BRIEF_EVIDENCE_BODY_CHARS = 900;
/** Earlier, dated records given to the article as background: a few per story that moved, and no more overall. */
export const ARTICLE_BACKGROUND_PER_STORY = 3;
export const ARTICLE_BACKGROUND_MAX = 8;
/**
 * The lead is written from the top-ranked evidence, and a claim may only use
 * what its evidence block contains: an article's specific figures ("6.114
 * mills") often sit below a 900-character cut, so a correct lead bullet gets
 * rejected as ungrounded. The items most likely to be cited get more room.
 */
export const BRIEF_LEAD_EVIDENCE_ITEMS = 4;
export const BRIEF_LEAD_BODY_CHARS = 2400;
const PARENT_CONTEXT_CHARS = 600;

export function buildBriefInput(options: {
  locality: Pick<LocalityConfig, 'name' | 'state'>;
  periodStart: string;
  periodEnd: string;
  editionMode?: import('./types.js').EditionMode;
  clusters: readonly Cluster[];
  agendaRowsByItemId: ReadonlyMap<number, readonly AgendaItemRow[]>;
  sourceNames: ReadonlyMap<string, string>;
  clusterCitations?: readonly (
    | readonly import('./types.js').LlmCitation[]
    | undefined
  )[];
}): Parameters<Summarizer['tldr']>[0] {
  const evidenceByCluster = options.clusters.map((cluster) =>
    buildClusterEvidenceItems(
      cluster.items,
      options.agendaRowsByItemId,
      options.sourceNames
    )
  );
  // Editorial order, not arrival order: a tax decision outranks a ball game
  // however recent the game is. Ties fall back to the newer item.
  const ranked = evidenceByCluster
    .flatMap((evidence, clusterIndex) =>
      evidence.map((item, itemIndex) => ({
        clusterIndex,
        itemIndex,
        date: item.date ?? '',
        rank: scoreNewsworthiness({
          title: `${item.heading ?? ''} ${item.title ?? ''}`.trim(),
          body: item.body ?? '',
          kind: options.clusters[clusterIndex]?.kind,
        }),
      }))
    )
    .sort(
      (a, b) =>
        b.rank.score - a.rank.score ||
        b.date.localeCompare(a.date) ||
        a.clusterIndex - b.clusterIndex ||
        a.itemIndex - b.itemIndex
    )
    .slice(0, BRIEF_EVIDENCE_MAX_ITEMS);
  const selected = new Set(
    ranked.map((entry) => `${entry.clusterIndex}:${entry.itemIndex}`)
  );
  const priority = new Map(
    ranked.map((entry, index) => [
      `${entry.clusterIndex}:${entry.itemIndex}`,
      index,
    ])
  );
  const clusterPriority = (index: number): number =>
    Math.min(
      ...[...priority.entries()]
        .filter(([key]) => key.startsWith(`${index}:`))
        .map(([, order]) => order),
      Number.MAX_SAFE_INTEGER
    );
  return {
    locality: `${options.locality.name}, ${options.locality.state}`,
    period: `${options.periodStart} to ${options.periodEnd}`,
    asOf: options.periodEnd,
    ...(options.editionMode ? { editionMode: options.editionMode } : {}),
    clusterSummaries: options.clusters
      .map((cluster, index) => ({ cluster, index }))
      .sort((a, b) => clusterPriority(a.index) - clusterPriority(b.index))
      .flatMap(({ cluster, index }) => {
        const evidence = evidenceByCluster[index]!.map((item, itemIndex) => ({
          item,
          itemIndex,
        }))
          .filter(({ itemIndex }) => selected.has(`${index}:${itemIndex}`))
          .sort(
            (a, b) =>
              (priority.get(`${index}:${a.itemIndex}`) ?? 0) -
              (priority.get(`${index}:${b.itemIndex}`) ?? 0)
          )
          .map(({ item, itemIndex }) => ({
            ...item,
            body: (item.body ?? '').slice(
              0,
              (priority.get(`${index}:${itemIndex}`) ??
                BRIEF_EVIDENCE_MAX_ITEMS) < BRIEF_LEAD_EVIDENCE_ITEMS
                ? BRIEF_LEAD_BODY_CHARS
                : BRIEF_EVIDENCE_BODY_CHARS
            ),
            ...(item.parentDocumentContext
              ? {
                  parentDocumentContext: {
                    ...item.parentDocumentContext,
                    body: item.parentDocumentContext.body?.slice(
                      0,
                      PARENT_CONTEXT_CHARS
                    ),
                  },
                }
              : {}),
          }));
        if (!evidence.length) return [];
        const heading = `${KIND_HEADINGS[cluster.kind] ?? cluster.kind} — ${
          cluster.topic
        }`;
        const first =
          cluster.items[0]?.id !== undefined
            ? summarizerEvidenceForItem(cluster.items[0]!, options.sourceNames)
            : undefined;
        const body = evidence.map((item) => item.body).join('\n');
        const citations = options.clusterCitations?.[index];
        return [
          {
            heading,
            summary: body,
            title: heading,
            // The persisted evidence is the factual input; generated cluster prose is never brief evidence.
            body,
            ...(first
              ? {
                  sourceKey: first.sourceKey,
                  civicItemId: first.civicItemId,
                  ...(first.sourceName ? { sourceName: first.sourceName } : {}),
                  publisher: first.publisher,
                  localitySlug: first.localitySlug,
                  ...(first.scopeSlug ? { scopeSlug: first.scopeSlug } : {}),
                  ...(first.scopeKind ? { scopeKind: first.scopeKind } : {}),
                }
              : {}),
            ...(citations ? { citations } : {}),
            evidence,
          },
        ];
      }),
  } as Parameters<Summarizer['tldr']>[0];
}

export interface DevelopResult {
  stories: {
    threadKey: string;
    title: string;
    status: string;
    file: string;
    model: string;
  }[];
  /** Revision rows staged for the outer briefing publication boundary. */
  revisionInputs?: CanonicalStoryRevisionInput[];
}

/** Develop full stories for top substantive threads.
 *
 * The canonical story is the durable identity.  The markdown file is a
 * rendering artifact and the legacy `stories` table is intentionally left
 * untouched for compatibility with old readers.
 */
export async function developStories(
  ds: DataSource,
  locality: LocalityConfig,
  summarizer: Summarizer,
  limit = 5,
  outputDirectory = join(process.cwd(), 'data', 'stories'),
  publicationLockPath = defaultPublicationLockPath(),
  publicationLockHeld = false,
  contextRange?: { start: string; end: string },
  runId?: number,
  ancestry?: readonly string[],
  deferRevisions = false
): Promise<DevelopResult> {
  if (!publicationLockHeld) {
    return withPublicationLock(publicationLockPath, () =>
      developStories(
        ds,
        locality,
        summarizer,
        limit,
        outputDirectory,
        publicationLockPath,
        true,
        contextRange,
        runId,
        ancestry,
        deferRevisions
      )
    );
  }
  const result: DevelopResult = { stories: [] };
  const projectionRuleVersion = locality.ruleVersion ?? null;
  if (!projectionRuleVersion) return result;
  const sourceKeys = await loadStoredSourceKeys(ds);
  // Stories to develop come from the story engine: the edition's projected
  // stories with evidence from two or more records or dates inside the context
  // window, most recently updated first. The engine is the only place story
  // identity is decided; development never relinks evidence.
  const timezone = locality.timezone;
  const inContext = (item: ProjectedStoryItem) => {
    const day = itemEvidenceLocalDate(item, timezone);
    return (
      !contextRange ||
      (day !== null && day >= contextRange.start && day < contextRange.end)
    );
  };
  // Story projection is idempotent; direct callers may not have run it yet.
  await projectStories(ds, locality.slug, projectionRuleVersion);
  const candidateViews = (
    await loadProjectedStories(
      ds,
      locality.slug,
      projectionRuleVersion,
      timezone
    )
  )
    .filter((view) =>
      view.items.some((item) => item.accessMode !== 'snippet-only')
    )
    .map((view) => ({ ...view, items: view.items.filter(inContext) }))
    .filter((view) => isStoryWorthy(view, false, timezone));
  const newestEvidence = (view: ProjectedStoryView) =>
    view.items
      .map((item) => itemEvidenceLocalDate(item, timezone) ?? '')
      .sort()
      .at(-1) ?? '';
  const threads = candidateViews
    .sort(
      (a, b) =>
        storyImportance(b) - storyImportance(a) ||
        newestEvidence(b).localeCompare(newestEvidence(a))
    )
    .slice(0, limit)
    .map((view) => {
      const items = [...view.items]
        .sort(
          (a, b) =>
            (itemEvidenceLocalDate(a, timezone) ?? '').localeCompare(
              itemEvidenceLocalDate(b, timezone) ?? ''
            ) || (a.id as number) - (b.id as number)
        )
        .map((item) => ({
          itemId: item.id as number,
          ...(item.agendaItemId !== null && item.agendaItemId !== undefined
            ? { agendaItemId: item.agendaItemId }
            : {}),
          sourceKey: sourceKeys.get(item.sourceId) ?? item.sourceId,
          snippetOnly: item.accessMode === 'snippet-only',
          topicKey: view.story.storyKey,
          meetingDate: itemEvidenceLocalDate(item, timezone),
          heading: item.title,
          body: item.body,
          itemTitle: item.documentTitle ?? item.title,
          uris: parseUris(item.uris),
          canonicalUrl: item.canonicalUrl ?? null,
        }));
      return {
        topicKey: view.story.storyKey,
        canonicalStoryId: view.story.id,
        items,
        meetings: [
          ...new Set(
            items
              .map((item) => item.meetingDate)
              .filter((date): date is string => Boolean(date))
          ),
        ],
        related: [] as ThreadRow[],
      };
    });
  const safeStoryThreads = threads;
  const localityName = `${locality.name}, ${locality.state}`;
  const sourceNames = await loadStoredSourceNames(ds);
  const storyEvidenceIds = [
    ...new Set(
      safeStoryThreads.flatMap((thread) =>
        thread.items
          .map((item) => item.itemId)
          .filter((id): id is number => id !== undefined)
      )
    ),
  ];
  const storyEvidenceRows = storyEvidenceIds.length
    ? await ds
        .getRepository(CivicItemSchema)
        .find({ where: { id: In(storyEvidenceIds) } })
    : [];
  const storyEvidenceById = new Map(
    storyEvidenceRows.map((item) => [item.id as number, item])
  );
  const prepared: {
    thread: (typeof threads)[number];
    canonical: CanonicalStoryRow;
    title: string;
    narrative: string;
    status: string;
    model: string;
    markdown: string;
    file: string;
    editionRules: Set<string>;
    analysis?: import('./types.js').LlmStoryAnalysis;
    generationId?: number;
    existingRevision?: import('./schema.js').CanonicalStoryRevisionRow;
    artifactToken: string;
  }[] = [];
  for (const thread of safeStoryThreads) {
    const events = buildAgendaEvidenceEvents(
      thread.items,
      storyEvidenceById,
      sourceNames,
      sourceKeys
    );
    let storyAnalysis: Awaited<ReturnType<Summarizer['developStory']>>;
    try {
      storyAnalysis = await summarizer.developStory({
        topicKey: thread.topicKey,
        events,
        asOf: contextRange?.end,
      });
    } catch (error) {
      // When every claim the model offers for a story fails grounding, that
      // story sits out this edition; its evidence still appears in the
      // agenda and context sections, and the failed attempt is recorded.
      // Other stories and the brief carry on.
      if (!summarizer.strict) throw error;
      continue;
    }
    const { title, status, model, analysis } = storyAnalysis;
    // Legacy/non-strict summarizers may return an empty title. Keep the
    // artifact readable by deriving a deterministic title from the exact
    // evidence row; strict model output is validated upstream.
    const engineStory = await ds
      .getRepository(CanonicalStorySchema)
      .findOneBy({ id: thread.canonicalStoryId });
    const storyTitle =
      title?.trim() ||
      // The engine's story title (from the evidence line or headline) before any document title.
      engineStory?.title?.trim() ||
      thread.items
        .map((item) =>
          item.itemId === undefined
            ? undefined
            : storyEvidenceById.get(item.itemId)?.title?.trim()
        )
        .find(Boolean) ||
      thread.items
        .map((item) => item.itemTitle?.trim() || item.heading?.trim())
        .find(Boolean) ||
      events
        .map((event) => event.heading?.trim() || event.title?.trim())
        .find(Boolean) ||
      thread.topicKey;
    const narrative = analysis?.claims?.length
      ? deriveNarrativeFromClaims(analysis.claims)
      : storyAnalysis.narrative;
    if (summarizer.strict && !analysis)
      throw new Error('strict story analysis is required');
    if (
      summarizer.strict &&
      (!analysis?.claims || analysis.claims.length === 0)
    )
      throw new Error('strict story analysis requires claim-level output');
    if (analysis && analysis.citations.length === 0)
      throw new Error('strict story analysis requires at least one citation');
    // Snippet-only story output is discovery evidence, never a main story or
    // canonical history entry. The successful generation remains observable.
    if (analysis?.relegated) continue;
    const canonical = engineStory;
    // A story is only renderable as a canonical projection.  projectItems is
    // the single identity-creation boundary; direct callers without a prior
    // projection simply produce no canonical story.
    if (!canonical) continue;
    // Strict story generations are immutable revisions.  Their input hash is
    // part of the artifact name, so a changed revision can never replace the
    // bytes (or receipt) of an earlier revision at the shared story path.
    const revisionInputHash =
      analysis && runId !== undefined
        ? analysis.provenance.inputSha256
        : undefined;
    const file = storyFilename(canonical.storyKey, revisionInputHash);
    const agendaOnly =
      thread.items.length > 0 &&
      thread.items.every((item) => {
        if (item.itemId === undefined) return false;
        const original = storyEvidenceById.get(item.itemId);
        return (
          original?.kind === 'meeting' &&
          isAgendaOnlyEvidence(original.title, original.body)
        );
      });
    const timelineEvents = agendaOnly
      ? selectStoryTimelineEvents(events, {
          title: storyTitle,
          claims: analysis?.claims,
          citations: analysis?.citations,
          narrative,
        })
      : events;
    const timeline = timelineEvents.map((e) => ({
      date: e.date,
      heading: e.heading,
      detail: extractOutcome(e.body),
      // Timeline context is source evidence, not additional model prose.
      // `articleUrl` is populated from persisted civic-item URL fields.
      ...(e.articleUrl ? { url: e.articleUrl } : {}),
      ...(e.snippetOnly
        ? (() => {
            const evidenceItem = thread.items.find(
              (item) => item.itemId === e.civicItemId
            );
            return evidenceItem?.itemId !== undefined
              ? { disclosure: snippetDisclosure(evidenceItem) }
              : {};
          })()
        : {}),
    }));
    const markdown = assembleStory({
      locality: localityName,
      title: storyTitle,
      ...(analysis?.titleOrigin ? { titleOrigin: analysis.titleOrigin } : {}),
      status,
      agendaOnly,
      asOf: contextRange?.end,
      narrative,
      timeline,
      meetings: [
        ...new Set(
          timelineEvents
            .map((event) => event.date)
            .filter((date): date is string => Boolean(date))
        ),
      ],
      sources: (
        analysis?.citations ??
        thread.items.map((item) => ({
          sourceKey: item.sourceKey ?? '',
          civicItemId: item.itemId ?? -1,
          snippetOnly: false,
        }))
      ).map((citation: import('./types.js').LlmCitation) => {
        const cited = thread.items.find(
          (item) =>
            item.itemId === citation.civicItemId &&
            (citation.agendaItemId === undefined ||
              item.agendaItemId === citation.agendaItemId) &&
            (!citation.sourceKey || item.sourceKey === citation.sourceKey)
        );
        if (!cited)
          throw new Error(
            `story citation ${citation.sourceKey}/${citation.civicItemId} is not in the candidate evidence`
          );
        const url = cited.canonicalUrl?.trim() || cited.uris[0];
        if (analysis && !url)
          throw new Error(
            `story citation ${citation.sourceKey}/${citation.civicItemId} has no direct article URL`
          );
        return {
          title: cited.itemTitle,
          // This URL comes from the persisted candidate item, never the model.
          url,
          snippetOnly: citation.snippetOnly,
          ...(citation.snippetOnly
            ? { disclosure: snippetDisclosure(cited) }
            : {}),
        };
      }),
      ...(analysis?.limitation ? { limitation: analysis.limitation } : {}),
      model,
      // The edition this revision belongs to, not the machine's clock: a replay
      // of last Tuesday must not claim the story was updated today.
      updatedAt: contextRange?.end ?? localDate(new Date(), locality.timezone),
    });
    const editionRules = new Set<string>();
    for (const item of thread.items) {
      if (item.itemId === undefined) continue;
      const projections = await ds.getRepository(EditionItemSchema).find({
        where: {
          localitySlug: locality.slug,
          civicItemId: item.itemId,
          decision: 'include',
          ruleVersion: projectionRuleVersion,
        },
      });
      for (const projection of projections)
        editionRules.add(projection.ruleVersion);
    }
    if (!editionRules.size)
      editionRules.add(locality.ruleVersion ?? 'unversioned');
    let generationId: number | undefined;
    let existingRevision:
      | import('./schema.js').CanonicalStoryRevisionRow
      | undefined;
    if (analysis && runId !== undefined) {
      const generation = await ds.getRepository(LlmGenerationSchema).findOne({
        where: {
          runId,
          localitySlug: locality.slug,
          operation: 'story',
          inputSha256: analysis.provenance.inputSha256,
        },
        order: { attempt: 'DESC' },
      });
      if (!generation?.id)
        throw new Error(
          `story generation provenance missing for ${locality.slug}`
        );
      generationId = generation.id;
      existingRevision =
        (await ds
          .getRepository(CanonicalStoryRevisionSchema)
          .findOneBy({
            canonicalStoryId: canonical.id as number,
            inputSha256: analysis.provenance.inputSha256,
          })) ?? undefined;
      if (existingRevision) {
        // A revision with an older receipt contract is never eligible for
        // reattachment during a full synthesis pass. The briefing shortcut
        // performs the same check, but this guard is required when the
        // shortcut has already been invalidated by another stale field.
        if (!isCurrentStoryArtifactToken(existingRevision.artifactToken)) {
          existingRevision = undefined;
        }
      }
      if (existingRevision) {
        if (
          existingRevision.title !== title ||
          existingRevision.narrative !== narrative ||
          existingRevision.storyStatus !== status
        ) {
          throw new Error(
            `immutable story revision content mismatch for ${canonical.storyKey}`
          );
        }
        const priorCitations = await ds
          .getRepository(StoryRevisionCitationSchema)
          .find({ where: { revisionId: existingRevision.id } });
        const requestedCitations = analysis.citations
          .map(
            (citation) =>
              `${citation.civicItemId}:${citation.agendaItemId ?? ''}:${
                citation.sourceKey
              }:${citation.snippetOnly === true}`
          )
          .sort();
        const storedCitations = priorCitations
          .map(
            (citation) =>
              `${citation.civicItemId}:${citation.agendaItemId ?? ''}:${
                citation.sourceKey
              }:${citation.snippetOnly}`
          )
          .sort();
        if (requestedCitations.join('|') !== storedCitations.join('|'))
          throw new Error(
            `immutable story revision citation binding mismatch for ${canonical.storyKey}`
          );
        generationId = existingRevision.generationId ?? generationId;
      }
    }
    const artifactToken =
      existingRevision?.artifactToken ??
      (revisionInputHash
        ? storyArtifactToken(revisionInputHash)
        : `${process.pid}-${Date.now()}-${prepared.length}`);
    if (
      existingRevision &&
      existingRevision.artifactPath &&
      existingRevision.artifactPath.endsWith(`/${file}`) === false &&
      existingRevision.artifactPath.endsWith(`\\${file}`) === false
    ) {
      throw new Error(
        `legacy shared-path story receipt cannot be safely repaired for ${canonical.storyKey}; use a fresh acceptance output root`
      );
    }
    prepared.push({
      thread,
      canonical,
      title: storyTitle,
      narrative,
      status,
      model,
      markdown,
      file,
      editionRules,
      analysis,
      generationId,
      existingRevision,
      artifactToken,
    });
  }
  assertDistinctStoryNarratives(
    prepared.map((story) => ({
      storyKey: story.canonical.storyKey,
      narrative: story.narrative,
    }))
  );
  const publications: PreparedMarkdown[] = [];
  try {
    const storyRoot = outputDirectory;
    for (const story of prepared) {
      // A previously recorded revision is retried against its same receipt
      // path so a detected corruption can be repaired. New revisions always
      // take the exclusive content-addressed path above and can never replace
      // an earlier artifact.
      publications.push(
        story.analysis && runId !== undefined && !story.existingRevision
          ? await prepareImmutableMarkdown(
              storyRoot,
              locality.slug,
              story.file,
              story.markdown,
              story.artifactToken
            )
          : await prepareMarkdown(
              storyRoot,
              locality.slug,
              story.file,
              story.markdown,
              story.artifactToken
            )
      );
    }
  } catch (error) {
    await Promise.all(publications.map((publication) => publication.abort()));
    throw error;
  }
  const canonicalIds = [
    ...new Set(
      prepared
        .map((story) => story.canonical.id)
        .filter((id): id is number => id !== undefined)
    ),
  ];
  const canonicalRepoBefore = ds.getRepository(CanonicalStorySchema);
  const linkRepoBefore = ds.getRepository(CanonicalStoryItemSchema);
  const editionStoryRepoBefore = ds.getRepository(EditionStorySchema);
  const previousCanonical = canonicalIds.length
    ? await canonicalRepoBefore.find({ where: { id: In(canonicalIds) } })
    : [];
  const previousLinks = canonicalIds.length
    ? await linkRepoBefore.find({
        where: { canonicalStoryId: In(canonicalIds) },
      })
    : [];
  const previousEditionStories = canonicalIds.length
    ? await editionStoryRepoBefore.find({
        where: {
          localitySlug: locality.slug,
          canonicalStoryId: In(canonicalIds),
        },
      })
    : [];
  let revisionInputs: CanonicalStoryRevisionInput[] = [];
  try {
    // Commit artifacts first. Canonical links and current story metadata are
    // changed only after the guarded filesystem boundary succeeds.
    for (const publication of publications) await publication.commit();
    const queryRunner = ds.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const canonicalRepo =
        queryRunner.manager.getRepository(CanonicalStorySchema);
      const linkRepo = queryRunner.manager.getRepository(
        CanonicalStoryItemSchema
      );
      const editionStoryRepo =
        queryRunner.manager.getRepository(EditionStorySchema);
      for (const story of prepared) {
        const now = new Date().toISOString();
        await canonicalRepo.update(
          { id: story.canonical.id as number },
          { title: story.title, status: story.status, updatedAt: now }
        );
        for (const ruleVersion of story.editionRules)
          await editionStoryRepo.upsert(
            {
              localitySlug: locality.slug,
              canonicalStoryId: story.canonical.id as number,
              ruleVersion,
              createdAt: now,
            },
            ['localitySlug', 'canonicalStoryId', 'ruleVersion']
          );
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
    revisionInputs = prepared.flatMap((story, index) => {
      if (!story.analysis || runId === undefined || story.existingRevision)
        return [];
      if (!story.generationId)
        throw new Error(
          `story generation provenance missing for ${locality.slug}`
        );
      return [
        {
          canonicalStoryId: story.canonical.id as number,
          revision: undefined,
          status: 'successful' as const,
          title: story.title,
          titleOrigin: story.analysis.titleOrigin ?? null,
          narrative: story.narrative,
          storyStatus: story.status,
          generationId: story.generationId,
          inputSha256: story.analysis.provenance.inputSha256,
          createdAt: story.analysis.provenance.generatedAt,
          citations: story.analysis.citations.map((citation) => ({
            civicItemId: citation.civicItemId,
            agendaItemId: citation.agendaItemId,
            sourceKey: citation.sourceKey,
            snippetOnly: citation.snippetOnly,
          })),
          publicationReceipt: {
            path: publications[index]!.path,
            sha256: sha256(story.markdown),
            token: story.artifactToken,
          },
        },
      ];
    });
    if (!deferRevisions)
      await appendCanonicalStoryRevisions(ds, revisionInputs);
    for (const story of prepared) {
      result.stories.push({
        threadKey: story.canonical.storyKey,
        title: story.title,
        status: story.status,
        file: story.file,
        model: story.model,
      });
    }
  } catch (error) {
    await Promise.allSettled(
      publications.map((publication) => publication.rollback())
    );
    const compensationRunner = ds.createQueryRunner();
    await compensationRunner.connect();
    try {
      await compensationRunner.startTransaction();
      const manager = compensationRunner.manager;
      if (canonicalIds.length) {
        await manager
          .getRepository(CanonicalStoryItemSchema)
          .delete({ canonicalStoryId: In(canonicalIds) });
        await manager
          .getRepository(EditionStorySchema)
          .delete({
            localitySlug: locality.slug,
            canonicalStoryId: In(canonicalIds),
          });
        await manager
          .getRepository(CanonicalStorySchema)
          .save(previousCanonical);
        if (previousLinks.length)
          await manager
            .getRepository(CanonicalStoryItemSchema)
            .save(previousLinks);
        if (previousEditionStories.length)
          await manager
            .getRepository(EditionStorySchema)
            .save(previousEditionStories);
      }
      await compensationRunner.commitTransaction();
    } catch (compensationError) {
      await compensationRunner.rollbackTransaction();
      throw new AggregateError(
        [error, compensationError],
        'story publication failed and database compensation failed'
      );
    } finally {
      await compensationRunner.release();
    }
    throw error;
  }
  return deferRevisions ? { ...result, revisionInputs } : result;
}

export interface BriefResult {
  markdown: string;
  briefingId: number;
  model: string;
  /** Story revisions staged by a deferred outer publication boundary. */
  storyRevisions?: CanonicalStoryRevisionInput[];
  /** Fingerprint of the complete eligible context window used by strict synthesis. */
  contextEvidenceFingerprint?: string;
  contextItemIds?: number[];
}

function citationUrl(
  citation: import('./types.js').LlmCitation,
  items: ReadonlyMap<number, CivicItemRow>
): string | undefined {
  const item = items.get(citation.civicItemId);
  if (
    !item ||
    item.sourceId !== citation.sourceKey ||
    item.unresolvedAggregateLink === true
  )
    return undefined;
  return preferredItemUrl(item);
}

export function renderAnalysisClaim(
  text: string,
  citations: readonly import('./types.js').LlmCitation[] | undefined,
  limitation: string | undefined,
  items: ReadonlyMap<number, CivicItemRow>,
  relegated = false
): string {
  if (citations !== undefined && citations.length === 0)
    throw new Error('strict LLM analysis requires at least one citation');
  const links = [
    ...new Set(
      (citations ?? [])
        .map((citation) => citationUrl(citation, items))
        .filter((url): url is string => Boolean(url))
    ),
  ];
  if (citations?.some((citation) => !citationUrl(citation, items)))
    throw new Error('validated LLM citation has no direct stored article URL');
  const prefix = relegated
    ? 'Discovery/coverage note (limited-access source): '
    : '';
  const restricted = [
    ...new Set(
      (citations ?? [])
        .filter((citation) => citation.snippetOnly === true)
        .map((citation) => citation.civicItemId)
    ),
  ]
    .map((id) => items.get(id))
    .filter((item): item is CivicItemRow => Boolean(item));
  const disclosure = restricted.length
    ? `\n\n${restricted.map((item) => snippetDisclosure(item)).join('\n\n')}${
        limitation?.trim() ? `\n\nModel limitation: ${limitation.trim()}` : ''
      }`
    : limitation?.trim()
    ? `\n\n${limitation.trim()}`
    : '';
  return `${prefix}${text.trim()}${
    links.length ? ` ${links.map((url) => `[source](${url})`).join(' ')}` : ''
  }${disclosure}`;
}

export interface BriefCoverageGap {
  sourceKey: string;
  stage: 'gather' | 'parse' | 'project';
  reason: string;
  sourceName?: string;
  accessRestrictionReason?: string;
  restrictionPolicyUrl?: string;
  /** Diagnostic-only aggregate link; never an article citation. */
  aggregateUrl?: string;
  /** A direct publisher URL is included only when explicitly configured. */
  directPublisherUrl?: string;
}

/** Name each gap by its source. Projection gaps ("item:<id>") name only the item's source: a withheld item's title belongs to another edition. */
/** Turns recorded gaps into reader-facing lines naming the source and what was missed. */
export async function labelCoverageGaps(
  ds: DataSource,
  gaps: readonly BriefCoverageGap[],
  sourceNames: ReadonlyMap<string, string>
): Promise<BriefCoverageGap[]> {
  const itemIds = gaps
    .map((gap) => /^item:(\d+)$/u.exec(gap.sourceKey)?.[1])
    .filter((id): id is string => Boolean(id))
    .map(Number);
  const items = itemIds.length
    ? new Map(
        (
          await ds
            .getRepository(CivicItemSchema)
            .find({ where: { id: In(itemIds) } })
        ).map((item) => [`item:${item.id}`, item])
      )
    : new Map<string, CivicItemRow>();
  return gaps.map((gap) => {
    if (gap.sourceName) return gap;
    const item = items.get(gap.sourceKey);
    const sourceName = item
      ? sourceNames.get(item.sourceId) ?? item.sourceId
      : gap.sourceKey === '__config__'
      ? 'Locality configuration'
      : sourceNames.get(gap.sourceKey);
    return sourceName ? { ...gap, sourceName } : gap;
  });
}

/** Render coverage diagnostics without presenting an aggregate URL as a citation. */
export function renderCoverageGapMarkdown(gap: BriefCoverageGap): string {
  const label = gap.sourceName ?? 'Configured source';
  const restriction = gap.accessRestrictionReason
    ? ` Access restriction: ${gap.accessRestrictionReason}.`
    : '';
  const policy = gap.restrictionPolicyUrl
    ? ` Policy: [publisher access policy](${gap.restrictionPolicyUrl}).`
    : '';
  const direct = gap.directPublisherUrl
    ? ` Read the publisher directly: [publisher link](${gap.directPublisherUrl}).`
    : '';
  const aggregate = gap.aggregateUrl
    ? ` Diagnostic-only aggregate: ${gap.aggregateUrl}.`
    : '';
  const details = `${restriction}${policy}${direct}${aggregate}`;
  const separator = details
    ? /\s$/u.test(gap.reason) || /[.!?]$/u.test(gap.reason)
      ? ''
      : '.'
    : '';
  return `- ${gap.stage} · ${label}: ${gap.reason}${separator}${details}`;
}

const UNCONFIRMED_RANGE =
  'source does not document date or pagination coverage capability';

/**
 * The coverage notes under an edition. Real gaps — a source that failed, was
 * paused, withheld items for access reasons, or skipped days — are listed one
 * by one. Two routine kinds are counted instead: regional items set aside
 * because they do not mention the town (the projection working as meant),
 * and sources that cannot confirm they returned everything for the period.
 */
export function renderCoverageNotes(gaps: readonly BriefCoverageGap[]): string {
  const offTopic = gaps.filter(
    (gap) =>
      gap.stage === 'project' &&
      /^withhold: does not mention /u.test(gap.reason)
  );
  const unconfirmed = gaps.filter((gap) => gap.reason === UNCONFIRMED_RANGE);
  const real = gaps.filter(
    (gap) => !offTopic.includes(gap) && !unconfirmed.includes(gap)
  );
  const names = (list: readonly BriefCoverageGap[]) =>
    [...new Set(list.map((gap) => gap.sourceName ?? 'Configured source'))].join(
      ', '
    );
  const lines = real.map(renderCoverageGapMarkdown);
  if (offTopic.length)
    lines.push(
      `- Set aside ${
        offTopic.length
      } regional item(s) that do not name this town: ${names(offTopic)}.`
    );
  if (unconfirmed.length)
    lines.push(
      `- ${
        new Set(unconfirmed.map((gap) => gap.sourceKey)).size
      } source(s) cannot confirm they returned every record for the period: ${names(
        unconfirmed
      )}.`
    );
  const summary = real.length
    ? `Coverage gaps (${real.length}): sources that failed, paused, or withheld items`
    : 'Coverage notes';
  return `<details>\n<summary>${summary}</summary>\n\n${lines.join(
    '\n'
  )}\n\n</details>\n`;
}

/** Section titles for each kind of record, as a reader sees them. */
export const KIND_HEADINGS: Record<string, string> = {
  meeting: 'Council & Meetings',
  legislation: 'Policy & Legislation',
  permit: 'Planning & Permits',
  alert: 'Alerts & Open Data',
  'open-data': 'Alerts & Open Data',
  news: 'Local News',
};

/** What composing an edition needs from the run that is publishing it. */
export interface ComposeEditionContext {
  ds: DataSource;
  locality: LocalityConfig;
  cadence: Cadence;
  periodStart: string;
  periodEnd: string;
  editionMode?: import('./types.js').EditionMode;
  summarizer: Summarizer;
  clusters: Awaited<ReturnType<typeof collate>>;
  contextClusters: Awaited<ReturnType<typeof collate>>;
  sections: {
    heading: string;
    summary: string;
    rawSummary: string;
    citations?: import('./types.js').LlmCitation[];
    items: {
      title: string;
      date?: string;
      url?: string;
      disclosure?: string;
    }[];
  }[];
  agendaRowsByItemId: Map<number, AgendaItemRow[]>;
  sourceNames: ReadonlyMap<string, string>;
  usedModels: Set<string>;
  deterministicQuietDay: boolean | undefined;
  deterministicInitialEmpty: boolean | undefined;
  runId?: number;
  coverageRange?: { start: string; end: string } | CoverageRange;
  projectionRuleVersion: string | null;
  developLimit: number;
  ancestry?: readonly string[];
  contextSince?: string;
  freshnessScope?: FreshnessScope;
  communityDirectory?: string;
  /** Develops the stories behind this edition; each engine supplies its own story stage. */
  develop: (
    storyContext: { start: string; end: string } | undefined
  ) => ReturnType<typeof developStories>;
}

/**
 * The edition itself, from the evidence the run has collated: the lead, the
 * stories, what is coming up, and the rendered markdown. One definition,
 * called by the reference pipeline and the Nest pipeline alike, so the two
 * cannot drift apart in what a reader sees.
 */
export async function composeEdition(context: ComposeEditionContext) {
  const {
    ds,
    locality,
    cadence,
    periodStart,
    periodEnd,
    editionMode,
    summarizer,
    clusters,
    contextClusters,
    sections,
    agendaRowsByItemId,
    sourceNames,
    usedModels,
    deterministicQuietDay,
    deterministicInitialEmpty,
    runId,
    coverageRange,
    projectionRuleVersion,
    developLimit,
    ancestry,
    contextSince,
    freshnessScope,
    communityDirectory,
    develop,
  } = context;

  // Full stories first so the briefing links to developed articles.
  const storyContext = coverageRange
    ? 'start' in coverageRange
      ? coverageRange
      : { start: coverageRange.requestedStart, end: coverageRange.requestedEnd }
    : undefined;
  const developed =
    projectionRuleVersion &&
    developLimit > 0 &&
    !deterministicQuietDay &&
    !deterministicInitialEmpty
      ? await develop(storyContext)
      : { stories: [] };
  const storyByKey = new Map(
    developed.stories.map((s) => [
      s.threadKey,
      `../../stories/${locality.slug}/${s.file}`,
    ])
  );
  for (const s of developed.stories) usedModels.add(s.model);

  // Stories: dated updates from the story engine. Stories updated in this
  // period come first; ongoing stories follow (more of them on a town's first
  // edition, which has no earlier briefing to point back to).
  const threads: OutsiderThread[] = [];
  const projectedIds = projectionRuleVersion
    ? await projectedStoryItemIds(ds, locality.slug, projectionRuleVersion)
    : new Set<number>();
  const projectedStories = projectionRuleVersion
    ? (
        await loadProjectedStories(
          ds,
          locality.slug,
          projectionRuleVersion,
          locality.timezone
        )
      )
        .filter((view) =>
          view.items.some((item) => projectedIds.has(item.id as number))
        )
        // A story backed exclusively by snippets is discovery/coverage evidence,
        // never a durable main-story history entry. Mixed evidence remains in
        // the story view and receives the adjacent limitation disclosure below.
        .filter((view) =>
          view.items.some((item) => item.accessMode !== 'snippet-only')
        )
    : [];
  const carryForwardStories =
    deterministicQuietDay && storyContext
      ? await filterQuietCarryForwardStories(
          ds,
          projectedStories,
          storyContext,
          locality.timezone,
          locality.slug,
          ancestry ?? []
        )
      : projectedStories;
  // A story needs more than one agenda line: coverage on two or more dates, a
  // news article or other non-meeting record, or a developed (cited) story
  // revision. A lone agenda line is listed under its meeting instead.
  const viewStoryIds = carryForwardStories.map((view) => view.story.id);
  const revisedStoryIds = new Set([
    ...(viewStoryIds.length
      ? await ds
          .getRepository(CanonicalStoryRevisionSchema)
          .find({
            where: { canonicalStoryId: In(viewStoryIds), status: 'successful' },
          })
      : []
    ).map((revision) => revision.canonicalStoryId),
    ...(developed.revisionInputs ?? []).map(
      (revision) => revision.canonicalStoryId
    ),
  ]);
  const firstEdition = !(await ds
    .getRepository(BriefingSchema)
    .createQueryBuilder('briefing')
    .where(
      'briefing.localitySlug = :slug AND briefing.cadence = :cadence AND briefing.periodEnd <= :start',
      { slug: locality.slug, cadence, start: periodStart }
    )
    .getCount());
  // What counts as news: what is dated since the last edition. A town's first
  // edition has no last edition, so its news is the past week — not the six
  // months of context behind it, which the article may use only as dated
  // background. Undated evidence is never news: it cannot be placed in time.
  // A quiet day is one with nothing new in the day itself, so its window is the day.
  const newsStart =
    !deterministicQuietDay && (firstEdition || editionMode === 'bootstrap')
      ? backfillSince(periodEnd, 7)
      : periodStart;
  const inPeriod = (date: string | null) =>
    Boolean(date && date >= newsStart && date < periodEnd);
  // A story with nothing new for two weeks is no longer carried.
  const openSince = backfillSince(periodEnd, 14);
  const latestDate = (view: ProjectedStoryView) =>
    view.items
      .map((item) => itemEvidenceLocalDate(item, locality.timezone) ?? '')
      .sort()
      .at(-1) ?? '';
  const worthy = carryForwardStories
    .filter((view) =>
      isStoryWorthy(view, revisedStoryIds.has(view.story.id), locality.timezone)
    )
    // A run of ball games is a sequence, not a civic story.
    .filter((view) => storyImportance(view) >= 0);
  // Consequence first, then recency: a tax decision outranks an agenda line
  // filed a day later.
  const byImportance = (a: ProjectedStoryView, b: ProjectedStoryView) =>
    storyImportance(b) - storyImportance(a) ||
    latestDate(b).localeCompare(latestDate(a));
  const updatedStories = worthy
    .filter((view) =>
      view.items.some((item) =>
        inPeriod(itemEvidenceLocalDate(item, locality.timezone))
      )
    )
    .sort(byImportance);
  // Stories not updated in this edition are carried only on a quiet day, as
  // what is still open, and only while they have moved in the last two weeks.
  const ongoingStories = deterministicQuietDay
    ? worthy
        .filter(
          (view) =>
            !updatedStories.includes(view) && latestDate(view) >= openSince
        )
        .sort(byImportance)
        .slice(0, 3)
    : [];
  const storyViews = [...updatedStories.slice(0, 8), ...ongoingStories];
  const shownInStories = new Set<number>();
  const loneViews = carryForwardStories.filter(
    (view) => !worthy.includes(view)
  );
  const agendas = agendaListings(loneViews, locality.timezone);
  // Older records are not listed as if they were news; the article may draw
  // on them only as dated background to something new.
  // A meeting document listed under "On the agenda" is not repeated as a new item.
  for (const view of loneViews)
    for (const item of view.items)
      if (
        item.agendaItemId !== null &&
        item.agendaItemId !== undefined &&
        inPeriod(itemEvidenceLocalDate(item, locality.timezone))
      )
        shownInStories.add(item.id as number);
  // Items in a story updated today are shown there, not repeated as new items.
  for (const view of updatedStories)
    for (const item of view.items)
      if (inPeriod(itemEvidenceLocalDate(item, locality.timezone)))
        shownInStories.add(item.id as number);
  for (const view of storyViews) {
    const orderedItems = [...view.items].sort(
      (a, b) =>
        (itemEvidenceLocalDate(a, locality.timezone) ?? '').localeCompare(
          itemEvidenceLocalDate(b, locality.timezone) ?? ''
        ) || (a.id as number) - (b.id as number)
    );
    const latestRevision = await ds
      .getRepository(CanonicalStoryRevisionSchema)
      .findOne({
        where: { canonicalStoryId: view.story.id, status: 'successful' },
        order: { revision: 'DESC' },
      });
    // Deferred publication stages a new immutable revision until the outer
    // briefing transaction. Prefer that staged view so this briefing never
    // renders the prior database revision while a new one is in flight.
    const stagedRevision = developed.revisionInputs?.find(
      (revision) => revision.canonicalStoryId === view.story.id
    );
    const effectiveStoryTitle =
      stagedRevision?.title?.trim() || view.story.title;
    const narrative =
      stagedRevision?.narrative?.trim() ||
      latestRevision?.narrative?.trim() ||
      '';
    // Quiet editions keep their carried-forward background paragraph.
    const quietBackground = deterministicQuietDay
      ? orderedItems
          .map((item) => {
            const body = truncateSentences(cleanEditorialBody(item.body), 300);
            return isEditoriallyEligibleBody(`${item.title} ${body}`, item.kind)
              ? body
              : '';
          })
          .filter(Boolean)
          .join(' ')
      : '';
    const history = deterministicQuietDay
      ? narrative || quietBackground
        ? `Carried forward/background: ${narrative || quietBackground}`
        : ''
      : narrative;
    const meetings = [
      ...new Set(
        orderedItems
          .map((item) => itemEvidenceLocalDate(item, locality.timezone))
          .filter(Boolean) as string[]
      ),
    ];
    const links = orderedItems.map((item) => ({
      title: item.title,
      url: preferredItemUrl(item),
      publisher: item.publisher ?? null,
    }));
    const allUpdates = orderedItems.map((item) => {
      const date = itemEvidenceLocalDate(item, locality.timezone);
      const agendaLine =
        item.agendaItemId !== null && item.agendaItemId !== undefined;
      // Publication metadata ("Published 1:20 pm Monday, September 7, 2026") is not part of the lead.
      const lead =
        !agendaLine && item.kind !== 'meeting'
          ? truncateSentences(
              cleanEditorialBody(item.body).replace(
                /^Published\s+\d{1,2}:\d{2}\s*[ap]\.?m\.?\s+\p{L}+,\s+\p{L}+\s+\d{1,2},\s+\d{4}\s*(?:By\s+[^\n.]{2,60}?\s+(?=\p{Lu}{2,}|\p{Lu}\p{Ll}))?/iu,
                ''
              ),
              280
            )
          : '';
      return {
        ...(date ? { date } : {}),
        text: agendaLine
          ? `${evidenceTitle(item.title)} — ${
              item.documentTitle ?? 'meeting agenda'
            }`
          : `${item.title}${item.publisher ? ` — ${item.publisher}` : ''}`,
        ...(lead &&
        isEditoriallyEligibleBody(`${item.title} ${lead}`, item.kind)
          ? { detail: lead }
          : {}),
        ...(preferredItemUrl(item) ? { url: preferredItemUrl(item)! } : {}),
        current: inPeriod(date),
        article: !agendaLine,
      };
    });
    const updates = dedupeArticleUpdates(allUpdates);
    // A council acts between editions; the decision reaches the record either
    // in minutes or in the paper. Until one of them reports it, say so plainly
    // instead of leaving the reader to assume nothing happened.
    const decided =
      [...orderedItems]
        .reverse()
        .find(
          (item) => item.kind !== 'meeting' && STORY_DECISION.test(item.title)
        ) ??
      [...orderedItems]
        .reverse()
        .find(
          (item) =>
            /minutes/iu.test(item.documentTitle ?? item.title) &&
            STORY_DECISION.test(item.body)
        );
    const outcome = decided
      ? {
          ...(itemEvidenceLocalDate(decided, locality.timezone)
            ? { date: itemEvidenceLocalDate(decided, locality.timezone)! }
            : {}),
          text: `${decided.title}${
            decided.publisher ? ` — ${decided.publisher}` : ''
          }`,
          ...(preferredItemUrl(decided)
            ? { url: preferredItemUrl(decided)! }
            : {}),
        }
      : undefined;
    const latestItem = orderedItems[orderedItems.length - 1];
    const outcomePending =
      !outcome &&
      Boolean(
        latestItem &&
          (latestItem.kind === 'meeting' ||
            (latestItem.agendaItemId !== null &&
              latestItem.agendaItemId !== undefined))
      );
    const restricted = orderedItems.filter(
      (item) => item.accessMode === 'snippet-only'
    );
    const disclosure = restricted.length
      ? [...new Set(restricted.map((item) => snippetDisclosure(item)))].join(
          '\n\n'
        )
      : undefined;
    threads.push({
      heading: effectiveStoryTitle,
      history,
      meetings,
      links,
      updates,
      ...(outcome ? { outcome } : {}),
      ...(outcomePending ? { outcomePending: true } : {}),
      ...(disclosure ? { disclosure } : {}),
      ...(storyByKey.get(view.story.storyKey) ??
      (stagedRevision?.publicationReceipt.path
        ? `../../stories/${locality.slug}/${basename(
            stagedRevision.publicationReceipt.path
          )}`
        : latestRevision?.artifactPath
        ? `../../stories/${locality.slug}/${basename(
            latestRevision.artifactPath
          )}`
        : undefined)
        ? {
            story:
              storyByKey.get(view.story.storyKey) ??
              (stagedRevision?.publicationReceipt.path
                ? `../../stories/${locality.slug}/${basename(
                    stagedRevision.publicationReceipt.path
                  )}`
                : `../../stories/${locality.slug}/${basename(
                    latestRevision!.artifactPath!
                  )}`),
          }
        : {}),
    });
  }

  const tz = locality.timezone;
  const today = localDate(new Date(), tz);
  // Still ahead: dated meetings and notices, nearest first. Undated items never appear.
  // A meeting dated after the edition lies outside its period, so the
  // edition's own clusters never hold it; the story records do. An agenda
  // posted this week for next Monday belongs here, under its own title.
  const aheadInStories = carryForwardStories
    .flatMap((view) => view.items)
    .filter((item) => item.kind === 'meeting')
    .map(
      (item) =>
        ({ ...item, title: item.documentTitle ?? item.title } as CivicItemRow)
    );
  const upcoming = [
    ...clusters.flatMap((cluster) => cluster.items),
    ...aheadInStories,
  ]
    .filter((i) => (i.eventDate ?? '').slice(0, 10) >= today)
    .sort((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? ''))
    .filter(
      (item, index, all) =>
        all.findIndex((other) => other.id === item.id) === index
    )
    .slice(0, 8)
    .map((i) => ({
      title: i.title,
      date: i.eventDate ?? undefined,
      url: preferredItemUrl(i),
      ...(i.accessMode === 'snippet-only'
        ? { disclosure: snippetDisclosure(i) }
        : {}),
    }));

  // The article's evidence. News is what is dated in this edition's window,
  // most consequential first. Background is a few earlier, dated records of
  // each story that moved, which the article may use only with their dates.
  const newsClusters = (
    editionMode === 'bootstrap' || firstEdition ? contextClusters : clusters
  )
    .map((cluster) => ({
      ...cluster,
      items: cluster.items
        .filter((item) => inPeriod(itemEvidenceLocalDate(item, tz)))
        // Reviews, columns and box scores are not the town's civic record.
        .filter(
          (item) =>
            !isNotCivicRecord(
              scoreNewsworthiness({
                title: item.title,
                body: item.body,
                kind: item.kind,
              })
            )
        )
        // An outline agenda parses completely; one with no business rows is a
        // meeting with nothing on it, which is not news.
        .filter(
          (item) =>
            item.kind !== 'meeting' ||
            Boolean(agendaRowsByItemId.get(item.id as number)?.length) ||
            !isOutlineAgenda(item.body)
        ),
    }))
    .filter((cluster) => cluster.items.length);
  const newsIds = new Set(
    newsClusters.flatMap((cluster) =>
      cluster.items.map((item) => item.id as number)
    )
  );
  const backgroundUnits = updatedStories
    .flatMap((view) =>
      view.items
        .filter((item) => !newsIds.has(item.id as number))
        .filter((item) => {
          const date = itemEvidenceLocalDate(item, tz);
          return Boolean(date && date < newsStart);
        })
        .sort((a, b) =>
          (itemEvidenceLocalDate(b, tz) ?? '').localeCompare(
            itemEvidenceLocalDate(a, tz) ?? ''
          )
        )
        .slice(0, ARTICLE_BACKGROUND_PER_STORY)
    )
    .filter(
      (item, index, all) =>
        all.findIndex(
          (other) =>
            other.id === item.id && other.agendaItemId === item.agendaItemId
        ) === index
    )
    .slice(0, ARTICLE_BACKGROUND_MAX);
  const backgroundEvidence = backgroundUnits
    .flatMap((item) => {
      const rows = buildClusterEvidenceItems(
        [item],
        agendaRowsByItemId,
        sourceNames
      );
      const bound =
        item.agendaItemId !== null && item.agendaItemId !== undefined
          ? rows.filter((row) => row.agendaItemId === item.agendaItemId)
          : rows;
      return (bound.length ? bound : rows).slice(0, 1);
    })
    .map((row) => ({
      ...row,
      role: 'background' as const,
      body: (row.body ?? '').slice(0, BRIEF_EVIDENCE_BODY_CHARS),
    }));
  const briefInput =
    newsClusters.length && !deterministicQuietDay && !deterministicInitialEmpty
      ? buildBriefInput({
          locality,
          periodStart: newsStart,
          periodEnd,
          editionMode,
          clusters: newsClusters,
          agendaRowsByItemId,
          sourceNames,
        })
      : null;
  if (briefInput) {
    for (const summary of briefInput.clusterSummaries) {
      for (const item of (summary as { evidence?: { role?: string }[] })
        .evidence ?? [])
        item.role = 'news';
    }
    if (backgroundEvidence.length) {
      briefInput.clusterSummaries.push({
        heading: 'Background: earlier, dated records of these stories',
        summary: '',
        sourceKey: backgroundEvidence[0]!.sourceKey,
        civicItemId: backgroundEvidence[0]!.civicItemId,
        evidence: backgroundEvidence,
      } as (typeof briefInput.clusterSummaries)[number]);
    }
  }
  // Model evaluation (pnpm eval:llm --inputs) replays the exact brief input
  // an edition would send; this is where it is captured. Off unless set.
  if (briefInput && process.env['CIVIC_CAPTURE_BRIEF_DIR']) {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(process.env['CIVIC_CAPTURE_BRIEF_DIR'], { recursive: true });
    writeFileSync(
      join(
        process.env['CIVIC_CAPTURE_BRIEF_DIR'],
        `${locality.slug}-${cadence}-${periodEnd}.json`
      ),
      `${JSON.stringify(
        {
          locality: locality.slug,
          cadence,
          periodStart,
          periodEnd,
          editionMode: editionMode ?? null,
          input: briefInput,
        },
        null,
        2
      )}\n`
    );
  }
  const tldrResult: Awaited<ReturnType<Summarizer['tldr']>> =
    deterministicQuietDay
      ? { bullets: [], model: 'deterministic-quiet-day' }
      : deterministicInitialEmpty
      ? { bullets: [], model: 'deterministic-initial-empty' }
      : briefInput
      ? await summarizer.tldr(briefInput)
      : // Nothing new to write about: the edition is deterministic, and says so.
        { bullets: [], model: 'deterministic-quiet-day' };
  usedModels.add(tldrResult.model);
  if (summarizer.strict && briefInput && !tldrResult.analysis)
    throw new Error('strict briefing analysis is required');
  const briefingGeneration =
    tldrResult.analysis && runId !== undefined
      ? await ds
          .getRepository(LlmGenerationSchema)
          .findOne({
            where: {
              runId,
              localitySlug: locality.slug,
              operation: 'brief',
              inputSha256: tldrResult.analysis.provenance.inputSha256,
            },
            order: { attempt: 'DESC' },
          })
      : null;
  if (tldrResult.analysis && runId !== undefined && !briefingGeneration)
    throw new Error(`brief generation provenance missing for ${locality.slug}`);

  // Sources are numbered in the order the article first cites them.
  const allItems = new Map(
    [...contextClusters, ...clusters]
      .flatMap((cluster) => cluster.items)
      .map((item) => [item.id as number, item as CivicItemRow])
  );
  for (const item of backgroundUnits)
    if (!allItems.has(item.id as number)) allItems.set(item.id as number, item);
  const sources: ArticleSource[] = [];
  const sourceNumbers = new Map<number, number>();
  const numberFor = (civicItemId: number): number | null => {
    const item = allItems.get(civicItemId);
    if (!item) return null;
    if (!sourceNumbers.has(civicItemId)) {
      sources.push({
        title: item.title,
        ...(preferredItemUrl(item) ? { url: preferredItemUrl(item)! } : {}),
        publisher: sourceNames.get(item.sourceId) ?? item.publisher ?? null,
        ...(itemEvidenceLocalDate(item, tz)
          ? { date: itemEvidenceLocalDate(item, tz)! }
          : {}),
      });
      sourceNumbers.set(civicItemId, sources.length);
    }
    return sourceNumbers.get(civicItemId)!;
  };
  const cited = (citations: readonly { civicItemId: number }[]) => [
    ...new Set(
      citations
        .map((citation) => numberFor(citation.civicItemId))
        .filter((number): number is number => number !== null)
    ),
  ];
  const analysis = tldrResult.analysis;
  let headline: string;
  let paragraphs: { claims: ArticleClaim[] }[];
  let deterministicNews = false;
  if (analysis?.paragraphs?.length) {
    headline =
      analysis.headline ??
      newsClusters[0]?.items[0]?.title ??
      `${locality.name} briefing`;
    paragraphs = analysis.paragraphs
      .map((paragraph) => ({
        claims: paragraph.claims
          // A claim resting only on snippets is discovery, not the town's record.
          .filter((claim) => !claim.relegated)
          .map((claim) => ({
            text: claim.text,
            sources: cited(claim.citations),
            ...(claim.limitation ? { limitation: claim.limitation } : {}),
          })),
      }))
      .filter((paragraph) => paragraph.claims.length);
  } else if (analysis?.bullets.some((claim) => claim.citations.length)) {
    // Cited claims without the article shape (an output recorded before it): one paragraph per claim.
    const claims = analysis.bullets.filter(
      (claim) => claim.citations.length && !claim.relegated
    );
    headline = newsClusters[0]?.items[0]?.title ?? claims[0]!.text;
    paragraphs = claims.map((claim) => ({
      claims: [{ text: claim.text, sources: cited(claim.citations) }],
    }));
  } else if (newsClusters.length) {
    // News without an article from the model: report it plainly — each record
    // by its own title and date, a meeting with the lines on its agenda — every
    // sentence cited. Never "nothing new" when something is.
    const newsItems = newsClusters
      .flatMap((cluster) => cluster.items)
      .filter(
        (item, index, all) =>
          all.findIndex((other) => other.id === item.id) === index
      )
      .sort(
        (a, b) =>
          scoreNewsworthiness({ title: b.title, body: b.body, kind: b.kind })
            .score -
            scoreNewsworthiness({ title: a.title, body: a.body, kind: a.kind })
              .score ||
          (itemEvidenceLocalDate(b, tz) ?? '').localeCompare(
            itemEvidenceLocalDate(a, tz) ?? ''
          )
      )
      .slice(0, 10);
    // An agenda's substance is its items; a section label (APPOINTMENTS, REGULAR AGENDA) is not one.
    const agendaLines = (item: CivicItemRow) =>
      (agendaRowsByItemId.get(item.id as number) ?? [])
        .filter((row) => !row.procedural)
        .map((row) => evidenceTitle(row.heading).replace(/\s+/gu, ' ').trim())
        .filter((line) => line && !/^[^a-z]*$/u.test(line));
    // A file name ("Document 09/14/2026") says nothing: such a record ranks last,
    // never heads the edition, and is named by the source that posted it.
    const bareDocument = (item: CivicItemRow) =>
      /^(?:document|agenda|minutes|packet|meeting)\b[^a-z]*$/iu.test(
        item.title.replace(/\s+/gu, ' ').trim()
      ) && !agendaLines(item).length;
    newsItems.sort((a, b) => Number(bareDocument(a)) - Number(bareDocument(b)));
    headline =
      newsItems
        .map(
          (item) =>
            agendaLines(item)[0] ?? (bareDocument(item) ? null : item.title)
        )
        .find((line): line is string => Boolean(line)) ?? newsItems[0]!.title;
    paragraphs = newsItems.map((item) => {
      const lines = agendaLines(item);
      const when = itemEvidenceLocalDate(item, tz);
      const dated = when ? ` (${proseDate(when, periodEnd.slice(0, 4))})` : '';
      const text = bareDocument(item)
        ? `${
            sourceNames.get(item.sourceId) ?? 'A town source'
          } posted ${item.title.replace(/\s+/gu, ' ').trim()}${dated}.`
        : lines.length
        ? `${item.title
            .replace(/\s+/gu, ' ')
            .trim()}${dated} listed: ${lines.join('; ')}.`
        : `${item.title.replace(/\s+/gu, ' ').trim()}${dated}.`;
      return {
        claims: [
          { text, sources: cited([{ civicItemId: item.id as number }]) },
        ],
      };
    });
    deterministicNews = true;
  } else {
    // Nothing new: say so, then what is still open from the last two weeks.
    headline = `No new public business in ${locality.name}`;
    paragraphs = [
      {
        claims: [
          {
            text: firstEdition
              ? `Daylight found no public business from ${locality.name} dated in the past week.`
              : `Daylight found no new public business from ${locality.name} dated since the last edition.`,
            sources: [],
          },
        ],
      },
    ];
    const stillOpen = (
      deterministicQuietDay
        ? ongoingStories
        : worthy
            .filter((view) => latestDate(view) >= openSince)
            .sort(byImportance)
            .slice(0, 3)
    ).flatMap((view) => {
      const latest = [...view.items]
        .filter((item) => itemEvidenceLocalDate(item, tz))
        .sort((x, y) =>
          (itemEvidenceLocalDate(y, tz) ?? '').localeCompare(
            itemEvidenceLocalDate(x, tz) ?? ''
          )
        )[0];
      if (!latest) return [];
      // An agenda line is named by its own heading and its meeting, not the parent document alone.
      const agendaLine =
        latest.agendaItemId !== null && latest.agendaItemId !== undefined;
      const name = agendaLine
        ? `${evidenceTitle(latest.title)} (${
            latest.documentTitle ?? 'meeting agenda'
          })`
        : latest.title;
      const day = itemEvidenceLocalDate(latest, tz)!;
      // A meeting dated after the edition is still ahead, not the last word.
      const when =
        day > periodEnd
          ? `next on the agenda for ${proseDate(day, periodEnd.slice(0, 4))}`
          : `last on the record ${proseDate(day, periodEnd.slice(0, 4))}`;
      return [
        {
          text: `Still open: “${name.replace(/\s+/gu, ' ').trim()}”, ${when}.`,
          sources: cited([{ civicItemId: latest.id as number }]),
        },
      ];
    });
    if (stillOpen.length) paragraphs.push({ claims: stillOpen });
  }
  const disclosure = deterministicInitialEmpty
    ? INITIAL_BRIEFING_DISCLOSURE
    : analysis
    ? LLM_CLAIM_GROUNDING_DISCLOSURE
    : deterministicNews
    ? DETERMINISTIC_NEWS_DISCLOSURE
    : DETERMINISTIC_QUIET_DAY_DISCLOSURE;
  const sourceFreshness = freshnessScope
    ? await deriveSourceFreshness(
        ds,
        clusters.flatMap((cluster) => cluster.items),
        freshnessScope
      )
    : undefined;
  const community = communityForEdition(
    readCommunitySnapshot(communityDirectory, locality.slug),
    periodStart,
    periodEnd
  );
  const rendered = assembleArticleEdition({
    locality: `${locality.name}, ${locality.state}`,
    cadence,
    periodStart,
    periodEnd,
    headline,
    paragraphs,
    sources,
    upcoming,
    ...(community.quotes.length || community.corrections.length
      ? { community }
      : {}),
    sourceCount: locality.sources.filter((source) => source.enabled !== false)
      .length,
    model: [...usedModels].join('+'),
    disclosure,
    ...(summarizer.strict && contextSince ? { contextSince } : {}),
    ...(summarizer.strict && storyContext
      ? { coverageRange: storyContext }
      : {}),
    ...(summarizer.strict && briefingGeneration?.id !== undefined
      ? { generationId: briefingGeneration.id }
      : {}),
    ...(summarizer.strict && tldrResult.analysis?.provenance.generatedAt
      ? { generatedAt: tldrResult.analysis.provenance.generatedAt }
      : {}),
    ...(sourceFreshness
      ? { sourceFreshness }
      : summarizer.strict
      ? {
          sourceFreshness: [
            ...new Map(
              clusters
                .flatMap((cluster) => cluster.items)
                .map((item) => [
                  item.sourceId,
                  {
                    sourceKey: item.sourceId,
                    sourceName: sourceNames.get(item.sourceId),
                    observedAt: item.observedAt,
                    basis: item.observedAt
                      ? ('observed' as const)
                      : ('unavailable' as const),
                  },
                ])
            ).values(),
          ],
        }
      : {}),
  });
  return { rendered, briefingGeneration, developed };
}

export async function brief(
  ds: DataSource,
  locality: LocalityConfig,
  cadence: Cadence,
  periodStart: string,
  periodEnd: string,
  summarizer: Summarizer,
  since?: string,
  developLimit = 5,
  coverageGaps: readonly BriefCoverageGap[] = [],
  storyOutputDirectory = join(process.cwd(), 'data', 'stories'),
  publicationLockPath = defaultPublicationLockPath(),
  publicationLockHeld = false,
  contextSince?: string,
  coverageRange?: { start: string; end: string } | CoverageRange,
  runId?: number,
  ancestry?: readonly string[],
  deferStoryRevisions = false,
  freshnessScope?: FreshnessScope,
  quietDay = false,
  editionMode?: import('./types.js').EditionMode,
  /** Where the community service writes its snapshots; without it a briefing carries no community material. */
  communityDirectory?: string
): Promise<BriefResult> {
  const projectionRuleVersion = locality.ruleVersion ?? null;
  const clusters = projectionRuleVersion
    ? await collate(
        ds,
        locality.slug,
        contextSince ?? since,
        periodStart,
        projectionRuleVersion,
        locality.timezone,
        periodEnd,
        coverageRange && 'end' in coverageRange ? coverageRange.end : undefined
      )
    : [];
  // Quiet-day output is a strict/live contract. Legacy non-strict callers
  // retain their historical deterministic fallback when they omit the flag.
  const deterministicQuietDay =
    editionMode === 'quiet' ||
    quietDay ||
    (!editionMode && summarizer.strict && clusters.length === 0);
  const deterministicInitialEmpty = editionMode === 'initial-empty';
  const contextEnd = coverageRange
    ? 'end' in coverageRange
      ? coverageRange.end
      : coverageRange.requestedEnd
    : periodEnd;
  const contextClusters =
    summarizer.strict && contextSince
      ? await collate(
          ds,
          locality.slug,
          contextSince,
          undefined,
          projectionRuleVersion ?? undefined,
          locality.timezone,
          undefined,
          contextEnd
        )
      : clusters;
  // A first (bootstrap) edition may have an empty edition day and still summarize its context window.
  const briefingEvidence =
    editionMode === 'bootstrap' ? contextClusters : clusters;
  if (
    summarizer.strict &&
    briefingEvidence.length === 0 &&
    !deterministicQuietDay &&
    !deterministicInitialEmpty
  )
    throw new Error('strict briefing requires at least one evidence cluster');
  const contextFingerprint =
    summarizer.strict && contextSince
      ? contextEvidenceFingerprint(
          contextClusters.flatMap((cluster) => cluster.items),
          contextSince,
          contextEnd
        )
      : undefined;
  const itemRepo = ds.getRepository(CivicItemSchema);
  const sourceNames = await loadStoredSourceNames(ds);
  const agendaRowsByItemId = new Map<number, AgendaItemRow[]>();
  const agendaParents = [
    ...new Set(
      [...contextClusters, ...clusters].flatMap((cluster) =>
        cluster.items
          .filter((item) => item.kind === 'meeting')
          .map((item) => item.id as number)
      )
    ),
  ];
  if (agendaParents.length) {
    for (const row of await ds
      .getRepository(AgendaItemSchema)
      .find({ where: { itemId: In(agendaParents), procedural: false } })) {
      const rows = agendaRowsByItemId.get(row.itemId) ?? [];
      rows.push(row);
      agendaRowsByItemId.set(row.itemId, rows);
    }
  }
  const sections: {
    heading: string;
    summary: string;
    rawSummary: string;
    citations?: import('./types.js').LlmCitation[];
    items: {
      title: string;
      date?: string;
      url?: string;
      disclosure?: string;
    }[];
  }[] = [];
  const usedModels = new Set<string>();

  for (const cluster of clusters) {
    let clusterResult: Awaited<ReturnType<Summarizer['summarizeCluster']>>;
    try {
      clusterResult = await summarizer.summarizeCluster({
        kind: cluster.kind,
        topic: cluster.topic,
        items: buildClusterEvidenceItems(
          cluster.items,
          agendaRowsByItemId,
          sourceNames
        ),
      });
    } catch (error) {
      // A cluster summary is optional context (the briefing lists the cluster's
      // items either way); a strict model failure here must not fail the edition.
      // The failed attempt is already recorded.
      if (!summarizer.strict) throw error;
      clusterResult = { summary: '', model: summarizer.model };
    }
    const { summary, model } = clusterResult;
    const analysis = clusterResult.analysis;
    if (summarizer.strict && !analysis && summary)
      throw new Error('strict cluster analysis is required');
    if (analysis && runId !== undefined) {
      const generation = await ds
        .getRepository(LlmGenerationSchema)
        .findOne({
          where: {
            runId,
            localitySlug: locality.slug,
            operation: 'cluster',
            inputSha256: analysis.provenance.inputSha256,
          },
          order: { attempt: 'DESC' },
        });
      if (!generation)
        throw new Error(
          `cluster generation provenance missing for ${locality.slug}`
        );
    }
    if (summary) {
      usedModels.add(model);
      // Persist per-item summary (first 2 sentences cover the cluster; store ref).
      for (const item of cluster.items) {
        await itemRepo.update({ id: item.id }, { summary });
      }
    }
    const itemMap = new Map(
      cluster.items.map((item) => [item.id as number, item])
    );
    const renderedSummary = analysis
      ? renderAnalysisClaim(
          analysis.summary,
          analysis.citations,
          analysis.limitation,
          itemMap,
          analysis.relegated
        )
      : summary;
    sections.push({
      heading: `${KIND_HEADINGS[cluster.kind] ?? cluster.kind} — ${
        cluster.topic
      }`,
      summary: renderedSummary,
      rawSummary: summary,
      ...(analysis ? { citations: analysis.citations } : {}),
      items: cluster.items.map((i) => {
        const uris: string[] = i.uris ? JSON.parse(i.uris) : [];
        return {
          title: i.title,
          date: i.eventDate ?? i.publishedAt ?? undefined,
          url: preferredItemUrl(i),
          ...(i.accessMode === 'snippet-only'
            ? { disclosure: snippetDisclosure(i) }
            : {}),
        };
      }),
    });
  }

  const { rendered, briefingGeneration, developed } = await composeEdition({
    ds,
    locality,
    cadence,
    periodStart,
    periodEnd,
    editionMode,
    summarizer,
    clusters,
    contextClusters,
    sections,
    agendaRowsByItemId,
    sourceNames,
    usedModels,
    deterministicQuietDay,
    deterministicInitialEmpty,
    runId,
    coverageRange,
    projectionRuleVersion,
    developLimit,
    ancestry,
    contextSince,
    freshnessScope,
    communityDirectory,
    develop: (storyContext) =>
      developStories(
        ds,
        locality,
        summarizer,
        developLimit,
        storyOutputDirectory,
        publicationLockPath,
        publicationLockHeld,
        storyContext,
        runId,
        ancestry,
        deferStoryRevisions
      ),
  });
  const labeledGaps = await labelCoverageGaps(ds, coverageGaps, sourceNames);
  // Coverage gaps are operator diagnostics: one honest line for the reader,
  // the full list behind it. Dozens of near-identical withhold lines above
  // the reporting made the briefing read like a log file.
  const markdown = labeledGaps.length
    ? `${rendered}\n${renderCoverageNotes(labeledGaps)}`
    : rendered;

  const briefingRepo = ds.getRepository(BriefingSchema);
  const ruleVersion = projectionRuleVersion ?? 'unversioned';
  const existingBriefing = await briefingRepo.findOneBy({
    localitySlug: locality.slug,
    cadence,
    periodStart,
    periodEnd,
    ruleVersion,
  });
  const saved = await briefingRepo.save({
    ...(existingBriefing?.id ? { id: existingBriefing.id } : {}),
    localitySlug: locality.slug,
    cadence,
    periodStart,
    periodEnd,
    markdown,
    itemIds: JSON.stringify(clusters.flatMap((c) => c.items.map((i) => i.id))),
    model: [...usedModels].join('+'),
    createdAt: new Date().toISOString(),
    ruleVersion,
    runId: null,
    contextSince: contextSince ?? since ?? null,
    coverageRange:
      coverageRange || contextFingerprint || summarizer.strict
        ? JSON.stringify({
            ...(coverageRange ?? {}),
            ...(summarizer.strict
              ? {
                  synthesisContractVersion:
                    editionMode === 'initial-empty'
                      ? 'initial-empty-v1'
                      : editionMode === 'quiet'
                      ? QUIET_DAY_SYNTHESIS_CONTRACT_VERSION
                      : SYNTHESIS_CONTRACT_VERSION,
                  storySynthesisContractVersion:
                    STORY_SYNTHESIS_CONTRACT_VERSION,
                }
              : {}),
            ...(contextFingerprint
              ? { contextEvidenceFingerprint: contextFingerprint }
              : {}),
            ...(summarizer.strict && contextSince
              ? {
                  contextItemIds: [
                    ...new Set(
                      contextClusters.flatMap((cluster) =>
                        cluster.items.map((item) => item.id as number)
                      )
                    ),
                  ],
                }
              : {}),
          })
        : null,
    briefingGenerationId: briefingGeneration?.id ?? null,
  });

  return {
    markdown,
    briefingId: saved.id as number,
    model: [...usedModels].join('+'),
    ...(developed.revisionInputs?.length
      ? { storyRevisions: developed.revisionInputs }
      : {}),
    ...(contextFingerprint
      ? { contextEvidenceFingerprint: contextFingerprint }
      : {}),
    ...(summarizer.strict && contextSince
      ? {
          contextItemIds: [
            ...new Set(
              contextClusters.flatMap((cluster) =>
                cluster.items.map((item) => item.id as number)
              )
            ),
          ],
        }
      : {}),
  };
}
