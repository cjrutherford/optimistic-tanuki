import { EntitySchema } from 'typeorm';
import type {
  ArticleProvenance,
  LlmOperation,
  SourceAccessMode,
  EditorialDesk,
} from './types.js';

export interface LocalityRow {
  slug: string;
  name: string;
  state: string;
  timezone: string;
  lat: number;
  lon: number;
  kind?: string | null;
  /** JSON array of parent slugs. */
  parents?: string | null;
  edition?: boolean | null;
  aliases?: string | null;
  ruleVersion?: string | null;
}

export interface SourceRow {
  id: string;
  sourceKey?: string;
  localitySlug?: string | null;
  ownerSlug?: string;
  coverage?: string;
  adapter: string;
  name: string;
  url: string;
  kind: string;
  enabled: boolean;
  config?: string | null;
  desk?: EditorialDesk | null;
  accessMode?: SourceAccessMode | null;
  accessRestrictionReason?: string | null;
  restrictionPolicyUrl?: string | null;
  aggregateDiscovery?: boolean | null;
  aggregateUrl?: string | null;
  coverageCapabilities?: string | null;
  observedAt?: string | null;
}

export interface RawDocumentRow {
  id?: number;
  sourceId: string;
  urlHash: string;
  url: string;
  contentType: string;
  body?: string | null;
  checksum?: string | null;
  fetchedAt: string;
  activeVersionId?: number | null;
}

export interface FetchLedgerRow {
  id?: number;
  sourceId: string;
  url: string;
  lastAttemptAt?: string | null;
  lastSuccessAt?: string | null;
  lastChangedAt?: string | null;
  etag?: string | null;
  lastModified?: string | null;
  lastStatus?: number | null;
  lastChecksum?: string | null;
  consecutiveFailures: number;
  lastError?: string | null;
  observedStart?: string | null;
  observedEnd?: string | null;
  coverageRange?: string | null;
}

export interface FetchAttemptRow {
  id?: number;
  sourceId: string;
  url: string;
  requestUrl: string;
  attemptedAt: string;
  status?: number | null;
  outcome: string;
  etag?: string | null;
  lastModified?: string | null;
  errorKind?: string | null;
  error?: string | null;
  retryable?: boolean | null;
  observedStart?: string | null;
  observedEnd?: string | null;
  coverageRange?: string | null;
}

export interface RawDocumentVersionRow {
  id?: number;
  sourceId: string;
  url: string;
  checksum: string;
  payloadKind: 'text' | 'blob-ref';
  body?: string | null;
  blobRef?: string | null;
  contentType: string;
  fetchedAt: string;
}

export interface CivicItemRow {
  id?: number;
  sourceId: string;
  localitySlug: string;
  scopeSlug?: string | null;
  scopeKind?: string | null;
  jurisdictionSlug?: string | null;
  geographyDecision?: string | null;
  geographyEvidence?: string | null;
  ruleVersion?: string | null;
  kind: string;
  title: string;
  body: string;
  summary?: string | null;
  publishedAt?: string | null;
  eventDate?: string | null;
  topics?: string | null;
  uris?: string | null;
  hash: string;
  createdAt: string;
  originalSnippet?: string | null;
  publisher?: string | null;
  canonicalUrl?: string | null;
  articleProvenance?: ArticleProvenance | string | null;
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
  unresolvedAggregateLink?: boolean | null;
  observedAt?: string | null;
}

export interface BriefingRow {
  id?: number;
  localitySlug: string;
  cadence: string;
  periodStart: string;
  periodEnd: string;
  markdown: string;
  itemIds: string;
  model: string;
  createdAt: string;
  ruleVersion?: string | null;
  runId?: number | null;
  briefingGenerationId?: number | null;
  contextSince?: string | null;
  coverageRange?: string | null;
}

export type PipelineRunStatus =
  | 'running'
  | 'succeeded'
  | 'partial_success'
  | 'failed'
  | 'blocked'
  | 'skipped-overlap';
export type PipelineStageStatus =
  | 'running'
  | 'succeeded'
  | 'partial_success'
  | 'failed'
  | 'skipped';

export interface PipelineRunRow {
  id?: number;
  scopeSlug: string;
  localitySlug: string;
  cadence: string;
  startedAt: string;
  completedAt?: string | null;
  status: PipelineRunStatus;
  currentStage?: string | null;
  ruleVersion: string;
  counts: string;
  coverageGaps: string;
  error?: string | null;
  coverageRanges: string;
}

export interface LlmGenerationRow {
  id?: number;
  runId: number;
  localitySlug: string;
  operation: LlmOperation;
  model: string;
  status: string;
  attempt: number;
  promptSha256: string;
  inputSha256: string;
  outputSha256?: string | null;
  sourceKeys: string;
  output?: string | null;
  error?: string | null;
  generatedAt: string;
  latencyMs: number;
  /** JSON-encoded effective generation controls (including configured numCtx). */
  generationSettings?: string | null;
}

export interface CanonicalStoryRevisionRow {
  id?: number;
  canonicalStoryId: number;
  revision: number;
  status: string;
  title: string;
  titleOrigin?: 'model' | 'evidence' | null;
  narrative: string;
  storyStatus: string;
  generationId?: number | null;
  inputSha256: string;
  createdAt: string;
  artifactPath?: string | null;
  artifactSha256?: string | null;
  artifactToken?: string | null;
}

export interface StoryRevisionCitationRow {
  id?: number;
  revisionId: number;
  civicItemId: number;
  /** Agenda row identity; null preserves legacy parent-only citations. */
  agendaItemId?: number | null;
  sourceKey: string;
  snippetOnly: boolean;
  createdAt: string;
}

export interface PipelineStageRunRow {
  id?: number;
  runId: number;
  stage: string;
  startedAt: string;
  completedAt?: string | null;
  status: PipelineStageStatus;
  counts: string;
  coverageGaps: string;
  error?: string | null;
}

export interface PipelineRunLeaseRow {
  id?: number;
  scopeSlug: string;
  cadence: string;
  ownerId: string;
  runId: number;
  leaseUntil: string;
  createdAt: string;
  updatedAt: string;
}

export const PipelineRunSchema = new EntitySchema<PipelineRunRow>({
  name: 'PipelineRun',
  tableName: 'pipeline_runs',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    scopeSlug: { type: String },
    localitySlug: { type: String },
    cadence: { type: String },
    startedAt: { type: String },
    completedAt: { type: String, nullable: true },
    status: { type: String },
    currentStage: { type: String, nullable: true },
    ruleVersion: { type: String },
    counts: { type: 'text' },
    coverageGaps: { type: 'text' },
    error: { type: 'text', nullable: true },
    coverageRanges: { type: 'text', default: '{}' },
  },
  indices: [{ columns: ['scopeSlug', 'cadence', 'startedAt'] }],
});

export const PipelineStageRunSchema = new EntitySchema<PipelineStageRunRow>({
  name: 'PipelineStageRun',
  tableName: 'pipeline_stage_runs',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    runId: { type: Number },
    stage: { type: String },
    startedAt: { type: String },
    completedAt: { type: String, nullable: true },
    status: { type: String },
    counts: { type: 'text' },
    coverageGaps: { type: 'text' },
    error: { type: 'text', nullable: true },
  },
  indices: [{ columns: ['runId', 'stage'], unique: true }],
});

export const PipelineRunLeaseSchema = new EntitySchema<PipelineRunLeaseRow>({
  name: 'PipelineRunLease',
  tableName: 'pipeline_run_leases',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    scopeSlug: { type: String },
    cadence: { type: String },
    ownerId: { type: String },
    runId: { type: Number },
    leaseUntil: { type: String },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  indices: [
    { columns: ['scopeSlug', 'cadence'], unique: true },
    { columns: ['leaseUntil'] },
    { columns: ['runId'] },
  ],
});

export interface EditionItemRow {
  id?: number;
  localitySlug: string;
  civicItemId: number;
  decision: string;
  reason: string;
  ruleVersion: string;
  createdAt: string;
}

export const EditionItemSchema = new EntitySchema<EditionItemRow>({
  name: 'EditionItem',
  tableName: 'edition_items',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    localitySlug: { type: String },
    civicItemId: { type: Number },
    decision: { type: String },
    reason: { type: String },
    ruleVersion: { type: String },
    createdAt: { type: String },
  },
  indices: [
    { columns: ['localitySlug', 'civicItemId', 'ruleVersion'], unique: true },
  ],
});

export interface AgendaItemRow {
  id?: number;
  itemId: number;
  localitySlug: string;
  meetingDate?: string | null;
  section: string;
  ordinal: number;
  heading: string;
  body: string;
  topicKey: string;
  procedural: boolean;
  createdAt: string;
}

export interface QuarantineRow {
  id?: number;
  targetType?: string;
  targetKey?: string;
  sourceId: string;
  scopeSlug?: string | null;
  runId?: string | null;
  stage: string;
  errorKind?: string | null;
  error: string;
  retryable?: boolean;
  payloadSha256?: string | null;
  payloadBytes?: number | null;
  payloadRef?: string | null;
  payload?: string | null;
  createdAt: string;
}

export const LocalitySchema = new EntitySchema<LocalityRow>({
  name: 'Locality',
  tableName: 'localities',
  columns: {
    slug: { type: String, primary: true },
    name: { type: String },
    state: { type: String },
    timezone: { type: String },
    lat: { type: 'real' },
    lon: { type: 'real' },
    kind: { type: String, nullable: true },
    parents: { type: 'text', nullable: true },
    edition: { type: Boolean, nullable: true },
    aliases: { type: 'text', nullable: true },
    ruleVersion: { type: String, nullable: true },
  },
});

export const SourceSchema = new EntitySchema<SourceRow>({
  name: 'Source',
  tableName: 'sources',
  columns: {
    id: { type: String, primary: true },
    sourceKey: { type: String, nullable: true },
    localitySlug: { type: String, nullable: true },
    ownerSlug: { type: String, nullable: true },
    coverage: { type: String, nullable: true },
    adapter: { type: String },
    name: { type: String },
    url: { type: String },
    kind: { type: String },
    enabled: { type: Boolean, default: true },
    config: { type: 'text', nullable: true },
    desk: { type: String, nullable: true },
    accessMode: { type: String, nullable: true },
    accessRestrictionReason: { type: 'text', nullable: true },
    restrictionPolicyUrl: { type: String, nullable: true },
    aggregateDiscovery: { type: Boolean, nullable: true },
    aggregateUrl: { type: String, nullable: true },
    coverageCapabilities: { type: 'text', nullable: true },
    observedAt: { type: String, nullable: true },
  },
});

export const RawDocumentSchema = new EntitySchema<RawDocumentRow>({
  name: 'RawDocument',
  tableName: 'raw_documents',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    sourceId: { type: String },
    urlHash: { type: String, unique: true },
    url: { type: String },
    contentType: { type: String },
    body: { type: 'text', nullable: true },
    checksum: { type: String, nullable: true },
    fetchedAt: { type: String },
    activeVersionId: { type: Number, nullable: true },
  },
  indices: [{ columns: ['sourceId', 'url'], unique: true }],
});

export const FetchLedgerSchema = new EntitySchema<FetchLedgerRow>({
  name: 'FetchLedger',
  tableName: 'fetch_ledger',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    sourceId: { type: String },
    url: { type: String },
    lastAttemptAt: { type: String, nullable: true },
    lastSuccessAt: { type: String, nullable: true },
    lastChangedAt: { type: String, nullable: true },
    etag: { type: String, nullable: true },
    lastModified: { type: String, nullable: true },
    lastStatus: { type: Number, nullable: true },
    lastChecksum: { type: String, nullable: true },
    consecutiveFailures: { type: Number, default: 0 },
    lastError: { type: 'text', nullable: true },
    observedStart: { type: String, nullable: true },
    observedEnd: { type: String, nullable: true },
    coverageRange: { type: 'text', nullable: true },
  },
  indices: [{ columns: ['sourceId', 'url'], unique: true }],
});

export const FetchAttemptSchema = new EntitySchema<FetchAttemptRow>({
  name: 'FetchAttempt',
  tableName: 'fetch_attempts',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    sourceId: { type: String },
    url: { type: String },
    requestUrl: { type: String },
    attemptedAt: { type: String },
    status: { type: Number, nullable: true },
    outcome: { type: String },
    etag: { type: String, nullable: true },
    lastModified: { type: String, nullable: true },
    errorKind: { type: String, nullable: true },
    error: { type: 'text', nullable: true },
    retryable: { type: Boolean, nullable: true },
    observedStart: { type: String, nullable: true },
    observedEnd: { type: String, nullable: true },
    coverageRange: { type: 'text', nullable: true },
  },
});

export const RawDocumentVersionSchema = new EntitySchema<RawDocumentVersionRow>(
  {
    name: 'RawDocumentVersion',
    tableName: 'raw_document_versions',
    columns: {
      id: { type: Number, primary: true, generated: 'increment' },
      sourceId: { type: String },
      url: { type: String },
      checksum: { type: String },
      payloadKind: { type: String },
      body: { type: 'text', nullable: true },
      blobRef: { type: 'text', nullable: true },
      contentType: { type: String },
      fetchedAt: { type: String },
    },
    indices: [{ columns: ['sourceId', 'url', 'checksum'], unique: true }],
  }
);

export const CivicItemSchema = new EntitySchema<CivicItemRow>({
  name: 'CivicItem',
  tableName: 'civic_items',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    sourceId: { type: String },
    localitySlug: { type: String },
    scopeSlug: { type: String, nullable: true },
    scopeKind: { type: String, nullable: true },
    jurisdictionSlug: { type: String, nullable: true },
    geographyDecision: { type: String, nullable: true },
    geographyEvidence: { type: 'text', nullable: true },
    ruleVersion: { type: String, nullable: true },
    kind: { type: String },
    title: { type: String },
    body: { type: 'text' },
    summary: { type: 'text', nullable: true },
    publishedAt: { type: String, nullable: true },
    eventDate: { type: String, nullable: true },
    topics: { type: 'text', nullable: true },
    uris: { type: 'text', nullable: true },
    hash: { type: String, unique: true },
    createdAt: { type: String },
    originalSnippet: { type: 'text', nullable: true },
    publisher: { type: String, nullable: true },
    canonicalUrl: { type: String, nullable: true },
    articleProvenance: { type: 'text', nullable: true },
    contentChecksum: { type: String, nullable: true },
    caseId: { type: String, nullable: true },
    matterId: { type: String, nullable: true },
    permitId: { type: String, nullable: true },
    externalId: { type: String, nullable: true },
    entity: { type: String, nullable: true },
    action: { type: String, nullable: true },
    accessMode: { type: String, nullable: true },
    accessRestrictionReason: { type: 'text', nullable: true },
    restrictionPolicyUrl: { type: String, nullable: true },
    aggregateDiscovery: { type: Boolean, nullable: true },
    aggregateUrl: { type: String, nullable: true },
    unresolvedAggregateLink: { type: Boolean, nullable: true },
    observedAt: { type: String, nullable: true },
  },
  indices: [{ columns: ['canonicalUrl'], unique: false }],
});

export const BriefingSchema = new EntitySchema<BriefingRow>({
  name: 'Briefing',
  tableName: 'briefings',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    localitySlug: { type: String },
    cadence: { type: String },
    periodStart: { type: String },
    periodEnd: { type: String },
    markdown: { type: 'text' },
    itemIds: { type: 'text' },
    model: { type: String },
    createdAt: { type: String },
    ruleVersion: { type: String, nullable: true },
    runId: { type: Number, nullable: true },
    briefingGenerationId: { type: Number, nullable: true },
    contextSince: { type: String, nullable: true },
    coverageRange: { type: 'text', nullable: true },
  },
});

export const AgendaItemSchema = new EntitySchema<AgendaItemRow>({
  name: 'AgendaItem',
  tableName: 'agenda_items',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    itemId: { type: Number },
    localitySlug: { type: String },
    meetingDate: { type: String, nullable: true },
    section: { type: String },
    ordinal: { type: Number },
    heading: { type: String },
    body: { type: 'text' },
    topicKey: { type: String },
    procedural: { type: Boolean, default: false },
    createdAt: { type: String },
  },
});

export interface StoryRow {
  id?: number;
  localitySlug: string;
  threadKey: string;
  title: string;
  narrative: string;
  timeline: string;
  status?: string | null;
  meetings: string;
  itemTitles: string;
  model: string;
  updatedAt: string;
}

export const StorySchema = new EntitySchema<StoryRow>({
  name: 'Story',
  tableName: 'stories',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    localitySlug: { type: String },
    threadKey: { type: String },
    title: { type: String },
    narrative: { type: 'text' },
    timeline: { type: 'text' },
    status: { type: String, nullable: true },
    meetings: { type: 'text' },
    itemTitles: { type: 'text' },
    model: { type: String },
    updatedAt: { type: String },
  },
  indices: [{ columns: ['localitySlug', 'threadKey'], unique: true }],
});

export interface CanonicalStoryRow {
  id?: number;
  scopeSlug: string;
  scopeKind: string;
  storyKey: string;
  strategy: string;
  title: string;
  status?: string | null;
  createdAt: string;
  updatedAt: string;
  currentRevisionId?: number | null;
  /** Date of the newest evidence linked to the story. */
  lastEvidenceDate?: string | null;
}

export interface CanonicalStoryItemRow {
  id?: number;
  canonicalStoryId: number;
  civicItemId: number;
  /** Agenda row identity; null preserves legacy parent-only links. */
  agendaItemId?: number | null;
  /** Local date of this piece of evidence (meeting date or publication date). */
  evidenceDate?: string | null;
  /** How the evidence joined the story: "opened" or the match signal. */
  matchReason?: string | null;
  matchScore?: number | null;
  createdAt: string;
}

export interface EditionStoryRow {
  id?: number;
  localitySlug: string;
  canonicalStoryId: number;
  ruleVersion: string;
  createdAt: string;
}

export const CanonicalStorySchema = new EntitySchema<CanonicalStoryRow>({
  name: 'CanonicalStory',
  tableName: 'canonical_stories',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    scopeSlug: { type: String },
    scopeKind: { type: String },
    storyKey: { type: String },
    strategy: { type: String },
    title: { type: String },
    status: { type: String, nullable: true },
    createdAt: { type: String },
    updatedAt: { type: String },
    currentRevisionId: { type: Number, nullable: true },
    lastEvidenceDate: { type: String, nullable: true },
  },
  indices: [{ columns: ['scopeSlug', 'scopeKind', 'storyKey'], unique: true }],
});

export const CanonicalStoryItemSchema = new EntitySchema<CanonicalStoryItemRow>(
  {
    name: 'CanonicalStoryItem',
    tableName: 'canonical_story_items',
    columns: {
      id: { type: Number, primary: true, generated: 'increment' },
      canonicalStoryId: { type: Number },
      civicItemId: { type: Number },
      agendaItemId: { type: Number, nullable: true },
      evidenceDate: { type: String, nullable: true },
      matchReason: { type: 'text', nullable: true },
      matchScore: { type: 'float', nullable: true },
      createdAt: { type: String },
    },
    indices: [
      {
        name: 'IDX_canonical_story_items_parent_identity',
        columns: ['canonicalStoryId', 'civicItemId'],
        unique: true,
        where: '"agendaItemId" IS NULL',
      },
      {
        name: 'IDX_canonical_story_items_agenda_identity',
        columns: ['canonicalStoryId', 'civicItemId', 'agendaItemId'],
        unique: true,
        where: '"agendaItemId" IS NOT NULL',
      },
    ],
  }
);

export const EditionStorySchema = new EntitySchema<EditionStoryRow>({
  name: 'EditionStory',
  tableName: 'edition_stories',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    localitySlug: { type: String },
    canonicalStoryId: { type: Number },
    ruleVersion: { type: String },
    createdAt: { type: String },
  },
  indices: [
    {
      columns: ['localitySlug', 'canonicalStoryId', 'ruleVersion'],
      unique: true,
    },
  ],
});

export const QuarantineSchema = new EntitySchema<QuarantineRow>({
  name: 'Quarantine',
  tableName: 'quarantine',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    targetType: { type: String, nullable: true },
    targetKey: { type: String, nullable: true },
    sourceId: { type: String, nullable: true },
    scopeSlug: { type: String, nullable: true },
    runId: { type: String, nullable: true },
    stage: { type: String },
    errorKind: { type: String, nullable: true },
    error: { type: String },
    retryable: { type: Boolean, nullable: true },
    payloadSha256: { type: String, nullable: true },
    payloadBytes: { type: Number, nullable: true },
    payloadRef: { type: String, nullable: true },
    payload: { type: 'text', nullable: true },
    createdAt: { type: String },
  },
});

/** Entity metadata for the isolated migration target (no legacy payload column). */
export const FoundationSourceSchema = new EntitySchema<SourceRow>({
  name: 'FoundationSource',
  tableName: 'sources',
  columns: {
    id: { type: String, primary: true },
    sourceKey: { type: String, unique: true },
    ownerSlug: { type: String },
    coverage: { type: String },
    adapter: { type: String },
    name: { type: String },
    url: { type: String },
    kind: { type: String },
    config: { type: 'text', nullable: true },
    enabled: { type: Boolean, default: true },
    desk: { type: String, nullable: true },
    accessMode: { type: String, nullable: true },
    accessRestrictionReason: { type: 'text', nullable: true },
    restrictionPolicyUrl: { type: String, nullable: true },
    aggregateDiscovery: { type: Boolean, nullable: true },
    aggregateUrl: { type: String, nullable: true },
    coverageCapabilities: { type: 'text', nullable: true },
    observedAt: { type: String, nullable: true },
  },
});

export const LlmGenerationSchema = new EntitySchema<LlmGenerationRow>({
  name: 'LlmGeneration',
  tableName: 'llm_generations',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    runId: { type: Number },
    localitySlug: { type: String },
    operation: { type: String },
    model: { type: String },
    status: { type: String },
    attempt: { type: Number },
    promptSha256: { type: String },
    inputSha256: { type: String },
    outputSha256: { type: String, nullable: true },
    sourceKeys: { type: 'text' },
    output: { type: 'text', nullable: true },
    error: { type: 'text', nullable: true },
    generatedAt: { type: String },
    latencyMs: { type: Number },
    generationSettings: { type: 'text', nullable: true },
  },
  indices: [
    { columns: ['runId', 'operation', 'inputSha256', 'attempt'], unique: true },
  ],
  checks: [
    {
      expression: `"operation" IN ('cluster', 'brief', 'story', 'agenda_fixup')`,
    },
  ],
});

export const CanonicalStoryRevisionSchema =
  new EntitySchema<CanonicalStoryRevisionRow>({
    name: 'CanonicalStoryRevision',
    tableName: 'canonical_story_revisions',
    columns: {
      id: { type: Number, primary: true, generated: 'increment' },
      canonicalStoryId: { type: Number },
      revision: { type: Number },
      status: { type: String },
      title: { type: String },
      titleOrigin: { type: String, nullable: true },
      narrative: { type: 'text' },
      storyStatus: { type: String },
      generationId: { type: Number, nullable: true },
      inputSha256: { type: String },
      createdAt: { type: String },
      artifactPath: { type: String, nullable: true },
      artifactSha256: { type: String, nullable: true },
      artifactToken: { type: String, nullable: true },
    },
    indices: [{ columns: ['canonicalStoryId', 'revision'], unique: true }],
  });

export const StoryRevisionCitationSchema =
  new EntitySchema<StoryRevisionCitationRow>({
    name: 'StoryRevisionCitation',
    tableName: 'story_revision_citations',
    columns: {
      id: { type: Number, primary: true, generated: 'increment' },
      revisionId: { type: Number },
      civicItemId: { type: Number },
      agendaItemId: { type: Number, nullable: true },
      sourceKey: { type: String },
      snippetOnly: { type: Boolean, default: false },
      createdAt: { type: String },
    },
    indices: [
      {
        name: 'IDX_story_revision_citations_parent_identity',
        columns: ['revisionId', 'civicItemId'],
        unique: true,
        where: '"agendaItemId" IS NULL',
      },
      {
        name: 'IDX_story_revision_citations_agenda_identity',
        columns: ['revisionId', 'civicItemId', 'agendaItemId'],
        unique: true,
        where: '"agendaItemId" IS NOT NULL',
      },
    ],
  });

export interface SchemaMetaRow {
  key: string;
  value: string;
}

/** Records the schema version a foundation database was created with. */
export const SchemaMetaSchema = new EntitySchema<SchemaMetaRow>({
  name: 'SchemaMeta',
  tableName: 'schema_meta',
  columns: {
    key: { type: String, primary: true },
    value: { type: String },
  },
});

export interface FoundationQuarantineRow {
  id?: number;
  targetType: string;
  targetKey: string;
  sourceId?: string | null;
  scopeSlug?: string | null;
  runId?: string | null;
  stage: string;
  errorKind?: string | null;
  error: string;
  retryable: boolean;
  payloadSha256?: string | null;
  payloadBytes?: number | null;
  payloadRef?: string | null;
  createdAt: string;
}

export const FoundationQuarantineSchema =
  new EntitySchema<FoundationQuarantineRow>({
    name: 'FoundationQuarantine',
    tableName: 'quarantine',
    columns: {
      id: { type: Number, primary: true, generated: 'increment' },
      targetType: { type: String },
      targetKey: { type: String },
      sourceId: { type: String, nullable: true },
      scopeSlug: { type: String, nullable: true },
      runId: { type: String, nullable: true },
      stage: { type: String },
      errorKind: { type: String, nullable: true },
      error: { type: 'text' },
      retryable: { type: Boolean, default: false },
      payloadSha256: { type: String, nullable: true },
      payloadBytes: { type: Number, nullable: true },
      payloadRef: { type: String, nullable: true },
      createdAt: { type: String },
    },
    indices: [{ columns: ['targetType', 'targetKey'], unique: true }],
  });

export const ALL_SCHEMAS = [
  LocalitySchema,
  SourceSchema,
  RawDocumentSchema,
  CivicItemSchema,
  EditionItemSchema,
  AgendaItemSchema,
  StorySchema,
  CanonicalStorySchema,
  CanonicalStoryItemSchema,
  EditionStorySchema,
  BriefingSchema,
  QuarantineSchema,
  PipelineRunSchema,
  PipelineStageRunSchema,
  PipelineRunLeaseSchema,
  LlmGenerationSchema,
  CanonicalStoryRevisionSchema,
  StoryRevisionCitationSchema,
];

export const FOUNDATION_SCHEMAS = [
  SchemaMetaSchema,
  LocalitySchema,
  FoundationSourceSchema,
  FoundationQuarantineSchema,
  FetchLedgerSchema,
  FetchAttemptSchema,
  RawDocumentVersionSchema,
  RawDocumentSchema,
  CivicItemSchema,
  EditionItemSchema,
  AgendaItemSchema,
  StorySchema,
  BriefingSchema,
  CanonicalStorySchema,
  CanonicalStoryItemSchema,
  EditionStorySchema,
  PipelineRunSchema,
  PipelineStageRunSchema,
  PipelineRunLeaseSchema,
  LlmGenerationSchema,
  CanonicalStoryRevisionSchema,
  StoryRevisionCitationSchema,
];
