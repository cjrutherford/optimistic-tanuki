import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';
import {
  appendCanonicalStoryRevision,
  closeDataSource,
  createFoundationDataSource,
  createLlmAttemptRecorder,
  getDataSource,
  persistLlmGeneration,
} from '@optimistic-tanuki/civic-core';
import {
  CanonicalStoryItemSchema,
  CanonicalStorySchema,
  CivicItemSchema,
  FoundationSourceSchema,
  LlmGenerationSchema,
  PipelineRunSchema,
} from '@optimistic-tanuki/civic-core';
import type { LlmAttemptRecord } from '../../src/contracts.js';
import { createOllamaSummarizer } from '../../src/index.js';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const OUTPUT_SHA = createHash('sha256')
  .update('raw successful output')
  .digest('hex');

describe('LLM generation provenance', () => {
  it('persists every operation attempt and makes an identical retry idempotent', async () => {
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-13T00:00:00Z',
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      const input = {
        runId: run.id!,
        localitySlug: 'town-a',
        operation: 'cluster' as const,
        model: 'test-model',
        status: 'failed' as const,
        attempt: 1,
        promptSha256: SHA_A,
        inputSha256: SHA_B,
        outputSha256: null,
        sourceKeys: ['source-a'],
        output: null,
        error: 'invalid output',
        generatedAt: '2026-09-13T00:00:01Z',
        latencyMs: 4,
      };
      const first = await persistLlmGeneration(ds, input);
      const second = await persistLlmGeneration(ds, input);
      expect(first.id).toBe(second.id);
      expect(await ds.getRepository(LlmGenerationSchema).count()).toBe(1);
      expect(
        (
          await ds
            .getRepository(LlmGenerationSchema)
            .findOneByOrFail({ id: first.id })
        ).sourceKeys
      ).toStrictEqual(JSON.stringify(['source-a']));
      await expect(
        (() =>
          persistLlmGeneration(ds, { ...input, model: 'different-model' }))()
      ).rejects.toThrow(/immutable|mismatch/i);
      await expect(
        (() =>
          ds
            .getRepository(LlmGenerationSchema)
            .update({ id: first.id }, { model: 'tampered' }))()
      ).rejects.toThrow(/append-only|immutable/i);
      await expect(
        (() => ds.getRepository(LlmGenerationSchema).delete({ id: first.id }))()
      ).rejects.toThrow(/append-only|immutable/i);
      await expect(
        (() =>
          ds.query(
            'INSERT INTO llm_generations ("runId", "localitySlug", operation, model, status, attempt, "promptSha256", "inputSha256", "sourceKeys", "generatedAt", "latencyMs") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
            [
              run.id,
              'town-a',
              'not-an-operation',
              'm',
              'failed',
              2,
              'p2',
              'i2',
              '[]',
              '2026-09-13T00:00:00Z',
              1,
            ]
          ))()
      ).rejects.toThrow(/CHECK|constraint|operation/i);
      await expect(
        (() =>
          ds.query(
            'INSERT INTO llm_generations ("runId", "localitySlug", operation, model, status, attempt, "promptSha256", "inputSha256", "sourceKeys", "generatedAt", "latencyMs") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
            [
              null,
              'town-a',
              'cluster',
              'm',
              'failed',
              2,
              'p2',
              'i2',
              '[]',
              '2026-09-13T00:00:00Z',
              1,
            ]
          ))()
      ).rejects.toThrow(/NOT NULL|constraint/i);
    } finally {
      await ds.destroy();
    }
  });

  it('records a two-stage brief plan as a brief generation marked stage=plan', async () => {
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-13T00:00:00Z',
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      const row = await persistLlmGeneration(ds, {
        runId: run.id!,
        localitySlug: 'town-a',
        operation: 'brief_plan' as never,
        model: 'planner',
        status: 'failed',
        attempt: 1,
        promptSha256: SHA_A,
        inputSha256: SHA_B,
        outputSha256: null,
        sourceKeys: ['source-a'],
        output: null,
        error: 'no matters',
        generatedAt: '2026-09-13T00:00:01Z',
        latencyMs: 4,
        generationSettings: JSON.stringify({
          temperature: 0,
          seed: 17,
          numCtx: 16384,
        }),
      });
      const stored = await ds
        .getRepository(LlmGenerationSchema)
        .findOneByOrFail({ id: row.id });
      expect(stored.operation).toBe('brief');
      expect(JSON.parse(stored.generationSettings ?? '{}')).toStrictEqual({
        temperature: 0,
        seed: 17,
        numCtx: 16384,
        stage: 'plan',
      });
    } finally {
      await ds.destroy();
    }
  });

  it('rejects an operation outside the exact provenance vocabulary', async () => {
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      await expect(
        (() =>
          persistLlmGeneration(ds, {
            runId: 1,
            localitySlug: 'town-a',
            operation: 'extract' as never,
            model: 'test',
            status: 'failed',
            attempt: 1,
            promptSha256: SHA_A,
            inputSha256: SHA_B,
            outputSha256: null,
            sourceKeys: ['source-a'],
            output: null,
            error: 'bad',
            generatedAt: '2026-09-13T00:00:00Z',
            latencyMs: 1,
          }))()
      ).rejects.toThrow(/operation/i);
    } finally {
      await ds.destroy();
    }
  });

  it('canonicalizes provenance and rejects malformed hashes, timestamps, source keys, status payloads, and latency', async () => {
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-13T00:00:00Z',
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      const valid = {
        runId: run.id!,
        localitySlug: 'town-a',
        operation: 'cluster' as const,
        model: 'model',
        status: 'failed' as const,
        attempt: 1,
        promptSha256: SHA_A,
        inputSha256: SHA_B,
        outputSha256: null,
        sourceKeys: ['z-source', 'a-source', 'a-source'],
        output: null,
        error: 'failed',
        generatedAt: '2026-09-13T00:00:00.000Z',
        latencyMs: 0,
      };
      const canonical = await persistLlmGeneration(ds, valid);
      expect(canonical.promptSha256).toBe(SHA_A);
      expect(canonical.sourceKeys).toBe(
        JSON.stringify(['a-source', 'z-source'])
      );
      for (const malformed of [
        { ...valid, attempt: 2, promptSha256: 'bad' },
        { ...valid, attempt: 3, inputSha256: 'not-a-sha' },
        { ...valid, attempt: 4, sourceKeys: 'not-json' },
        { ...valid, attempt: 5, sourceKeys: [] },
        { ...valid, attempt: 6, generatedAt: 'tomorrow' },
        { ...valid, attempt: 7, latencyMs: Number.NaN },
        { ...valid, attempt: 8, latencyMs: -1 },
        { ...valid, attempt: 9, error: null },
        { ...valid, attempt: 10, status: 'invalid' as const, error: '' },
        {
          ...valid,
          attempt: 11,
          status: 'succeeded' as const,
          output: 'hello',
          outputSha256: null,
          error: null,
        },
        {
          ...valid,
          attempt: 12,
          status: 'succeeded' as const,
          output: 'hello',
          outputSha256: SHA_A,
          error: null,
        },
        {
          ...valid,
          attempt: 13,
          status: 'succeeded' as const,
          output: 'hello',
          outputSha256: createHash('sha256').update('hello').digest('hex'),
          error: 'unexpected error',
        },
      ])
        expect((() => persistLlmGeneration(ds, malformed))()).rejects.toThrow(
          /SHA|sourceKeys|timestamp|latency|error|output|status/i
        );
      const uppercase = await persistLlmGeneration(ds, {
        ...valid,
        attempt: 14,
        promptSha256: SHA_A.toUpperCase(),
        inputSha256: SHA_B.toUpperCase(),
      });
      expect(uppercase.promptSha256).toBe(SHA_A);
      expect(uppercase.inputSha256).toBe(SHA_B);
    } finally {
      await ds.destroy();
    }
  });

  it('maps a strict attempt callback through a run-scoped recorder', async () => {
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-13T00:00:00Z',
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      const recorder = createLlmAttemptRecorder(ds, {
        runId: run.id!,
        localitySlug: 'town-a',
      });
      const row = await recorder.record({
        operation: 'brief',
        model: 'test-model',
        status: 'failed',
        attempt: 1,
        promptSha256: SHA_A,
        inputSha256: SHA_B,
        sourceKeys: ['source-a'],
        error: new Error('refusal'),
        generatedAt: '2026-09-13T00:00:01Z',
        latencyMs: 7,
      });
      expect(row.runId).toBe(run.id);
      expect(row.error).toBe('Error: refusal');
      expect(row.status).toBe('failed');
      const successful: LlmAttemptRecord = {
        runId: String(run.id),
        operation: 'brief',
        model: 'test-model',
        status: 'succeeded',
        attempt: 2,
        promptSha256: SHA_A,
        inputSha256: SHA_B,
        outputSha256: OUTPUT_SHA,
        sourceKeys: ['source-a'],
        output: 'raw successful output',
        generatedAt: '2026-09-13T00:00:02Z',
        latencyMs: 9,
        raw: { transport: 'diagnostic' },
      };
      const successfulRow = await recorder.record(successful);
      expect(successfulRow.output).toBe('raw successful output');
      expect(successfulRow.status).toBe('successful');
    } finally {
      await ds.destroy();
    }
  });

  it('opens a legacy-style database without synchronizing foundation tables', async () => {
    const { url } = await createTestSchema();
    const legacy = new DataSource({ type: 'postgres', url });
    try {
      await legacy.initialize();
      await legacy.query(
        'CREATE TABLE legacy_marker (id SERIAL PRIMARY KEY, value TEXT NOT NULL)'
      );
      await legacy.query(
        "INSERT INTO legacy_marker (value) VALUES ('protected')"
      );
      await legacy.destroy();

      const opened = await getDataSource(url);
      try {
        const tables = await opened.query(
          'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()'
        );
        expect(
          tables.some((row: { name: string }) => row.name === 'llm_generations')
        ).toBe(false);
        expect(
          tables.some(
            (row: { name: string }) => row.name === 'canonical_story_revisions'
          )
        ).toBe(false);
        expect(
          tables.some(
            (row: { name: string }) => row.name === 'story_revision_citations'
          )
        ).toBe(false);
        expect(await opened.query('SELECT * FROM legacy_marker')).toStrictEqual(
          [{ id: 1, value: 'protected' }]
        );
        expect(tables.map((row: { name: string }) => row.name)).toStrictEqual([
          'legacy_marker',
        ]);
      } finally {
        await closeDataSource();
      }
    } finally {
      if (legacy.isInitialized) await legacy.destroy();
    }
  });

  it('requires the recorder to use an independent DataSource boundary', async () => {
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    const runner = ds.createQueryRunner();
    await runner.connect();
    try {
      expect(() =>
        createLlmAttemptRecorder(runner.manager as never, {
          runId: 1,
          localitySlug: 'town-a',
        })
      ).toThrow(/DataSource|persistence boundary/i);
    } finally {
      await runner.release();
      await ds.destroy();
    }
  });

  it('resolves concurrent two-DataSource idempotency races and rejects a conflicting winner', async () => {
    const database = (await createTestSchema()).url;
    const first = await createFoundationDataSource(database);
    const second = await createFoundationDataSource(database);
    const run = await first.getRepository(PipelineRunSchema).save({
      scopeSlug: 'town-a',
      localitySlug: 'town-a',
      cadence: 'daily',
      startedAt: '2026-09-13T00:00:00Z',
      status: 'running',
      ruleVersion: 'v1',
      counts: '{}',
      coverageGaps: '[]',
      coverageRanges: '{}',
    });
    const input = {
      runId: run.id!,
      localitySlug: 'town-a',
      operation: 'story' as const,
      model: 'race-model',
      status: 'failed' as const,
      attempt: 1,
      promptSha256: SHA_A,
      inputSha256: SHA_B,
      outputSha256: null,
      sourceKeys: ['source-a'],
      output: null,
      error: 'race failure',
      generatedAt: '2026-09-13T00:00:01Z',
      latencyMs: 4,
    };
    const originalGets = [first, second].map((dataSource) =>
      dataSource.getRepository.bind(dataSource)
    );
    let reads = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    [first, second].forEach((dataSource, index) => {
      let firstRead = true;
      const originalGet = originalGets[index]!;
      dataSource.getRepository = ((target: typeof LlmGenerationSchema) => {
        const repo = originalGet(target);
        if (target === LlmGenerationSchema && firstRead) {
          firstRead = false;
          const originalFind = repo.findOneBy.bind(repo);
          repo.findOneBy = async (
            ...args: Parameters<typeof repo.findOneBy>
          ) => {
            reads += 1;
            if (reads === 2) release();
            await barrier;
            return originalFind(...args);
          };
        }
        return repo;
      }) as typeof dataSource.getRepository;
    });
    try {
      const same = await Promise.all([
        persistLlmGeneration(first, input),
        persistLlmGeneration(second, input),
      ]);
      expect(same[0]!.id).toBe(same[1]!.id);
      expect(await first.getRepository(LlmGenerationSchema).count()).toBe(1);

      reads = 0;
      let conflictRelease!: () => void;
      const conflictBarrier = new Promise<void>((resolve) => {
        conflictRelease = resolve;
      });
      [first, second].forEach((dataSource, index) => {
        const originalGet = originalGets[index]!;
        let firstRead = true;
        dataSource.getRepository = ((target: typeof LlmGenerationSchema) => {
          const repo = originalGet(target);
          if (target === LlmGenerationSchema && firstRead) {
            firstRead = false;
            const originalFind = repo.findOneBy.bind(repo);
            repo.findOneBy = async (
              ...args: Parameters<typeof repo.findOneBy>
            ) => {
              reads += 1;
              if (reads === 2) conflictRelease();
              await conflictBarrier;
              return originalFind(...args);
            };
          }
          return repo;
        }) as typeof dataSource.getRepository;
      });
      const outcomes = await Promise.allSettled([
        persistLlmGeneration(first, {
          ...input,
          model: 'conflict-a',
          attempt: 2,
          promptSha256: SHA_A,
          inputSha256: 'c'.repeat(64),
        }),
        persistLlmGeneration(second, {
          ...input,
          model: 'conflict-b',
          attempt: 2,
          promptSha256: SHA_A,
          inputSha256: 'c'.repeat(64),
        }),
      ]);
      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled').length
      ).toBe(1);
      expect(
        outcomes.filter(
          (outcome) =>
            outcome.status === 'rejected' &&
            /immutable|mismatch/i.test(String(outcome.reason))
        ).length
      ).toBe(1);
    } finally {
      await first.destroy();
      await second.destroy();
    }
  });

  it('persists explicit Ollama source keys/output and failed-attempt diagnostics through the recorder', async () => {
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-13T00:00:00Z',
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      const recorder = createLlmAttemptRecorder(ds, {
        runId: run.id!,
        localitySlug: 'town-a',
      });
      const responseBody = JSON.stringify({
        model: 'fake-model',
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: 'Road update',
                summary: 'Road work begins.',
                whyItMatters: 'Residents can plan.',
                citations: [{ sourceKey: 'town-news', civicItemId: 17 }],
              }),
            },
          },
        ],
      });
      const successful = createOllamaSummarizer({
        baseUrl: 'http://fake.local/v1',
        primary: 'fake-model',
        fallback: 'fake-model',
        runId: String(run.id),
        fetchImpl: async () => new Response(responseBody, { status: 200 }),
        recordAttempt: async (attempt) => {
          await recorder.record(attempt);
        },
      });
      await successful.summarizeCluster({
        kind: 'news',
        topic: 'roads',
        items: [
          {
            sourceKey: 'town-news',
            civicItemId: 17,
            title: 'Road update',
            body: 'Road work begins.',
          },
        ],
      });
      const successRow = await ds
        .getRepository(LlmGenerationSchema)
        .findOneByOrFail({
          runId: run.id!,
          operation: 'cluster',
          attempt: 1,
          inputSha256: successful.attempts[0]!.inputSha256,
        });
      expect(JSON.parse(successRow.sourceKeys)).toStrictEqual(['town-news']);
      expect(successRow.output).toBe(
        JSON.parse(responseBody).choices[0].message.content
      );
      expect(successRow.status).toBe('successful');
      expect(successRow.promptSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(successRow.inputSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(successRow.outputSha256 ?? '').toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.parse(successRow.generationSettings ?? '{}')).toStrictEqual({
        temperature: 0,
        seed: 17,
        numCtx: 16384,
      });

      const failing = createOllamaSummarizer({
        baseUrl: 'http://fake.local/v1',
        primary: 'fake-model',
        fallback: 'fake-model',
        runId: String(run.id),
        fetchImpl: async () =>
          new Response('upstream unavailable', { status: 503 }),
        recordAttempt: async (attempt) => {
          await recorder.record(attempt);
        },
      });
      await expect(
        (() =>
          failing.summarizeCluster({
            kind: 'news',
            topic: 'bridges',
            items: [
              {
                sourceKey: 'town-news',
                civicItemId: 18,
                title: 'Bridge update',
                body: 'Bridge work begins.',
              },
            ],
          }))()
      ).rejects.toThrow();
      const failureRow = await ds
        .getRepository(LlmGenerationSchema)
        .findOneByOrFail({
          runId: run.id!,
          operation: 'cluster',
          attempt: 1,
          inputSha256: failing.attempts[0]!.inputSha256,
        });
      expect(JSON.parse(failureRow.sourceKeys)).toStrictEqual(['town-news']);
      expect(failureRow.status).toBe('failed');
      expect(failureRow.output).toBe(null);
      expect(failureRow.error ?? '').toMatch(/gateway|unavailable|503/i);
      expect(failureRow.model).toBe('fake-model');
      expect(failureRow.latencyMs >= 0).toBeTruthy();
    } finally {
      await ds.destroy();
    }
  });

  it('appends a revision from a real Ollama story attempt persisted by the recorder', async () => {
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      const source = await ds.getRepository(FoundationSourceSchema).save({
        id: 'town-news',
        sourceKey: 'town-news',
        ownerSlug: 'town-a',
        coverage: 'mentions',
        adapter: 'test',
        name: 'Town News',
        url: 'https://example.test',
        kind: 'news',
        enabled: true,
      });
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-13T00:00:00Z',
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      const item = await ds.getRepository(CivicItemSchema).save({
        sourceId: source.id,
        localitySlug: 'town-a',
        scopeSlug: 'town-a',
        kind: 'news',
        title: 'Road update',
        body: 'Road work begins.',
        hash: 'story-attempt-item',
        createdAt: '2026-09-13T00:00:00Z',
      });
      const story = await ds.getRepository(CanonicalStorySchema).save({
        scopeSlug: 'town-a',
        scopeKind: 'town',
        storyKey: 'roads',
        strategy: 'fallback',
        title: 'Roads',
        status: 'open',
        createdAt: '2026-09-13T00:00:00Z',
        updatedAt: '2026-09-13T00:00:00Z',
      });
      await ds.getRepository(CanonicalStoryItemSchema).save({
        canonicalStoryId: story.id!,
        civicItemId: item.id!,
        createdAt: '2026-09-13T00:00:00Z',
      });
      const output = JSON.stringify({
        title: 'Road update',
        claims: [
          {
            text: 'Road work begins and residents should plan around construction.',
            citations: [{ sourceKey: 'town-news', civicItemId: item.id }],
          },
        ],
        status: 'ongoing',
      });
      const recorder = createLlmAttemptRecorder(ds, {
        runId: run.id!,
        localitySlug: 'town-a',
      });
      const summarizer = createOllamaSummarizer({
        baseUrl: 'http://fake.local/v1',
        primary: 'story-model',
        fallback: 'story-model',
        runId: String(run.id),
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              model: 'story-model',
              choices: [{ message: { content: output } }],
            }),
            { status: 200 }
          ),
        recordAttempt: async (attempt) => {
          await recorder.record(attempt);
        },
      });
      const result = await summarizer.developStory({
        topicKey: 'roads',
        events: [
          {
            sourceKey: 'town-news',
            civicItemId: item.id!,
            heading: 'Roads',
            body: 'Road work begins.',
          },
        ],
      });
      const attempt = summarizer.attempts[0]!;
      const generation = await ds
        .getRepository(LlmGenerationSchema)
        .findOneByOrFail({
          runId: run.id!,
          operation: 'story',
          inputSha256: attempt.inputSha256,
          attempt: 1,
        });
      const revision = await appendCanonicalStoryRevision(ds, {
        canonicalStoryId: story.id!,
        status: 'successful',
        title: result.title,
        narrative: result.narrative,
        storyStatus: result.status,
        generationId: generation.id!,
        inputSha256: generation.inputSha256,
        createdAt: '2026-09-13T00:00:02Z',
        citations: [{ civicItemId: item.id! }],
        publicationReceipt: {
          path: '/artifacts/roads.md',
          sha256: 'a'.repeat(64),
          token: 'receipt',
        },
      });
      expect(revision.generationId).toBe(generation.id);
      expect(
        (
          await ds
            .getRepository(CanonicalStorySchema)
            .findOneByOrFail({ id: story.id! })
        ).currentRevisionId
      ).toBe(revision.id);
      expect(generation.status).toBe('successful');
      expect(JSON.parse(generation.sourceKeys)).toStrictEqual(['town-news']);
      expect(generation.output).toBe(output);
    } finally {
      await ds.destroy();
    }
  });
});
