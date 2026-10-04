import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { basename, join } from 'node:path';
import {
  AgendaItemRow,
  AgendaItemSchema,
  BriefCoverageGap,
  BriefResult,
  BriefingSchema,
  Cadence,
  CivicItemSchema,
  CoverageRange,
  EditionMode,
  FreshnessScope,
  LlmCitation,
  LlmGenerationSchema,
  LocalityConfig,
  STORY_SYNTHESIS_CONTRACT_VERSION,
  SYNTHESIS_CONTRACT_VERSION,
  QUIET_DAY_SYNTHESIS_CONTRACT_VERSION,
  Summarizer,
  brief,
  buildClusterEvidenceItems,
  collate,
  composeEdition,
  contextEvidenceFingerprint,
  coverageRange,
  defaultPublicationLockPath,
  labelCoverageGaps,
  loadStoredSourceNames,
  preferredItemUrl,
  renderAnalysisClaim,
  renderCoverageNotes,
  snippetDisclosure,
  KIND_HEADINGS,
} from '@optimistic-tanuki/civic-core';
import { CollateService } from '../collate/collate.service';
import { StoryDevelopmentService } from '../stories/story-development.service';
import type { EditionMode, LlmCitation } from '@optimistic-tanuki/civic-core';

/**
 * Assembles and publishes a town's edition.
 *
 * Everything a reader sees is decided here: which evidence leads, which
 * stories are shown and in what order, what is said plainly when nothing
 * happened. Synthesis is delegated to an injected summarizer so a replay can
 * run the whole chain with no model at all, which is what makes the published
 * artifacts comparable between implementations.
 */
@Injectable()
export class BriefingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly collateService: CollateService,
    private readonly storyService: StoryDevelopmentService
  ) {}

  async brief(
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
    editionMode?: EditionMode,
    /** Where the community service writes its snapshots; without it a briefing carries no community material. */
    communityDirectory?: string
  ): Promise<BriefResult> {
    const projectionRuleVersion = locality.ruleVersion ?? null;
    const clusters = projectionRuleVersion
      ? await this.collateService.collate({
          localitySlug: locality.slug,
          ruleVersion: projectionRuleVersion,
          since: contextSince ?? since,
          publishedSince: periodStart,
          publishedEnd: periodEnd,
          timezone: locality.timezone,
          contextEnd:
            coverageRange && 'end' in coverageRange
              ? coverageRange.end
              : undefined,
        })
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
            this.dataSource,
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
    const itemRepo = this.dataSource.getRepository(CivicItemSchema);
    const sourceNames = await loadStoredSourceNames(this.dataSource);
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
      for (const row of await this.dataSource
        .getRepository(AgendaItemSchema)
        // In agenda order. SQLite returned rows by rowid; Postgres guarantees
        // no order without one, and the first line heads the section.
        .find({
          where: { itemId: In(agendaParents), procedural: false },
          order: { ordinal: 'ASC', id: 'ASC' },
        })) {
        const rows = agendaRowsByItemId.get(row.itemId) ?? [];
        rows.push(row);
        agendaRowsByItemId.set(row.itemId, rows);
      }
    }
    const sections: {
      heading: string;
      summary: string;
      rawSummary: string;
      citations?: LlmCitation[];
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
        const generation = await this.dataSource
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
      ds: this.dataSource,
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
        this.storyService.develop(
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
    const labeledGaps = await labelCoverageGaps(
      this.dataSource,
      coverageGaps,
      sourceNames
    );
    // Coverage gaps are operator diagnostics: one honest line for the reader,
    // the full list behind it. Dozens of near-identical withhold lines above
    // the reporting made the briefing read like a log file.
    const markdown = labeledGaps.length
      ? `${rendered}\n${renderCoverageNotes(labeledGaps)}`
      : rendered;

    const briefingRepo = this.dataSource.getRepository(BriefingSchema);
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
      itemIds: JSON.stringify(
        clusters.flatMap((c) => c.items.map((i) => i.id))
      ),
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
}
