import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { basename, join } from 'node:path';
import {
  CanonicalStoryItemSchema,
  CanonicalStoryRevisionInput,
  CanonicalStoryRevisionRow,
  CanonicalStoryRevisionSchema,
  CanonicalStoryRow,
  CanonicalStorySchema,
  CivicItemSchema,
  DevelopResult,
  EditionItemSchema,
  EditionStorySchema,
  LlmCitation,
  LlmGenerationSchema,
  LlmStoryAnalysis,
  LocalityConfig,
  PreparedMarkdown,
  ProjectedStoryItem,
  ProjectedStoryView,
  StoryRevisionCitationSchema,
  Summarizer,
  ThreadRow,
  appendCanonicalStoryRevisions,
  assembleStory,
  assertDistinctStoryNarratives,
  brief,
  buildAgendaEvidenceEvents,
  canonicalUrl,
  defaultPublicationLockPath,
  deriveNarrativeFromClaims,
  developStories,
  extractOutcome,
  isAgendaOnlyEvidence,
  isCurrentStoryArtifactToken,
  isStoryWorthy,
  itemEvidenceLocalDate,
  loadProjectedStories,
  loadStoredSourceKeys,
  loadStoredSourceNames,
  localDate,
  parseUris,
  prepareImmutableMarkdown,
  prepareMarkdown,
  projectItems,
  projectStories,
  selectStoryTimelineEvents,
  sha256,
  snippetDisclosure,
  storyArtifactToken,
  storyFilename,
  storyImportance,
  storyTitle,
  topicKey,
  withPublicationLock,
  KIND_HEADINGS,
  storyTitle as evidenceTitle,
} from '@optimistic-tanuki/civic-core';
import type {
  CanonicalStoryRevisionRow,
  LlmCitation,
  LlmStoryAnalysis,
} from '@optimistic-tanuki/civic-core';

/**
 * Writes the ongoing stories an edition links to.
 *
 * A story is only ever written from evidence the projection already accepted,
 * and each revision is immutable: its input hash is part of its filename, so
 * a changed revision cannot overwrite the bytes an earlier edition cited.
 * Publication takes a lock, because two runs writing the same story path
 * would otherwise interleave.
 */
@Injectable()
export class StoryDevelopmentService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async develop(
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
        this.develop(
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
    const sourceKeys = await loadStoredSourceKeys(this.dataSource);
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
    await projectStories(this.dataSource, locality.slug, projectionRuleVersion);
    const candidateViews = (
      await loadProjectedStories(
        this.dataSource,
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
    const sourceNames = await loadStoredSourceNames(this.dataSource);
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
      ? await this.dataSource
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
      analysis?: LlmStoryAnalysis;
      generationId?: number;
      existingRevision?: CanonicalStoryRevisionRow;
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
      const engineStory = await this.dataSource
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
        ).map((citation: LlmCitation) => {
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
        updatedAt:
          contextRange?.end ?? localDate(new Date(), locality.timezone),
      });
      const editionRules = new Set<string>();
      for (const item of thread.items) {
        if (item.itemId === undefined) continue;
        const projections = await this.dataSource
          .getRepository(EditionItemSchema)
          .find({
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
      let existingRevision: CanonicalStoryRevisionRow | undefined;
      if (analysis && runId !== undefined) {
        const generation = await this.dataSource
          .getRepository(LlmGenerationSchema)
          .findOne({
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
          (await this.dataSource
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
          const priorCitations = await this.dataSource
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
    const canonicalRepoBefore =
      this.dataSource.getRepository(CanonicalStorySchema);
    const linkRepoBefore = this.dataSource.getRepository(
      CanonicalStoryItemSchema
    );
    const editionStoryRepoBefore =
      this.dataSource.getRepository(EditionStorySchema);
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
      const queryRunner = this.dataSource.createQueryRunner();
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
        await appendCanonicalStoryRevisions(this.dataSource, revisionInputs);
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
      const compensationRunner = this.dataSource.createQueryRunner();
      await compensationRunner.connect();
      try {
        await compensationRunner.startTransaction();
        const manager = compensationRunner.manager;
        if (canonicalIds.length) {
          await manager
            .getRepository(CanonicalStoryItemSchema)
            .delete({ canonicalStoryId: In(canonicalIds) });
          await manager.getRepository(EditionStorySchema).delete({
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
}
