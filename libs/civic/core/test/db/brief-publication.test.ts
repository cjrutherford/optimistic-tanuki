import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadLocalityRegistry } from '../../src/locality-registry.js';
import { createTestSchema, withTestDataSource } from './helpers/postgres.js';
import { publishBriefing } from '../../src/brief-publication.js';
import { projectItems } from '../../src/edition.js';
import { ensureLocality } from '../../src/pipeline.js';
import {
  AgendaItemSchema,
  BriefingSchema,
  CanonicalStoryItemSchema,
  CanonicalStorySchema,
  CivicItemSchema,
  EditionItemSchema,
  EditionStorySchema,
  LlmGenerationSchema,
  PipelineRunSchema,
} from '../../src/schema.js';
import {
  createFoundationDataSource,
  createLlmAttemptRecorder,
} from '../../src/store.js';
import { publishMarkdown } from '../../src/publication.js';

async function captureRejection(
  p: Promise<unknown> | (() => Promise<unknown>)
): Promise<unknown> {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}
const registry = loadLocalityRegistry(
  join(__dirname, '..', 'fixtures', 'localities')
);
const ADEL_RULES = registry.ruleVersion('adel-ga');

test('brief publication failure restores story and briefing database rows and both artifact trees', async () => {
  await withTestDataSource(async (ds) => {
    const body = `A substantive bridge project update for Adel residents. ${'Public works details and a documented timeline. '.repeat(
      8
    )}`;
    const raw = await ds.getRepository(CivicItemSchema).save({
      sourceId: 'adel-documents',
      localitySlug: 'adel-ga',
      scopeSlug: 'adel-ga',
      scopeKind: 'town',
      kind: 'meeting',
      title: 'Recoverable brief story',
      body,
      summary: null,
      publishedAt: '2026-09-12T10:00:00.000Z',
      eventDate: null,
      topics: JSON.stringify(['roads']),
      uris: JSON.stringify(['https://example.test/story']),
      hash: 'recoverable-brief',
      createdAt: '2026-09-12T10:00:00.000Z',
      geographyDecision: null,
      geographyEvidence: null,
      ruleVersion: null,
      originalSnippet: null,
      publisher: null,
      canonicalUrl: null,
      articleProvenance: null,
      contentChecksum: null,
    });
    await ds.getRepository(AgendaItemSchema).save([
      {
        itemId: raw.id as number,
        localitySlug: 'adel-ga',
        meetingDate: '2026-09-01',
        section: 'Projects',
        ordinal: 1,
        heading: 'Recoverable brief story',
        body,
        topicKey: 'topic:recoverable-brief',
        procedural: false,
        createdAt: '2026-09-01T10:00:00.000Z',
      },
      {
        itemId: raw.id as number,
        localitySlug: 'adel-ga',
        meetingDate: '2026-09-15',
        section: 'Projects',
        ordinal: 2,
        heading: 'Recoverable brief story',
        body,
        topicKey: 'topic:recoverable-brief',
        procedural: false,
        createdAt: '2026-09-15T10:00:00.000Z',
      },
    ]);
    await projectItems(ds, 'adel-ga', registry);
    const locality = { ...registry.get('adel-ga'), ruleVersion: ADEL_RULES };
    const run = await ds.getRepository(PipelineRunSchema).save({
      scopeSlug: 'adel-ga',
      localitySlug: 'adel-ga',
      cadence: 'daily',
      startedAt: '2026-09-13T00:00:00Z',
      status: 'running',
      ruleVersion: ADEL_RULES,
      counts: '{}',
      coverageGaps: '[]',
      coverageRanges: '{}',
    });
    await createLlmAttemptRecorder(ds, {
      runId: run.id!,
      localitySlug: 'adel-ga',
    }).record({
      operation: 'brief',
      model: 'test-model',
      status: 'failed',
      attempt: 1,
      promptSha256: 'a'.repeat(64),
      inputSha256: 'b'.repeat(64),
      sourceKeys: ['adel-documents'],
      error: 'publisher input rejected',
      generatedAt: '2026-09-13T00:00:01Z',
      latencyMs: 12,
    });
    const directory = mkdtempSync(join(tmpdir(), 'brief-recovery-'));
    const storyRoot = join(directory, 'stories');
    const briefingRoot = join(directory, 'briefings');
    const makeSummarizer = (title: string, status: string) => ({
      model: 'test',
      summarizeCluster: async () => ({
        summary: 'cluster summary',
        model: 'test',
      }),
      tldr: async () => ({ bullets: ['brief bullet'], model: 'test' }),
      summarizeThread: async () => ({
        summary: 'thread summary',
        model: 'test',
      }),
      developStory: async () => ({
        title,
        narrative: `${title} narrative`,
        status,
        model: 'test',
      }),
    });
    const base = {
      ds,
      locality,
      cadence: 'daily' as const,
      periodStart: '2026-09-13',
      periodEnd: '2026-09-13',
      storyRoot,
      briefingRoot,
      briefingFilename: '2026-09-13-daily.md',
      token: 'brief-recovery',
    };
    try {
      await publishBriefing({
        ...base,
        summarizer: makeSummarizer('Original story', 'open'),
      });
      const storyFile = readdirSync(join(storyRoot, 'adel-ga'))[0]!;
      const storyPath = join(storyRoot, 'adel-ga', storyFile);
      const briefingPath = join(briefingRoot, 'adel-ga', '2026-09-13-daily.md');
      const before = {
        story: readFileSync(storyPath, 'utf8'),
        briefing: readFileSync(briefingPath, 'utf8'),
        civicItems: await ds.getRepository(CivicItemSchema).find(),
        canonical: await ds.getRepository(CanonicalStorySchema).find(),
        links: await ds.getRepository(CanonicalStoryItemSchema).find(),
        editionStories: await ds.getRepository(EditionStorySchema).find(),
        briefings: await ds.getRepository(BriefingSchema).find(),
        generations: await ds.getRepository(LlmGenerationSchema).find(),
      };
      // Existing immutable story artifacts can already have long
      // content-addressed names. Compensation must restore them without
      // appending the filename to its temporary token.
      const longArtifactPaths = [
        'legacy-story-',
        'legacy-story-copy-',
        'legacy-story-third-',
      ].map((prefix, index) => {
        const path = join(
          storyRoot,
          'adel-ga',
          prefix + 'x'.repeat(14 * 12) + '.md'
        );
        writeFileSync(path, `legacy story artifact ${index}`);
        return path;
      });
      const forcedPublicationError = new Error(
        'forced briefing publication failure'
      );
      await expect(
        ((error) => error === forcedPublicationError)(
          await captureRejection(() =>
            publishBriefing({
              ...base,
              summarizer: makeSummarizer('Mutated story', 'closed'),
              publisher: async () => {
                throw forcedPublicationError;
              },
            })
          )
        )
      ).toBe(true);
      for (const [index, path] of longArtifactPaths.entries())
        expect(readFileSync(path, 'utf8')).toBe(
          `legacy story artifact ${index}`
        );
      expect(readFileSync(storyPath, 'utf8')).toBe(before.story);
      expect(readFileSync(briefingPath, 'utf8')).toBe(before.briefing);
      expect(await ds.getRepository(CivicItemSchema).find()).toStrictEqual(
        before.civicItems
      );
      expect(await ds.getRepository(CanonicalStorySchema).find()).toStrictEqual(
        before.canonical
      );
      expect(
        await ds.getRepository(CanonicalStoryItemSchema).find()
      ).toStrictEqual(before.links);
      expect(await ds.getRepository(EditionStorySchema).find()).toStrictEqual(
        before.editionStories
      );
      expect(await ds.getRepository(BriefingSchema).find()).toStrictEqual(
        before.briefings
      );
      expect(await ds.getRepository(LlmGenerationSchema).find()).toStrictEqual(
        before.generations
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

test('serializes concurrent town brief publications across DataSources and releases after compensation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'brief-lock-'));
  const database = (await createTestSchema()).url;
  const lockPath = join(directory, 'publication.lock');
  const registry = loadLocalityRegistry(
    join(__dirname, '..', 'fixtures', 'locality-graph')
  );
  const seed = await createFoundationDataSource(database);
  try {
    await ensureLocality(seed, registry.get('town-a'), registry);
    await ensureLocality(seed, registry.get('town-b'), registry);
    const body = `A shared county bridge project update. ${'Public works details and a documented timeline. '.repeat(
      8
    )}`;
    const raw = await seed.getRepository(CivicItemSchema).save({
      sourceId: 'county-news',
      localitySlug: 'town-a',
      scopeSlug: 'county-a',
      scopeKind: 'county',
      kind: 'news',
      title: 'Shared county story project',
      body,
      summary: null,
      publishedAt: '2026-09-12T10:00:00.000Z',
      eventDate: null,
      topics: JSON.stringify(['roads']),
      uris: JSON.stringify(['https://example.test/shared']),
      hash: 'shared-lock-story',
      createdAt: '2026-09-12T10:00:00.000Z',
      geographyDecision: null,
      geographyEvidence: null,
      ruleVersion: null,
      originalSnippet: null,
      publisher: null,
      canonicalUrl: null,
      articleProvenance: null,
      contentChecksum: null,
    });
    const rawB = await seed.getRepository(CivicItemSchema).save({
      sourceId: 'county-news',
      localitySlug: 'town-b',
      scopeSlug: 'county-a',
      scopeKind: 'county',
      kind: 'news',
      title: 'Shared county story project',
      body,
      summary: null,
      publishedAt: '2026-09-12T10:00:00.000Z',
      eventDate: null,
      topics: JSON.stringify(['roads']),
      uris: JSON.stringify(['https://example.test/shared']),
      hash: 'shared-lock-story-b',
      createdAt: '2026-09-12T10:00:00.000Z',
      geographyDecision: null,
      geographyEvidence: null,
      ruleVersion: null,
      originalSnippet: null,
      publisher: null,
      canonicalUrl: null,
      articleProvenance: null,
      contentChecksum: null,
    });
    const rows = await seed.getRepository(AgendaItemSchema).save([
      {
        itemId: raw.id as number,
        localitySlug: 'town-a',
        meetingDate: '2026-09-01',
        section: 'Projects',
        ordinal: 1,
        heading: 'Shared county story project',
        body,
        topicKey: 'topic:shared-lock',
        procedural: false,
        createdAt: '2026-09-01T10:00:00.000Z',
      },
      {
        itemId: raw.id as number,
        localitySlug: 'town-a',
        meetingDate: '2026-09-15',
        section: 'Projects',
        ordinal: 2,
        heading: 'Shared county story project',
        body,
        topicKey: 'topic:shared-lock',
        procedural: false,
        createdAt: '2026-09-15T10:00:00.000Z',
      },
      {
        itemId: rawB.id as number,
        localitySlug: 'town-b',
        meetingDate: '2026-09-01',
        section: 'Projects',
        ordinal: 3,
        heading: 'Shared county story project',
        body,
        topicKey: 'topic:shared-lock',
        procedural: false,
        createdAt: '2026-09-01T10:00:00.000Z',
      },
      {
        itemId: rawB.id as number,
        localitySlug: 'town-b',
        meetingDate: '2026-09-15',
        section: 'Projects',
        ordinal: 4,
        heading: 'Shared county story project',
        body,
        topicKey: 'topic:shared-lock',
        procedural: false,
        createdAt: '2026-09-15T10:00:00.000Z',
      },
    ]);
    const canonical = await seed.getRepository(CanonicalStorySchema).save({
      scopeSlug: 'county-a',
      scopeKind: 'county',
      storyKey: 'shared-lock-story',
      strategy: 'fallback',
      title: 'Prior title',
      status: 'open',
      createdAt: '2026-09-12T00:00:00.000Z',
      updatedAt: '2026-09-12T00:00:00.000Z',
    });
    // The story engine links each agenda row, so each town sees the story on two meeting dates.
    await seed.getRepository(CanonicalStoryItemSchema).save(
      rows.map((row) => ({
        canonicalStoryId: canonical.id as number,
        civicItemId: row.itemId,
        agendaItemId: row.id as number,
        evidenceDate: row.meetingDate,
        createdAt: '2026-09-12T00:00:00.000Z',
      }))
    );
    await seed.getRepository(EditionItemSchema).save([
      {
        localitySlug: 'town-a',
        civicItemId: raw.id as number,
        decision: 'include',
        reason: 'countywide',
        ruleVersion: 'county-a.v1',
        createdAt: '2026-09-12T00:00:00.000Z',
      },
      {
        localitySlug: 'town-b',
        civicItemId: rawB.id as number,
        decision: 'include',
        reason: 'countywide',
        ruleVersion: 'county-a.v1',
        createdAt: '2026-09-12T00:00:00.000Z',
      },
    ]);
    await seed.getRepository(EditionStorySchema).save([
      {
        localitySlug: 'town-a',
        canonicalStoryId: canonical.id as number,
        ruleVersion: 'county-a.v1',
        createdAt: '2026-09-12T00:00:00.000Z',
      },
      {
        localitySlug: 'town-b',
        canonicalStoryId: canonical.id as number,
        ruleVersion: 'county-a.v1',
        createdAt: '2026-09-12T00:00:00.000Z',
      },
    ]);
  } finally {
    await seed.destroy();
  }
  const first = await createFoundationDataSource(database);
  const second = await createFoundationDataSource(database);
  let releaseFirst!: () => void;
  const firstHeld = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let firstPublishing = false;
  let secondEntered = false;
  const makeSummarizer = (title: string, onDevelop?: () => void) => ({
    model: 'test',
    summarizeCluster: async () => {
      onDevelop?.();
      return { summary: 'summary', model: 'test' };
    },
    tldr: async () => {
      onDevelop?.();
      return { bullets: [], model: 'test' };
    },
    summarizeThread: async () => {
      onDevelop?.();
      return { summary: 'thread', model: 'test' };
    },
    developStory: async () => {
      onDevelop?.();
      return {
        title,
        narrative: `${title} narrative`,
        status: 'open',
        model: 'test',
      };
    },
  });
  const common = {
    cadence: 'daily' as const,
    periodStart: '2026-09-13',
    periodEnd: '2026-09-13',
    storyRoot: join(directory, 'stories'),
    briefingRoot: join(directory, 'briefings'),
    briefingFilename: 'brief.md',
    token: 'lock-test',
    publicationLockPath: lockPath,
  };
  try {
    const firstRun = publishBriefing({
      ...common,
      ds: first,
      locality: { ...registry.get('town-a'), ruleVersion: 'county-a.v1' },
      summarizer: makeSummarizer('A title'),
      publisher: async () => {
        firstPublishing = true;
        await firstHeld;
        throw new Error('forced A publication failure');
      },
    });
    while (!firstPublishing)
      await new Promise((resolve) => setTimeout(resolve, 5));
    const secondRun = publishBriefing({
      ...common,
      ds: second,
      locality: { ...registry.get('town-b'), ruleVersion: 'county-a.v1' },
      summarizer: makeSummarizer('B title'),
      briefingFilename: 'town-b.md',
      publisher: async (root, slug, filename, markdown, token) => {
        secondEntered = true;
        return publishMarkdown(root, slug, filename, markdown, token);
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(secondEntered).toBe(false);
    releaseFirst();
    await expect(firstRun).rejects.toThrow(/forced A publication failure/);
    try {
      await secondRun;
    } catch (error) {
      console.error('second run failed', error);
      throw error;
    }
    expect(secondEntered).toBe(true);
    const canonical = await second.getRepository(CanonicalStorySchema).find();
    expect(canonical.find((row) => row.id === 1)?.title).toBe('B title');
    expect(
      await second.getRepository(EditionStorySchema).count({
        where: { localitySlug: 'town-b', ruleVersion: 'county-a.v1' },
      })
    ).toBe(1);
  } finally {
    if (first.isInitialized) await first.destroy();
    if (second.isInitialized) await second.destroy();
    rmSync(directory, { recursive: true, force: true });
  }
});
