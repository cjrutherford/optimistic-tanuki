import { createTestDataSource, createTestSchema } from './helpers/postgres.js';
import { DataSource, In } from 'typeorm';
import {
  finalizeRunAndRelease,
  recoverExpired,
  releaseLease,
  runPipeline,
  type RunPipelineOptions,
} from '../../src/runner.js';
import { FOUNDATION_SCHEMAS } from '../../src/schema.js';
import type { LocalityConfig } from '../../src/types.js';
import type { LocalityRegistry } from '../../src/locality-registry.js';
import {
  createLocalityRegistry,
  loadLocalityRegistry,
} from '../../src/locality-registry.js';
import { registerAdapter } from '../../src/registry.js';
import { failingSourceAdapter } from '../fixtures/runner/failing-source.js';
import {
  CanonicalStorySchema,
  FoundationQuarantineSchema,
} from '../../src/schema.js';
import {
  PipelineRunSchema,
  PipelineRunLeaseSchema,
  PipelineStageRunSchema,
} from '../../src/schema.js';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const locality: LocalityConfig = {
  slug: 'town-a',
  name: 'Town A',
  state: 'GA',
  timezone: 'America/New_York',
  lat: 31,
  lon: -83,
  kind: 'town',
  parents: ['county-a'],
  edition: true,
  topics: [],
  cadence: ['daily'],
  sources: [],
};
const registry: LocalityRegistry = createLocalityRegistry([
  { ...locality, parents: [] },
]);
const summarizer = {
  model: 'test',
  async summarizeCluster() {
    return { summary: '', model: 'test' };
  },
  async tldr() {
    return { bullets: [], model: 'test' };
  },
  async summarizeThread() {
    return { summary: '', model: 'test' };
  },
  async developStory() {
    return { title: '', narrative: '', status: '', model: 'test' };
  },
};

async function dataSource(): Promise<DataSource> {
  const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
  return ds;
}

describe('unified pipeline runner', () => {
  it('has the compile-time options contract', () => {
    const options = {
      registry,
      localitySlug: locality.slug,
      cadence: 'daily',
      dataSource: null as unknown as DataSource,
      summarizer,
    } satisfies RunPipelineOptions;
    expect(options.cadence).toBe('daily');
  });

  it('carries the run blob store from fetch through document parsing under outputRoot', async () => {
    const root = mkdtempSync(join(tmpdir(), 'civic-runner-blobs-'));
    const originalCwd = process.cwd();
    let parsed = 0;
    registerAdapter({
      name: 'runner-document-blobs',
      async fetch(source, context) {
        const refs = [
          await context.blobStore!.put(new Uint8Array([1]), 'application/pdf'),
          await context.blobStore!.put(new Uint8Array([2]), 'application/pdf'),
        ];
        return refs.map((ref, index) => ({
          kind: 'fetched' as const,
          status: 200 as const,
          url: `${source.url}/${index}`,
          requestUrl: source.url,
          contentType: 'application/pdf',
          fetchedAt: `2026-09-12T0${index + 1}:00:00.000Z`,
          payload: { kind: 'blob-ref' as const, ref },
        }));
      },
      async parse(raw, _source, context) {
        expect(context?.blobStore).toBeTruthy();
        expect(
          (
            await context!.blobStore!.get(
              raw.payload.kind === 'blob-ref'
                ? raw.payload.ref
                : (() => {
                    throw new Error('expected blob ref');
                  })()
            )
          ).length
        ).toBe(1);
        parsed += 1;
        return [
          {
            kind: 'meeting',
            title: `Document ${parsed}`,
            body: 'A durable document body with enough detail for projection.',
            eventDate: '2026-09-12',
            topics: ['documents'],
            uris: [raw.url],
          },
        ];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-document-blobs-source',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-document-blobs',
      name: 'Documents',
      url: 'https://example.test/document-index',
      kind: 'meeting' as const,
    };
    const testRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source],
    };
    const ds = await dataSource();
    try {
      process.chdir(root);
      const result = await runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
        outputRoot: join(root, 'artifacts'),
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(
        ['succeeded', 'partial_success'].includes(result.status)
      ).toBeTruthy();
      expect(parsed).toBe(2);
      expect(existsSync(join(root, 'artifacts', 'blobs'))).toBeTruthy();
      expect(existsSync(join(root, 'data', 'blobs'))).toBe(false);
    } finally {
      process.chdir(originalCwd);
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps daily evidence half-open while carrying context history, coverage, blobs, and repeat idempotency', async () => {
    const root = mkdtempSync(join(tmpdir(), 'civic-runner-window-e2e-'));
    const originalCwd = process.cwd();
    const records: {
      title: string;
      body: string;
      kind: 'meeting' | 'news' | 'permit' | 'alert';
      eventDate?: string;
      publishedAt?: string;
      topics: string[];
      uris: string[];
    }[] = [
      {
        title: 'Historical bridge meeting',
        body: `Bridge project: 1. The council reviewed the bridge project and approved a documented construction schedule for residents. ${'Detailed public works findings. '.repeat(
          8
        )}`,
        kind: 'meeting',
        eventDate: '2026-08-20',
        topics: ['bridge'],
        uris: ['https://example.test/historical-meeting'],
      },
      {
        title: 'Daily bridge meeting',
        body: `Bridge project: 1. The council reviewed the bridge project and approved a documented construction schedule for residents. ${'Detailed public works findings. '.repeat(
          8
        )}`,
        kind: 'meeting',
        eventDate: '2026-09-12',
        topics: ['bridge'],
        uris: ['https://example.test/daily-meeting'],
      },
      {
        title: 'Historical community update',
        body: 'Historical community reporting within the ongoing backfill context.',
        kind: 'news',
        publishedAt: '2026-08-20T15:00:00.000Z',
        topics: ['community'],
        uris: ['https://example.test/historical-news'],
      },
      {
        title: 'Historical permit filing',
        body: 'Historical permit evidence within the ongoing backfill context.',
        kind: 'permit',
        eventDate: '2026-08-20',
        topics: ['planning'],
        uris: ['https://example.test/historical-permit'],
      },
      {
        title: 'Historical weather alert',
        body: 'Historical alert evidence within the ongoing backfill context.',
        kind: 'alert',
        eventDate: '2026-08-20',
        topics: ['weather'],
        uris: ['https://example.test/historical-alert'],
      },
      {
        title: 'Daily community update',
        body: 'Daily community reporting for the exact edition interval.',
        kind: 'news',
        publishedAt: '2026-09-12T15:00:00.000Z',
        topics: ['community'],
        uris: ['https://example.test/daily-news'],
      },
      {
        title: 'Daily permit filing',
        body: 'Daily permit evidence for the exact edition interval.',
        kind: 'permit',
        eventDate: '2026-09-12',
        topics: ['planning'],
        uris: ['https://example.test/daily-permit'],
      },
      {
        title: 'Daily weather alert',
        body: 'Daily alert evidence for the exact edition interval.',
        kind: 'alert',
        eventDate: '2026-09-12',
        topics: ['weather'],
        uris: ['https://example.test/daily-alert'],
      },
      {
        title: 'Too old community update',
        body: 'This record is outside the thirty-day context and must not render.',
        kind: 'news',
        publishedAt: '2026-08-01T15:00:00.000Z',
        topics: ['community'],
        uris: ['https://example.test/too-old'],
      },
    ];
    let fetchCalls = 0;
    registerAdapter({
      name: 'runner-window-e2e',
      async fetch(source, context) {
        fetchCalls += 1;
        expect(context.coverageRange).toStrictEqual({
          requestedStart: '2026-08-14',
          requestedEnd: '2026-09-13',
        });
        const store = context.blobStore!;
        return Promise.all(
          records.map(async (record, index) => ({
            kind: 'fetched' as const,
            status: 200 as const,
            url: `${source.url}/${index}`,
            requestUrl: source.url,
            contentType: 'application/json',
            fetchedAt: `2026-09-12T${fetchCalls === 1 ? '12' : '13'}:${String(
              index
            ).padStart(2, '0')}:00.000Z`,
            observedDates:
              fetchCalls === 1 ||
              (record.eventDate ?? record.publishedAt!.slice(0, 10)) ===
                '2026-09-12'
                ? [record.eventDate ?? record.publishedAt!.slice(0, 10)]
                : [],
            payload: {
              kind: 'blob-ref' as const,
              ref: await store.put(
                new TextEncoder().encode(JSON.stringify(record)),
                'application/json'
              ),
            },
          }))
        );
      },
      async parse(raw, _source, context) {
        expect(context?.blobStore).toBeTruthy();
        const record = JSON.parse(
          new TextDecoder().decode(
            await context!.blobStore!.get(
              raw.payload.kind === 'blob-ref'
                ? raw.payload.ref
                : (() => {
                    throw new Error('expected blob ref');
                  })()
            )
          )
        ) as (typeof records)[number];
        return [record];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-window-e2e-source',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-window-e2e',
      name: 'Window fixture',
      url: 'https://example.test/window-e2e',
      kind: 'news' as const,
      coverageCapabilities: {
        dateQuery: { parameter: 'from', format: 'YYYY-MM-DD' as const },
      },
    };
    const testRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source],
    };
    const ds = await dataSource();
    try {
      process.chdir(root);
      const options = {
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily' as const,
        dataSource: ds,
        summarizer,
        outputRoot: join(root, 'artifacts'),
        now: new Date('2026-09-13T12:00:00.000Z'),
      };
      const first = await runPipeline(options);
      expect(first.dailyPeriod?.start).toBe('2026-09-12');
      expect(first.contextRange).toStrictEqual({
        start: '2026-08-14',
        end: '2026-09-13',
      });
      expect(first.coverageRanges?.[source.sourceKey]?.observedStart).toBe(
        '2026-08-20'
      );
      expect(first.coverageRanges?.[source.sourceKey]?.observedEnd).toBe(
        '2026-09-13'
      );
      expect(first.coverageRanges?.[source.sourceKey]?.reason).toBe(
        'partial-range'
      );
      const markdown = readFileSync(first.markdownPath!, 'utf8');
      // What is dated in the edition's window is reported as news; earlier records
      // are never reported as news — the article may use them only as dated
      // background — and records outside the context window appear nowhere.
      const article = markdown.split('## Sources')[0]!;
      for (const title of [
        'Daily bridge meeting',
        'Daily community update',
        'Daily permit filing',
        'Daily weather alert',
      ])
        expect(article).toMatch(new RegExp(title));
      for (const title of [
        'Historical bridge meeting',
        'Historical community update',
        'Historical permit filing',
        'Historical weather alert',
      ])
        expect(article).not.toMatch(new RegExp(title));
      expect(markdown).not.toMatch(/Too old community update/);
      expect(existsSync(join(root, 'artifacts', 'blobs'))).toBe(true);
      expect(existsSync(join(root, 'data', 'blobs'))).toBe(false);
      const firstRun = await ds
        .getRepository(PipelineRunSchema)
        .findOneByOrFail({ id: first.runId });
      expect(JSON.parse(firstRun.coverageRanges)).toStrictEqual(
        first.coverageRanges
      );
      const storyCount = await ds.getRepository(CanonicalStorySchema).count();
      const second = await runPipeline(options);
      expect(
        ['succeeded', 'partial_success'].includes(second.status)
      ).toBeTruthy();
      expect(await ds.getRepository('CivicItem').count()).toBe(
        records.length - 1
      );
      expect(await ds.getRepository('Briefing').count()).toBe(1);
      expect(await ds.getRepository(CanonicalStorySchema).count()).toBe(
        storyCount
      );
      const attempts = await ds
        .getRepository('FetchAttempt')
        .find({ order: { id: 'ASC' } });
      expect(attempts.length).toBe(records.length * 2);
      expect(
        JSON.parse(attempts[0]!['coverageRange'] ?? '{}').observedStart
      ).toBe('2026-08-20');
      expect(
        JSON.parse(attempts.at(-1)!['coverageRange'] ?? '{}').observedStart
      ).toBe('2026-09-12');
    } finally {
      process.chdir(originalCwd);
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('records a failed configuration run without network or stage work when no source is enabled', async () => {
    const ds = await dataSource();
    try {
      const result = await runPipeline({
        registry,
        localitySlug: locality.slug,
        cadence: 'daily',
        dataSource: ds,
        summarizer,
        now: new Date('2026-09-12T12:00:00.000Z'),
      });
      expect(result.status).toBe('failed');
      expect(result.coverageGaps).toStrictEqual([
        {
          sourceKey: '__config__',
          stage: 'gather',
          reason: 'no enabled sources for locality',
        },
      ]);
      expect(result.stages).toStrictEqual([]);
      expect(await ds.getRepository('PipelineRun').count()).toBe(1);
      expect(await ds.getRepository('PipelineStageRun').count()).toBe(0);
    } finally {
      await ds.destroy();
    }
  });

  it('executes the seven stages in order and carries one rule version through the edition', async () => {
    registerAdapter({
      name: 'runner-test',
      async fetch(source) {
        return [
          {
            kind: 'fetched',
            status: 200,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: '2026-03-08T12:00:00.000Z',
            payload: { kind: 'text', body: 'fixture' },
          },
        ];
      },
      async parse() {
        return [
          {
            kind: 'news',
            title: 'Adel local update',
            body: 'A verified local update with enough detail.',
            topics: ['general'],
            uris: ['https://example.test/story'],
            publishedAt: '2026-03-08T12:00:00.000Z',
          },
        ];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-test-source',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-test',
      name: 'Fixture',
      url: 'https://example.test/feed',
      kind: 'news' as const,
    };
    const testRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: (slug) => (slug === 'adel-ga' ? [source] : []),
    };
    const ds = await dataSource();
    try {
      const periods: string[] = [];
      const periodSummarizer = {
        ...summarizer,
        async tldr(input: { period: string }) {
          periods.push(input.period);
          return { bullets: [], model: 'test' };
        },
      };
      const result = await runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer: periodSummarizer,
        now: new Date('2026-03-09T04:30:00.000Z'),
      });
      expect(result.stages.map((stage) => stage.stage)).toStrictEqual([
        'ensure',
        'gather',
        'parse',
        'extractAgenda',
        'project',
        'collate',
        'brief',
      ]);
      expect(
        ['succeeded', 'partial_success'].includes(result.status)
      ).toBeTruthy();
      // A town's first edition reports the past week, so its article is asked about that week.
      expect(periods.includes('2026-03-02 to 2026-03-09')).toBeTruthy();
      expect(result.dailyPeriod).toStrictEqual({
        start: '2026-03-08',
        end: '2026-03-09',
      });
      expect(result.contextRange).toStrictEqual({
        start: '2026-02-07',
        end: '2026-03-09',
      });
      const run = await ds
        .getRepository('PipelineRun')
        .findOneBy({ id: result.runId });
      expect(run?.['status']).toBe(result.status);
      expect(JSON.parse(run?.['coverageRanges'] ?? '{}')).toStrictEqual(
        result.coverageRanges
      );
      expect(await ds.getRepository('PipelineRunLease').count()).toBe(0);
    } finally {
      await ds.destroy();
    }
  });

  it('pulls without an edition, then backfills a past day from stored records known by that day (D31)', async () => {
    let fetches = 0;
    registerAdapter({
      name: 'runner-backfill',
      async fetch(source) {
        fetches += 1;
        return [
          {
            kind: 'fetched',
            status: 200,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: '2026-03-13T12:00:00.000Z',
            payload: { kind: 'text', body: 'fixture' },
          },
        ];
      },
      async parse() {
        return [
          {
            kind: 'news',
            title: 'Adel council approves paving',
            body: 'The Adel council approved paving on Love Avenue with enough detail.',
            topics: ['general'],
            uris: ['https://example.test/known'],
            eventDate: '2026-03-07',
            publishedAt: '2026-03-07T15:00:00.000Z',
          },
          {
            kind: 'news',
            title: 'Adel council paving, a week on',
            body: 'Reported later: the Adel paving vote drew complaints with enough detail.',
            topics: ['general'],
            uris: ['https://example.test/later'],
            eventDate: '2026-03-07',
            publishedAt: '2026-03-12T15:00:00.000Z',
          },
        ];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-backfill-source',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-backfill',
      name: 'Fixture',
      url: 'https://example.test/backfill',
      kind: 'news' as const,
    };
    const testRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: (slug) => (slug === 'adel-ga' ? [source] : []),
    };
    const ds = await dataSource();
    try {
      const pull = await runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
        now: new Date('2026-03-13T12:00:00.000Z'),
        pullOnly: true,
      });
      expect(pull.stages.map((stage) => stage.stage)).toStrictEqual([
        'ensure',
        'gather',
        'parse',
      ]);
      // The fixture adapter documents no coverage capability: a gap, not a failure.
      expect(['succeeded', 'partial_success']).toContain(pull.status);
      expect(await ds.getRepository('Briefing').count()).toBe(0);
      expect(await ds.getRepository('CivicItem').count()).toBe(2);

      const backfilled = await runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
        now: new Date('2026-03-08T12:00:00.000Z'),
        periodStart: '2026-03-07',
        periodEnd: '2026-03-08',
        fromStored: true,
      });
      expect(fetches).toBe(1);
      expect(backfilled.stages.map((stage) => stage.stage)).toStrictEqual([
        'ensure',
        'extractAgenda',
        'project',
        'collate',
        'brief',
      ]);
      const briefing = await ds
        .getRepository('Briefing')
        .findOneByOrFail({ periodEnd: '2026-03-08' });
      const ids = JSON.parse(briefing['itemIds']) as number[];
      const titles = (
        await ds.getRepository('CivicItem').findBy({ id: In(ids) })
      ).map((item) => item['title']);
      // The follow-up was published on the 12th, after the edition's day.
      expect(titles).toStrictEqual(['Adel council approves paving']);
    } finally {
      await ds.destroy();
    }
  });

  it('marks a failed source stage truthfully and records run-scoped quarantine metadata', async () => {
    registerAdapter(failingSourceAdapter);
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-failing-source-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-failing-source',
      name: 'Failure',
      url: 'https://example.test/fail',
      kind: 'news' as const,
    };
    const testRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source],
    };
    const ds = await dataSource();
    try {
      const result = await runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      expect(result.status).toBe('failed');
      expect(result.stages[1]?.stage).toBe('gather');
      expect(result.stages[1]?.status).toBe('failed');
      const quarantines = await ds
        .getRepository(FoundationQuarantineSchema)
        .find();
      expect(
        quarantines.some(
          (row) =>
            row.sourceId === source.sourceKey &&
            row.scopeSlug === 'adel-ga' &&
            row.runId === String(result.runId) &&
            row.stage === 'gather'
        )
      ).toBeTruthy();
    } finally {
      await ds.destroy();
    }
  });

  it('takes over an expired database lease and marks the abandoned run failed', async () => {
    const { url } = await createTestSchema();
    const first = new DataSource({
      type: 'postgres',
      url,
      entities: FOUNDATION_SCHEMAS,
      synchronize: true,
    });
    const second = new DataSource({
      type: 'postgres',
      url,
      entities: FOUNDATION_SCHEMAS,
      synchronize: true,
    });
    await first.initialize();
    await second.initialize();
    try {
      const old = await first.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-12T00:00:00.000Z',
        completedAt: null,
        status: 'running',
        currentStage: 'gather',
        ruleVersion: 'cook-county.v1',
        counts: '{}',
        coverageGaps: '[]',
        error: null,
      });
      await first.getRepository('PipelineStageRun').save({
        runId: old.id as number,
        stage: 'gather',
        startedAt: '2026-09-12T00:00:00.000Z',
        completedAt: null,
        status: 'running',
        counts: '{}',
        coverageGaps: '[]',
        error: null,
      });
      await first.getRepository(PipelineRunLeaseSchema).save({
        scopeSlug: 'town-a',
        cadence: 'daily',
        ownerId: 'old-owner',
        runId: old.id as number,
        leaseUntil: '2026-09-12T00:01:00.000Z',
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      });
      const result = await runPipeline({
        registry,
        localitySlug: locality.slug,
        cadence: 'daily',
        dataSource: second,
        summarizer,
        now: new Date('2026-09-12T00:02:00.000Z'),
      });
      expect(result.status).toBe('failed');
      expect(
        (
          await second
            .getRepository(PipelineRunSchema)
            .findOneBy({ id: old.id })
        )?.status
      ).toBe('failed');
      expect(
        (
          await second
            .getRepository('PipelineStageRun')
            .findOneBy({ runId: old.id, stage: 'gather' })
        )?.['status']
      ).toBe('failed');
    } finally {
      await first.destroy();
      await second.destroy();
    }
  });

  it('retains successful records and reports partial success when one fetch fails', async () => {
    registerAdapter({
      name: 'runner-partial-source',
      async fetch(source) {
        return [
          {
            kind: 'failed',
            status: 503,
            url: `${source.url}/failed`,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            error: { kind: 'http', message: '503', retryable: true },
          },
          {
            kind: 'fetched',
            status: 200,
            url: `${source.url}/ok`,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'ok' },
          },
        ];
      },
      async parse(raw) {
        return [
          {
            kind: 'news',
            title: `Retained ${raw.url}`,
            body: 'A successful record retained after a partial source failure.',
            topics: ['general'],
            uris: [raw.url],
          },
        ];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-partial-source-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-partial-source',
      name: 'Partial',
      url: 'https://example.test/partial',
      kind: 'news' as const,
    };
    const testRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source],
    };
    const ds = await dataSource();
    try {
      const result = await runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      expect(result.status).toBe('partial_success');
      expect(
        result.stages.find((stage) => stage.stage === 'gather')?.status
      ).toBe('partial_success');
      expect(
        result.coverageGaps.some((gap) => gap.sourceKey === source.sourceKey)
      ).toBeTruthy();
      expect(await ds.getRepository('CivicItem').count()).toBe(1);
    } finally {
      await ds.destroy();
    }
  });

  it('persists nonzero project include/withhold/uncertain counts and diagnostic gaps on the stage row', async () => {
    registerAdapter({
      name: 'runner-project-diagnostics',
      async fetch(source) {
        return [
          {
            kind: 'fetched',
            status: 200,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'fixture' },
          },
        ];
      },
      async parse() {
        return [
          {
            kind: 'news',
            title: 'Project diagnostic item',
            body: 'Details',
            topics: ['general'],
          },
        ];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-project-diagnostic-source',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-project-diagnostics',
      name: 'Diagnostics',
      url: 'https://example.test/diagnostics',
      kind: 'news' as const,
    };
    const unresolvedSource = {
      ...source,
      sourceKey: 'runner-project-unresolved-source',
      ownerSlug: 'missing-owner',
      coverage: 'mentions' as const,
      url: 'https://example.test/unresolved',
    };
    const testRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source, unresolvedSource],
    };
    const ds = await dataSource();
    try {
      const result = await runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      expect(result.status).toBe('partial_success');
      expect(
        result.stages.some(
          (stage) =>
            stage.stage === 'project' &&
            stage.counts['included']! > 0 &&
            stage.counts['withheld']! > 0 &&
            stage.counts['uncertain']! >= 0
        )
      ).toBeTruthy();
      const projectStage = await ds
        .getRepository(PipelineStageRunSchema)
        .findOneBy({ runId: result.runId, stage: 'project' });
      expect(projectStage).toBeTruthy();
      const counts = JSON.parse(projectStage!.counts) as Record<string, number>;
      expect(
        'included' in counts && 'withheld' in counts && 'uncertain' in counts
      ).toBeTruthy();
      expect(
        JSON.parse(projectStage!.coverageGaps).some(
          (gap: { sourceKey: string }) => gap.sourceKey.startsWith('item:')
        )
      ).toBeTruthy();
      expect(
        result.coverageGaps.some(
          (gap) => gap.stage === 'project' && gap.sourceKey.startsWith('item:')
        )
      ).toBeTruthy();
    } finally {
      await ds.destroy();
    }
  });

  it('admits one owner and returns the overlapping two-connection run as a no-op', async () => {
    const { url } = await createTestSchema();
    const first = new DataSource({
      type: 'postgres',
      url,
      entities: FOUNDATION_SCHEMAS,
      synchronize: true,
    });
    const second = new DataSource({
      type: 'postgres',
      url,
      entities: FOUNDATION_SCHEMAS,
      synchronize: false,
    });
    let started!: () => void;
    const fetchStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let releaseFetch!: () => void;
    const fetchRelease = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    registerAdapter({
      name: 'runner-overlap-source',
      async fetch(source) {
        started();
        await fetchRelease;
        return [
          {
            kind: 'fetched',
            status: 200,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'overlap' },
          },
        ];
      },
      async parse() {
        return [];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-overlap-source-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-overlap-source',
      name: 'Overlap',
      url: 'https://example.test/overlap',
      kind: 'news' as const,
    };
    const testRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source],
    };
    await first.initialize();
    await second.initialize();
    try {
      const firstRun = runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: first,
        summarizer,
        heartbeatIntervalMs: 10,
      });
      await fetchStarted;
      await new Promise((resolve) => setTimeout(resolve, 30));
      const renewed = await first
        .getRepository(PipelineRunLeaseSchema)
        .findOneBy({ scopeSlug: 'adel-ga', cadence: 'daily' });
      expect(renewed && renewed.updatedAt > renewed.createdAt).toBeTruthy();
      const secondRun = await runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: second,
        summarizer,
        heartbeatIntervalMs: 10,
      });
      expect(secondRun.status).toBe('skipped-overlap');
      expect(
        await second
          .getRepository(PipelineStageRunSchema)
          .countBy({ runId: secondRun.runId })
      ).toBe(0);
      releaseFetch();
      const completed = await firstRun;
      expect(completed.status).not.toBe('skipped-overlap');
      const stages = await first
        .getRepository(PipelineStageRunSchema)
        .findBy({ runId: completed.runId });
      expect(
        stages.length > 0 &&
          stages.every(
            (stage) => stage.status !== 'running' && stage.completedAt !== null
          )
      ).toBeTruthy();
    } finally {
      releaseFetch();
      await first.destroy();
      await second.destroy();
    }
  });

  it('rejects a stale owner release after another owner has taken over', async () => {
    const ds = await dataSource();
    try {
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-12T00:00:00.000Z',
        completedAt: null,
        status: 'running',
        currentStage: null,
        ruleVersion: 'county-a.v1',
        counts: '{}',
        coverageGaps: '[]',
        error: null,
      });
      await ds.getRepository(PipelineRunLeaseSchema).save({
        scopeSlug: 'town-a',
        cadence: 'daily',
        ownerId: 'new-owner',
        runId: run.id,
        leaseUntil: '2099-01-01T00:00:00.000Z',
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      });
      await releaseLease(
        ds,
        'town-a',
        'daily',
        'stale-owner',
        run.id as number
      );
      expect(await ds.getRepository(PipelineRunLeaseSchema).count()).toBe(1);
    } finally {
      await ds.destroy();
    }
  });

  it('rolls back terminal run state when transactional finalization or lease release fails', async () => {
    const ds = await dataSource();
    try {
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-12T00:00:00.000Z',
        completedAt: null,
        status: 'running',
        currentStage: null,
        ruleVersion: 'county-a.v1',
        counts: '{}',
        coverageGaps: '[]',
        error: null,
      });
      await ds.getRepository(PipelineRunLeaseSchema).save({
        scopeSlug: 'town-a',
        cadence: 'daily',
        ownerId: 'owner',
        runId: run.id,
        leaseUntil: '2099-01-01T00:00:00.000Z',
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      });
      await ds.query(
        "CREATE FUNCTION fail_lease_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'lease release failure'; END; $$"
      );
      await ds.query(
        'CREATE TRIGGER fail_lease_delete BEFORE DELETE ON pipeline_run_leases FOR EACH ROW EXECUTE FUNCTION fail_lease_delete()'
      );
      await expect(
        (() =>
          finalizeRunAndRelease(
            ds,
            run.id as number,
            'town-a',
            'daily',
            'owner',
            { status: 'succeeded', completedAt: '2026-09-12T00:01:00.000Z' }
          ))()
      ).rejects.toThrow(/lease release failure/);
      expect(
        (await ds.getRepository(PipelineRunSchema).findOneBy({ id: run.id }))
          ?.status
      ).toBe('running');
      expect(await ds.getRepository(PipelineRunLeaseSchema).count()).toBe(1);
    } finally {
      await ds.destroy();
    }
  });

  it('decides overlap before consulting a poisoned registry', async () => {
    const ds = await dataSource();
    try {
      const active = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'poisoned-town',
        localitySlug: 'poisoned-town',
        cadence: 'daily',
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: 'running',
        currentStage: null,
        ruleVersion: 'unversioned',
        counts: '{}',
        coverageGaps: '[]',
        error: null,
      });
      await ds.getRepository(PipelineRunLeaseSchema).save({
        scopeSlug: 'poisoned-town',
        cadence: 'daily',
        ownerId: 'active-owner',
        runId: active.id,
        leaseUntil: '2099-01-01T00:00:00.000Z',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const poisoned = new Proxy({} as LocalityRegistry, {
        get() {
          throw new Error('registry must not be consulted');
        },
      });
      const result = await runPipeline({
        registry: poisoned,
        localitySlug: 'poisoned-town',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      expect(result.status).toBe('skipped-overlap');
    } finally {
      await ds.destroy();
    }
  });

  it('turns heartbeat lease loss into a controlled failed run without an unhandled rejection', async () => {
    registerAdapter({
      name: 'runner-heartbeat-loss',
      async fetch(source) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return [
          {
            kind: 'fetched',
            status: 200,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'heartbeat' },
          },
        ];
      },
      async parse() {
        return [];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-heartbeat-loss-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-heartbeat-loss',
      name: 'Heartbeat',
      url: 'https://example.test/heartbeat',
      kind: 'news' as const,
    };
    const testRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source],
    };
    const ds = await dataSource();
    const unhandled: unknown[] = [];
    const listener = (error: unknown) => unhandled.push(error);
    process.on('unhandledRejection', listener);
    try {
      const run = runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
        heartbeatIntervalMs: 10,
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      await ds.getRepository(PipelineRunLeaseSchema).clear();
      const result = await run;
      expect(result.status).toBe('failed');
      expect(unhandled.length).toBe(0);
    } finally {
      process.off('unhandledRejection', listener);
      await ds.destroy();
    }
  });

  it('retains parsed records and quarantines a failed record as partial parse success', async () => {
    registerAdapter({
      name: 'runner-parse-partial',
      async fetch(source) {
        return [
          {
            kind: 'fetched',
            status: 200,
            url: `${source.url}/bad-1`,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'bad' },
          },
          {
            kind: 'fetched',
            status: 200,
            url: `${source.url}/bad-2`,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'bad' },
          },
          {
            kind: 'fetched',
            status: 200,
            url: `${source.url}/good`,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'good' },
          },
        ];
      },
      async parse(raw) {
        if (raw.url.includes('/bad-')) throw new Error('malformed record');
        return [
          {
            kind: 'news',
            title: 'Good parsed record',
            body: 'Retained',
            topics: ['general'],
            uris: [raw.url],
          },
        ];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-parse-partial-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-parse-partial',
      name: 'Parse Partial',
      url: 'https://example.test/parse-partial',
      kind: 'news' as const,
    };
    const testRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source],
    };
    const ds = await dataSource();
    try {
      const result = await runPipeline({
        registry: testRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      expect(
        result.stages.find((stage) => stage.stage === 'parse')?.status
      ).toBe('partial_success');
      expect(
        result.coverageGaps.some(
          (gap) => gap.stage === 'parse' && gap.sourceKey === source.sourceKey
        )
      ).toBeTruthy();
      expect(await ds.getRepository('CivicItem').count()).toBe(1);
      expect(
        (await ds.getRepository(FoundationQuarantineSchema).find()).filter(
          (row) => row.stage === 'parse' && row.sourceId === source.sourceKey
        ).length
      ).toBe(2);
    } finally {
      await ds.destroy();
    }
  });

  it('treats empty source results as successful processing for mixed and quiet editions', async () => {
    registerAdapter({
      name: 'runner-empty-source',
      async fetch(source) {
        if (source.url.endsWith('/failed'))
          return [
            {
              kind: 'failed',
              status: 503,
              url: source.url,
              requestUrl: source.url,
              contentType: 'text/plain',
              fetchedAt: new Date().toISOString(),
              error: { kind: 'http', message: '503', retryable: true },
            },
          ];
        return [];
      },
      async parse() {
        return [];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const emptySource = {
      sourceKey: 'runner-empty-source-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-empty-source',
      name: 'Empty',
      url: 'https://example.test/empty',
      kind: 'news' as const,
    };
    const failedSource = {
      ...emptySource,
      sourceKey: 'runner-empty-failed-key',
      name: 'Failed',
      url: 'https://example.test/failed',
    };
    const mixedRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [emptySource, failedSource],
    };
    const mixedDs = await dataSource();
    try {
      const mixed = await runPipeline({
        registry: mixedRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: mixedDs,
        summarizer,
      });
      expect(mixed.status).toBe('partial_success');
      expect(
        mixed.stages.find((stage) => stage.stage === 'gather')?.status
      ).toBe('partial_success');
    } finally {
      await mixedDs.destroy();
    }

    const quietRegistry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [
        emptySource,
        {
          ...emptySource,
          sourceKey: 'runner-empty-source-key-2',
          name: 'Empty 2',
          url: 'https://example.test/empty-2',
        },
      ],
    };
    const quietDs = await dataSource();
    try {
      const quiet = await runPipeline({
        registry: quietRegistry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: quietDs,
        summarizer,
      });
      expect(quiet.status).toBe('partial_success');
      expect(
        quiet.stages.find((stage) => stage.stage === 'gather')?.status
      ).toBe('partial_success');
      expect(
        quiet.stages.find((stage) => stage.stage === 'parse')?.status
      ).toBe('succeeded');
    } finally {
      await quietDs.destroy();
    }
  });

  it('classifies an empty restricted aggregate source as no recent aggregate result', async () => {
    registerAdapter({
      name: 'news-discover',
      async fetch() {
        return [];
      },
      async parse() {
        return [];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-restricted-zero-result-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'news-discover',
      name: 'Adel News-Tribune',
      url: 'https://news.google.com/search?q=adel',
      kind: 'news' as const,
      accessMode: 'snippet-only' as const,
      accessRestrictionReason:
        'Publisher crawler policy blocks automated AI retrieval',
      restrictionPolicyUrl: 'https://adelnews.example/robots.txt',
      aggregateDiscovery: true,
      aggregateUrl: 'https://news.google.com/search?q=adel',
      declaredInSlug: 'adel-ga' as const,
    };
    const ds = await dataSource();
    try {
      const result = await runPipeline({
        registry: { ...base, sourcesForRun: () => [source] },
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      const gap = result.coverageGaps.find(
        (candidate) => candidate.sourceKey === source.sourceKey
      );
      expect(gap?.reason).toBe('no recent aggregate result');
      expect(
        (gap as { accessRestrictionReason?: string } | undefined)
          ?.accessRestrictionReason
      ).toBe(source.accessRestrictionReason);
      expect(
        (gap as { restrictionPolicyUrl?: string } | undefined)
          ?.restrictionPolicyUrl
      ).toBe(source.restrictionPolicyUrl);
      expect((gap as { aggregateUrl?: string } | undefined)?.aggregateUrl).toBe(
        source.aggregateUrl
      );
    } finally {
      await ds.destroy();
    }
  });

  it('reclassifies aggregate fetch rows with zero parsed publisher items as no recent aggregate result', async () => {
    registerAdapter({
      name: 'news-discover',
      async fetch(source) {
        return [
          {
            kind: 'fetched',
            status: 200,
            url: `${source.url}/third-party`,
            requestUrl: source.url,
            contentType: 'application/json',
            fetchedAt: '2026-09-13T12:00:00.000Z',
            payload: {
              kind: 'text',
              body: JSON.stringify({ title: 'Third-party aggregate result' }),
            },
          },
        ];
      },
      async parse() {
        return [];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-restricted-aggregate-row-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'news-discover',
      name: 'Adel News-Tribune',
      url: 'https://news.google.com/search?q=adel',
      kind: 'news' as const,
      accessMode: 'snippet-only' as const,
      accessRestrictionReason:
        'Publisher crawler policy blocks automated AI retrieval',
      restrictionPolicyUrl: 'https://adelnews.example/robots.txt',
      aggregateDiscovery: true,
      aggregateUrl: 'https://news.google.com/search?q=adel',
    };
    const ds = await dataSource();
    try {
      const result = await runPipeline({
        registry: { ...base, sourcesForRun: () => [source] },
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      const gap = result.coverageGaps.find(
        (candidate) => candidate.sourceKey === source.sourceKey
      );
      expect(gap?.reason).toBe('no recent aggregate result');
      const persisted = await ds
        .getRepository(PipelineRunSchema)
        .findOneByOrFail({ id: result.runId });
      expect(persisted.coverageGaps).toMatch(/no recent aggregate result/);
      const persistedGather = await ds
        .getRepository(PipelineStageRunSchema)
        .findOneByOrFail({ runId: result.runId, stage: 'gather' });
      expect(persistedGather.coverageGaps).toMatch(
        /no recent aggregate result/
      );
    } finally {
      await ds.destroy();
    }
  });

  it('retains parse/source failure instead of relabeling a restricted aggregate source', async () => {
    registerAdapter({
      name: 'news-discover',
      async fetch(source) {
        return [
          {
            kind: 'fetched',
            status: 200,
            url: `${source.url}/bad`,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'bad' },
          },
          {
            kind: 'fetched',
            status: 200,
            url: `${source.url}/third-party`,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'third party' },
          },
        ];
      },
      async parse(raw) {
        if (raw.url.endsWith('/bad'))
          throw new Error('malformed aggregate record');
        return [
          {
            kind: 'news',
            title: 'Third-party local update',
            body: 'A durable third-party update with enough detail for projection.',
            topics: ['general'],
            uris: ['https://www.walb.com/local-update'],
            publisher: 'WALB',
            publishedAt: '2026-09-13T12:00:00.000Z',
          },
        ];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-restricted-parse-failure-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'news-discover',
      name: 'Adel News-Tribune',
      url: 'https://news.google.com/search?q=adel',
      kind: 'news' as const,
      accessMode: 'snippet-only' as const,
      config: { matchNames: ['Adel News-Tribune', 'Adel'] },
      accessRestrictionReason:
        'Publisher crawler policy blocks automated AI retrieval',
      restrictionPolicyUrl: 'https://www.adelnewstribune.com/robots.txt',
      aggregateDiscovery: true,
      aggregateUrl: 'https://news.google.com/search?q=adel',
    };
    const ds = await dataSource();
    try {
      const result = await runPipeline({
        registry: { ...base, sourcesForRun: () => [source] },
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      expect(
        result.coverageGaps.some(
          (gap) => gap.stage === 'parse' && gap.sourceKey === source.sourceKey
        )
      ).toBeTruthy();
      expect(
        result.coverageGaps.some(
          (gap) =>
            gap.stage === 'gather' &&
            gap.reason === 'no recent aggregate result'
        )
      ).toBe(false);
      const persistedGather = await ds
        .getRepository(PipelineStageRunSchema)
        .findOneByOrFail({ runId: result.runId, stage: 'gather' });
      expect(persistedGather.coverageGaps).not.toMatch(
        /no recent aggregate result/
      );
      expect(persistedGather.coverageGaps).toMatch(
        /source does not document date or pagination coverage capability/
      );
    } finally {
      await ds.destroy();
    }
  });

  it('treats a parser that emits no drafts as successful record processing', async () => {
    registerAdapter({
      name: 'runner-parse-empty-record',
      async fetch(source) {
        return [
          {
            kind: 'fetched',
            status: 200,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'fixture' },
          },
        ];
      },
      async parse(raw) {
        if (raw.url.endsWith('/parse-fail'))
          throw new Error('malformed record');
        return [];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const empty = {
      sourceKey: 'runner-parse-empty-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-parse-empty-record',
      name: 'Parse Empty',
      url: 'https://example.test/parse-empty',
      kind: 'news' as const,
    };
    const failed = {
      ...empty,
      sourceKey: 'runner-parse-failed-key',
      name: 'Parse Failed',
      url: 'https://example.test/parse-fail',
    };
    const ds = await dataSource();
    try {
      const result = await runPipeline({
        registry: { ...base, sourcesForRun: () => [empty, failed] },
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      expect(result.status).toBe('partial_success');
      expect(
        result.stages.find((stage) => stage.stage === 'parse')?.status
      ).toBe('partial_success');
      expect(
        result.stages.find((stage) => stage.stage === 'parse')?.counts[
          'successfulRecords'
        ]
      ).toBe(1);
    } finally {
      await ds.destroy();
    }
  });

  it('carries an empty gather outcome into parse without crediting a failing source', async () => {
    registerAdapter({
      name: 'runner-empty-parse-outcome',
      async fetch(source) {
        if (source.url.endsWith('/quiet')) return [];
        return [
          {
            kind: 'fetched',
            status: 200,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'fixture' },
          },
        ];
      },
      async parse() {
        throw new Error('parser failed');
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const quiet = {
      sourceKey: 'runner-empty-parse-quiet-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-empty-parse-outcome',
      name: 'Quiet',
      url: 'https://example.test/quiet',
      kind: 'news' as const,
    };
    const failing = {
      ...quiet,
      sourceKey: 'runner-empty-parse-failing-key',
      name: 'Failing',
      url: 'https://example.test/failing',
    };
    const ds = await dataSource();
    try {
      const result = await runPipeline({
        registry: { ...base, sourcesForRun: () => [quiet, failing] },
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      expect(result.status).toBe('partial_success');
      expect(
        result.stages.find((stage) => stage.stage === 'gather')?.status
      ).toBe('partial_success');
      expect(
        result.stages.find((stage) => stage.stage === 'parse')?.status
      ).toBe('partial_success');
      expect(
        result.stages.find((stage) => stage.stage === 'parse')?.counts[
          'successfulSources'
        ]
      ).toBe(1);
    } finally {
      await ds.destroy();
    }
  });

  it('does not credit parse success when durable civic-item persistence fails', async () => {
    registerAdapter({
      name: 'runner-parse-save-failure',
      async fetch(source) {
        return [
          {
            kind: 'fetched',
            status: 200,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: new Date().toISOString(),
            payload: { kind: 'text', body: 'fixture' },
          },
        ];
      },
      async parse() {
        return [
          {
            kind: 'news',
            title: 'Unpersisted item',
            body: 'Details',
            topics: ['general'],
          },
        ];
      },
    });
    const base = loadLocalityRegistry(
      join(__dirname, '..', 'fixtures', 'localities')
    );
    const source = {
      sourceKey: 'runner-parse-save-failure-key',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'runner-parse-save-failure',
      name: 'Persistence Failure',
      url: 'https://example.test/save-failure',
      kind: 'news' as const,
    };
    const ds = await dataSource();
    try {
      await ds.query(
        "CREATE FUNCTION fail_civic_item_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'civic item persistence failure'; END; $$"
      );
      await ds.query(
        'CREATE TRIGGER fail_civic_item_insert BEFORE INSERT ON civic_items FOR EACH ROW EXECUTE FUNCTION fail_civic_item_insert()'
      );
      const result = await runPipeline({
        registry: { ...base, sourcesForRun: () => [source] },
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizer,
      });
      expect(result.status).toBe('failed');
      expect(
        result.stages.find((stage) => stage.stage === 'parse')?.status
      ).toBe('failed');
      expect(
        result.stages.find((stage) => stage.stage === 'parse')?.counts[
          'successfulRecords'
        ] ?? 0
      ).toBe(0);
      expect(await ds.getRepository('CivicItem').count()).toBe(0);
    } finally {
      await ds.destroy();
    }
  });

  it('recovers only the lease it conditionally claims, preserving a concurrent heartbeat renewal', async () => {
    const { url } = await createTestSchema();
    const renewer = new DataSource({
      type: 'postgres',
      url,
      entities: FOUNDATION_SCHEMAS,
      synchronize: true,
    });
    const recovery = new DataSource({
      type: 'postgres',
      url,
      entities: FOUNDATION_SCHEMAS,
      synchronize: false,
    });
    await renewer.initialize();
    await recovery.initialize();
    try {
      const oldRun = await renewer.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-12T00:00:00.000Z',
        completedAt: null,
        status: 'running',
        currentStage: 'gather',
        ruleVersion: 'county-a.v1',
        counts: '{}',
        coverageGaps: '[]',
        error: null,
      });
      await renewer.getRepository(PipelineStageRunSchema).save({
        runId: oldRun.id as number,
        stage: 'gather',
        startedAt: '2026-09-12T00:00:00.000Z',
        completedAt: null,
        status: 'running',
        counts: '{}',
        coverageGaps: '[]',
        error: null,
      });
      await renewer.getRepository(PipelineRunLeaseSchema).save({
        scopeSlug: 'town-a',
        cadence: 'daily',
        ownerId: 'old-owner',
        runId: oldRun.id as number,
        leaseUntil: '2026-09-12T00:01:00.000Z',
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      });

      // Hold the renewal write open while recovery has already observed the
      // expired candidate. Its conditional claim must re-check after commit.
      const heartbeat = renewer.createQueryRunner();
      await heartbeat.connect();
      await heartbeat.startTransaction();
      await heartbeat.query(
        'UPDATE pipeline_run_leases SET "leaseUntil"=$1,"updatedAt"=$2 WHERE "scopeSlug"=$3 AND cadence=$4 AND "ownerId"=$5 AND "runId"=$6',
        [
          '2099-01-01T00:00:00.000Z',
          '2026-09-12T00:02:00.000Z',
          'town-a',
          'daily',
          'old-owner',
          oldRun.id,
        ]
      );
      const recovering = recoverExpired(
        recovery,
        new Date('2026-09-12T00:02:00.000Z')
      );
      await new Promise((resolve) => setTimeout(resolve, 25));
      await heartbeat.commitTransaction();
      await heartbeat.release();
      await recovering;
      expect(
        (
          await recovery
            .getRepository(PipelineRunSchema)
            .findOneBy({ id: oldRun.id })
        )?.status
      ).toBe('running');
      expect(
        (
          await recovery
            .getRepository(PipelineRunLeaseSchema)
            .findOneBy({ runId: oldRun.id })
        )?.ownerId
      ).toBe('old-owner');

      // Once the lease is actually expired again, recovery owns the terminal
      // transition and a late heartbeat cannot mutate the recovered run.
      await renewer
        .getRepository(PipelineRunLeaseSchema)
        .update(
          { runId: oldRun.id },
          { leaseUntil: '2026-09-12T00:01:00.000Z' }
        );
      await recoverExpired(recovery, new Date('2026-09-12T00:03:00.000Z'));
      expect(
        (
          await recovery
            .getRepository(PipelineRunSchema)
            .findOneBy({ id: oldRun.id })
        )?.status
      ).toBe('failed');
      expect(
        (
          await recovery
            .getRepository(PipelineStageRunSchema)
            .findOneBy({ runId: oldRun.id, stage: 'gather' })
        )?.status
      ).toBe('failed');
      expect(
        await recovery
          .getRepository(PipelineRunLeaseSchema)
          .countBy({ runId: oldRun.id })
      ).toBe(0);
      const lateHeartbeat = await renewer.query(
        'UPDATE pipeline_run_leases SET "leaseUntil"=$1 WHERE "scopeSlug"=$2 AND cadence=$3 AND "ownerId"=$4 AND "runId"=$5',
        ['2099-01-01T00:00:00.000Z', 'town-a', 'daily', 'old-owner', oldRun.id]
      );
      // TypeORM's postgres driver resolves a raw UPDATE as [rows, affectedCount].
      expect(lateHeartbeat[1]).toBe(0);
    } finally {
      await renewer.destroy();
      await recovery.destroy();
    }
  });
});
