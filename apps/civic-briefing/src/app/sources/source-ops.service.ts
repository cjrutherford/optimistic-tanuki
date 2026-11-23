import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import {
  localityHealth,
  type LocalityConfig,
  type LocalityRegistry,
  type SourceConfig,
  type SourceHealth,
} from '@optimistic-tanuki/civic-core';
import {
  MAX_SOURCE_REASON_LENGTH,
  SOURCE_OVERRIDE_KINDS,
  SOURCE_REQUEST_DECISIONS,
  SOURCE_REQUEST_STATUSES,
  type SourceDecisionEntry,
  type SourceDecisionPage,
  type SourceHealthEntry,
  type SourceHealthReport,
  type SourceHealthStatus,
  type SourceOverride,
  type SourceRequestDecision,
  type SourceRequestEntry,
  type SourceRequestPage,
  type SourceRequestStatus,
} from '@optimistic-tanuki/models';
import { type DataSource, In, IsNull, Not } from 'typeorm';
import type { LocalityRegistrySource } from '../registry/locality-registry.source';
import {
  type SourceRequestRow,
  SourceRequestSchema,
} from '../registry/source-request.schema';
import {
  type SourceOverrideKind,
  type SourceOverrideRow,
  SourceOverrideSchema,
} from '../schedule/source-override.schema';
import {
  type SourcingDecisionRow,
  SourcingDecisionSchema,
} from '../schedule/sourcing-decision.schema';
import { SourcingStore } from '../schedule/sourcing-store';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** A value the service refuses; the gateway answers it with 400. */
export class InvalidSourceOpError extends Error {}
/** The request was already decided; the gateway answers it with 409. */
export class SourceRequestDecidedError extends Error {}

export interface PageInput {
  limit?: number;
  offset?: number;
}

export interface SetOverrideInput {
  slug: string;
  sourceKey: string;
  kind: string;
  reason: string;
  actor: string;
}

export interface ClearOverrideInput {
  sourceKey: string;
  reason: string;
  actor: string;
}

export interface DecideRequestInput {
  id: string;
  decision: string;
  reason: string;
  actor: string;
}

/**
 * A source's health in an operator's words: retired once switched off,
 * failing while its fetches fail, quiet when it has published nothing new for
 * too long (or was never fetched), healthy otherwise.
 */
export function sourceStatus(
  health: Pick<SourceHealth, 'enabled' | 'status'>
): SourceHealthStatus {
  if (!health.enabled) return 'retired';
  if (health.status === 'failing') return 'failing';
  if (health.status === 'fresh') return 'healthy';
  return 'quiet';
}

function page({ limit, offset }: PageInput): { take: number; skip: number } {
  const take = Number.isInteger(limit)
    ? Math.min(Math.max(limit as number, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  const skip =
    Number.isInteger(offset) && (offset as number) > 0 ? (offset as number) : 0;
  return { take, skip };
}

function requireReason(reason: unknown): string {
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (!text) throw new InvalidSourceOpError('A reason is required.');
  if (text.length > MAX_SOURCE_REASON_LENGTH)
    throw new InvalidSourceOpError(
      `The reason is limited to ${MAX_SOURCE_REASON_LENGTH} characters.`
    );
  return text;
}

function requireActor(actor: unknown): string {
  if (typeof actor !== 'string' || !actor.trim())
    throw new InvalidSourceOpError('The operator is required.');
  return actor;
}

function iso(value: Date | string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function evidenceOf(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Operators' view of, and control over, a town's sources (SD.6): the decision
 * log, overrides (block, pin), per-source health and readers' requests.
 */
export class SourceOpsService {
  private readonly logger = new Logger(SourceOpsService.name);
  private readonly store: SourcingStore;

  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: Pick<LocalityRegistrySource, 'current'>
  ) {
    this.store = new SourcingStore(dataSource);
  }

  private get decisions() {
    return this.dataSource.getRepository<SourcingDecisionRow>(
      SourcingDecisionSchema
    );
  }
  private get overrideRows() {
    return this.dataSource.getRepository<SourceOverrideRow>(
      SourceOverrideSchema
    );
  }
  private get requests() {
    return this.dataSource.getRepository<SourceRequestRow>(SourceRequestSchema);
  }

  private town(slug: string): LocalityConfig | undefined {
    return this.registry
      .current()
      .all()
      .find((place) => place.slug === slug);
  }

  /** What discovery and operators decided about a town's sources, newest first. */
  async decisionLog(
    slug: string,
    input: PageInput = {}
  ): Promise<SourceDecisionPage> {
    const { take, skip } = page(input);
    const [rows, total] = await this.decisions.findAndCount({
      where: { slug, decision: Not('searched') },
      order: { decidedAt: 'DESC', id: 'DESC' },
      take,
      skip,
    });
    return {
      items: rows.map(
        (row): SourceDecisionEntry => ({
          id: row.id ?? 0,
          slug: row.slug,
          ownerSlug: row.ownerSlug ?? null,
          sourceKey: row.sourceKey ?? null,
          adapter: row.adapter ?? null,
          url: row.url ?? null,
          decision: row.decision,
          via: row.via ?? null,
          reason: row.reason ?? null,
          evidence: evidenceOf(row.evidence),
          decidedAt: new Date(row.decidedAt).toISOString(),
        })
      ),
      total,
    };
  }

  private overrideOf(row: SourceOverrideRow): SourceOverride {
    return {
      id: row.id,
      slug: row.slug,
      sourceKey: row.sourceKey,
      kind: row.kind,
      reason: row.reason,
      actor: row.actor,
      createdAt: new Date(row.createdAt ?? Date.now()).toISOString(),
    };
  }

  /** The overrides in force, newest first; for one town when `slug` is given. */
  async overrides(slug?: string): Promise<SourceOverride[]> {
    const rows = await this.overrideRows.find({
      where: { clearedAt: IsNull(), ...(slug ? { slug } : {}) },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.overrideOf(row));
  }

  /**
   * Blocks a source (discovery never adopts it, and a discovered source
   * already held is switched off) or pins it (discovery adopts it even where
   * it refused, and a switched-off discovered source is switched back on). A
   * second override on the same source replaces the first. Recorded in the
   * decision log.
   */
  async setOverride(input: SetOverrideInput): Promise<SourceOverride | null> {
    const reason = requireReason(input.reason);
    const actor = requireActor(input.actor);
    if (!(SOURCE_OVERRIDE_KINDS as readonly string[]).includes(input.kind))
      throw new InvalidSourceOpError('The kind must be block or pin.');
    const kind = input.kind as SourceOverrideKind;
    const sourceKey = input.sourceKey?.trim();
    if (!sourceKey) throw new InvalidSourceOpError('A source is required.');
    if (!this.town(input.slug)) return null;
    const active = await this.overrideRows.findOneBy({
      sourceKey,
      clearedAt: IsNull(),
    });
    let row: SourceOverrideRow;
    if (active) {
      await this.overrideRows.update(active.id, {
        kind,
        reason,
        actor,
        slug: input.slug,
        createdAt: new Date(),
      });
      row = { ...active, kind, reason, actor, slug: input.slug };
    } else {
      row = {
        id: randomUUID(),
        slug: input.slug,
        sourceKey,
        kind,
        reason,
        actor,
      };
      await this.overrideRows.insert(row);
    }
    await this.store.setDiscoveredEnabled(sourceKey, kind === 'pin');
    await this.logEvent(
      input.slug,
      sourceKey,
      kind === 'block' ? 'blocked' : 'pinned',
      reason,
      actor
    );
    this.logger.log(
      `${input.slug}: ${sourceKey} ${
        kind === 'block' ? 'blocked' : 'pinned'
      } by ${actor}`
    );
    const saved = await this.overrideRows.findOneByOrFail({ id: row.id });
    return this.overrideOf(saved);
  }

  /** Clears the override on a source. Null when there is none in force. */
  async clearOverride(
    input: ClearOverrideInput
  ): Promise<SourceOverride | null> {
    const reason = requireReason(input.reason);
    const actor = requireActor(input.actor);
    const active = await this.overrideRows.findOneBy({
      sourceKey: input.sourceKey,
      clearedAt: IsNull(),
    });
    if (!active) return null;
    await this.overrideRows.update(active.id, {
      clearedAt: new Date(),
      clearedBy: actor,
      clearReason: reason,
    });
    await this.logEvent(
      active.slug,
      active.sourceKey,
      active.kind === 'block' ? 'unblocked' : 'unpinned',
      reason,
      actor
    );
    return this.overrideOf(active);
  }

  private async logEvent(
    slug: string,
    sourceKey: string,
    decision: string,
    reason: string,
    actor: string
  ): Promise<void> {
    const known = await this.decisions.findOne({
      where: { sourceKey, decision: In(['adopted', 'refused']) },
      order: { decidedAt: 'DESC', id: 'DESC' },
    });
    await this.decisions.insert({
      slug,
      ownerSlug: known?.ownerSlug ?? null,
      sourceKey,
      adapter: known?.adapter ?? null,
      url: known?.url ?? null,
      decision: decision as SourcingDecisionRow['decision'],
      via: `operator ${actor}`,
      reason,
      decidedAt: new Date(),
    });
  }

  /** Each source serving a town (its own, inside it, its county's), disabled ones included. */
  private sourcesOf(town: LocalityConfig): SourceConfig[] {
    const registry: Pick<LocalityRegistry, 'ancestors' | 'descendants'> =
      this.registry.current();
    const seen = new Set<string>();
    return [
      town,
      ...registry.descendants(town.slug),
      ...registry
        .ancestors(town.slug)
        .filter((place) => place.kind === 'county'),
    ]
      .flatMap((place) => place.sources ?? [])
      .filter((source) =>
        seen.has(source.sourceKey) ? false : !!seen.add(source.sourceKey)
      );
  }

  /** How each of a town's sources is doing; null for a slug the registry does not hold. */
  async health(slug: string): Promise<SourceHealthReport | null> {
    const town = this.town(slug);
    if (!town) return null;
    const sources = this.sourcesOf(town);
    const health = await localityHealth(this.dataSource, { ...town, sources });
    const byKey = new Map(
      health.sources.map((entry) => [entry.sourceId, entry])
    );
    const overrides = await this.store.overrides();
    return {
      slug: town.slug,
      name: town.name,
      sources: sources.flatMap((source): SourceHealthEntry[] => {
        const entry = byKey.get(source.sourceKey);
        if (!entry) return [];
        const override = overrides.get(source.sourceKey);
        return [
          {
            sourceKey: source.sourceKey,
            name: source.name ?? source.sourceKey,
            adapter: entry.adapter,
            status: sourceStatus(entry),
            lastAttemptAt: entry.lastAttemptAt,
            lastSuccessAt: entry.lastSuccessAt,
            consecutiveFailures: entry.consecutiveFailures,
            items7d: entry.items7d,
            errors7d: entry.errors7d,
            newestPublished: entry.newestPublished,
            ...(override ? { override } : {}),
          },
        ];
      }),
    };
  }

  /** Readers' requests for sources, newest first; pending unless a status is given. */
  async listRequests(
    input: PageInput & { slug?: string; status?: string } = {}
  ): Promise<SourceRequestPage> {
    const status = (input.status ?? 'pending') as SourceRequestStatus;
    if (!SOURCE_REQUEST_STATUSES.includes(status))
      throw new InvalidSourceOpError(
        'The status must be pending, approved or rejected.'
      );
    const { take, skip } = page(input);
    const [rows, total] = await this.requests.findAndCount({
      where: { status, ...(input.slug ? { slug: input.slug } : {}) },
      order: { createdAt: 'DESC', id: 'DESC' },
      take,
      skip,
    });
    return { items: rows.map((row) => this.requestOf(row)), total };
  }

  private requestOf(row: SourceRequestRow): SourceRequestEntry {
    return {
      id: row.id,
      slug: row.slug,
      townName: this.town(row.slug)?.name ?? row.slug,
      userId: row.userId,
      note: row.note ?? null,
      status: row.status ?? 'pending',
      createdAt: new Date(row.createdAt ?? Date.now()).toISOString(),
      decidedBy: row.decidedBy ?? null,
      decidedAt: iso(row.decidedAt),
      decisionReason: row.decisionReason ?? null,
    };
  }

  /** Approves or rejects a pending request, with a reason. Null for an unknown id. */
  async decideRequest(
    input: DecideRequestInput
  ): Promise<SourceRequestEntry | null> {
    const reason = requireReason(input.reason);
    const actor = requireActor(input.actor);
    if (
      !(SOURCE_REQUEST_DECISIONS as readonly string[]).includes(input.decision)
    )
      throw new InvalidSourceOpError(
        'The decision must be approved or rejected.'
      );
    const row = await this.requests.findOneBy({ id: input.id });
    if (!row) return null;
    if ((row.status ?? 'pending') !== 'pending')
      throw new SourceRequestDecidedError('This request was already decided.');
    const decision = input.decision as SourceRequestDecision;
    const decidedAt = new Date();
    // Only a still-pending row is decided, so two operators cannot both win.
    const result = await this.requests.update(
      { id: row.id, status: 'pending' },
      { status: decision, decidedBy: actor, decidedAt, decisionReason: reason }
    );
    if (!result.affected)
      throw new SourceRequestDecidedError('This request was already decided.');
    return this.requestOf({
      ...row,
      status: decision,
      decidedBy: actor,
      decidedAt,
      decisionReason: reason,
    });
  }
}
