import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import {
  assignStories,
  CivicItemSchema,
  decideEdition,
  EditionItemSchema,
  evidenceUnitsFor,
  isDayInContextWindow,
  itemEvidenceLocalDate,
  itemLocalDate,
  type EditionDiagnostic,
  type EditionItemRow,
  type GeographyEvidence,
  type LocalityRegistry,
} from '@optimistic-tanuki/civic-core';

/**
 * Decides what belongs in a town's edition, and links what does to a story.
 *
 * One rule decides inclusion for every town, and its version is recorded on
 * each projection: changing the rule produces a new version rather than
 * quietly rewriting what earlier editions claimed. A withheld item is
 * deleted from the projection rather than marked, so an edition can never
 * cite something the current rule excludes.
 *
 * The whole projection runs in one transaction, because a half-linked story
 * is worse than none: evidence would appear in an edition without the story
 * that explains it.
 */

export interface ProjectionRequest {
  targetSlug: string;
  registry: LocalityRegistry;
  contextRange?: { start: string; end: string };
}

export interface ProjectionResult {
  included: EditionItemRow[];
  diagnostics: EditionDiagnostic[];
}

/** SQLite serialises writers; a busy database is a wait, not a failure. */
const BUSY = /SQLITE_BUSY|database is locked|SQLITE_LOCKED/iu;
const MAX_ATTEMPTS = 5;

@Injectable()
export class ProjectionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async project(
    request: ProjectionRequest,
    attempt = 0
  ): Promise<ProjectionResult> {
    const { targetSlug, registry } = request;
    const target = registry.get(targetSlug);
    const ruleVersion = registry.ruleVersion(targetSlug);
    const sourceKeys = registry
      .sourcesForRun(targetSlug)
      .map((source) => source.sourceKey);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const items = queryRunner.manager.getRepository(CivicItemSchema);
      const editionItems = queryRunner.manager.getRepository(EditionItemSchema);
      const included: EditionItemRow[] = [];
      const diagnostics: EditionDiagnostic[] = [];
      const candidates = sourceKeys.length
        ? await items.find({
            where: { sourceId: In(sourceKeys) },
            order: { id: 'ASC' },
          })
        : [];

      for (const item of candidates) {
        const withhold = async (
          reason: string,
          matchedSlugs: string[]
        ): Promise<void> => {
          const evidence: GeographyEvidence = {
            decision: 'withhold',
            confidence: 'low',
            matchedSlugs,
            reason,
          };
          diagnostics.push({
            civicItemId: item.id as number,
            decision: 'withhold',
            evidence,
          });
          await editionItems.delete({
            localitySlug: targetSlug,
            civicItemId: item.id as number,
            ruleVersion,
          });
        };

        if (request.contextRange) {
          const day = itemLocalDate(item, target.timezone);
          if (
            day &&
            !isDayInContextWindow(day, request.contextRange, item.kind)
          ) {
            await editionItems.delete({
              localitySlug: targetSlug,
              civicItemId: item.id as number,
              ruleVersion,
            });
            continue;
          }
        }
        const scopeSlug = item.scopeSlug ?? null;
        if (!scopeSlug) {
          await withhold('canonical scope is unresolved', []);
          continue;
        }
        // A restricted aggregate result with no direct publisher URL stays
        // intake evidence: it is real, but it cannot be cited, so it must not
        // open a story either.
        if (
          item.accessMode === 'snippet-only' &&
          item.unresolvedAggregateLink === true
        ) {
          await withhold('restricted aggregate article link is unresolved', [
            scopeSlug,
          ]);
          continue;
        }

        const evidence = decideEdition(
          {
            sourceId: item.sourceId,
            kind: item.kind as never,
            title: item.title,
            body: item.body,
            topics: parseTopics(item.topics),
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
          await editionItems.delete({
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
        await editionItems.upsert(row, [
          'localitySlug',
          'civicItemId',
          'ruleVersion',
        ]);
        included.push(
          (await editionItems.findOneBy({
            localitySlug: targetSlug,
            civicItemId: item.id as number,
            ruleVersion,
          })) as EditionItemRow
        );
      }

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
        attempt < MAX_ATTEMPTS &&
        BUSY.test(error instanceof Error ? error.message : String(error))
      ) {
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 10));
        return this.project(request, attempt + 1);
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

function parseTopics(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  try {
    return JSON.parse(value as string) as string[];
  } catch {
    return [];
  }
}
