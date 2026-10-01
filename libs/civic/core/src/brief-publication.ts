import { readdir, readFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { In, type DataSource } from 'typeorm';
import type {
  Cadence,
  CoverageRange,
  LocalityConfig,
  Summarizer,
} from './types.js';
import {
  BriefingSchema,
  CanonicalStoryItemSchema,
  CanonicalStorySchema,
  CivicItemSchema,
  EditionItemSchema,
  EditionStorySchema,
  type BriefingRow,
  type CanonicalStoryItemRow,
  type CanonicalStoryRow,
  type CivicItemRow,
  type EditionStoryRow,
} from './schema.js';
import { brief, type BriefCoverageGap, type BriefResult } from './pipeline.js';
import { appendCanonicalStoryRevisions } from './store.js';
import {
  defaultPublicationLockPath,
  publishMarkdown,
  withPublicationLock,
} from './publication.js';
import {
  INITIAL_EMPTY_SYNTHESIS_CONTRACT_VERSION,
  QUIET_DAY_SYNTHESIS_CONTRACT_VERSION,
  STORY_SYNTHESIS_CONTRACT_VERSION,
  SYNTHESIS_CONTRACT_VERSION,
} from './synthesis-contract.js';
import type { FreshnessScope } from './freshness.js';

interface ArtifactSnapshot {
  path: string;
  contents: Buffer;
}
interface BriefDatabaseSnapshot {
  canonical: CanonicalStoryRow[];
  links: CanonicalStoryItemRow[];
  editionStories: EditionStoryRow[];
  civicItems: CivicItemRow[];
  briefing: BriefingRow | null;
  briefingKey: {
    localitySlug: string;
    cadence: Cadence;
    periodStart: string;
    periodEnd: string;
    ruleVersion: string;
  };
}

export interface BriefPublicationOptions {
  ds: DataSource;
  /** Alternative briefing implementation; defaults to this package's own. */
  brief?: typeof brief;
  locality: LocalityConfig;
  cadence: Cadence;
  periodStart: string;
  periodEnd: string;
  summarizer: Summarizer;
  since?: string;
  contextSince?: string;
  coverageRange?: { start: string; end: string } | CoverageRange;
  developLimit?: number;
  coverageGaps?: readonly BriefCoverageGap[];
  storyRoot?: string;
  briefingRoot: string;
  briefingFilename: string;
  /** Where the community service writes its snapshots, when a run is given one. */
  communityDirectory?: string;
  token: string;
  runId?: number;
  freshnessScope?: FreshnessScope;
  ancestry?: readonly string[];
  publisher?: typeof publishMarkdown;
  publicationLockPath?: string;
  /** Internal composition flag; callers should let publishBriefing acquire the lock. */
  publicationLockHeld?: boolean;
  /** Publish a deterministic quiet-day edition without invoking an LLM. */
  quietDay?: boolean;
  editionMode?: import('./types.js').EditionMode;
}

export interface BriefPublicationResult {
  result: BriefResult;
  markdownPath: string;
}

async function snapshotTree(
  root: string,
  localitySlug: string
): Promise<ArtifactSnapshot[]> {
  const directory = join(root, localitySlug);
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: ArtifactSnapshot[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const path = join(directory, entry.name);
      files.push({ path, contents: await readFile(path) });
    }
    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function restoreArtifactToken(
  token: string,
  path: string,
  index: number
): string {
  // Artifact filenames may be content-addressed and already close to the
  // filesystem component limit. Hash both the caller token and exact path so
  // each restore remains deterministic and collision-resistant without
  // embedding the filename in another path component.
  const digest = createHash('sha256')
    .update(token + '\0' + path)
    .digest('hex')
    .slice(0, 24);
  return 'restore-' + index + '-' + digest;
}

async function restoreArtifacts(
  root: string,
  localitySlug: string,
  previous: readonly ArtifactSnapshot[],
  keep: ArtifactSnapshot | null,
  publish: typeof publishMarkdown,
  token: string
): Promise<void> {
  const directory = join(root, localitySlug);
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const retained = new Set(previous.map((file) => file.path));
    if (keep) retained.add(keep.path);
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isFile() && !retained.has(path)) await unlink(path);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  let index = 0;
  for (const file of previous) {
    const relativeName = file.path.slice(directory.length + 1);
    await publish(
      root,
      localitySlug,
      relativeName,
      file.contents.toString('utf8'),
      restoreArtifactToken(token, file.path, index)
    );
    index += 1;
  }
  if (keep) {
    const relativeName = keep.path.slice(directory.length + 1);
    await publish(
      root,
      localitySlug,
      relativeName,
      keep.contents.toString('utf8'),
      restoreArtifactToken(token, keep.path, index)
    );
  }
}

async function captureDatabase(
  ds: DataSource,
  locality: LocalityConfig,
  cadence: Cadence,
  periodStart: string,
  periodEnd: string
): Promise<BriefDatabaseSnapshot> {
  const ruleVersion = locality.ruleVersion ?? 'unversioned';
  const editionItems = await ds
    .getRepository(EditionItemSchema)
    .find({
      where: { localitySlug: locality.slug, decision: 'include', ruleVersion },
    });
  const civicIds = editionItems.map((item) => item.civicItemId);
  const priorEditionStories = await ds
    .getRepository(EditionStorySchema)
    .find({ where: { localitySlug: locality.slug, ruleVersion } });
  const civicItems = civicIds.length
    ? await ds
        .getRepository(CivicItemSchema)
        .find({ where: { id: In(civicIds) } })
    : [];
  // The synthesis pass may create a brand-new row-identity canonical story
  // before the briefing publisher fails. Snapshot the complete canonical
  // graph so compensation can remove those orphans as well as restore the
  // existing locality projection.
  const canonical = await ds.getRepository(CanonicalStorySchema).find();
  const canonicalIds = canonical
    .map((row) => row.id as number)
    .filter(Number.isInteger);
  const links = canonicalIds.length
    ? await ds
        .getRepository(CanonicalStoryItemSchema)
        .find({ where: { canonicalStoryId: In(canonicalIds) } })
    : [];
  const briefingKey = {
    localitySlug: locality.slug,
    cadence,
    periodStart,
    periodEnd,
    ruleVersion,
  };
  const briefing = await ds
    .getRepository(BriefingSchema)
    .findOneBy(briefingKey);
  return {
    canonical,
    links,
    editionStories: priorEditionStories,
    civicItems,
    briefing,
    briefingKey,
  };
}

async function restoreDatabase(
  ds: DataSource,
  snapshot: BriefDatabaseSnapshot
): Promise<void> {
  const ids = [
    ...new Set(
      snapshot.canonical
        .map((row) => row.id)
        .filter((id): id is number => id !== undefined)
    ),
  ];
  const queryRunner = ds.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const canonicalRepo =
      queryRunner.manager.getRepository(CanonicalStorySchema);
    const linkRepo = queryRunner.manager.getRepository(
      CanonicalStoryItemSchema
    );
    const current = await canonicalRepo.find();
    const savedIds = new Set(ids);
    const orphanIds = current
      .map((row) => row.id as number)
      .filter((id) => Number.isInteger(id) && !savedIds.has(id));
    if (orphanIds.length) {
      await linkRepo.delete({ canonicalStoryId: In(orphanIds) });
      await canonicalRepo.delete(orphanIds);
    }
    if (ids.length) {
      await linkRepo.delete({ canonicalStoryId: In(ids) });
      await canonicalRepo.save(snapshot.canonical);
      if (snapshot.links.length) await linkRepo.save(snapshot.links);
    }
    if (snapshot.civicItems.length)
      await queryRunner.manager
        .getRepository(CivicItemSchema)
        .save(snapshot.civicItems);
    await queryRunner.manager
      .getRepository(EditionStorySchema)
      .delete({
        localitySlug: snapshot.briefingKey.localitySlug,
        ruleVersion: snapshot.briefingKey.ruleVersion,
      });
    if (snapshot.editionStories.length)
      await queryRunner.manager
        .getRepository(EditionStorySchema)
        .save(snapshot.editionStories);
    const briefingRepo = queryRunner.manager.getRepository(BriefingSchema);
    await briefingRepo.delete(snapshot.briefingKey);
    if (snapshot.briefing) await briefingRepo.save(snapshot.briefing);
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

export async function publishBriefing(
  options: BriefPublicationOptions
): Promise<BriefPublicationResult> {
  if (!options.publicationLockHeld) {
    return withPublicationLock(
      options.publicationLockPath ?? defaultPublicationLockPath(),
      () => publishBriefing({ ...options, publicationLockHeld: true })
    );
  }
  const storyRoot = options.storyRoot ?? join(process.cwd(), 'data', 'stories');
  const publish = options.publisher ?? publishMarkdown;
  const previousDatabase = await captureDatabase(
    options.ds,
    options.locality,
    options.cadence,
    options.periodStart,
    options.periodEnd
  );
  const previousStories = await snapshotTree(storyRoot, options.locality.slug);
  // Snapshot the whole locality briefing directory. A failed run may target
  // a new period/file; restoring only that path would otherwise delete an
  // older successful edition during compensation.
  const previousBriefings = await snapshotTree(
    options.briefingRoot,
    options.locality.slug
  );
  let result: BriefResult | undefined;
  try {
    // Story artifacts and mutable links are prepared inside `brief`, but
    // immutable revisions wait until this final briefing boundary succeeds.
    // That means a metadata or briefing-artifact failure cannot leave a new
    // revision pointing at content that was rolled back.
    result = await (options.brief ?? brief)(
      options.ds,
      options.locality,
      options.cadence,
      options.periodStart,
      options.periodEnd,
      options.summarizer,
      options.since,
      options.developLimit ?? 5,
      options.coverageGaps ?? [],
      storyRoot,
      options.publicationLockPath,
      true,
      options.contextSince,
      options.coverageRange,
      options.runId,
      options.ancestry,
      true,
      options.freshnessScope,
      options.quietDay,
      options.editionMode,
      options.communityDirectory
    );
    const briefingMetadata = {
      ...(options.contextSince ? { contextSince: options.contextSince } : {}),
      ...(options.coverageRange ||
      result.contextEvidenceFingerprint ||
      options.summarizer.strict
        ? {
            coverageRange: JSON.stringify({
              ...(options.coverageRange ?? {}),
              ...(options.summarizer.strict
                ? {
                    synthesisContractVersion:
                      options.editionMode === 'initial-empty'
                        ? INITIAL_EMPTY_SYNTHESIS_CONTRACT_VERSION
                        : options.quietDay || options.editionMode === 'quiet'
                        ? QUIET_DAY_SYNTHESIS_CONTRACT_VERSION
                        : SYNTHESIS_CONTRACT_VERSION,
                    ...(options.quietDay ||
                    options.editionMode === 'quiet' ||
                    options.editionMode === 'initial-empty'
                      ? {}
                      : {
                          storySynthesisContractVersion:
                            STORY_SYNTHESIS_CONTRACT_VERSION,
                        }),
                    ...(options.editionMode
                      ? { editionMode: options.editionMode }
                      : {}),
                  }
                : {}),
              ...(result.contextEvidenceFingerprint
                ? {
                    contextEvidenceFingerprint:
                      result.contextEvidenceFingerprint,
                  }
                : {}),
              ...(result.contextItemIds?.length
                ? { contextItemIds: result.contextItemIds }
                : {}),
            }),
          }
        : {}),
    };
    if (Object.keys(briefingMetadata).length)
      await options.ds
        .getRepository(BriefingSchema)
        .update(result.briefingId, briefingMetadata);
    if (options.runId !== undefined)
      await options.ds
        .getRepository(BriefingSchema)
        .update(result.briefingId, { runId: options.runId });
    const markdownPath = await publish(
      options.briefingRoot,
      options.locality.slug,
      options.briefingFilename,
      result.markdown,
      options.token
    );
    if (result.storyRevisions?.length)
      await appendCanonicalStoryRevisions(options.ds, result.storyRevisions);
    return { result, markdownPath };
  } catch (error) {
    const failures: unknown[] = [];
    try {
      await restoreDatabase(options.ds, previousDatabase);
    } catch (restoreError) {
      failures.push(restoreError);
    }
    try {
      await restoreArtifacts(
        storyRoot,
        options.locality.slug,
        previousStories,
        null,
        publishMarkdown,
        `${options.token}-stories`
      );
    } catch (restoreError) {
      failures.push(restoreError);
    }
    try {
      const briefingRootPath = options.briefingRoot;
      await restoreArtifacts(
        briefingRootPath,
        options.locality.slug,
        previousBriefings,
        null,
        publishMarkdown,
        `${options.token}-briefing`
      );
    } catch (restoreError) {
      failures.push(restoreError);
    }
    if (failures.length)
      throw new AggregateError(
        [error, ...failures],
        'brief publication failed and compensation failed'
      );
    throw error;
  }
}
