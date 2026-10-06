import 'reflect-metadata';
import { DataSource, type QueryRunner } from 'typeorm';
import { createHash } from 'node:crypto';
import { ALL_SCHEMAS, FOUNDATION_SCHEMAS, SchemaMetaSchema } from './schema.js';
import {
  LlmGenerationSchema,
  CanonicalStoryRevisionSchema,
  StoryRevisionCitationSchema,
  CanonicalStorySchema,
  CanonicalStoryItemSchema,
  CivicItemSchema,
  AgendaItemSchema,
  FoundationSourceSchema,
  SourceSchema,
  PipelineRunSchema,
  LocalitySchema,
  type LlmGenerationRow,
  type CanonicalStoryRevisionRow,
  type StoryRevisionCitationRow,
} from './schema.js';

let cached: DataSource | null = null;

/**
 * Version of the foundation entity definitions. Bump it whenever an entity
 * changes. While the POC schema is still moving, foundation databases hold
 * derived data and are recreated rather than migrated.
 */
export const FOUNDATION_SCHEMA_VERSION = '2026-09-17.1';
const SCHEMA_VERSION_KEY = 'schemaVersion';

/** Foundation databases are Postgres; the URL is postgres://… or postgresql://… */
function requirePostgresUrl(targetUrl: string): void {
  if (
    !targetUrl.startsWith('postgres://') &&
    !targetUrl.startsWith('postgresql://')
  ) {
    throw new Error('foundation target must be a postgres URL');
  }
}

export async function getDataSource(url?: string): Promise<DataSource> {
  if (cached?.isInitialized) return cached;
  const raw = url ?? process.env['DATA_SOURCE_URL'];
  if (!raw) throw new Error('DATA_SOURCE_URL is required');
  requirePostgresUrl(raw);
  cached = new DataSource({
    type: 'postgres',
    url: raw,
    entities: ALL_SCHEMAS,
    synchronize: false,
    migrationsRun: false,
  });
  await cached.initialize();
  return cached;
}

/** 'empty' for a database with no application tables, otherwise its recorded schema version (null when unrecorded). */
async function readSchemaVersion(
  dataSource: DataSource
): Promise<'empty' | string | null> {
  const rows: { name: string }[] = await dataSource.query(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
  );
  const tables = rows.map((row) => row.name);
  if (!tables.length) return 'empty';
  if (!tables.includes('schema_meta')) return null;
  const meta = (await dataSource.query(
    'SELECT value FROM schema_meta WHERE "key" = $1',
    [SCHEMA_VERSION_KEY]
  )) as { value: string }[];
  return meta[0]?.value ?? null;
}

function schemaMismatch(version: string | null): Error {
  return new Error(
    `foundation target has schema ${
      version ?? 'unversioned (created before 2026-09-16)'
    }, expected ${FOUNDATION_SCHEMA_VERSION}; foundation databases are derived data, so point the run at a new database`
  );
}

/** Read-only gate for strict live runs: the target must already exist with the current schema version. */
export async function preflightFoundationTarget(
  targetUrl: string
): Promise<void> {
  requirePostgresUrl(targetUrl);
  const dataSource = new DataSource({
    type: 'postgres',
    url: targetUrl,
    entities: [],
    synchronize: false,
    migrationsRun: false,
  });
  try {
    await dataSource.initialize();
    const version = await readSchemaVersion(dataSource);
    if (version === 'empty') throw new Error('foundation target is empty');
    if (version !== FOUNDATION_SCHEMA_VERSION) throw schemaMismatch(version);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

/** Provenance tables are append-only: model outputs and published story revisions are never edited in place. */
const APPEND_ONLY_TABLES = [
  'llm_generations',
  'canonical_story_revisions',
  'story_revision_citations',
] as const;

async function createAppendOnlyGuards(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `CREATE OR REPLACE FUNCTION civic_reject_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only table % cannot be changed', TG_TABLE_NAME; END; $$`
  );
  for (const table of APPEND_ONLY_TABLES) {
    await dataSource.query(
      `CREATE TRIGGER civic_${table}_immutable_update BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION civic_reject_immutable()`
    );
    await dataSource.query(
      `CREATE TRIGGER civic_${table}_immutable_delete BEFORE DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION civic_reject_immutable()`
    );
  }
}

/**
 * Create or open an isolated foundation target. An empty target is created
 * from the entity definitions; slice P2.2 replaces this with a generated
 * migration owned by civic-briefing.
 */
export async function createFoundationDataSource(
  targetUrl: string
): Promise<DataSource> {
  requirePostgresUrl(targetUrl);
  const dataSource = new DataSource({
    type: 'postgres',
    url: targetUrl,
    entities: FOUNDATION_SCHEMAS,
    synchronize: false,
    migrationsRun: false,
  });
  try {
    await dataSource.initialize();
    const version = await readSchemaVersion(dataSource);
    if (version === 'empty') {
      await dataSource.synchronize();
      await createAppendOnlyGuards(dataSource);
      await dataSource
        .getRepository(SchemaMetaSchema)
        .insert({ key: SCHEMA_VERSION_KEY, value: FOUNDATION_SCHEMA_VERSION });
    } else if (version !== FOUNDATION_SCHEMA_VERSION) {
      throw schemaMismatch(version);
    }
    return dataSource;
  } catch (error) {
    if (dataSource.isInitialized) await dataSource.destroy();
    throw error;
  }
}

export async function closeDataSource(): Promise<void> {
  if (cached?.isInitialized) await cached.destroy();
  cached = null;
}

const LLM_OPERATIONS = new Set(['cluster', 'brief', 'story', 'agenda_fixup']);

function requireDataSourceBoundary(value: DataSource): DataSource {
  if (!(value instanceof DataSource) || !value.isInitialized)
    throw new Error('persistence boundary must be an initialized DataSource');
  return value;
}

export type LlmGenerationInput = Omit<LlmGenerationRow, 'id' | 'sourceKeys'> & {
  sourceKeys: readonly string[] | string;
};

function canonicalSha256(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error(`${field} must be a 64-character SHA-256 hex digest`);
  return value.toLowerCase();
}

function canonicalIsoTimestamp(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    ) ||
    Number.isNaN(Date.parse(value))
  )
    throw new Error('generatedAt must be a valid ISO timestamp');
  return new Date(value).toISOString();
}

function canonicalSourceKeys(value: readonly string[] | string): string {
  let parsed: unknown;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : [...value];
  } catch {
    throw new Error('sourceKeys must be a JSON array of source keys');
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.some((key) => typeof key !== 'string' || !key.trim())
  )
    throw new Error('sourceKeys must contain non-empty strings');
  return JSON.stringify(
    [...new Set(parsed.map((key) => (key as string).trim()))].sort((a, b) =>
      a.localeCompare(b)
    )
  );
}

function canonicalGenerationSettings(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  let parsed: unknown;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new Error('generationSettings must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('generationSettings must be a JSON object');
  const row = parsed as Record<string, unknown>;
  for (const key of [
    'temperature',
    'seed',
    'numCtx',
    'numPredict',
    'repeatPenalty',
    'repeatLastN',
  ])
    if (
      row[key] !== undefined &&
      (typeof row[key] !== 'number' || !Number.isFinite(row[key]))
    )
      throw new Error('generationSettings values must be finite numbers');
  if (row['stage'] !== undefined && row['stage'] !== 'plan')
    throw new Error('generationSettings stage must be "plan"');
  return JSON.stringify({
    ...(row['temperature'] === undefined
      ? {}
      : { temperature: row['temperature'] }),
    ...(row['seed'] === undefined ? {} : { seed: row['seed'] }),
    ...(row['numCtx'] === undefined ? {} : { numCtx: row['numCtx'] }),
    ...(row['numPredict'] === undefined
      ? {}
      : { numPredict: row['numPredict'] }),
    ...(row['repeatPenalty'] === undefined
      ? {}
      : { repeatPenalty: row['repeatPenalty'] }),
    ...(row['repeatLastN'] === undefined
      ? {}
      : { repeatLastN: row['repeatLastN'] }),
    ...(row['stage'] === undefined ? {} : { stage: row['stage'] }),
  });
}

function normalizeLlmGenerationInput(
  raw: LlmGenerationInput
): LlmGenerationInput {
  // A two-stage brief's plan is a step of the brief operation. It is stored as
  // one, marked stage=plan, so the operation set (a CHECK constraint on
  // derived databases that are never migrated) stays as it is; readers find a
  // brief's generation by its exact input hash, so a plan row is never taken
  // for the article.
  const input: LlmGenerationInput =
    (raw.operation as string) === 'brief_plan'
      ? {
          ...raw,
          operation: 'brief',
          generationSettings: JSON.stringify({
            ...(typeof raw.generationSettings === 'string'
              ? JSON.parse(raw.generationSettings)
              : raw.generationSettings ?? {}),
            stage: 'plan',
          }),
        }
      : raw;
  if (!LLM_OPERATIONS.has(input.operation))
    throw new Error(`unsupported LLM operation: ${String(input.operation)}`);
  if (!Number.isInteger(input.attempt) || input.attempt < 1)
    throw new Error('LLM attempt must be a positive integer');
  if (
    typeof input.localitySlug !== 'string' ||
    !input.localitySlug.trim() ||
    typeof input.model !== 'string' ||
    !input.model.trim()
  )
    throw new Error('LLM generation localitySlug and model are required');
  if (!Number.isFinite(input.latencyMs) || input.latencyMs < 0)
    throw new Error('LLM generation latencyMs must be finite and nonnegative');
  const status = input.status === 'succeeded' ? 'successful' : input.status;
  if (!['successful', 'validated', 'failed', 'invalid'].includes(status))
    throw new Error(`unsupported LLM generation status: ${String(status)}`);
  const output = input.output ?? null;
  const error = input.error ?? null;
  if (output !== null && typeof output !== 'string')
    throw new Error('LLM generation output must be text or null');
  if (error !== null && typeof error !== 'string')
    throw new Error('LLM generation error must be text or null');
  const outputSha256 =
    input.outputSha256 == null
      ? null
      : canonicalSha256(input.outputSha256, 'outputSha256');
  const hasOutput = typeof output === 'string' && output.length > 0;
  if (['successful', 'validated'].includes(status)) {
    if (!hasOutput || !outputSha256)
      throw new Error(
        'successful LLM generation requires output and outputSha256'
      );
    if (canonicalSha256(sha256Text(output), 'outputSha256') !== outputSha256)
      throw new Error('outputSha256 does not match output');
    if (error !== null)
      throw new Error('successful LLM generation cannot include an error');
  } else {
    if (typeof error !== 'string' || !error.trim())
      throw new Error('failed/invalid LLM generation requires an error');
    if (outputSha256 && !hasOutput)
      throw new Error('outputSha256 requires output text');
    if (
      outputSha256 &&
      canonicalSha256(sha256Text(output as string), 'outputSha256') !==
        outputSha256
    )
      throw new Error('outputSha256 does not match output');
  }
  return {
    ...input,
    status,
    promptSha256: canonicalSha256(input.promptSha256, 'promptSha256'),
    inputSha256: canonicalSha256(input.inputSha256, 'inputSha256'),
    outputSha256,
    sourceKeys: canonicalSourceKeys(input.sourceKeys),
    output,
    error,
    generatedAt: canonicalIsoTimestamp(input.generatedAt),
    generationSettings: canonicalGenerationSettings(input.generationSettings),
  };
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** True when one locality contains the other (or they are the same) in the persisted locality graph. */
async function isRelatedScope(
  manager: import('typeorm').EntityManager,
  localitySlug: string,
  scopeSlug: string
): Promise<boolean> {
  if (localitySlug === scopeSlug) return true;
  const rows = await manager.getRepository(LocalitySchema).find();
  const parents = new Map(
    rows.map((row) => [
      row.slug,
      (() => {
        try {
          return JSON.parse(row.parents ?? '[]') as string[];
        } catch {
          return [];
        }
      })(),
    ])
  );
  const containedBy = (child: string, ancestor: string): boolean => {
    const seen = new Set<string>();
    const queue = [...(parents.get(child) ?? [])];
    while (queue.length) {
      const next = queue.shift()!;
      if (next === ancestor) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...(parents.get(next) ?? []));
    }
    return false;
  };
  return (
    containedBy(localitySlug, scopeSlug) || containedBy(scopeSlug, localitySlug)
  );
}

function assertImmutableLlmGeneration(
  existing: LlmGenerationRow,
  input: LlmGenerationInput,
  sourceKeys: string
): void {
  for (const field of [
    'localitySlug',
    'operation',
    'model',
    'status',
    'attempt',
    'promptSha256',
    'inputSha256',
    'generatedAt',
    'latencyMs',
  ] as const) {
    if (existing[field] !== input[field])
      throw new Error(`immutable LLM generation ${field} mismatch`);
  }
  for (const field of [
    'outputSha256',
    'output',
    'error',
    'generationSettings',
  ] as const) {
    if ((existing[field] ?? null) !== (input[field] ?? null))
      throw new Error(`immutable LLM generation ${field} mismatch`);
  }
  if (existing.sourceKeys !== sourceKeys)
    throw new Error('immutable LLM generation sourceKeys mismatch');
}

/** Append one generation attempt. Existing attempts are immutable and an exact
 * retry (the idempotency key) returns the original row. Diagnostics are stored
 * even when status is failed/invalid; callers should invoke this before any
 * artifact transaction. */
export async function persistLlmGeneration(
  dataSource: DataSource,
  input: LlmGenerationInput
): Promise<LlmGenerationRow> {
  requireDataSourceBoundary(dataSource);
  const normalized = normalizeLlmGenerationInput(input);
  const sourceKeys = normalized.sourceKeys as string;
  const repo = dataSource.getRepository(LlmGenerationSchema);
  if (!Number.isInteger(normalized.runId) || normalized.runId < 1)
    throw new Error('LLM generation runId must be a positive integer');
  const key = {
    runId: normalized.runId,
    operation: normalized.operation,
    inputSha256: normalized.inputSha256,
    attempt: normalized.attempt,
  };
  const existing = await repo.findOneBy(key);
  if (existing) {
    assertImmutableLlmGeneration(existing, normalized, sourceKeys);
    return existing;
  }
  const row = { ...normalized, sourceKeys } as LlmGenerationRow;
  try {
    await repo
      .createQueryBuilder()
      .insert()
      .into(LlmGenerationSchema)
      .values(row)
      .orIgnore()
      .execute();
  } catch (error) {
    const raced = await repo.findOneBy(key);
    if (!raced) throw error;
  }
  const persisted = await repo.findOneBy(key);
  if (!persisted) throw new Error('LLM generation was not persisted');
  assertImmutableLlmGeneration(persisted, normalized, sourceKeys);
  return persisted;
}

export interface StoryRevisionCitationInput {
  civicItemId: number;
  agendaItemId?: number;
  sourceKey?: string;
  snippetOnly?: boolean;
}

export interface ResolvedStoryRevisionCitation {
  civicItemId: number;
  agendaItemId?: number | null;
  sourceKey: string;
  snippetOnly: boolean;
  createdAt: string;
}

/**
 * Normalize the citations that will be persisted for one immutable story
 * revision. A model can cite the same evidence item more than once across its
 * claims, but the database identity is revision + civic item. Duplicate
 * records are therefore collapsed only when their authoritative bindings are
 * identical. A source/access disagreement is unsafe to resolve by picking a
 * winner, so it fails closed before any row is inserted.
 */
export function normalizeStoryRevisionCitations(
  citations: readonly ResolvedStoryRevisionCitation[]
): ResolvedStoryRevisionCitation[] {
  const byItem = new Map<string, ResolvedStoryRevisionCitation>();
  for (const citation of citations) {
    const key = `${citation.civicItemId}:${citation.agendaItemId ?? ''}`;
    const existing = byItem.get(key);
    if (!existing) {
      byItem.set(key, citation);
      continue;
    }
    if (existing.sourceKey !== citation.sourceKey) {
      throw new Error(
        `conflicting story citation sourceKey for civic item ${citation.civicItemId}`
      );
    }
    if (existing.snippetOnly !== citation.snippetOnly) {
      throw new Error(
        `conflicting story citation access metadata for civic item ${citation.civicItemId}`
      );
    }
    if (existing.createdAt !== citation.createdAt) {
      throw new Error(
        `conflicting story citation createdAt for civic item ${citation.civicItemId}`
      );
    }
  }
  return [...byItem.values()].sort(
    (left, right) =>
      left.civicItemId - right.civicItemId ||
      (left.agendaItemId ?? 0) - (right.agendaItemId ?? 0) ||
      left.sourceKey.localeCompare(right.sourceKey)
  );
}

export interface PublicationReceipt {
  path: string;
  sha256: string;
  token: string;
}

/**
 * Receipt produced by the recoverable publication layer. Persistence checks
 * only this trusted contract's non-empty fields and checksum shape; filesystem
 * existence and atomic publication are completed by the Task 6 integration.
 */
export function createPublicationReceipt(
  input: PublicationReceipt
): PublicationReceipt {
  if (!input || typeof input.path !== 'string' || !input.path.trim())
    throw new Error('publication receipt requires a non-empty artifact path');
  if (typeof input.token !== 'string' || !input.token.trim())
    throw new Error('publication receipt requires a non-empty token');
  if (typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(input.sha256))
    throw new Error('publication receipt requires a SHA-256 checksum');
  return {
    path: input.path,
    sha256: input.sha256.toLowerCase(),
    token: input.token,
  };
}

export type CanonicalStoryRevisionInput = Omit<
  CanonicalStoryRevisionRow,
  'id' | 'revision'
> & {
  revision?: number;
  citations: readonly StoryRevisionCitationInput[];
  publicationReceipt: PublicationReceipt;
};

/** Persist a validated canonical revision and its citations atomically. The
 * pointer is advanced only after the links and artifact success contract have
 * completed. Failed generation diagnostics live in llm_generations and never
 * enter this immutable table. */
export async function appendCanonicalStoryRevision(
  dataSource: DataSource,
  input: CanonicalStoryRevisionInput,
  transactionRunner?: QueryRunner
): Promise<CanonicalStoryRevisionRow> {
  const publicationReceipt = createPublicationReceipt(input.publicationReceipt);
  const inputSha256 = canonicalSha256(input.inputSha256, 'inputSha256');
  if (input.status !== 'successful')
    throw new Error('only successful validated output creates a revision');
  if (
    input.titleOrigin !== undefined &&
    input.titleOrigin !== null &&
    input.titleOrigin !== 'model' &&
    input.titleOrigin !== 'evidence'
  )
    throw new Error('story revision titleOrigin must be model or evidence');
  if (!input.title.trim() || !input.narrative.trim())
    throw new Error('story revision title and narrative are required');
  if (!input.citations.length)
    throw new Error('story revision requires at least one citation');
  const queryRunner = transactionRunner ?? dataSource.createQueryRunner();
  const ownsTransaction = transactionRunner === undefined;
  if (ownsTransaction) {
    await queryRunner.connect();
    await queryRunner.startTransaction();
  }
  try {
    const manager = queryRunner.manager;
    const storyRepo = manager.getRepository(CanonicalStorySchema);
    const revisionRepo = manager.getRepository(CanonicalStoryRevisionSchema);
    const citationRepo = manager.getRepository(StoryRevisionCitationSchema);
    const story = await storyRepo.findOneBy({ id: input.canonicalStoryId });
    if (!story)
      throw new Error(
        `canonical story ${input.canonicalStoryId} does not exist`
      );
    const priorByInput = await revisionRepo.findOneBy({
      canonicalStoryId: input.canonicalStoryId,
      inputSha256,
    });
    let revision = input.revision;
    const max = await revisionRepo
      .createQueryBuilder('revision')
      .select('MAX(revision.revision)', 'max')
      .where('revision.canonicalStoryId = :id', { id: input.canonicalStoryId })
      .getRawOne<{ max: string | null }>();
    const maxRevision =
      max?.max === null || max?.max === undefined ? 0 : Number(max.max);
    if (revision === undefined) revision = maxRevision + 1;
    const existingRevision = await revisionRepo.findOneBy({
      canonicalStoryId: input.canonicalStoryId,
      revision,
    });
    if (existingRevision) {
      if (existingRevision.inputSha256.toLowerCase() !== inputSha256)
        throw new Error(
          `story revision ${revision} already exists with different input`
        );
    }
    if (!existingRevision && revision <= maxRevision)
      throw new Error(`story revision must be monotonic after ${maxRevision}`);
    const resolvedCitations: ResolvedStoryRevisionCitation[] = [];
    for (const citation of input.citations) {
      const links = await manager
        .getRepository(CanonicalStoryItemSchema)
        .find({ where: { civicItemId: citation.civicItemId } });
      const exactLink = links.find(
        (link) =>
          link.canonicalStoryId === input.canonicalStoryId &&
          (citation.agendaItemId === undefined
            ? link.agendaItemId == null
            : link.agendaItemId === citation.agendaItemId)
      );
      if (!exactLink)
        throw new Error(
          `story citation civic item ${citation.civicItemId}${
            citation.agendaItemId === undefined
              ? ''
              : ` agenda item ${citation.agendaItemId}`
          } is not linked to canonical story ${input.canonicalStoryId}`
        );
      const item = await manager
        .getRepository(CivicItemSchema)
        .findOneBy({ id: citation.civicItemId });
      if (!item)
        throw new Error(
          `story citation civic item ${citation.civicItemId} does not exist`
        );
      if (
        item.geographyDecision === 'withhold' ||
        item.geographyDecision === 'uncertain'
      )
        throw new Error(
          `story citation civic item ${citation.civicItemId} is not eligible`
        );
      // The story engine links evidence from related places (a county
      // record in a town story), never from unrelated places.
      const itemScope = item.scopeSlug ?? item.localitySlug;
      if (!(await isRelatedScope(manager, story.scopeSlug, itemScope)))
        throw new Error(
          `story citation civic item ${citation.civicItemId} is outside canonical story scope`
        );
      const sourceRepo = manager.connection.hasMetadata(FoundationSourceSchema)
        ? manager.getRepository(FoundationSourceSchema)
        : manager.getRepository(SourceSchema);
      const source = await sourceRepo.findOneBy({ id: item.sourceId });
      if (!source || !source.sourceKey)
        throw new Error(
          `story citation civic item ${citation.civicItemId} has no stored source metadata`
        );
      const sourceKey = source.sourceKey;
      const snippetOnly =
        item.accessMode === 'snippet-only' ||
        source?.accessMode === 'snippet-only';
      if (citation.sourceKey !== undefined && citation.sourceKey !== sourceKey)
        throw new Error(
          `story citation sourceKey mismatch for civic item ${citation.civicItemId}`
        );
      if (
        citation.snippetOnly !== undefined &&
        citation.snippetOnly !== snippetOnly
      )
        throw new Error(
          `story citation snippetOnly mismatch for civic item ${citation.civicItemId}`
        );
      if (citation.agendaItemId !== undefined) {
        const agenda = await manager
          .getRepository(AgendaItemSchema)
          .findOneBy({ id: citation.agendaItemId });
        if (!agenda || agenda.itemId !== citation.civicItemId)
          throw new Error(
            `story citation agenda item ${citation.agendaItemId} is not part of civic item ${citation.civicItemId}`
          );
      }
      resolvedCitations.push({
        civicItemId: citation.civicItemId,
        agendaItemId: exactLink.agendaItemId ?? null,
        sourceKey,
        snippetOnly,
        createdAt: input.createdAt,
      });
    }
    const normalizedCitations =
      normalizeStoryRevisionCitations(resolvedCitations);
    if (input.generationId !== null && input.generationId !== undefined) {
      const generation = await manager
        .getRepository(LlmGenerationSchema)
        .findOneBy({ id: input.generationId });
      if (
        !generation ||
        generation.operation !== 'story' ||
        !['successful', 'validated'].includes(generation.status)
      )
        throw new Error(
          'story revision requires a successful validated story generation'
        );
      if (generation.inputSha256.toLowerCase() !== inputSha256)
        throw new Error('story revision inputSha256 does not match generation');
      const run = await manager
        .getRepository(PipelineRunSchema)
        .findOneBy({ id: generation.runId });
      if (
        !run ||
        !run.scopeSlug?.trim() ||
        !run.localitySlug?.trim() ||
        !run.cadence?.trim() ||
        run.localitySlug !== generation.localitySlug
      )
        throw new Error(
          'story revision generation run/locality/cadence mismatch'
        );
      if (run.scopeSlug !== run.localitySlug)
        throw new Error(
          'story revision generation run scopeSlug/localitySlug mismatch'
        );
      // A story may be generated by an edition that contains its scope or is
      // contained by it (a county story in a town edition, a nested city's
      // story in its town's edition).
      if (
        !(await isRelatedScope(
          manager,
          generation.localitySlug,
          story.scopeSlug
        ))
      )
        throw new Error(
          'story revision generation is outside canonical story context'
        );
    } else throw new Error('story revision requires a generationId');
    if (priorByInput || existingRevision) {
      const candidate = priorByInput ?? existingRevision!;
      if (input.revision !== undefined && candidate.revision !== input.revision)
        throw new Error('immutable story revision revision mismatch');
      for (const field of [
        'canonicalStoryId',
        'status',
        'title',
        'titleOrigin',
        'narrative',
        'storyStatus',
        'generationId',
        'inputSha256',
        'createdAt',
      ] as const) {
        if (
          field === 'inputSha256'
            ? candidate[field].toLowerCase() !== inputSha256
            : field === 'titleOrigin'
            ? (candidate[field] ?? null) !== (input[field] ?? null)
            : candidate[field] !== input[field]
        )
          throw new Error(`immutable story revision ${field} mismatch`);
      }
      if (
        candidate.artifactPath !== publicationReceipt.path ||
        candidate.artifactSha256?.toLowerCase() !== publicationReceipt.sha256 ||
        candidate.artifactToken !== publicationReceipt.token
      )
        throw new Error(
          'immutable story revision publication receipt mismatch'
        );
      const stored = await citationRepo.find({
        where: { revisionId: candidate.id },
      });
      const actual = stored
        .map(
          (row) =>
            `${row.civicItemId}:${row.agendaItemId ?? ''}:${row.sourceKey}:${
              row.snippetOnly
            }`
        )
        .sort();
      const requested = normalizedCitations
        .map(
          (row) =>
            `${row.civicItemId}:${row.agendaItemId ?? ''}:${row.sourceKey}:${
              row.snippetOnly
            }`
        )
        .sort();
      if (actual.join('|') !== requested.join('|'))
        throw new Error('immutable story revision citation binding mismatch');
      if (ownsTransaction) await queryRunner.commitTransaction();
      return candidate;
    }
    const saved = await revisionRepo.save({
      canonicalStoryId: input.canonicalStoryId,
      revision,
      status: input.status,
      title: input.title,
      titleOrigin: input.titleOrigin ?? null,
      narrative: input.narrative,
      storyStatus: input.storyStatus,
      generationId: input.generationId,
      inputSha256,
      createdAt: input.createdAt,
      artifactPath: publicationReceipt.path,
      artifactSha256: publicationReceipt.sha256,
      artifactToken: publicationReceipt.token,
    });
    await citationRepo.save(
      normalizedCitations.map((citation) => ({
        ...citation,
        revisionId: saved.id!,
      }))
    );
    await storyRepo.update(
      { id: input.canonicalStoryId },
      { currentRevisionId: saved.id, updatedAt: input.createdAt }
    );
    if (ownsTransaction) await queryRunner.commitTransaction();
    return saved;
  } catch (error) {
    if (ownsTransaction) await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    if (ownsTransaction) await queryRunner.release();
  }
}

/** Append a set of story revisions behind one publication transaction. This
 * keeps append-only revision/citation tables atomic when a later story fails:
 * the database rolls back all earlier inserts without destructive deletes. */
export async function appendCanonicalStoryRevisions(
  dataSource: DataSource,
  inputs: readonly CanonicalStoryRevisionInput[]
): Promise<CanonicalStoryRevisionRow[]> {
  if (!inputs.length) return [];
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const revisions: CanonicalStoryRevisionRow[] = [];
    for (const input of inputs)
      revisions.push(
        await appendCanonicalStoryRevision(dataSource, input, queryRunner)
      );
    await queryRunner.commitTransaction();
    return revisions;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

export const recordLlmGeneration = persistLlmGeneration;
export const appendLlmGeneration = persistLlmGeneration;
export const saveLlmGeneration = persistLlmGeneration;

export interface LlmAttemptCallback {
  /** Optional callback metadata is accepted structurally from packages/llm;
   * the recorder's run-scoped defaults remain authoritative. */
  runId?: string | number;
  operation: LlmGenerationInput['operation'];
  model: string;
  status: string;
  attempt: number;
  promptSha256: string;
  inputSha256: string;
  outputSha256?: string | null;
  sourceKeys: readonly string[] | string;
  output?: string | null;
  /** Optional transport diagnostics; canonical output is always `output`. */
  raw?: unknown;
  error?: unknown;
  generationSettings?: unknown;
  generatedAt?: string;
  latencyMs?: number;
}

export interface LlmAttemptRecorder {
  record(callback: LlmAttemptCallback): Promise<LlmGenerationRow>;
}

/** Adapter boundary for strict summarizers. Task 6 wires this recorder into
 * the live client; Task 3 keeps it deliberately caller-agnostic. */
export function createLlmAttemptRecorder(
  dataSource: DataSource,
  defaults: { runId: number; localitySlug: string }
): LlmAttemptRecorder {
  requireDataSourceBoundary(dataSource);
  if (!Number.isInteger(defaults.runId) || defaults.runId < 1)
    throw new Error('LLM attempt recorder requires a positive runId');
  if (!defaults.localitySlug.trim())
    throw new Error('LLM attempt recorder requires a localitySlug');
  return {
    record(callback) {
      return persistLlmGeneration(dataSource, {
        ...callback,
        runId: defaults.runId,
        localitySlug: defaults.localitySlug,
        output: callback.output ?? null,
        outputSha256: callback.outputSha256 ?? null,
        sourceKeys: callback.sourceKeys ?? [],
        error:
          callback.error instanceof Error
            ? `${callback.error.name}: ${callback.error.message}`
            : callback.error === undefined || callback.error === null
            ? null
            : String(callback.error),
        generatedAt: callback.generatedAt ?? new Date().toISOString(),
        latencyMs: callback.latencyMs ?? 0,
        generationSettings:
          callback.generationSettings === undefined
            ? null
            : typeof callback.generationSettings === 'string'
            ? callback.generationSettings
            : JSON.stringify(callback.generationSettings),
      });
    },
  };
}

export const makeLlmAttemptRecorder = createLlmAttemptRecorder;
export const persistStoryRevision = appendCanonicalStoryRevision;
export const saveCanonicalStoryRevision = appendCanonicalStoryRevision;
