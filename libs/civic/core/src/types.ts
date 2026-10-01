import type {
  LocalityKind,
  RuleVersion,
  SourceCoverage,
} from './foundation-types.js';

export type CivicKind =
  | 'meeting'
  | 'legislation'
  | 'permit'
  | 'alert'
  | 'news'
  | 'open-data';

export type Cadence = 'daily' | 'weekly';

export type EditionMode = 'bootstrap' | 'initial-empty' | 'normal' | 'quiet';

export type SourceAccessMode = 'full' | 'snippet-only';

export type LlmOperation =
  | 'cluster'
  | 'brief'
  | 'brief_plan'
  | 'story'
  | 'agenda_fixup';

/** Transport classification only; it is never public editorial prose. */
export type LlmEvidenceKind = 'agenda-row' | 'source-item';

/** Evidence returned by the strict LLM boundary.  URLs in these structures
 * are advisory only; renderers resolve links from persisted CivicItems. */
export interface LlmCitation {
  sourceKey: string;
  civicItemId: number;
  agendaItemId?: number;
  articleUrl?: string;
  snippetOnly?: boolean;
}

/** Independently citation-bound factual statement returned by strict LLMs. */
export interface LlmClaim {
  text: string;
  citations: LlmCitation[];
}

export interface LlmAnalysisProvenance {
  provider: 'ollama';
  baseUrl: string;
  model: string;
  promptSha256: string;
  inputSha256: string;
  outputSha256: string;
  generatedAt: string;
  latencyMs: number;
  attempt: number;
  fallbackUsed: boolean;
  sourceKeys: string[];
  runId?: string;
  operation?: LlmOperation;
  generationSettings?: { temperature?: number; seed?: number; numCtx?: number };
}

export interface LlmClusterAnalysis {
  headline: string;
  summary: string;
  whyItMatters: string;
  citations: LlmCitation[];
  limitation?: string;
  provenance: LlmAnalysisProvenance;
  relegated?: boolean;
}

export interface LlmBriefBullet {
  text: string;
  citations: LlmCitation[];
  limitation?: string;
  relegated?: boolean;
}

export interface LlmBriefAnalysis {
  bullets: LlmBriefBullet[];
  headline?: string;
  headlineOrigin?: 'model' | 'claim' | 'plan' | 'evidence';
  paragraphs?: { claims: LlmBriefBullet[] }[];
  provenance: LlmAnalysisProvenance;
  relegated?: boolean;
}

export interface LlmStoryAnalysis {
  title: string;
  /** Explicitly records a deterministic input-title fallback when used. */
  titleOrigin?: 'model' | 'evidence';
  narrative: string;
  /** Present on strict live output; omitted only for legacy persisted output. */
  claims?: LlmClaim[];
  status: 'decided' | 'pending' | 'ongoing';
  citations: LlmCitation[];
  limitation?: string;
  provenance: LlmAnalysisProvenance;
  relegated?: boolean;
}

export interface SummarizerEvidenceItem {
  /** Exact transport kind used to prevent parent-document leakage. */
  evidenceKind?: LlmEvidenceKind;
  /** News happened in the edition's period; background is earlier, dated evidence from the same stories. */
  role?: 'news' | 'background';
  sourceKey?: string;
  civicItemId?: number;
  agendaItemId?: number;
  title: string;
  body: string;
  date?: string;
  snippetOnly?: boolean;
  accessMode?: SourceAccessMode;
  articleUrl?: string;
  /** Canonical source identity/display metadata loaded from persisted records. */
  sourceName?: string;
  publisher?: string | null;
  localitySlug?: string;
  scopeSlug?: string;
  scopeKind?: LocalityKind;
  /** Original parent CivicItem context; usable only for institutional-role and
   * event-type support, never row-specific dates, numbers, names, outcomes, or
   * meeting occurrence. */
  parentDocumentContext?: { title?: string; body?: string };
}

export type EditorialDesk =
  | 'government'
  | 'schools'
  | 'public-safety'
  | 'weather'
  | 'planning-permits'
  | 'community-news'
  | 'local-reporting';

export interface SourceCoverageCapabilities {
  dateQuery?: {
    parameter: string;
    format: 'YYYY-MM-DD' | 'RFC3339';
  };
  pagination?: {
    mode: 'page' | 'cursor' | 'next-link';
    maxPages: number;
    /** Query parameter for page mode (default `page`; WordPress feeds use `paged`). */
    parameter?: string;
    /**
     * Stop paging once a page reaches back past the requested start, with
     * `maxPages` as the ceiling. A town's first run then reads six months and
     * a daily run reads a page or two, rather than every run reading the same
     * fixed depth.
     */
    untilCovered?: boolean;
  };
}

/** A local-calendar coverage interval. The end date is exclusive. */
export interface CoverageRange {
  requestedStart: string;
  requestedEnd: string;
  observedStart: string | null;
  observedEnd: string | null;
  missingDays: string[];
  reason:
    | 'complete'
    | 'partial-range'
    | 'no-dated-items'
    | 'source-failed'
    | 'unsupported-capability';
}

/** Persisted briefing coverage metadata, including the synthesis contract
 * identity used to decide whether a strict edition may be reused. */
export interface BriefingCoverageMetadata {
  editionMode?: EditionMode;
  contextItemIds?: number[];
  synthesisContractVersion?: string;
  storySynthesisContractVersion?: string;
  contextEvidenceFingerprint?: string;
  [key: string]: unknown;
}

export interface SourceConfig {
  sourceKey: string;
  /** Slug of the locality file that declares (and owns) this source. */
  ownerSlug: string;
  /** Defaults by kind: meeting/permit sources apply to everything below the owner; others need a mention. */
  coverage: SourceCoverage;
  adapter: string;
  name: string;
  url: string;
  kind: CivicKind;
  enabled?: boolean;
  config?: Record<string, unknown>;
  desk?: EditorialDesk;
  accessMode?: SourceAccessMode;
  accessRestrictionReason?: string;
  restrictionPolicyUrl?: string;
  aggregateDiscovery?: boolean;
  aggregateUrl?: string;
  coverageCapabilities?: SourceCoverageCapabilities;
}

/**
 * A locality's officials, as its government publishes them. An account on a
 * listed email domain whose name matches a roster entry may submit as an
 * official; an operator's callback to the published number makes that
 * material the official record. Nothing here is supplied by the applicant.
 */
export interface OfficialsConfig {
  /** Email domains the government issues, lower case, e.g. groton-ct.gov. */
  domains: string[];
  roster: OfficialRosterEntry[];
  /** Where the government publishes the number an operator calls back. */
  callbackNumberSource: string;
}

export interface OfficialRosterEntry {
  name: string;
  office: string;
  /** Where this entry is published. */
  source: string;
}

export interface LocalityConfig {
  slug: string;
  name: string;
  /** Two-letter state code, or US for national roots. */
  state: string;
  timezone: string;
  lat: number;
  lon: number;
  kind: LocalityKind;
  /** Containing localities. Empty for roots; several for places that span boundaries. */
  parents: string[];
  /** True when this locality publishes its own briefing. */
  edition: boolean;
  /** True for places (country, state, region) whose name alone is too general to place an item inside every locality they contain. */
  broad?: boolean;
  aliases?: string[];
  /** Phrases that name a different place sharing this locality's name (for example, "Nashville, Tennessee"). */
  excludePhrases?: string[];
  topics: string[];
  cadence: Cadence[];
  sources: SourceConfig[];
  /** Who may submit as this locality's officials; kept by an operator from the published roster. */
  officials?: OfficialsConfig;
  /**
   * The place's own websites — the town's, the school district's — where the
   * sourcing engine starts looking. Optional: the engine also starts from the
   * sources already configured, and from a search when one is available.
   */
  websites?: string[];
  /** Inclusion-rule version for editions; computed by the registry from the graph. */
  ruleVersion?: RuleVersion;
}

export type FetchErrorKind =
  | 'network'
  | 'timeout'
  | 'http'
  | 'decode'
  | 'size'
  | 'policy';

export interface FetchError {
  kind: FetchErrorKind;
  message: string;
  retryable: boolean;
  status?: number;
  code?: string;
  /** Request/content diagnostics retained for failed binary downloads. */
  url?: string;
  bytes?: number;
  checksum?: string;
}

export interface BlobRef {
  store: string;
  key: string;
  sha256: string;
  bytes: number;
  contentType: string;
}

export type FetchPayload =
  | { kind: 'text'; body: string }
  | { kind: 'blob-ref'; ref: BlobRef };

export interface FetchResultBase {
  url: string;
  requestUrl: string;
  contentType: string;
  fetchedAt: string;
  etag?: string;
  lastModified?: string;
  /** Adapter-observed item dates used to calculate requested coverage. */
  observedDates?: readonly string[];
}

export type FetchResult =
  | (FetchResultBase & {
      kind: 'fetched';
      status: 200 | 206;
      payload: FetchPayload;
    })
  | (FetchResultBase & { kind: 'not_modified'; status: 304; payload?: never })
  | (FetchResultBase & {
      kind: 'failed';
      status: number | null;
      error: FetchError;
      payload?: never;
    });

export interface RawDocumentInput {
  url: string;
  contentType: string;
  payload: FetchPayload;
  fetchedAt: string;
}

/** Runtime resources available while decoding a persisted raw record. */
export interface ParseContext {
  blobStore?: BlobStore;
}

export interface BlobStore {
  put(input: Uint8Array, contentType: string): Promise<BlobRef>;
  get(ref: BlobRef): Promise<Uint8Array>;
  has(ref: BlobRef): Promise<boolean>;
}

/** Normalized but unpersisted item produced by an adapter. */
export interface DraftItem {
  title: string;
  body: string;
  kind: CivicKind;
  publishedAt?: string;
  eventDate?: string;
  topics?: string[];
  uris?: string[];
  originalSnippet?: string;
  publisher?: string | null;
  originalUrl?: string;
  jurisdictionSlug?: string | null;
  alertAreaNames?: string[];
  canonicalUrl?: string | null;
  /** Explicit article URL carried by an aggregate/provider payload. */
  sourceUrl?: string | null;
  /** The publisher's site named by an aggregate item (Google News `<source url>`); never an article URL. */
  publisherHome?: string | null;
  articleProvenance?: ArticleProvenance;
  contentChecksum?: string;
  caseId?: string | null;
  matterId?: string | null;
  permitId?: string | null;
  externalId?: string | null;
  entity?: string | null;
  action?: string | null;
  accessMode?: SourceAccessMode;
  accessRestrictionReason?: string | null;
  restrictionPolicyUrl?: string | null;
  aggregateDiscovery?: boolean;
  aggregateUrl?: string | null;
  /** Metadata describing the aggregate observation; never article body content. */
  aggregateProvenance?: AggregateProvenance | null;
  /** True when only an aggregate/redirect URL was observed. */
  unresolvedAggregateLink?: boolean;
  observedAt?: string;
}

/** `rejected-boilerplate`: the page was fetched but its text was not article prose (menus, listings, link pages). */
export type ArticleExtraction =
  | 'article'
  | 'snippet-fallback'
  | 'fetch-failed'
  | 'rejected-boilerplate';

export interface ExtractionQuality {
  method: 'readability' | 'structure';
  words: number;
  proseRatio: number;
  menuRatio: number;
}

export interface ArticleProvenance {
  originalUrl: string;
  resolvedUrl: string;
  redirectChain?: readonly string[];
  extraction: ArticleExtraction;
  checksum: string;
  publisher: string | null;
  accessMode?: SourceAccessMode;
  accessRestrictionReason?: string | null;
  restrictionPolicyUrl?: string | null;
  aggregateUrl?: string | null;
  observedAt?: string;
  /** Whether canonicalUrl came from an explicit aggregate field. */
  canonicalUrlSource?: 'aggregate-metadata' | 'publisher-fetch' | 'unresolved';
  unresolvedAggregateLink?: boolean;
  policyBlock?: { code: 'restricted-domain'; url: string };
  extractionQuality?: ExtractionQuality;
}

export interface AggregateProvenance {
  aggregateUrl: string;
  observedAt?: string;
  /** direct: the feed carried the publisher URL; publisher-match: found by headline on the publisher's own site. */
  resolution: 'direct' | 'publisher-match' | 'unresolved';
  directPublisherUrl?: string | null;
  /** Publisher listing (sitemap or feed) where a publisher-match was found. */
  publisherListing?: string | null;
}

export interface FetchContext {
  locality: LocalityConfig;
  httpClient: HttpClient;
  signal?: AbortSignal;
  blobStore?: BlobStore;
  conditional?: { etag?: string; lastModified?: string };
  /** Optional requested local interval supplied by the runner. Adapters may
   * use it only when source.coverageCapabilities documents a date parameter. */
  coverageRange?: Pick<CoverageRange, 'requestedStart' | 'requestedEnd'>;
}

export interface HttpClient {
  fetch(input: string, init?: HttpRequestInit): Promise<HttpResponse>;
  /** Check a URL against the outbound policy without fetching it. */
  validate?(value: string, baseUrl?: string): Promise<URL>;
}

export interface HttpRequestInit extends RequestInit {
  readonly maxBytes?: number;
  readonly timeoutMs?: number;
  readonly policy?: {
    readonly allowPublicCrossOriginRedirects?: boolean;
    /** Registrable domains that must be denied before DNS/transport. */
    readonly deniedRegistrableDomains?: readonly string[];
  };
}

export type HttpResponse = Response & {
  readonly finalUrl: string;
  readonly redirectChain: readonly string[];
};

/** Adapter port. Generic protocol adapters; localities are data (YAML). */
export interface SourceAdapter {
  readonly name: string;
  fetch(source: SourceConfig, ctx: FetchContext): Promise<FetchResult[]>;
  parse(
    raw: RawDocumentInput,
    source: SourceConfig,
    ctx?: ParseContext
  ): Promise<DraftItem[]>;
}

/** Summarizer port (implemented in @civic/llm against the gateway). */
export interface Summarizer {
  readonly model: string;
  /** Strict live clients must provide structured, citation-bound analyses. */
  readonly strict?: boolean;
  summarizeCluster(input: {
    kind: CivicKind;
    topic: string;
    items: SummarizerEvidenceItem[];
  }): Promise<{
    summary: string;
    model: string;
    analysis?: LlmClusterAnalysis;
  }>;
  tldr(input: {
    locality: string;
    period: string;
    /** The edition's local date; an agenda dated before it is past. */
    asOf?: string;
    editionMode?: EditionMode;
    clusterSummaries: (SummarizerEvidenceItem & {
      heading: string;
      summary: string;
      citations?: LlmCitation[];
      evidence?: SummarizerEvidenceItem[];
    })[];
  }): Promise<{
    bullets: string[];
    model: string;
    analysis?: LlmBriefAnalysis;
    bulletAnalyses?: LlmBriefAnalysis['bullets'];
  }>;
  summarizeThread(input: {
    topicKey: string;
    events: (SummarizerEvidenceItem & { heading: string })[];
  }): Promise<{ summary: string; model: string; analysis?: LlmStoryAnalysis }>;
  developStory(input: {
    topicKey: string;
    events: (SummarizerEvidenceItem & { heading: string })[];
    /** Local briefing boundary for historical agenda temporal modality. */
    asOf?: string;
  }): Promise<{
    title: string;
    narrative: string;
    status: string;
    model: string;
    analysis?: LlmStoryAnalysis;
  }>;
  fixupAgendaItems?(input: {
    body: string;
    sourceKey: string;
    civicItemId: number;
    runId?: string;
  }): Promise<
    {
      section: string;
      heading: string;
      body: string;
      citations: LlmCitation[];
    }[]
  >;
}
export interface StoredCivicItem {
  id: number;
  sourceId: string;
  scopeSlug: string | null;
  scopeKind: LocalityKind | null;
  jurisdictionSlug: string | null;
  kind: CivicKind;
  title: string;
  body: string;
  summary: string | null;
  publishedAt: string | null;
  eventDate: string | null;
  topics: string[];
  uris: string[];
  hash: string;
  geographyDecision: 'include' | 'withhold' | 'uncertain';
  geographyEvidence: import('./geography.js').GeographyEvidence;
  ruleVersion: string;
  createdAt: string;
  originalSnippet?: string | null;
  publisher?: string | null;
  canonicalUrl?: string | null;
  articleProvenance?: ArticleProvenance | null;
  contentChecksum?: string | null;
  caseId?: string | null;
  matterId?: string | null;
  permitId?: string | null;
  externalId?: string | null;
  entity?: string | null;
  action?: string | null;
  accessMode?: SourceAccessMode | null;
  accessRestrictionReason?: string | null;
  restrictionPolicyUrl?: string | null;
  aggregateDiscovery?: boolean | null;
  aggregateUrl?: string | null;
  aggregateProvenance?: AggregateProvenance | null;
  unresolvedAggregateLink?: boolean | null;
  observedAt?: string | null;
}
