import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { In, IsNull, Not, type DataSource } from 'typeorm';
import type {
  BlobStore,
  BriefingCoverageMetadata,
  Cadence,
  CoverageRange,
  HttpClient,
  LocalityConfig,
  SourceConfig,
  Summarizer,
} from './types.js';
import type { LocalityRegistry } from './locality-registry.js';
import { createLocalBlobStore } from './blob-store.js';
import { OutboundPolicy } from './outbound-policy.js';
import {
  ensureLocality,
  gather,
  parseAll,
  extractAgenda,
  collate,
  type AgendaFixup,
  type GatherSourceOutcome,
  sha256,
  contextEvidenceFingerprint,
  isCurrentStoryArtifactToken,
} from './pipeline.js';
import { isItemInLocalRange, projectItems, projectStories } from './edition.js';
import { isEditoriallyEligibleBody } from './article-enrichment.js';
import { backfillSince, localDate, periodFor } from './calendar.js';
import {
  coverageGapForRange,
  matchesConfiguredPublisherIdentity,
} from './coverage.js';
import { publishBriefing } from './brief-publication.js';
import type { brief } from './pipeline.js';
import {
  CanonicalStoryRevisionSchema,
  CanonicalStorySchema,
  EditionStorySchema,
  BriefingSchema,
  FoundationQuarantineSchema,
  PipelineStageRunSchema,
  FetchLedgerSchema,
  type BriefingRow,
} from './schema.js';
import { publicationLockPathFor, publishMarkdown } from './publication.js';
import {
  INITIAL_EMPTY_SYNTHESIS_CONTRACT_VERSION,
  QUIET_DAY_SYNTHESIS_CONTRACT_VERSION,
  STORY_SYNTHESIS_CONTRACT_VERSION,
  SYNTHESIS_CONTRACT_VERSION,
} from './synthesis-contract.js';
import { resolveEditionMode, type EditionMode } from './edition-mode.js';

export type PipelineStage =
  | 'ensure'
  | 'gather'
  | 'parse'
  | 'extractAgenda'
  | 'project'
  | 'collate'
  | 'brief';

function isRestrictedAggregateOnly(
  source: LocalityConfig['sources'][number]
): boolean {
  return (
    source.kind === 'news' &&
    source.adapter === 'news-discover' &&
    source.accessMode === 'snippet-only' &&
    source.aggregateDiscovery === true
  );
}
/**
 * The pipeline's stages, as the runner calls them.
 *
 * The runner owns sequencing, leases, windows and receipts; the stages own
 * the work. Making them replaceable lets a second implementation run the
 * same orchestration and publish through the same path, which is how the
 * ported stages are compared with the originals on identical inputs.
 */
export interface PipelineStages {
  gather: typeof gather;
  parseAll: typeof parseAll;
  extractAgenda: typeof extractAgenda;
  projectItems: typeof projectItems;
  collate: typeof collate;
  brief: typeof brief;
}

export interface RunPipelineOptions {
  registry: LocalityRegistry;
  localitySlug: string;
  cadence: Cadence;
  dataSource: DataSource;
  /** Compatibility injection for fixture/unit runs. Live runs should use the
   * run-scoped factory so attempts carry the acquired pipeline run ID. */
  summarizer?: Summarizer;
  summarizerFactory?: (context: {
    runId: number;
    localitySlug: string;
    dataSource: DataSource;
  }) => Summarizer | Promise<Summarizer>;
  httpClient?: HttpClient;
  blobStore?: BlobStore;
  agendaFixup?: AgendaFixup;
  now?: Date;
  since?: string;
  /** Explicit daily/weekly edition interval; dates are local to the locality. */
  periodStart?: string;
  periodEnd?: string;
  /** Ongoing-story context interval, independent from the daily edition. */
  contextStart?: string;
  contextEnd?: string;
  backfillDays?: number;
  /**
   * How far back sources are fetched, when that is less than the story
   * context. A town's first run fetches its whole context window; after that
   * a daily run only needs what was published since the last one, while
   * collation still reads six months of stored evidence. Unset means the
   * context window, which is what every earlier caller gets.
   */
  gatherSince?: string;
  /** Testable heartbeat cadence; production defaults to one third of the lease. */
  heartbeatIntervalMs?: number;
  outputDirectory?: string;
  /** Single explicit artifact root; children are briefings, stories, and blobs. */
  outputRoot?: string;
  publicationLockPath?: string;
  /** Test/embedding hook for the final guarded briefing artifact boundary. */
  publisher?: typeof publishMarkdown;
  /** Alternative stage implementations; defaults to this package's own. */
  stages?: Partial<PipelineStages>;
  /**
   * Where the community service writes its snapshots. Without it a run reads
   * no community material, which is how replay stays a function of its corpus.
   */
  communityDirectory?: string;
}
export interface PipelineRunResult {
  runId: number;
  status:
    | 'succeeded'
    | 'partial_success'
    | 'failed'
    | 'blocked'
    | 'skipped-overlap';
  scopeSlug: string;
  localitySlug: string;
  stages: {
    stage: PipelineStage;
    status: 'succeeded' | 'partial_success' | 'failed' | 'skipped';
    counts: Record<string, number>;
    error?: string;
    coverageGaps?: { sourceKey: string; reason: string }[];
  }[];
  coverageGaps: {
    sourceKey: string;
    stage: 'gather' | 'parse' | 'project';
    reason: string;
  }[];
  coverageRanges?: Record<string, CoverageRange>;
  dailyPeriod?: { start: string; end: string };
  contextRange?: { start: string; end: string };
  blockedReason?: string;
  briefingId?: number;
  markdownPath?: string;
  /** Context identity used by this strict synthesis, for receipt validation. */
  contextEvidenceFingerprint?: string;
  editionMode?: EditionMode;
  /** Set only when the briefing/artifact was explicitly reused from a prior run. */
  reusedFromRunId?: number;
  /** Exact source attempts/raw rows accepted by this run. */
  sourceOutcomes?: GatherSourceOutcome[];
  currentFetchAttemptIds?: number[];
  currentLedgerIds?: number[];
  currentRawDocumentIds?: number[];
  currentRawVersionIds?: number[];
  currentItemIds?: number[];
}

/**
 * Where a run starts reading its sources. A daily run reads from a few days
 * before its last edition; but a source the pipeline has never read — one
 * the sourcing engine just adopted — has no history here yet, and reading it
 * only from yesterday would leave its six months out for good. So when any
 * of the run's sources has never been read successfully, the run reads the
 * whole window, once.
 */
export async function gatherStart(
  options: RunPipelineOptions,
  sources: readonly SourceConfig[],
  contextStart: string
): Promise<string> {
  if (!options.gatherSince || options.gatherSince <= contextStart)
    return contextStart;
  const ledger = options.dataSource.getRepository(FetchLedgerSchema);
  for (const source of sources) {
    if (
      !(await ledger.findOne({
        where: { sourceId: source.sourceKey, lastSuccessAt: Not(IsNull()) },
      }))
    )
      return contextStart;
  }
  return options.gatherSince;
}

const STAGES: readonly PipelineStage[] = [
  'ensure',
  'gather',
  'parse',
  'extractAgenda',
  'project',
  'collate',
  'brief',
];
const LEASE_MS = 10 * 60 * 1000;

function nowDate(value?: Date): Date {
  return value ? new Date(value) : new Date();
}
function period(
  now: Date,
  locality: LocalityConfig,
  cadence: Cadence
): { start: string; end: string; since: string } {
  return periodFor(now, cadence, locality.timezone);
}
function localWindow(
  now: Date,
  locality: LocalityConfig,
  cadence: Cadence,
  options: RunPipelineOptions
): {
  daily: { start: string; end: string };
  context: { start: string; end: string };
} {
  const standard = period(now, locality, cadence);
  const daily = {
    start: options.periodStart ?? standard.start,
    end: options.periodEnd ?? standard.end,
  };
  const normalizeBoundary = (value: string): string =>
    /^\d{4}-\d{2}-\d{2}$/u.test(value)
      ? value
      : localDate(new Date(value), locality.timezone);
  const context = {
    start:
      options.contextStart ??
      (options.since
        ? normalizeBoundary(options.since)
        : backfillSince(daily.end, options.backfillDays ?? 30)),
    end: options.contextEnd ?? daily.end,
  };
  // Validate explicit command-line boundaries as Gregorian local dates before
  // comparing strings or passing them to adapters.
  backfillSince(daily.start, 0);
  backfillSince(daily.end, 0);
  backfillSince(context.start, 0);
  backfillSince(context.end, 0);
  if (daily.end < daily.start)
    throw new Error('period-end must be on or after period-start');
  if (context.end < context.start)
    throw new Error('context-end must be on or after context-start');
  return { daily, context };
}
function json(value: unknown): string {
  return JSON.stringify(value ?? {});
}

/** Validate the complete immutable publication receipt graph before taking
 * the strict idempotent shortcut. A persisted briefing row alone is not
 * enough: a manually removed/corrupted artifact must trigger a real rebuild
 * (or a visible failure), never a false success. */
async function strictPublicationArtifactsValid(
  dataSource: DataSource,
  localitySlug: string,
  ruleVersion: string,
  prior: BriefingRow,
  briefingPath: string
): Promise<boolean> {
  try {
    if (!existsSync(briefingPath)) return false;
    const briefingContent = readFileSync(briefingPath, 'utf8');
    if (
      briefingContent !== prior.markdown ||
      sha256(briefingContent) !== sha256(prior.markdown)
    )
      return false;

    const editionStories = await dataSource
      .getRepository(EditionStorySchema)
      .find({ where: { localitySlug, ruleVersion } });
    const canonicalIds = [
      ...new Set(editionStories.map((row) => row.canonicalStoryId)),
    ];
    if (!canonicalIds.length) return true;
    const stories = await dataSource
      .getRepository(CanonicalStorySchema)
      .find({ where: { id: In(canonicalIds) } });
    if (stories.length !== canonicalIds.length) return false;
    const revisionIds = stories
      .map((story) => story.currentRevisionId)
      .filter((id): id is number => id !== null && id !== undefined);
    const revisions = revisionIds.length
      ? await dataSource
          .getRepository(CanonicalStoryRevisionSchema)
          .find({ where: { id: In(revisionIds) } })
      : [];
    const byId = new Map(revisions.map((revision) => [revision.id, revision]));
    for (const story of stories) {
      // A canonical story can be projected before its first successful
      // synthesis. With no current pointer there is no artifact receipt to
      // validate; any pointer that does exist must pass the checks below.
      if (
        story.currentRevisionId === null ||
        story.currentRevisionId === undefined
      )
        continue;
      const revision = byId.get(story.currentRevisionId);
      if (
        !revision?.artifactPath ||
        !revision.artifactSha256 ||
        !revision.artifactToken ||
        !isCurrentStoryArtifactToken(revision.artifactToken) ||
        !existsSync(revision.artifactPath)
      )
        return false;
      const artifact = readFileSync(revision.artifactPath, 'utf8');
      if (sha256(artifact) !== revision.artifactSha256.toLowerCase())
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

function persistedContextFingerprint(prior: BriefingRow): string | undefined {
  try {
    const value = prior.coverageRange
      ? (JSON.parse(prior.coverageRange) as BriefingCoverageMetadata)
      : {};
    return typeof value.contextEvidenceFingerprint === 'string'
      ? value.contextEvidenceFingerprint
      : undefined;
  } catch {
    return undefined;
  }
}

function persistedSynthesisContractVersion(
  prior: BriefingRow
): string | undefined {
  try {
    const value = prior.coverageRange
      ? (JSON.parse(prior.coverageRange) as BriefingCoverageMetadata)
      : {};
    return typeof value.synthesisContractVersion === 'string'
      ? value.synthesisContractVersion
      : undefined;
  } catch {
    return undefined;
  }
}

function persistedEditionMode(prior: BriefingRow): EditionMode | undefined {
  try {
    const value = prior.coverageRange
      ? (JSON.parse(prior.coverageRange) as BriefingCoverageMetadata)
      : {};
    return value.editionMode === 'bootstrap' ||
      value.editionMode === 'initial-empty' ||
      value.editionMode === 'normal' ||
      value.editionMode === 'quiet'
      ? value.editionMode
      : undefined;
  } catch {
    return undefined;
  }
}

function persistedStorySynthesisContractVersion(
  prior: BriefingRow
): string | undefined {
  try {
    const value = prior.coverageRange
      ? (JSON.parse(prior.coverageRange) as BriefingCoverageMetadata)
      : {};
    return typeof value.storySynthesisContractVersion === 'string'
      ? value.storySynthesisContractVersion
      : undefined;
  } catch {
    return undefined;
  }
}

async function acquireOnce(
  dataSource: DataSource,
  scopeSlug: string,
  localitySlug: string,
  cadence: Cadence,
  ruleVersion: string,
  at: Date
): Promise<{ runId: number; ownerId: string; skipped: boolean }> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  const now = at.toISOString();
  const ownerId = randomUUID();
  const until = new Date(at.getTime() + LEASE_MS).toISOString();
  try {
    const insert =
      'INSERT INTO pipeline_runs (scopeSlug,localitySlug,cadence,startedAt,completedAt,status,currentStage,ruleVersion,counts,coverageGaps,error) VALUES ($1,$2,$3,$4,NULL,$5,NULL,$6,$7,$8,NULL) RETURNING id';
    const params = [
      scopeSlug,
      localitySlug,
      cadence,
      now,
      'running',
      ruleVersion,
      '{}',
      '[]',
    ];
    const inserted = await qr.query(insert, params);
    const runId = Number(inserted[0].id);
    const leaseSql =
      'INSERT INTO pipeline_run_leases (scopeSlug,cadence,ownerId,runId,leaseUntil,createdAt,updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$6) ON CONFLICT (scopeSlug,cadence) DO NOTHING';
    await qr.query(leaseSql, [
      scopeSlug,
      cadence,
      ownerId,
      runId,
      until,
      now,
      now,
    ]);
    const existing = await qr.query(
      'SELECT ownerId,runId,leaseUntil FROM pipeline_run_leases WHERE scopeSlug=$1 AND cadence=$2 FOR UPDATE',
      [scopeSlug, cadence]
    );
    const lease = existing[0] as
      | { ownerId: string; runId: number; leaseUntil: string }
      | undefined;
    if (lease?.ownerId === ownerId && Number(lease.runId) === runId) {
      await qr.commitTransaction();
      return { runId, ownerId, skipped: false };
    }
    if (lease && new Date(lease.leaseUntil).getTime() <= at.getTime()) {
      const takeover =
        'UPDATE pipeline_run_leases SET ownerId=$1,runId=$2,leaseUntil=$3,updatedAt=$4 WHERE scopeSlug=$5 AND cadence=$6 AND leaseUntil <= $7';
      const result = await qr.query(takeover, [
        ownerId,
        runId,
        until,
        now,
        scopeSlug,
        cadence,
        now,
      ]);
      const afterTakeover = await qr.query(
        'SELECT ownerId,runId FROM pipeline_run_leases WHERE scopeSlug=$1 AND cadence=$2',
        [scopeSlug, cadence]
      );
      const changed =
        (result.affected ?? result.changes ?? 0) > 0 ||
        (afterTakeover[0]?.ownerId === ownerId &&
          Number(afterTakeover[0]?.runId) === runId);
      if (changed) {
        await qr.query(
          'UPDATE pipeline_runs SET status=$1,completedAt=$2,error=$3 WHERE id=$4',
          ['failed', now, 'run lease expired', lease.runId]
        );
        await qr.commitTransaction();
        return { runId, ownerId, skipped: false };
      }
    }
    await qr.query(
      'UPDATE pipeline_runs SET status=$1,completedAt=$2,error=NULL WHERE id=$3',
      ['skipped-overlap', now, runId]
    );
    await qr.commitTransaction();
    return { runId, ownerId, skipped: true };
  } catch (error) {
    await qr.rollbackTransaction();
    throw error;
  } finally {
    await qr.release();
  }
}

async function acquire(
  dataSource: DataSource,
  scopeSlug: string,
  localitySlug: string,
  cadence: Cadence,
  ruleVersion: string,
  at: Date
): Promise<{ runId: number; ownerId: string; skipped: boolean }> {
  return acquireOnce(
    dataSource,
    scopeSlug,
    localitySlug,
    cadence,
    ruleVersion,
    at
  );
}

export async function recoverExpired(
  dataSource: DataSource,
  at: Date
): Promise<void> {
  const now = at.toISOString();
  const leases = (await dataSource.query(
    'SELECT scopeSlug,cadence,ownerId,runId FROM pipeline_run_leases WHERE leaseUntil <= $1',
    [now]
  )) as {
    scopeSlug: string;
    cadence: Cadence;
    ownerId: string;
    runId: number;
  }[];
  for (const lease of leases) {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Claim and terminalize in one transaction. Rechecking owner/run and
      // expiry makes a heartbeat renewal that wins the race immune to stale
      // recovery observations.
      const deleted = await queryRunner.query(
        'DELETE FROM pipeline_run_leases WHERE scopeSlug=$1 AND cadence=$2 AND ownerId=$3 AND runId=$4 AND leaseUntil <= $5 RETURNING runId',
        [lease.scopeSlug, lease.cadence, lease.ownerId, lease.runId, now]
      );
      const affected = Array.isArray(deleted) ? deleted.length : 0;
      if (Number(affected) > 0) {
        await queryRunner.query(
          "UPDATE pipeline_stage_runs SET status='failed',completedAt=$1,error='run lease expired' WHERE runId=$2 AND status='running'",
          [now, lease.runId]
        );
        await queryRunner.query(
          "UPDATE pipeline_runs SET status='failed',completedAt=$1,error='run lease expired',currentStage=NULL WHERE id=$2 AND status='running'",
          ['failed', now, lease.runId]
        );
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch {
        /* connection cleanup below */
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

async function renew(
  dataSource: DataSource,
  scopeSlug: string,
  cadence: Cadence,
  ownerId: string,
  runId: number
): Promise<void> {
  const now = new Date();
  const until = new Date(now.getTime() + LEASE_MS).toISOString();
  await dataSource.query(
    'UPDATE pipeline_run_leases SET leaseUntil=$1,updatedAt=$2 WHERE scopeSlug=$3 AND cadence=$4 AND ownerId=$5 AND runId=$6',
    [until, now.toISOString(), scopeSlug, cadence, ownerId, runId]
  );
  const current = await dataSource.query(
    'SELECT ownerId,runId FROM pipeline_run_leases WHERE scopeSlug=$1 AND cadence=$2 AND ownerId=$3 AND runId=$4',
    [scopeSlug, cadence, ownerId, runId]
  );
  if (!current[0]) throw new Error('run lease lost');
}

async function updateRun(
  ds: DataSource,
  id: number,
  values: Record<string, unknown>
): Promise<void> {
  const repo = ds.getRepository('PipelineRun');
  await repo.update(id, values);
}
export async function releaseLease(
  ds: DataSource,
  scopeSlug: string,
  cadence: Cadence,
  ownerId: string,
  runId: number
): Promise<void> {
  await ds
    .getRepository('PipelineRunLease')
    .delete({ scopeSlug, cadence, ownerId, runId });
}

export async function finalizeRunAndRelease(
  ds: DataSource,
  runId: number,
  leaseScopeSlug: string,
  cadence: Cadence,
  ownerId: string,
  values: Record<string, unknown>
): Promise<void> {
  const queryRunner = ds.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.manager
      .getRepository('PipelineRun')
      .update(runId, values);
    await queryRunner.manager
      .getRepository('PipelineRunLease')
      .delete({ scopeSlug: leaseScopeSlug, cadence, ownerId, runId });
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

export async function runPipeline(
  options: RunPipelineOptions
): Promise<PipelineRunResult> {
  // The lease decision must happen before source discovery, adapter opening,
  // or rule-file work.  An overlapping invocation is therefore a true no-op.
  // brief is reached through publishBriefing, which owns the artifact
  // boundary; the others are called here directly.
  const stages: Omit<PipelineStages, 'brief'> & {
    brief?: PipelineStages['brief'];
  } = {
    gather,
    parseAll,
    extractAgenda,
    projectItems,
    collate,
    ...options.stages,
  };
  let ruleVersion = 'unversioned';
  const started = nowDate(options.now);
  await recoverExpired(options.dataSource, started);
  const leaseScopeSlug = options.localitySlug;
  const acquired = await acquire(
    options.dataSource,
    leaseScopeSlug,
    options.localitySlug,
    options.cadence,
    ruleVersion,
    started
  );
  const result: PipelineRunResult = {
    runId: acquired.runId,
    status: acquired.skipped ? 'skipped-overlap' : 'failed',
    scopeSlug: options.localitySlug,
    localitySlug: options.localitySlug,
    stages: [],
    coverageGaps: [],
    coverageRanges: {},
  };
  if (acquired.skipped) return result;
  let finalized = false;
  let heartbeatError: Error | null = null;
  const heartbeat = setInterval(() => {
    void renew(
      options.dataSource,
      leaseScopeSlug,
      options.cadence,
      acquired.ownerId,
      acquired.runId
    ).catch((error: unknown) => {
      heartbeatError =
        error instanceof Error ? error : new Error(String(error));
    });
  }, options.heartbeatIntervalMs ?? Math.max(1000, Math.floor(LEASE_MS / 3)));
  heartbeat.unref?.();
  try {
    const base = options.registry.get(options.localitySlug);
    const scope = base;
    result.scopeSlug = scope.slug;
    const initialSources = options.registry
      .sourcesForRun(options.localitySlug)
      .filter((source) => source.enabled !== false);
    ruleVersion = options.registry.ruleVersion(options.localitySlug);
    const locality: LocalityConfig = {
      ...base,
      sources: initialSources,
      ruleVersion,
    };
    const activeSummarizer = options.summarizerFactory
      ? await options.summarizerFactory({
          runId: acquired.runId,
          localitySlug: locality.slug,
          dataSource: options.dataSource,
        })
      : options.summarizer;
    if (!activeSummarizer)
      throw new Error('pipeline requires a summarizer or summarizerFactory');
    // A factory is the live composition boundary: it receives the acquired
    // run ID so every model operation can persist provenance. Never allow a
    // legacy prose/fallback summarizer returned from that boundary to publish.
    if (options.summarizerFactory && activeSummarizer.strict !== true) {
      throw new Error('summarizerFactory must return a strict summarizer');
    }
    await updateRun(options.dataSource, acquired.runId, { ruleVersion });
    const windows = localWindow(started, locality, options.cadence, options);
    result.dailyPeriod = windows.daily;
    result.contextRange = windows.context;
    const httpClient = options.httpClient ?? new OutboundPolicy();
    const artifactRoot = options.outputRoot;
    const briefingRoot = artifactRoot
      ? join(artifactRoot, 'briefings')
      : options.outputDirectory ?? join(process.cwd(), 'data', 'briefings');
    const storyRoot = artifactRoot
      ? join(artifactRoot, 'stories')
      : join(process.cwd(), 'data', 'stories');
    const blobRoot = artifactRoot
      ? join(artifactRoot, 'blobs')
      : join(process.cwd(), 'data', 'blobs');
    const blobStore = options.blobStore ?? createLocalBlobStore(blobRoot);
    if (!initialSources.length) {
      result.coverageGaps.push({
        sourceKey: '__config__',
        stage: 'gather',
        reason: 'no enabled sources for locality',
      });
      await finalizeRunAndRelease(
        options.dataSource,
        acquired.runId,
        leaseScopeSlug,
        options.cadence,
        acquired.ownerId,
        {
          status: 'failed',
          completedAt: new Date().toISOString(),
          coverageGaps: json(result.coverageGaps),
          counts: '{}',
        }
      );
      finalized = true;
      return result;
    }
    const stage = async <T extends object>(
      name: PipelineStage,
      fn: () => Promise<T>
    ): Promise<T> => {
      const start = new Date().toISOString();
      if (heartbeatError) throw heartbeatError;
      await renew(
        options.dataSource,
        leaseScopeSlug,
        options.cadence,
        acquired.ownerId,
        acquired.runId
      );
      await options.dataSource.getRepository('PipelineStageRun').save({
        runId: acquired.runId,
        stage: name,
        startedAt: start,
        completedAt: null,
        status: 'running',
        counts: '{}',
        coverageGaps: '[]',
        error: null,
      });
      await updateRun(options.dataSource, acquired.runId, {
        currentStage: name,
      });
      try {
        const value = await fn();
        if (heartbeatError) throw heartbeatError;
        await renew(
          options.dataSource,
          leaseScopeSlug,
          options.cadence,
          acquired.ownerId,
          acquired.runId
        );
        const metadata = value as T & {
          __status?: 'succeeded' | 'partial_success' | 'failed';
          __coverageGaps?: { sourceKey: string; reason: string }[];
        };
        const status = metadata.__status ?? 'succeeded';
        const gaps = metadata.__coverageGaps ?? [];
        result.coverageGaps.push(
          ...(name === 'gather' || name === 'parse' || name === 'project'
            ? gaps.map((gap) => ({ ...gap, stage: name }))
            : [])
        );
        const counts = Object.fromEntries(
          Object.entries(value).filter(
            ([key, entry]) => !key.startsWith('__') && typeof entry === 'number'
          )
        ) as Record<string, number>;
        await options.dataSource.getRepository('PipelineStageRun').update(
          { runId: acquired.runId, stage: name },
          {
            completedAt: new Date().toISOString(),
            status,
            counts: json(counts),
            coverageGaps: json(gaps),
          }
        );
        result.stages.push({
          stage: name,
          status,
          counts,
          ...(gaps.length ? { coverageGaps: gaps } : {}),
        });
        return value;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await options.dataSource.getRepository('PipelineStageRun').update(
          { runId: acquired.runId, stage: name },
          {
            completedAt: new Date().toISOString(),
            status: 'failed',
            error: message,
          }
        );
        result.stages.push({
          stage: name,
          status: 'failed',
          counts: {},
          error: message,
        });
        throw error;
      }
    };
    await stage('ensure', async () => {
      await ensureLocality(options.dataSource, locality, options.registry);
      return { localities: 1, sources: initialSources.length };
    });
    const gathered = await stage('gather', async () => {
      const value = await stages.gather(options.dataSource, locality, {
        httpClient,
        blobStore,
        runId: acquired.runId,
        scopeSlug: scope.slug,
        coverageRange: {
          requestedStart: await gatherStart(
            options,
            initialSources,
            windows.context.start
          ),
          requestedEnd: windows.context.end,
        },
      });
      result.coverageRanges = value.coverageRanges;
      result.sourceOutcomes = value.sourceOutcomes;
      result.currentFetchAttemptIds = value.currentFetchAttemptIds;
      result.currentLedgerIds = value.currentLedgerIds;
      result.currentRawDocumentIds = value.currentRawDocumentIds;
      result.currentRawVersionIds = value.currentRawVersionIds;
      const coverageGaps = Object.entries(value.coverageRanges)
        .map(([sourceKey, range]) => {
          const gap = coverageGapForRange(sourceKey, range);
          if (!gap) return null;
          const source = initialSources.find(
            (candidate) => candidate.sourceKey === sourceKey
          );
          const configuredDirect =
            source?.config &&
            [
              source.config['publisherUrl'],
              source.config['directPublisherUrl'],
            ].find(
              (url): url is string =>
                typeof url === 'string' && /^https?:\/\//iu.test(url)
            );
          return {
            ...gap,
            ...((source?.accessMode === 'snippet-only' ||
              source?.aggregateDiscovery) &&
            source?.name
              ? { sourceName: source.name }
              : {}),
            ...(source?.accessRestrictionReason
              ? { accessRestrictionReason: source.accessRestrictionReason }
              : {}),
            ...(source?.restrictionPolicyUrl
              ? { restrictionPolicyUrl: source.restrictionPolicyUrl }
              : {}),
            ...(source?.aggregateDiscovery &&
            (source.aggregateUrl ?? source.url)
              ? { aggregateUrl: source.aggregateUrl ?? source.url }
              : {}),
            ...(configuredDirect
              ? { directPublisherUrl: configuredDirect }
              : {}),
          };
        })
        .filter((gap): gap is NonNullable<typeof gap> => gap !== null);
      const gaps = [
        ...value.errors.map((error) => ({
          sourceKey: error.sourceId,
          reason: error.error,
        })),
        ...coverageGaps,
      ];
      const successful =
        value.successfulSources > 0 || value.successfulRecords > 0;
      await updateRun(options.dataSource, acquired.runId, {
        coverageRanges: json(value.coverageRanges),
      });
      return {
        ...value,
        __status: gaps.length
          ? successful
            ? ('partial_success' as const)
            : ('failed' as const)
          : ('succeeded' as const),
        __coverageGaps: gaps,
      };
    });
    // A completely failed gather is an infrastructure failure, not an honest
    // quiet day. Mixed/empty successful results still proceed to quiet mode.
    if (
      (gathered as typeof gathered & { __status?: string }).__status ===
      'failed'
    )
      throw new Error('all enabled sources failed during gather');
    const parsed = await stage('parse', async () => {
      const value = await stages.parseAll(options.dataSource, locality, {
        blobStore,
        httpClient,
        runId: acquired.runId,
        scopeSlug: scope.slug,
        registry: options.registry,
        successfulSourceOutcomes: gathered.sourceOutcomes,
        currentRawDocumentIds: gathered.currentRawDocumentIds,
        contextRange: windows.context,
      });
      result.currentItemIds = value.currentItemIds;
      const gaps = value.errors.map((error) => ({
        sourceKey: error.sourceId,
        reason: error.error,
      }));
      const successful =
        value.successfulSources > 0 || value.successfulRecords > 0;
      return {
        ...value,
        __status: gaps.length
          ? successful
            ? ('partial_success' as const)
            : ('failed' as const)
          : ('succeeded' as const),
        __coverageGaps: gaps,
      };
    });
    // A completely failed parse is an infrastructure failure; an empty but
    // successful parse proceeds to a deterministic quiet edition.
    if ((parsed as typeof parsed & { __status?: string }).__status === 'failed')
      throw new Error('all records failed during parse');
    // Aggregate fetches can contain many third-party results while yielding
    // zero current/context civic items for the configured publisher. At
    // gather time those rows look non-empty, so correct only this exact
    // successful restricted-source case after parse; failures and sources
    // with parsed records retain their original capability diagnostics.
    const parsedItems = result.currentItemIds?.length
      ? await options.dataSource
          .getRepository('CivicItem')
          .find({ where: { id: In(result.currentItemIds) } })
      : [];
    const parseFailureSourceIds = new Set(
      parsed.errors.map((error) => error.sourceId)
    );
    if (options.dataSource.hasMetadata(FoundationQuarantineSchema)) {
      const quarantines = await options.dataSource
        .getRepository(FoundationQuarantineSchema)
        .find({
          where: { runId: String(acquired.runId), stage: 'parse' },
          select: ['sourceId'],
        });
      for (const quarantine of quarantines)
        if (quarantine.sourceId) parseFailureSourceIds.add(quarantine.sourceId);
    }
    let correctedGatherCoverage = false;
    for (const source of initialSources) {
      if (!isRestrictedAggregateOnly(source)) continue;
      const outcome = gathered.sourceOutcomes.find(
        (candidate) => candidate.sourceKey === source.sourceKey
      );
      const range = result.coverageRanges?.[source.sourceKey];
      if (
        outcome?.outcome !== 'records' ||
        range?.reason !== 'unsupported-capability'
      )
        continue;
      // A parse error/quarantine is a source failure, not evidence of an
      // empty publisher. Preserve the parse/source diagnostic in that case.
      if (parseFailureSourceIds.has(source.sourceKey)) continue;
      const sourceItems = parsedItems.filter(
        (item) => item['sourceId'] === source.sourceKey
      );
      if (
        sourceItems.some((item) =>
          matchesConfiguredPublisherIdentity(item, source)
        )
      )
        continue;
      range.reason = 'no-dated-items';
      correctedGatherCoverage = true;
      for (const gap of result.coverageGaps) {
        if (
          gap.stage === 'gather' &&
          gap.sourceKey === source.sourceKey &&
          gap.reason ===
            'source does not document date or pagination coverage capability'
        )
          gap.reason = 'no recent aggregate result';
      }
      const gatherStage = result.stages.find(
        (stage) => stage.stage === 'gather'
      );
      for (const gap of gatherStage?.coverageGaps ?? []) {
        if (
          gap.sourceKey === source.sourceKey &&
          gap.reason ===
            'source does not document date or pagination coverage capability'
        )
          gap.reason = 'no recent aggregate result';
      }
    }
    if (correctedGatherCoverage) {
      const gatherStage = result.stages.find(
        (stage) => stage.stage === 'gather'
      );
      // Keep the durable stage receipt in lockstep with the in-memory run
      // receipt and later Markdown/acceptance/preview projections.
      await options.dataSource.transaction(async (manager) => {
        await manager
          .getRepository(PipelineStageRunSchema)
          .update(
            { runId: acquired.runId, stage: 'gather' },
            { coverageGaps: json(gatherStage?.coverageGaps ?? []) }
          );
      });
    }
    // Determine whether the current daily interval has any parsed evidence
    // before enabling agenda repair. Long context-only agenda packets must
    // remain available for history, but must never trigger an LLM on a quiet
    // daily edition.
    const parsedCurrentItems = result.currentItemIds?.length
      ? await options.dataSource
          .getRepository('CivicItem')
          .find({ where: { id: In(result.currentItemIds) } })
      : [];
    const hasDailyParsedEvidence = parsedCurrentItems.some(
      (item) =>
        isItemInLocalRange(
          item,
          windows.daily.start,
          windows.daily.end,
          locality.timezone
        ) &&
        item['geographyDecision'] !== 'withhold' &&
        item['geographyDecision'] !== 'uncertain' &&
        isEditoriallyEligibleBody(
          `${item['title']} ${item['body']}`,
          item['kind']
        )
    );
    const structuredAgendaFixup = hasDailyParsedEvidence
      ? options.agendaFixup ??
        (activeSummarizer.fixupAgendaItems
          ? async (input: import('./pipeline.js').AgendaFixupInput) =>
              activeSummarizer.fixupAgendaItems!(input)
          : undefined)
      : undefined;
    await stage('extractAgenda', async () =>
      extractAgenda(
        options.dataSource,
        locality,
        structuredAgendaFixup,
        windows.context,
        locality.timezone,
        acquired.runId
      )
    );
    const projected = await stage('project', async () => {
      const items = await stages.projectItems(
        options.dataSource,
        locality.slug,
        options.registry,
        0,
        { contextRange: windows.context }
      );
      const stories = await projectStories(
        options.dataSource,
        locality.slug,
        ruleVersion
      );
      const withheld = items.diagnostics.filter(
        (diagnostic) => diagnostic.decision === 'withhold'
      );
      const uncertain = items.diagnostics.filter(
        (diagnostic) => diagnostic.decision === 'uncertain'
      );
      return {
        included: items.included.length,
        withheld: withheld.length,
        uncertain: uncertain.length,
        stories: stories.length,
        __coverageGaps: [...withheld, ...uncertain].map((diagnostic) => ({
          sourceKey: `item:${diagnostic.civicItemId}`,
          reason: `${diagnostic.decision}: ${diagnostic.evidence.reason}`,
        })),
      };
    });
    const p = windows.daily;
    const contextSince = windows.context.start;
    // Projection can contain only ongoing context (for example, a meeting
    // from the backfill window) while the requested daily edition has no
    // evidence.  Treat that as an intentional quiet/blocked run before any
    // summarization so it cannot fall through to canned prose.
    const dailyClusters = await stages.collate(
      options.dataSource,
      locality.slug,
      contextSince,
      p.start,
      ruleVersion,
      locality.timezone,
      p.end,
      windows.context.end
    );
    const contextClusters = activeSummarizer.strict
      ? await stages.collate(
          options.dataSource,
          locality.slug,
          contextSince,
          undefined,
          ruleVersion,
          locality.timezone,
          undefined,
          windows.context.end
        )
      : dailyClusters;
    const contextFingerprint = contextEvidenceFingerprint(
      contextClusters.flatMap((cluster) => cluster.items),
      contextSince,
      windows.context.end
    );
    result.contextEvidenceFingerprint = contextFingerprint;
    const editionMode = activeSummarizer.strict
      ? resolveEditionMode({
          dailyEvidence: dailyClusters.length > 0,
          contextEvidence: contextClusters.length > 0,
          currentPeriodStart: p.start,
          verifiedPriorEdition: await (async () => {
            if (options.cadence !== 'daily') return false;
            const candidates = await options.dataSource
              .getRepository(BriefingSchema)
              .find({
                where: {
                  localitySlug: locality.slug,
                  cadence: 'daily',
                  ruleVersion,
                },
                order: { periodEnd: 'DESC' },
              });
            for (const candidate of candidates) {
              // The current same-period row is an idempotency candidate, not
              // proof that a prior edition existed.
              if (candidate.periodStart >= p.start) continue;
              const candidatePath = join(
                briefingRoot,
                locality.slug,
                `${candidate.periodEnd}-daily.md`
              );
              if (
                await strictPublicationArtifactsValid(
                  options.dataSource,
                  locality.slug,
                  ruleVersion,
                  candidate,
                  candidatePath
                )
              )
                return true;
            }
            return false;
          })(),
          priorDaily: await (async () => {
            if (options.cadence !== 'daily') return undefined;
            const candidates = await options.dataSource
              .getRepository(BriefingSchema)
              .find({
                where: {
                  localitySlug: locality.slug,
                  cadence: 'daily',
                  periodEnd: p.start,
                  ruleVersion,
                },
                order: { periodStart: 'DESC' },
              });
            const candidate = candidates[0];
            if (!candidate) return undefined;
            const candidatePath = join(
              briefingRoot,
              locality.slug,
              `${p.start}-daily.md`
            );
            return {
              periodStart: candidate.periodStart,
              periodEnd: candidate.periodEnd,
              artifactVerified: await strictPublicationArtifactsValid(
                options.dataSource,
                locality.slug,
                ruleVersion,
                candidate,
                candidatePath
              ),
            };
          })(),
        })
      : undefined;
    result.editionMode = editionMode;
    await stage('collate', async () => ({ clusters: dailyClusters.length }));
    const briefing = await stage('brief', async () => {
      const prior = activeSummarizer.strict
        ? await options.dataSource.getRepository(BriefingSchema).findOneBy({
            localitySlug: locality.slug,
            cadence: options.cadence,
            periodStart: p.start,
            periodEnd: p.end,
            ruleVersion,
          })
        : null;
      let priorItemIds: number[] = [];
      if (prior?.itemIds) {
        try {
          const parsedIds = JSON.parse(prior.itemIds) as unknown;
          if (
            Array.isArray(parsedIds) &&
            parsedIds.every((id) => Number.isInteger(id))
          )
            priorItemIds = parsedIds as number[];
        } catch {
          /* malformed prior metadata cannot qualify for the shortcut */
        }
      }
      const currentItemIds = dailyClusters.flatMap((cluster) =>
        cluster.items.map((item) => item.id as number)
      );
      const briefingPath = join(
        briefingRoot,
        locality.slug,
        `${p.end}-${options.cadence}.md`
      );
      const unchanged =
        prior?.id !== undefined &&
        ((prior.briefingGenerationId !== null &&
          prior.briefingGenerationId !== undefined) ||
          prior.model === 'deterministic-quiet-day' ||
          prior.model === 'deterministic-initial-empty') &&
        priorItemIds
          .slice()
          .sort((a, b) => a - b)
          .join(',') ===
          currentItemIds
            .slice()
            .sort((a, b) => a - b)
            .join(',') &&
        persistedContextFingerprint(prior) === contextFingerprint &&
        persistedSynthesisContractVersion(prior) ===
          (persistedEditionMode(prior) === 'initial-empty'
            ? INITIAL_EMPTY_SYNTHESIS_CONTRACT_VERSION
            : persistedEditionMode(prior) === 'quiet' ||
              prior.model === 'deterministic-quiet-day'
            ? QUIET_DAY_SYNTHESIS_CONTRACT_VERSION
            : SYNTHESIS_CONTRACT_VERSION) &&
        persistedStorySynthesisContractVersion(prior) ===
          (persistedEditionMode(prior) === 'initial-empty' ||
          persistedEditionMode(prior) === 'quiet' ||
          prior.model === 'deterministic-quiet-day'
            ? undefined
            : STORY_SYNTHESIS_CONTRACT_VERSION) &&
        (await strictPublicationArtifactsValid(
          options.dataSource,
          locality.slug,
          ruleVersion,
          prior,
          briefingPath
        ));
      if (unchanged) {
        // A second strict run with identical persisted evidence is a read-only
        // publication reuse. It must not create another generation, story
        // revision, citation, or briefing row.
        result.briefingId = prior.id;
        result.markdownPath = briefingPath;
        if (prior.runId !== null && prior.runId !== undefined)
          result.reusedFromRunId = prior.runId;
        return { briefingId: prior.id, markdown: 1 };
      }
      const publication = await publishBriefing({
        ds: options.dataSource,
        locality,
        cadence: options.cadence,
        periodStart: p.start,
        periodEnd: p.end,
        summarizer: activeSummarizer,
        ...(stages.brief ? { brief: stages.brief } : {}),
        since: p.start,
        contextSince,
        coverageRange: windows.context,
        coverageGaps: result.coverageGaps,
        storyRoot,
        briefingRoot,
        briefingFilename: `${p.end}-${options.cadence}.md`,
        ...(options.communityDirectory
          ? { communityDirectory: options.communityDirectory }
          : {}),
        token: String(acquired.runId),
        runId: acquired.runId,
        freshnessScope: {
          currentItemIds: result.currentItemIds ?? [],
          currentRawDocumentIds: result.currentRawDocumentIds ?? [],
          currentRawVersionIds: result.currentRawVersionIds ?? [],
          currentFetchAttemptIds: result.currentFetchAttemptIds ?? [],
          currentLedgerIds: result.currentLedgerIds ?? [],
        },
        // Every scope whose items may appear in this edition: the edition, the places containing it, and the places inside it.
        ancestry: [
          ...options.registry.ancestry(locality.slug),
          ...options.registry.descendants(locality.slug),
        ].map((related) => related.slug),
        publicationLockPath:
          options.publicationLockPath ??
          publicationLockPathFor(
            options.dataSource.options as { type?: string; database?: unknown }
          ),
        publisher: options.publisher,
        quietDay: editionMode === 'quiet',
        editionMode,
      });
      result.briefingId = publication.result.briefingId;
      result.markdownPath = publication.markdownPath;
      return { briefingId: publication.result.briefingId, markdown: 1 };
    });
    void gathered;
    void parsed;
    void briefing;
    if (heartbeatError) throw heartbeatError;
    await renew(
      options.dataSource,
      leaseScopeSlug,
      options.cadence,
      acquired.ownerId,
      acquired.runId
    );
    // Project diagnostics are intentionally observable coverage information,
    // not pipeline failures.  Only source gather/parse gaps make a usable run
    // partial; withhold/uncertain geography must not penalize its status.
    const hasSourceCoverageGap = result.coverageGaps.some(
      (gap) => gap.stage === 'gather' || gap.stage === 'parse'
    );
    result.status = hasSourceCoverageGap ? 'partial_success' : 'succeeded';
    await finalizeRunAndRelease(
      options.dataSource,
      acquired.runId,
      leaseScopeSlug,
      options.cadence,
      acquired.ownerId,
      {
        status: result.status,
        completedAt: new Date().toISOString(),
        currentStage: null,
        counts: json(
          Object.fromEntries(result.stages.map((s) => [s.stage, s.counts]))
        ),
        coverageGaps: json(result.coverageGaps),
        coverageRanges: json(result.coverageRanges),
      }
    );
    finalized = true;
    return result;
  } catch (error) {
    result.status = 'failed';
    try {
      await finalizeRunAndRelease(
        options.dataSource,
        acquired.runId,
        leaseScopeSlug,
        options.cadence,
        acquired.ownerId,
        {
          status: 'failed',
          completedAt: new Date().toISOString(),
          currentStage: null,
          error: error instanceof Error ? error.message : String(error),
          coverageGaps: json(result.coverageGaps),
          coverageRanges: json(result.coverageRanges),
        }
      );
      finalized = true;
    } catch {
      try {
        await releaseLease(
          options.dataSource,
          leaseScopeSlug,
          options.cadence,
          acquired.ownerId,
          acquired.runId
        );
      } catch {
        /* reconciliation is best effort */
      }
    }
    return result;
  } finally {
    clearInterval(heartbeat);
    if (!finalized) {
      try {
        await releaseLease(
          options.dataSource,
          leaseScopeSlug,
          options.cadence,
          acquired.ownerId,
          acquired.runId
        );
      } catch {
        /* never turn a terminal result into an unhandled rejection */
      }
    }
  }
}

export { STAGES };
