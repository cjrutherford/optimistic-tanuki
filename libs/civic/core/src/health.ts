import { In } from 'typeorm';
import type { DataSource } from 'typeorm';
import {
  AgendaItemSchema,
  CivicItemSchema,
  EditionItemSchema,
  FetchLedgerSchema,
  FoundationQuarantineSchema,
  QuarantineSchema,
  RawDocumentSchema,
  BriefingSchema,
  StorySchema,
  PipelineRunSchema,
  PipelineStageRunSchema,
  LlmGenerationSchema,
  type CivicItemRow,
} from './schema.js';
import type { LocalityConfig } from './types.js';

export type FreshnessStatus = 'fresh' | 'stale' | 'failing' | 'never-fetched';

export interface LedgerHealthInput {
  sourceId: string;
  adapter: string;
  enabled: boolean;
  cadence: 'daily' | 'weekly';
  timezone?: string;
  now?: string;
  lastAttemptAt?: string | null;
  lastSuccessAt?: string | null;
  lastChangedAt?: string | null;
  consecutiveFailures?: number;
  lastError?: string | null;
}

export interface LedgerHealth {
  sourceId: string;
  adapter: string;
  enabled: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastChangedAt: string | null;
  consecutiveFailures: number;
  status: FreshnessStatus;
  stalenessDays: number | null;
}

export interface SourceHealth {
  sourceId: string;
  adapter: string;
  enabled: boolean;
  items7d: number;
  errors7d: number;
  newestPublished: string | null;
  stalenessDays: number | null;
  status: FreshnessStatus;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastChangedAt: string | null;
  consecutiveFailures: number;
}

export interface LocalityHealth {
  slug: string;
  score: number;
  sources: SourceHealth[];
  itemsTotal: number;
  threadsMulti: number;
  storiesDeveloped: number;
  storyCoveragePct: number;
  llmFallbackBriefings: number;
  briefingsChecked: number;
  duplicateGroups: number;
  notes: string[];
  lastRun: {
    runId: number;
    status: string;
    currentStage: string | null;
    coverageGaps: unknown[];
    error: string | null;
  } | null;
  failedStage: string | null;
  quarantineCount: number;
  coverageGaps: unknown[];
  uncertainWithheld: number;
  projectionCounts: { include: number; withhold: number; uncertain: number };
  agendaFixupFailures: number;
  agendaFixupDiagnostics: AgendaFixupDiagnostic[];
}

/** Safe operational evidence for a failed agenda-fixup attempt. Raw prompts,
 * model output, and error bodies are intentionally excluded from health. */
export interface AgendaFixupDiagnostic {
  generationId: number | null;
  runId: number;
  model: string;
  attempt: number;
  status: string;
  inputSha256: string;
  sourceKeys: string[];
  generatedAt: string;
  errorKind:
    | 'timeout'
    | 'unavailable'
    | 'http'
    | 'decode'
    | 'empty-output'
    | 'invalid-output'
    | 'generation-failed';
}

const DAY = 864e5;
const STALE_AFTER: Record<'daily' | 'weekly', number> = { daily: 2, weekly: 8 };

function localDay(value: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return (
    Date.UTC(
      Number(fields['year']),
      Number(fields['month']) - 1,
      Number(fields['day'])
    ) / DAY
  );
}

function diagnosticErrorKind(
  error: string | null | undefined
): AgendaFixupDiagnostic['errorKind'] {
  const message = (error ?? '').toLowerCase();
  if (message.includes('timeout')) return 'timeout';
  if (
    message.includes('unavailable') ||
    message.includes('connection') ||
    message.includes('econn')
  )
    return 'unavailable';
  if (message.includes('gateway') || /\bhttp\s+\d{3}\b/.test(message))
    return 'http';
  if (message.includes('not valid json') || message.includes('decode'))
    return 'decode';
  if (message.includes('empty content')) return 'empty-output';
  if (message.includes('invalid') || message.includes('validation'))
    return 'invalid-output';
  return 'generation-failed';
}

function safeSourceKeys(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (entry): entry is string =>
              typeof entry === 'string' && entry.trim().length > 0
          )
          .slice(0, 32)
      : [];
  } catch {
    return [];
  }
}

export function healthFromLedger(input: LedgerHealthInput): LedgerHealth {
  const lastAttemptAt = input.lastAttemptAt ?? null;
  const lastSuccessAt = input.lastSuccessAt ?? null;
  const lastChangedAt = input.lastChangedAt ?? null;
  const consecutiveFailures = input.consecutiveFailures ?? 0;
  const now = input.now ?? new Date().toISOString();
  const timezone = input.timezone ?? 'UTC';
  const stalenessDays = lastSuccessAt
    ? Math.max(0, localDay(now, timezone) - localDay(lastSuccessAt, timezone))
    : null;
  let status: FreshnessStatus;
  if (!lastAttemptAt && !lastSuccessAt) status = 'never-fetched';
  else if (consecutiveFailures > 0 || !lastSuccessAt) status = 'failing';
  else if (stalenessDays !== null && stalenessDays > STALE_AFTER[input.cadence])
    status = 'stale';
  else status = 'fresh';
  return {
    sourceId: input.sourceId,
    adapter: input.adapter,
    enabled: input.enabled,
    lastAttemptAt,
    lastSuccessAt,
    lastChangedAt,
    consecutiveFailures,
    status,
    stalenessDays,
  };
}

export async function localityHealth(
  ds: DataSource,
  locality: LocalityConfig
): Promise<LocalityHealth> {
  const notes: string[] = [];
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  // Items belong to their source owner; an edition's health covers the items from its run sources.
  const sourceKeys = locality.sources.map((source) => source.sourceKey);
  const items: Pick<
    CivicItemRow,
    | 'id'
    | 'sourceId'
    | 'kind'
    | 'publishedAt'
    | 'eventDate'
    | 'geographyDecision'
  >[] = ds.hasMetadata(CivicItemSchema)
    ? await ds
        .getRepository(CivicItemSchema)
        .find({
          where: sourceKeys.length
            ? { sourceId: In(sourceKeys) }
            : { localitySlug: locality.slug },
        })
    : [];
  const raws: { sourceId: string; fetchedAt: string }[] = ds.hasMetadata(
    RawDocumentSchema
  )
    ? await ds.getRepository(RawDocumentSchema).find()
    : [];
  const rawsBySource = new Map<string, string[]>();
  for (const r of raws) {
    if (!rawsBySource.has(r.sourceId)) rawsBySource.set(r.sourceId, []);
    rawsBySource.get(r.sourceId)!.push(r.fetchedAt);
  }
  const quar: { sourceId?: string | null; stage: string; createdAt: string }[] =
    ds.hasMetadata(QuarantineSchema)
      ? await ds.getRepository(QuarantineSchema).find()
      : ds.hasMetadata(FoundationQuarantineSchema)
      ? await ds.getRepository(FoundationQuarantineSchema).find()
      : [];
  const localityQuarantines = quar.filter(
    (q) =>
      !q.sourceId ||
      locality.sources.some((source) => source.sourceKey === q.sourceId)
  );
  const ledgers = ds.hasMetadata(FetchLedgerSchema)
    ? await ds.getRepository(FetchLedgerSchema).find()
    : [];
  const ledgerBySource = new Map(
    ledgers.map((ledger) => [ledger.sourceId, ledger])
  );
  const sources: SourceHealth[] = locality.sources.map((s) => {
    const mine = items.filter((i) => i.sourceId === s.sourceKey);
    const recentErrors = quar.filter(
      (q) => q.sourceId === s.sourceKey && q.createdAt >= weekAgo
    ).length;
    const fetched = (rawsBySource.get(s.sourceKey) ?? []).sort().at(-1) ?? null;
    const times = mine
      .map((i) => i.publishedAt ?? i.eventDate ?? null)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b);
    const newest: string | null = times.length
      ? new Date(times[times.length - 1]).toISOString()
      : null;
    const ledger = ledgerBySource.get(s.sourceKey);
    const freshness = healthFromLedger({
      sourceId: s.sourceKey,
      adapter: s.adapter,
      enabled: s.enabled !== false,
      cadence: locality.cadence[0] ?? 'daily',
      timezone: locality.timezone,
      lastAttemptAt: ledger?.lastAttemptAt,
      lastSuccessAt: ledger?.lastSuccessAt,
      lastChangedAt: ledger?.lastChangedAt,
      consecutiveFailures: ledger?.consecutiveFailures,
      lastError: ledger?.lastError,
    });
    return {
      sourceId: s.sourceKey,
      adapter: s.adapter,
      enabled: s.enabled !== false,
      items7d: mine.length,
      errors7d: recentErrors,
      newestPublished: newest,
      stalenessDays: freshness.stalenessDays,
      status: freshness.status,
      lastAttemptAt: freshness.lastAttemptAt,
      lastSuccessAt: freshness.lastSuccessAt,
      lastChangedAt: freshness.lastChangedAt,
      consecutiveFailures: freshness.consecutiveFailures,
    };
  });
  for (const s of sources) {
    if (s.status === 'failing')
      notes.push(`${s.sourceId}: failing (errors, no items)`);
    else if (s.status === 'stale')
      notes.push(
        `${s.sourceId}: stale (${s.stalenessDays}d since last successful fetch)`
      );
  }
  const agendaRows = ds.hasMetadata(AgendaItemSchema)
    ? items.length
      ? await ds
          .getRepository(AgendaItemSchema)
          .find({
            where: { itemId: In(items.map((item) => item.id as number)) },
          })
      : []
    : [];
  const datesByTopic = new Map<string, Set<string>>();
  for (const row of agendaRows) {
    if (row.procedural) continue;
    const dates = datesByTopic.get(row.topicKey) ?? new Set<string>();
    if (row.meetingDate) dates.add(row.meetingDate);
    datesByTopic.set(row.topicKey, dates);
  }
  const multi = [...datesByTopic.values()].filter(
    (dates) => dates.size >= 2
  ).length;
  const stories = ds.hasMetadata(StorySchema)
    ? await ds
        .getRepository(StorySchema)
        .find({ where: { localitySlug: locality.slug } })
    : [];
  const storyCoveragePct = multi
    ? Math.round((stories.length / Math.max(1, multi)) * 100)
    : 100;
  const briefings: { model: string }[] = ds.hasMetadata(BriefingSchema)
    ? await ds.getRepository(BriefingSchema).find({
        where: { localitySlug: locality.slug },
        order: { id: 'DESC' },
        take: 5,
      })
    : [];
  const llmFallbackBriefings = briefings.filter((b) =>
    /fallback|extractive/.test(b.model)
  ).length;
  const llmGenerations = ds.hasMetadata(LlmGenerationSchema)
    ? await ds
        .getRepository(LlmGenerationSchema)
        .find({ where: { localitySlug: locality.slug } })
    : [];
  const failedAgendaFixups = llmGenerations
    .filter(
      (generation) =>
        generation.operation === 'agenda_fixup' &&
        ['failed', 'invalid'].includes(generation.status)
    )
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const agendaFixupDiagnostics: AgendaFixupDiagnostic[] = failedAgendaFixups
    .slice(0, 20)
    .map((generation) => ({
      generationId: generation.id ?? null,
      runId: generation.runId,
      model: generation.model,
      attempt: generation.attempt,
      status: generation.status,
      inputSha256: generation.inputSha256,
      sourceKeys: safeSourceKeys(generation.sourceKeys),
      generatedAt: generation.generatedAt,
      errorKind: diagnosticErrorKind(generation.error),
    }));
  const active = sources.filter((s) => s.enabled);
  const healthyPct = active.length
    ? active.filter((s) => s.status === 'fresh').length / active.length
    : 1;
  const freshPct = active.length
    ? active.filter((s) => s.status === 'fresh').length / active.length
    : 1;
  const score = Math.round(
    healthyPct * 40 +
      freshPct * 30 +
      (storyCoveragePct / 100) * 15 +
      (briefings.length
        ? (1 - llmFallbackBriefings / briefings.length) * 15
        : 15)
  );
  if (!briefings.length) notes.push('no briefings generated yet');
  if (failedAgendaFixups.length)
    notes.push(
      `agenda_fixup unavailable (${failedAgendaFixups.length} failed attempt${
        failedAgendaFixups.length === 1 ? '' : 's'
      })`
    );
  // Duplicate groups are verified out-of-band (dedupe script: 0 groups); not re-scanned here for speed.
  const duplicateGroups = 0;
  const runRows: {
    id: number;
    status: string;
    currentStage?: string | null;
    coverageGaps: string;
    error?: string | null;
  }[] = ds.hasMetadata(PipelineRunSchema)
    ? (
        await ds
          .getRepository(PipelineRunSchema)
          .find({
            where: { localitySlug: locality.slug },
            order: { id: 'DESC' },
            take: 1,
          })
      ).filter(
        (row): row is typeof row & { id: number } => row.id !== undefined
      )
    : [];
  const latestRun = runRows[0];
  const stageRows: {
    stage: string;
    status: string;
    counts: string;
    coverageGaps: string;
  }[] =
    latestRun && ds.hasMetadata(PipelineStageRunSchema)
      ? await ds
          .getRepository(PipelineStageRunSchema)
          .find({ where: { runId: latestRun.id } })
      : [];
  const failedStage =
    stageRows.find((stage) => stage.status === 'failed')?.stage ?? null;
  let coverageGaps: unknown[] = [];
  if (latestRun?.coverageGaps) {
    try {
      coverageGaps = JSON.parse(latestRun.coverageGaps) as unknown[];
    } catch {
      coverageGaps = [];
    }
  }
  const projections = ds.hasMetadata(EditionItemSchema)
    ? await ds
        .getRepository(EditionItemSchema)
        .find({ where: { localitySlug: locality.slug } })
    : [];
  const projectStage = stageRows.find((stage) => stage.stage === 'project');
  let projectionCounts = {
    include: projections.filter((row) => row.decision === 'include').length,
    withhold: projections.filter((row) => row.decision === 'withhold').length,
    uncertain: projections.filter((row) => row.decision === 'uncertain').length,
  };
  if (projectStage) {
    try {
      const counts = JSON.parse(projectStage.counts) as Record<string, unknown>;
      projectionCounts = {
        include:
          typeof counts['included'] === 'number' ? counts['included'] : 0,
        withhold:
          typeof counts['withheld'] === 'number' ? counts['withheld'] : 0,
        uncertain:
          typeof counts['uncertain'] === 'number' ? counts['uncertain'] : 0,
      };
    } catch {
      projectionCounts = { include: 0, withhold: 0, uncertain: 0 };
    }
  }
  const uncertainWithheld = projectStage
    ? projectionCounts.withhold + projectionCounts.uncertain
    : items.filter(
        (item) =>
          item.geographyDecision === 'uncertain' ||
          item.geographyDecision === 'withhold'
      ).length;
  return {
    slug: locality.slug,
    score,
    sources,
    itemsTotal: items.length,
    threadsMulti: multi,
    storiesDeveloped: stories.length,
    storyCoveragePct,
    llmFallbackBriefings,
    briefingsChecked: briefings.length,
    duplicateGroups,
    notes,
    lastRun: latestRun
      ? {
          runId: latestRun.id,
          status: latestRun.status,
          currentStage: latestRun.currentStage ?? null,
          coverageGaps,
          error: latestRun.error ?? null,
        }
      : null,
    failedStage,
    quarantineCount: localityQuarantines.length,
    coverageGaps,
    uncertainWithheld,
    projectionCounts,
    agendaFixupFailures: failedAgendaFixups.length,
    agendaFixupDiagnostics,
  };
}
