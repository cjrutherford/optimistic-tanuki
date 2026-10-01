import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import YAML from 'yaml';
import { createFoundationDataSource } from '../../src/store.js';
import { registerAdapter } from '../../src/registry.js';
import { runPipeline } from '../../src/runner.js';
import { validateLocalityConfig } from '../../src/config.js';
import type {
  DraftItem,
  FetchResult,
  HttpClient,
  HttpResponse,
  SourceAdapter,
  SourceConfig,
  Summarizer,
} from '../../src/types.js';
import {
  createLocalityRegistry,
  type LocalityRegistry,
  type ResolvedSource,
} from '../../src/locality-registry.js';
import {
  FoundationSourceSchema,
  RawDocumentVersionSchema,
  RawDocumentSchema,
  CivicItemSchema,
  FoundationQuarantineSchema,
  CanonicalStorySchema,
  CanonicalStoryItemSchema,
  EditionItemSchema,
  EditionStorySchema,
  BriefingSchema,
  PipelineRunSchema,
  PipelineRunLeaseSchema,
} from '../../src/schema.js';
import { createLocalBlobStore } from '../../src/blob-store.js';
import { articleHtml } from '../helpers/article-html.js';

import { createTestSchema } from './helpers/postgres.js';
const fixtureDir = join(__dirname, '..', 'fixtures', 'multi-locality');
/** Distinct article leads per fixture URL: story matching compares titles and leads. */
const ARTICLE_LEADS: Record<string, string> = {
  road: 'Commissioners adopted the spending plan after residents spoke at the hearing.',
  'road-grant':
    'Transportation officials announced the paving award for the east corridor.',
  'road-resurfacing':
    'Crews started milling Main Street and posted detour signs downtown.',
  park: 'The riverside footbridge and playground repairs are complete.',
};
const descriptorPath = join(__dirname, '..', 'fixtures', 'multi-locality.yaml');

function response(url: string, status: number, body: string): HttpResponse {
  return Object.assign(
    new Response(body, { status, headers: { 'content-type': 'text/html' } }),
    {
      finalUrl: url,
      redirectChain: [] as readonly string[],
    }
  );
}

function makeFixtureRegistry(rootDirectory: string): LocalityRegistry {
  const descriptor = YAML.parse(readFileSync(descriptorPath, 'utf8')) as {
    localities: unknown[];
  };
  return createLocalityRegistry(
    descriptor.localities.map((value) => validateLocalityConfig(value)),
    rootDirectory
  );
}

function fixtureRecord(value: unknown): DraftItem {
  return value as DraftItem;
}

test('real runner produces isolated, repeatable multi-locality daily editions', async () => {
  expect(existsSync(descriptorPath)).toBeTruthy();
  for (const name of [
    'county-feed.json',
    'town-a-feed.json',
    'town-b-feed.json',
    'namesake-county-town-feed.json',
    'global-feed.json',
    'expected-daily.md',
  ]) {
    expect(existsSync(join(fixtureDir, name))).toBeTruthy();
  }
  const workspace = await mkdtemp(join(tmpdir(), 'daylight-task7-'));
  const registry = makeFixtureRegistry(workspace);
  const target = join(workspace, 'foundation.sqlite');
  const ds = await createFoundationDataSource((await createTestSchema()).url);
  const originalCwd = process.cwd();
  let bodyVersion = 1;
  const adapter: SourceAdapter = {
    name: 'rss',
    async fetch(source: SourceConfig): Promise<FetchResult[]> {
      const file = String(source.config?.['fixture'] ?? '');
      if (!file) return [];
      const records = JSON.parse(
        readFileSync(join(fixtureDir, file), 'utf8')
      ) as unknown[];
      const payload = JSON.stringify({
        records: records.map(fixtureRecord),
        version: source.sourceKey === 'multi-cook-county' ? bodyVersion : 1,
      });
      const fetched: FetchResult = {
        kind: 'fetched',
        status: 200,
        url: source.url,
        requestUrl: source.url,
        contentType: 'application/json',
        fetchedAt: `2026-09-13T${bodyVersion === 1 ? '12' : '13'}:00:00Z`,
        payload: { kind: 'text', body: payload },
      };
      if (source.sourceKey === 'multi-town-a') {
        return [
          fetched,
          {
            kind: 'failed',
            status: 503,
            url: `${source.url}/failed`,
            requestUrl: `${source.url}/failed`,
            contentType: 'application/json',
            fetchedAt: fetched.fetchedAt,
            error: {
              kind: 'http',
              message: 'fixture outage',
              retryable: true,
              status: 503,
            },
          },
        ];
      }
      return [fetched];
    },
    async parse(raw): Promise<DraftItem[]> {
      return (
        JSON.parse(raw.payload.kind === 'text' ? raw.payload.body : '') as {
          records: DraftItem[];
        }
      ).records;
    },
  };
  registerAdapter(adapter);
  const httpClient: HttpClient = {
    fetch: async (url) =>
      url.includes('/fallback')
        ? response(url, 503, '')
        : response(
            url,
            200,
            articleHtml(
              ARTICLE_LEADS[url.split('/').pop() ?? ''] ??
                'This is a sufficiently long deterministic article body for acceptance output and provenance.'
            )
          ),
  };
  const summarizer: Summarizer = {
    model: 'fixture-model',
    summarizeCluster: async ({ items }) => ({
      summary: items.map((item) => item.title).join('; '),
      model: 'fixture-model',
    }),
    tldr: async ({ clusterSummaries }) => ({
      bullets: clusterSummaries.map((item) => item.summary),
      model: 'fixture-model',
    }),
    summarizeThread: async ({ events }) => ({
      summary: events.map((item) => item.heading).join('; '),
      model: 'fixture-model',
    }),
    developStory: async ({ events }) => ({
      title: events[0]?.heading ?? 'Fixture story',
      narrative: events.map((item) => item.body).join('\n'),
      status: 'developing',
      model: 'fixture-model',
    }),
  };
  try {
    process.chdir(workspace);
    const run = async (localitySlug: string, hour: string) =>
      runPipeline({
        registry,
        localitySlug,
        cadence: 'daily',
        dataSource: ds,
        summarizer,
        httpClient,
        blobStore: createLocalBlobStore(join(workspace, 'blobs')),
        outputDirectory: join(workspace, 'briefings'),
        now: new Date(`2026-09-13T${hour}:00:00Z`),
      });
    const first = await run('pineville-alpha-ga', '12');
    const lake = await run('lakeview-alpha-ga', '12');
    const namesake = await run('pineville-beta-ga', '12');
    expect(first.status).toBe('partial_success');
    expect(lake.status).toBe('partial_success');
    expect(namesake.status).toBe('partial_success');
    expect(first.stages.length).toBe(7);
    expect(
      first.stages.every((stage) => stage.status !== 'skipped')
    ).toBeTruthy();
    for (const result of [first, lake, namesake])
      expect(
        result.markdownPath && existsSync(result.markdownPath)
      ).toBeTruthy();
    expect(
      (
        await ds
          .getRepository(RawDocumentVersionSchema)
          .find({ where: { sourceId: 'multi-cook-county' } })
      ).length
    ).toBe(1);
    bodyVersion = 2;
    await run('pineville-alpha-ga', '13');
    await run('lakeview-alpha-ga', '13');
    await run('pineville-beta-ga', '13');

    const sources = await ds.getRepository(FoundationSourceSchema).find();
    expect(sources.length).toBe(5);
    expect(
      sources.filter((source) => source.sourceKey === 'multi-us-wire').length
    ).toBe(1);
    const versions = await ds
      .getRepository(RawDocumentVersionSchema)
      .find({ where: { sourceId: 'multi-cook-county' } });
    expect(versions.length).toBe(2);
    expect(
      (
        await ds
          .getRepository(RawDocumentVersionSchema)
          .find({ where: { sourceId: 'multi-us-wire' } })
      ).length
    ).toBe(1);
    expect(
      await ds
        .getRepository(RawDocumentSchema)
        .count({ where: { sourceId: 'multi-us-wire' } })
    ).toBe(1);
    for (const sourceKey of [
      'multi-town-a',
      'multi-town-b',
      'multi-berrien-county',
    ]) {
      expect(
        (
          await ds
            .getRepository(RawDocumentVersionSchema)
            .find({ where: { sourceId: sourceKey } })
        ).length
      ).toBe(1);
    }
    expect(
      await ds
        .getRepository(RawDocumentSchema)
        .count({ where: { sourceId: 'multi-cook-county' } })
    ).toBe(1);
    expect(
      (
        await ds
          .getRepository(FoundationQuarantineSchema)
          .find({ where: { sourceId: 'multi-town-a' } })
      ).length > 0
    ).toBeTruthy();
    const items = await ds.getRepository(CivicItemSchema).find();
    expect(
      items.filter(
        (item) =>
          item.sourceId === 'multi-cook-county' &&
          item.title === 'Cook County budget approved'
      ).length
    ).toBe(1);
    expect(
      items.some((item) => item.title === 'Pineville road resurfacing begins')
    ).toBeTruthy();
    expect(
      items.some((item) =>
        JSON.stringify(item.articleProvenance).includes('article')
      )
    ).toBeTruthy();
    expect(
      items.some((item) =>
        JSON.stringify(item.articleProvenance).includes('snippet-fallback')
      )
    ).toBeTruthy();
    expect(
      items.some(
        (item) =>
          item.originalSnippet &&
          item.publisher &&
          item.contentChecksum &&
          item.uris?.includes('https://articles.test/road')
      )
    ).toBeTruthy();
    expect(
      items.some((item) => item.topics?.includes('agriculture'))
    ).toBeTruthy();
    const activeCountyRaw = await ds
      .getRepository(RawDocumentSchema)
      .findOneByOrFail({ sourceId: 'multi-cook-county' });
    expect(activeCountyRaw.activeVersionId).toBeTruthy();

    const storyRows = await ds.getRepository(CanonicalStorySchema).find();
    const budget = storyRows.filter((story) =>
      story.title.includes('Cook County budget')
    );
    expect(budget.length).toBe(1);
    const links = await ds
      .getRepository(CanonicalStoryItemSchema)
      .find({ where: { canonicalStoryId: budget[0]?.id } });
    expect(links.length).toBe(1);
    const globalItems = items.filter(
      (item) => item.sourceId === 'multi-us-wire'
    );
    expect(globalItems.length).toBe(1);
    const globalStories = storyRows.filter((story) =>
      story.title.includes('Global Cook County road grant')
    );
    expect(globalStories.length).toBe(1);
    const globalLinks = await ds
      .getRepository(CanonicalStoryItemSchema)
      .find({ where: { canonicalStoryId: globalStories[0]?.id } });
    expect(globalLinks.length).toBe(1);
    const pineEdition = await ds.getRepository(EditionItemSchema).find({
      where: {
        localitySlug: 'pineville-alpha-ga',
        decision: 'include',
        ruleVersion: registry.ruleVersion('pineville-alpha-ga'),
      },
    });
    const pineTitles = new Set(
      items
        .filter((item) =>
          pineEdition.some((row) => row.civicItemId === item.id)
        )
        .map((item) => item.title)
    );
    expect(pineEdition.length > 0).toBeTruthy();
    expect(pineTitles.has('Cook County budget approved')).toBeTruthy();
    expect(!pineTitles.has('Lakeview school expansion')).toBeTruthy();
    expect(pineTitles.has('Ambiguous county note')).toBeTruthy();
    const betaEdition = await ds.getRepository(EditionItemSchema).find({
      where: {
        localitySlug: 'pineville-beta-ga',
        decision: 'include',
        ruleVersion: registry.ruleVersion('pineville-beta-ga'),
      },
    });
    expect(
      items.some(
        (item) =>
          item.title === 'Pineville Berrien festival opens' &&
          betaEdition.some((row) => row.civicItemId === item.id)
      )
    ).toBeTruthy();
    expect(
      !betaEdition.some((row) =>
        links.some((link) => link.civicItemId === row.civicItemId)
      )
    ).toBeTruthy();
    const lakeEdition = await ds.getRepository(EditionItemSchema).find({
      where: {
        localitySlug: 'lakeview-alpha-ga',
        decision: 'include',
        ruleVersion: registry.ruleVersion('lakeview-alpha-ga'),
      },
    });
    expect(
      lakeEdition.some(
        (row) =>
          items.find((item) => item.id === row.civicItemId)?.title ===
          'Cook County budget approved'
      )
    ).toBeTruthy();
    expect(
      !lakeEdition.some(
        (row) =>
          items.find((item) => item.id === row.civicItemId)?.title ===
          'Pineville road resurfacing begins'
      )
    ).toBeTruthy();
    expect(
      !betaEdition.some(
        (row) =>
          items.find((item) => item.id === row.civicItemId)?.title ===
          'Pineville road resurfacing begins'
      )
    ).toBeTruthy();
    expect(
      !betaEdition.some(
        (row) =>
          items.find((item) => item.id === row.civicItemId)?.title ===
          'Cook County budget approved'
      )
    ).toBeTruthy();
    expect(
      lakeEdition.some((row) => row.civicItemId === globalItems[0]?.id)
    ).toBeTruthy();
    expect(
      pineEdition.some((row) => row.civicItemId === globalItems[0]?.id)
    ).toBeTruthy();
    expect(
      !betaEdition.some((row) => row.civicItemId === globalItems[0]?.id)
    ).toBeTruthy();
    const lakeStories = await ds.getRepository(EditionStorySchema).find({
      where: {
        localitySlug: 'lakeview-alpha-ga',
        ruleVersion: registry.ruleVersion('lakeview-alpha-ga'),
      },
    });
    const pineStories = await ds.getRepository(EditionStorySchema).find({
      where: {
        localitySlug: 'pineville-alpha-ga',
        ruleVersion: registry.ruleVersion('pineville-alpha-ga'),
      },
    });
    expect(
      pineStories.some((row) => row.canonicalStoryId === budget[0]?.id)
    ).toBeTruthy();
    expect(
      lakeStories.some((row) => row.canonicalStoryId === budget[0]?.id)
    ).toBeTruthy();
    expect(
      pineStories.some((row) => row.canonicalStoryId === globalStories[0]?.id)
    ).toBeTruthy();
    expect(
      lakeStories.some((row) => row.canonicalStoryId === globalStories[0]?.id)
    ).toBeTruthy();
    expect(
      !betaEdition.some((row) => row.civicItemId === globalItems[0]?.id)
    ).toBeTruthy();
    expect(await ds.getRepository(EditionItemSchema).count()).toBe(
      new Set(
        (await ds.getRepository(EditionItemSchema).find()).map(
          (row) => `${row.localitySlug}:${row.civicItemId}:${row.ruleVersion}`
        )
      ).size
    );
    expect(sources.length).toBe(
      new Set(sources.map((row) => row.sourceKey)).size
    );
    const allVersions = await ds.getRepository(RawDocumentVersionSchema).find();
    expect(allVersions.length).toBe(
      new Set(
        allVersions.map((row) => `${row.sourceId}:${row.url}:${row.checksum}`)
      ).size
    );
    const allStoryLinks = await ds.getRepository(EditionStorySchema).find();
    expect(allStoryLinks.length).toBe(
      new Set(
        allStoryLinks.map(
          (row) =>
            `${row.localitySlug}:${row.canonicalStoryId}:${row.ruleVersion}`
        )
      ).size
    );
    expect(
      await ds
        .getRepository(BriefingSchema)
        .count({ where: { localitySlug: 'pineville-alpha-ga' } })
    ).toBe(1);
    expect(await ds.getRepository(BriefingSchema).count()).toBe(3);
    const allBriefings = await ds.getRepository(BriefingSchema).find();
    expect(allBriefings.length).toBe(
      new Set(
        allBriefings.map(
          (row) =>
            `${row.localitySlug}:${row.cadence}:${row.periodStart}:${row.periodEnd}:${row.ruleVersion}`
        )
      ).size
    );
    const briefing = await ds
      .getRepository(BriefingSchema)
      .findOneByOrFail({ localitySlug: 'pineville-alpha-ga' });
    expect(first.markdownPath && existsSync(first.markdownPath)).toBeTruthy();
    expect(await readFile(first.markdownPath!, 'utf8')).toBe(briefing.markdown);
    const normalized = briefing.markdown.replace(
      /Generated: .*$/gm,
      'Generated: <TIMESTAMP>'
    );
    // The fixture is workspace-formatted, so compare the edition in that form;
    // pure formatting (e.g. *italic* vs _italic_) is not a difference.
    const expectedPath = join(fixtureDir, 'expected-daily.md');
    const formatted = format(normalized, {
      ...resolveConfig.sync(expectedPath),
      filepath: expectedPath,
    });
    // UPDATE_SNAPSHOTS=1 rewrites the expected edition; read the diff before committing it.
    if (process.env['UPDATE_SNAPSHOTS'] === '1')
      await writeFile(expectedPath, formatted);
    const expected = await readFile(expectedPath, 'utf8');
    expect(formatted).toBe(expected);
    expect(normalized).toMatch(/Pineville|Cook County/);
    expect(normalized).toMatch(/Coverage gaps/);
    // The fixture's articles state no date, so none can be placed in time: they are not reported.
    expect(normalized).not.toMatch(
      /Cook County budget approved|Pineville road resurfacing begins|Global Cook County road grant/
    );
    expect(normalized).not.toMatch(/WITHHELD|Lakeview school expansion/);
    expect(
      first.coverageGaps.some((gap) => gap.stage === 'gather')
    ).toBeTruthy();
    expect(
      first.coverageGaps.some((gap) => gap.stage === 'project')
    ).toBeTruthy();
    const priorMarkdown = briefing.markdown;
    const blockedOutput = join(workspace, 'blocked-output');
    await writeFile(blockedOutput, 'not a directory');
    const failedPublish = await runPipeline({
      registry,
      localitySlug: 'pineville-alpha-ga',
      cadence: 'daily',
      dataSource: ds,
      summarizer,
      httpClient,
      blobStore: createLocalBlobStore(join(workspace, 'blobs')),
      outputDirectory: blockedOutput,
      now: new Date('2026-09-13T14:00:00Z'),
    });
    expect(failedPublish.status).toBe('failed');
    expect(
      (
        await ds
          .getRepository(BriefingSchema)
          .findOneByOrFail({ localitySlug: 'pineville-alpha-ga' })
      ).markdown
    ).toBe(priorMarkdown);
    expect(await readFile(first.markdownPath!, 'utf8')).toBe(priorMarkdown);
    expect(
      await ds
        .getRepository(EditionStorySchema)
        .count({ where: { localitySlug: 'pineville-beta-ga' } })
    ).toBe(1);
  } finally {
    process.chdir(originalCwd);
    await ds.destroy();
  }
});

test('real runner records all-source failure and skips an overlapping active run', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'daylight-task7-recovery-'));
  const registry = makeFixtureRegistry(workspace);
  const baseSource: SourceConfig = {
    sourceKey: 'multi-all-fail',
    ownerSlug: 'pineville-alpha-ga',
    coverage: 'mentions',
    adapter: 'fixture-all-fail',
    name: 'failing fixture',
    url: 'https://fixtures.test/fail',
    kind: 'news',
  };
  registerAdapter({
    name: 'fixture-all-fail',
    fetch: async () => [
      {
        kind: 'failed',
        status: 503,
        url: baseSource.url,
        requestUrl: baseSource.url,
        contentType: 'text/plain',
        fetchedAt: '2026-09-13T12:00:00Z',
        error: {
          kind: 'http',
          status: 503,
          message: 'fixture unavailable',
          retryable: true,
        },
      },
    ],
    parse: async () => [],
  });
  const failingRegistry: LocalityRegistry = {
    ...registry,
    sourcesForRun: () => [baseSource as ResolvedSource],
  };
  const failingDb = await createFoundationDataSource(
    (
      await createTestSchema()
    ).url
  );
  const summarizer: Summarizer = {
    model: 'fixture-model',
    summarizeCluster: async () => ({ summary: '', model: 'fixture-model' }),
    tldr: async () => ({ bullets: [], model: 'fixture-model' }),
    summarizeThread: async () => ({ summary: '', model: 'fixture-model' }),
    developStory: async () => ({
      title: '',
      narrative: '',
      status: '',
      model: 'fixture-model',
    }),
  };
  const fakeHttp: HttpClient = { fetch: async (url) => response(url, 503, '') };
  const failed = await runPipeline({
    registry: failingRegistry,
    localitySlug: 'pineville-alpha-ga',
    cadence: 'daily',
    dataSource: failingDb,
    summarizer,
    httpClient: fakeHttp,
    now: new Date('2026-09-13T12:00:00Z'),
  });
  expect(failed.status).toBe('failed');
  expect(failed.stages.find((stage) => stage.stage === 'gather')?.status).toBe(
    'failed'
  );
  await failingDb.destroy();

  let calls = 0;
  registerAdapter({
    name: 'fixture-overlap',
    fetch: async () => {
      calls += 1;
      return [];
    },
    parse: async () => [],
  });
  const overlapSource: SourceConfig = {
    sourceKey: 'multi-overlap',
    ownerSlug: 'pineville-alpha-ga',
    coverage: 'mentions',
    adapter: 'fixture-overlap',
    name: 'overlap fixture',
    url: 'https://fixtures.test/overlap',
    kind: 'news',
  };
  const overlapRegistry: LocalityRegistry = {
    ...registry,
    sourcesForRun: () => [overlapSource as ResolvedSource],
  };
  const targetDb = await createFoundationDataSource(
    (
      await createTestSchema()
    ).url
  );
  const active = await targetDb.getRepository(PipelineRunSchema).save({
    scopeSlug: 'pineville-alpha-ga',
    localitySlug: 'pineville-alpha-ga',
    cadence: 'daily',
    startedAt: '2026-09-13T12:00:00Z',
    completedAt: null,
    status: 'running',
    currentStage: 'gather',
    ruleVersion: 'cook-county.v1',
    counts: '{}',
    coverageGaps: '[]',
    error: null,
  });
  await targetDb.getRepository(PipelineRunLeaseSchema).save({
    scopeSlug: 'pineville-alpha-ga',
    cadence: 'daily',
    ownerId: 'active-owner',
    runId: active.id as number,
    leaseUntil: '2099-01-01T00:00:00Z',
    createdAt: '2026-09-13T12:00:00Z',
    updatedAt: '2026-09-13T12:00:00Z',
  });
  const second = await runPipeline({
    registry: overlapRegistry,
    localitySlug: 'pineville-alpha-ga',
    cadence: 'daily',
    dataSource: targetDb,
    summarizer,
    httpClient: fakeHttp,
    now: new Date('2026-09-13T12:01:00Z'),
  });
  expect(second.status).toBe('skipped-overlap');
  expect(second.stages).toStrictEqual([]);
  expect(calls).toBe(0);
  expect(await targetDb.getRepository(PipelineRunLeaseSchema).count()).toBe(1);
  await targetDb.destroy();
});
