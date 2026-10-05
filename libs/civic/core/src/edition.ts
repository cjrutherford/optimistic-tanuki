import { In } from 'typeorm';
import type { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { decideEdition, type GeographyEvidence } from './geography.js';
import { assignStories, evidenceUnitsFor } from './story-engine.js';
import type { LocalityRegistry } from './locality-registry.js';
import type {
  CivicItemRow,
  EditionItemRow,
  EditionStoryRow,
} from './schema.js';
import {
  CivicItemSchema,
  CanonicalStoryItemSchema,
  EditionItemSchema,
  EditionStorySchema,
} from './schema.js';

export interface EditionDiagnostic {
  civicItemId: number;
  decision: GeographyEvidence['decision'];
  evidence: GeographyEvidence;
}

export interface ProjectItemsResult {
  included: EditionItemRow[];
  diagnostics: EditionDiagnostic[];
}

export interface EditionProjectionOptions {
  /** Ongoing-story context carried by the runner; projection remains durable
   * and scoped, while collate applies the date filter for rendered output. */
  contextRange?: { start: string; end: string };
}

/** Resolve an item's known date in a locality's calendar without using UTC
 * date slicing. Undated intake is intentionally not treated as daily evidence. */
export function itemLocalDate(
  item: Pick<CivicItemRow, 'eventDate' | 'publishedAt'>,
  timezone: string
): string | null {
  const value = item.eventDate ?? item.publishedAt;
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const fields = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return `${fields['year']}-${fields['month']}-${fields['day']}`;
}

/**
 * Resolve the date on which an item may serve as editorial evidence.  Intake
 * `createdAt` is deliberately not considered: it records when our crawler
 * saw a row, not when the publisher made a civic claim.  Undated official
 * notices may still participate when the adapter supplied an explicit
 * observation timestamp.
 */
export function itemEvidenceLocalDate(
  item: Pick<CivicItemRow, 'eventDate' | 'publishedAt' | 'observedAt'>,
  timezone: string
): string | null {
  return (
    itemLocalDate(item, timezone) ??
    (item.observedAt
      ? itemLocalDate(
          { eventDate: null, publishedAt: item.observedAt },
          timezone
        )
      : null)
  );
}

/** Half-open range membership for editorial evidence, including explicit
 * observation provenance but never crawler insertion time. */
export function isItemInEvidenceRange(
  item: Pick<CivicItemRow, 'eventDate' | 'publishedAt' | 'observedAt'>,
  start: string,
  end: string,
  timezone: string
): boolean {
  const day = itemEvidenceLocalDate(item, timezone);
  return day !== null && day >= start && day < end;
}

/**
 * Agendas are published before the meeting they announce, so a meeting record
 * dated after the edition is upcoming business, not stale or out-of-window
 * evidence. Other kinds report what already happened and keep the half-open
 * window exactly.
 */
export const UPCOMING_MEETING_DAYS = 30;

/** End of the context window for an item of this kind. */
export function contextWindowEnd(end: string, kind?: string | null): string {
  if (kind !== 'meeting') return end;
  const value = new Date(`${end}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + UPCOMING_MEETING_DAYS);
  return value.toISOString().slice(0, 10);
}

/** Context-window membership for a local date already resolved for an item. */
export function isDayInContextWindow(
  day: string | null,
  range: { start: string; end: string },
  kind?: string | null
): boolean {
  return (
    day !== null &&
    day >= range.start &&
    day < contextWindowEnd(range.end, kind)
  );
}

/**
 * Drops evidence published on or after `day` (a local date), and clusters
 * left empty (D31). A backfilled edition is written later from stored
 * records; this keeps it to what had been published by its own day. An item
 * without a publication date is kept: nothing says it came later.
 */
export function knownBefore<
  C extends { items: Pick<CivicItemRow, 'publishedAt'>[] }
>(clusters: readonly C[], day: string, timezone: string): C[] {
  return clusters
    .map((cluster) => ({
      ...cluster,
      items: cluster.items.filter((item) => {
        const published = itemLocalDate(
          { eventDate: null, publishedAt: item.publishedAt },
          timezone
        );
        return published === null || published < day;
      }),
    }))
    .filter((cluster) => cluster.items.length > 0);
}

/** Half-open local-calendar membership used by both edition and briefing views. */
export function isItemInLocalRange(
  item: Pick<CivicItemRow, 'eventDate' | 'publishedAt'>,
  start: string,
  end: string,
  timezone: string
): boolean {
  const day = itemLocalDate(item, timezone);
  return day !== null && day >= start && day < end;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Classify the items from an edition's sources and persist only include projections. */
export async function projectItems(
  dataSource: DataSource,
  targetSlug: string,
  registry: LocalityRegistry,
  attempt = 0,
  _options?: EditionProjectionOptions
): Promise<ProjectItemsResult> {
  const target = registry.get(targetSlug);
  const ruleVersion = registry.ruleVersion(targetSlug);
  const sourceKeys = registry
    .sourcesForRun(targetSlug)
    .map((source) => source.sourceKey);
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const itemRepo = queryRunner.manager.getRepository(CivicItemSchema);
    const editionRepo = queryRunner.manager.getRepository(EditionItemSchema);
    const included: EditionItemRow[] = [];
    const diagnostics: EditionDiagnostic[] = [];
    const items = sourceKeys.length
      ? await itemRepo.find({
          where: { sourceId: In(sourceKeys) },
          order: { id: 'ASC' },
        })
      : [];
    for (const item of items) {
      if (_options?.contextRange) {
        const day = itemLocalDate(item, target.timezone);
        if (
          day &&
          !isDayInContextWindow(day, _options.contextRange, item.kind)
        ) {
          await editionRepo.delete({
            localitySlug: targetSlug,
            civicItemId: item.id as number,
            ruleVersion,
          });
          continue;
        }
      }
      const scopeSlug = item.scopeSlug ?? null;
      if (!scopeSlug) {
        const evidence: GeographyEvidence = {
          decision: 'withhold',
          confidence: 'low',
          matchedSlugs: [],
          reason: 'canonical scope is unresolved',
        };
        diagnostics.push({
          civicItemId: item.id as number,
          decision: 'withhold',
          evidence,
        });
        await editionRepo.delete({
          localitySlug: targetSlug,
          civicItemId: item.id as number,
          ruleVersion,
        });
        continue;
      }
      // A restricted aggregate result without an explicitly supplied direct
      // publisher URL remains durable diagnostic intake, but cannot become
      // an edition-facing story/evidence citation. Do not create a canonical
      // story for this unresolved link.
      if (
        item.accessMode === 'snippet-only' &&
        item.unresolvedAggregateLink === true
      ) {
        const evidence: GeographyEvidence = {
          decision: 'withhold',
          confidence: 'low',
          matchedSlugs: [scopeSlug],
          reason: 'restricted aggregate article link is unresolved',
        };
        diagnostics.push({
          civicItemId: item.id as number,
          decision: 'withhold',
          evidence,
        });
        await editionRepo.delete({
          localitySlug: targetSlug,
          civicItemId: item.id as number,
          ruleVersion,
        });
        continue;
      }
      const evidence = decideEdition(
        {
          sourceId: item.sourceId,
          kind: item.kind as never,
          title: item.title,
          body: item.body,
          topics: parseJson<string[]>(item.topics, []),
          jurisdictionSlug: item.jurisdictionSlug ?? null,
        },
        targetSlug,
        registry
      );
      if (evidence.decision !== 'include') {
        diagnostics.push({
          civicItemId: item.id as number,
          decision: evidence.decision,
          evidence,
        });
        await editionRepo.delete({
          localitySlug: targetSlug,
          civicItemId: item.id as number,
          ruleVersion,
        });
        continue;
      }
      const row: EditionItemRow = {
        localitySlug: targetSlug,
        civicItemId: item.id as number,
        decision: 'include',
        reason: evidence.reason,
        ruleVersion,
        createdAt: new Date().toISOString(),
      };
      await editionRepo.upsert(row, [
        'localitySlug',
        'civicItemId',
        'ruleVersion',
      ]);
      included.push(
        (await editionRepo.findOneBy({
          localitySlug: targetSlug,
          civicItemId: item.id as number,
          ruleVersion,
        })) as EditionItemRow
      );
    }
    // Link included evidence to stories: matched to an open story, or opening one.
    const evidenceDate = (item: {
      eventDate?: string | null;
      publishedAt?: string | null;
      observedAt?: string | null;
    }) =>
      itemEvidenceLocalDate(
        {
          eventDate: item.eventDate ?? null,
          publishedAt: item.publishedAt ?? null,
          observedAt: item.observedAt ?? null,
        },
        target.timezone
      );
    const units = await evidenceUnitsFor(
      queryRunner.manager,
      included.map((row) => row.civicItemId),
      evidenceDate
    );
    await assignStories(queryRunner.manager, units, registry, evidenceDate);
    await queryRunner.commitTransaction();
    return { included, diagnostics };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    if (
      attempt < 5 &&
      /SQLITE_BUSY|database is locked|SQLITE_LOCKED/i.test(
        error instanceof Error ? error.message : String(error)
      )
    ) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 10));
      return projectItems(
        dataSource,
        targetSlug,
        registry,
        attempt + 1,
        _options
      );
    }
    throw error;
  } finally {
    await queryRunner.release();
  }
}

/** Project canonical stories referenced by the current include-only edition items. */
export async function projectStories(
  dataSource: DataSource,
  targetSlug: string,
  ruleVersion: string,
  attempt = 0
): Promise<EditionStoryRow[]> {
  // Item and story projections are immutable per rule version.  A version
  // with no include rows must not inherit an older version's output.
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const editionItems = await queryRunner.manager
      .getRepository(EditionItemSchema)
      .find({
        where: { localitySlug: targetSlug, decision: 'include', ruleVersion },
      });
    if (!editionItems.length) {
      await queryRunner.commitTransaction();
      return [];
    }
    const links = await queryRunner.manager
      .getRepository(CanonicalStoryItemSchema)
      .find({
        where: {
          civicItemId: In(editionItems.map((item) => item.civicItemId)),
        },
      });
    const storyIds = [...new Set(links.map((link) => link.canonicalStoryId))];
    const storyRepo = queryRunner.manager.getRepository(EditionStorySchema);
    const now = new Date().toISOString();
    for (const canonicalStoryId of storyIds)
      await storyRepo.upsert(
        {
          localitySlug: targetSlug,
          canonicalStoryId,
          ruleVersion,
          createdAt: now,
        },
        ['localitySlug', 'canonicalStoryId', 'ruleVersion']
      );
    const rows = await storyRepo.find({
      where: { localitySlug: targetSlug, ruleVersion },
      order: { canonicalStoryId: 'ASC' },
    });
    await queryRunner.commitTransaction();
    return rows;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    if (
      attempt < 5 &&
      /SQLITE_BUSY|database is locked|SQLITE_LOCKED|unique constraint/i.test(
        error instanceof Error ? error.message : String(error)
      )
    ) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 10));
      return projectStories(dataSource, targetSlug, ruleVersion, attempt + 1);
    }
    throw error;
  } finally {
    await queryRunner.release();
  }
}
