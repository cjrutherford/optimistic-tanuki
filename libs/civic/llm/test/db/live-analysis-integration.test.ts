import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { DataSource } from 'typeorm';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  renderAnalysisClaim,
  sha256,
  buildAgendaEvidenceEvents,
} from '@optimistic-tanuki/civic-core';
import { extractAgenda } from '@optimistic-tanuki/civic-core';
import { assembleOutsiderBriefing } from '@optimistic-tanuki/civic-core';
import { runPipeline } from '@optimistic-tanuki/civic-core';
import {
  appendCanonicalStoryRevisions,
  createLlmAttemptRecorder,
} from '@optimistic-tanuki/civic-core';
import { loadLocalityRegistry } from '@optimistic-tanuki/civic-core';
import { registerAdapter } from '@optimistic-tanuki/civic-core';
import {
  FOUNDATION_SCHEMAS,
  AgendaItemSchema,
  BriefingSchema,
  CanonicalStoryItemSchema,
  CanonicalStoryRevisionSchema,
  CanonicalStorySchema,
  CivicItemSchema,
  EditionItemSchema,
  LlmGenerationSchema,
  PipelineRunSchema,
  SourceSchema,
  StoryRevisionCitationSchema,
} from '@optimistic-tanuki/civic-core';
import {
  createTestDataSource,
  withTestDataSource,
} from '@optimistic-tanuki/civic-core/testing';
import type { LocalityRegistry } from '@optimistic-tanuki/civic-core';
import type { SourceConfig, Summarizer } from '@optimistic-tanuki/civic-core';
import { createOllamaSummarizer } from '../../src/index.js';

function responseFor(
  prompt: string,
  failStory = false,
  failBrief = false,
  storySuffix = ''
): string {
  if (failStory && /Develop a factual story/u.test(prompt))
    throw new Error('fixture story model unavailable');
  const articlePrompt = /short local news article/u.test(prompt);
  if (failBrief && articlePrompt)
    throw new Error('fixture brief model unavailable');
  const citations = [
    ...prompt.matchAll(
      /sourceKey=([^\n]+)\ncivicItemId=(\d+)(?:\nagendaItemId=(\d+))?/gu
    ),
  ].map((match) => ({
    sourceKey: match[1],
    civicItemId: Number(match[2]),
    ...(match[3] ? { agendaItemId: Number(match[3]) } : {}),
  }));
  const unique = [
    ...new Map(
      citations.map((citation) => [
        `${citation.sourceKey}\u0000${citation.civicItemId}\u0000${
          citation.agendaItemId ?? ''
        }`,
        citation,
      ])
    ).values(),
  ];
  if (/with headline, summary, whyItMatters/u.test(prompt))
    return JSON.stringify({
      headline: 'Adel bridge project update',
      summary: 'The Adel bridge project update changed.',
      whyItMatters: 'Residents can follow the stored source for details.',
      citations: unique,
    });
  if (articlePrompt)
    return JSON.stringify({
      headline: 'Adel bridge project update',
      paragraphs: [
        {
          claims: [
            {
              text: 'The Adel bridge project update changed and residents can follow the source.',
              citations: unique.slice(0, 1),
            },
          ],
        },
      ],
    });
  if (/claims/u.test(prompt))
    return JSON.stringify({
      title: 'Adel bridge project update',
      claims: [
        {
          text: `The Adel bridge project update remains ongoing.${storySuffix}`,
          citations: unique,
        },
      ],
      status: 'ongoing',
    });
  return JSON.stringify({
    title: 'A local reporting thread',
    narrative:
      'The local reporting records describe an ongoing matter for residents.',
    status: 'ongoing',
    citations: unique,
  });
}

interface CapturedLlmInput {
  operation: 'cluster' | 'brief' | 'story';
  runId: number;
  evidence: {
    sourceKey: string;
    civicItemId: number;
    sourceName?: string;
    publisher?: string;
    localitySlug?: string;
    scopeSlug?: string;
    scopeKind?: string;
    body?: string;
  }[];
}

function strictFixtureSummarizer(
  ds: DataSource,
  runId: number,
  failStory = false,
  failBrief = false,
  captured?: CapturedLlmInput[],
  storySuffix = ''
): Summarizer {
  const recorder = createLlmAttemptRecorder(ds, {
    runId,
    localitySlug: 'adel-ga',
  });
  return createOllamaSummarizer({
    strict: true,
    runId: String(runId),
    baseUrl: 'http://fixture-ollama.test/v1',
    primary: 'fixture-model',
    fallback: 'fixture-model',
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        messages?: { content?: string }[];
      };
      const prompt = body.messages?.at(-1)?.content ?? '';
      const operation = /with headline, summary, whyItMatters/u.test(prompt)
        ? 'cluster'
        : /short local news article/u.test(prompt)
        ? 'brief'
        : 'story';
      const evidence = [
        ...new Map(
          [
            ...prompt.matchAll(
              /sourceKey=([^\n]+)\ncivicItemId=(\d+)[\s\S]*?(?:^|\n)sourceName=([^\n]+)[\s\S]*?(?:^|\n)publisher=([^\n]+)[\s\S]*?(?:^|\n)localitySlug=([^\n]+)[\s\S]*?(?:^|\n)scopeSlug=([^\n]+)[\s\S]*?(?:^|\n)scopeKind=([^\n]+)[\s\S]*?(?:^|\n)body=([^\n]*)/gmu
            ),
          ].map(
            (match) =>
              [
                `${match[1]}\u0000${match[2]}`,
                {
                  sourceKey: match[1]!,
                  civicItemId: Number(match[2]),
                  sourceName: match[3]!,
                  publisher: match[4]!,
                  localitySlug: match[5]!,
                  scopeSlug: match[6]!,
                  scopeKind: match[7]!,
                  body: match[8]!,
                },
              ] as const
          )
        ).values(),
      ];
      captured?.push({ operation, runId, evidence });
      return new Response(
        JSON.stringify({
          model: 'fixture-model',
          choices: [
            {
              message: {
                content: responseFor(prompt, failStory, failBrief, storySuffix),
              },
            },
          ],
        }),
        { status: 200 }
      );
    },
    recordAttempt: async (attempt) => {
      await recorder.record(attempt);
    },
  }) as unknown as Summarizer;
}

function fixtureRegistry(): {
  registry: LocalityRegistry;
  source: SourceConfig;
} {
  const base = loadLocalityRegistry(
    join(__dirname, '../../../core/test/fixtures/localities')
  );
  const source = {
    sourceKey: 'live-integration-news',
    ownerSlug: 'adel-ga',
    coverage: 'mentions' as const,
    adapter: 'live-integration-news',
    name: 'Fixture local reporting',
    url: 'https://fixture.test/adel-news',
    kind: 'news' as const,
    desk: 'community-news' as const,
    accessMode: 'full' as const,
    aggregateDiscovery: false as const,
    coverageCapabilities: {
      dateQuery: { parameter: 'from', format: 'YYYY-MM-DD' as const },
    },
  };
  return { registry: { ...base, sourcesForRun: () => [source] }, source };
}

function registerLiveSource(): { setVariant(variant: string): void } {
  let variant = '';
  registerAdapter({
    name: 'live-integration-news',
    async fetch(source) {
      return [1, 2].map((index) => ({
        kind: 'fetched' as const,
        status: 200 as const,
        url: `${source.url}/${index}`,
        requestUrl: source.url,
        contentType: 'text/plain',
        fetchedAt: '2026-09-12T12:00:00.000Z',
        observedDates: ['2026-09-12'],
        payload: {
          kind: 'text' as const,
          body: `fixture article ${index}${variant}`,
        },
      }));
    },
    async parse(raw) {
      const index = raw.url.endsWith('/2') ? 2 : 1;
      const payloadBody = raw.payload.kind === 'text' ? raw.payload.body : '';
      return [
        {
          kind: 'news' as const,
          title: `Adel bridge project update ${index}`,
          body: `The Adel bridge project update ${index} reports the same bridge construction matter for residents and includes the latest public status. ${'The bridge crews posted another detailed schedule update for residents. '.repeat(
            40
          )} ${payloadBody}`,
          publishedAt: '2026-09-12T15:00:00.000Z',
          topics: ['bridge'],
          uris: [raw.url],
          canonicalUrl: raw.url,
          publisher: 'Fixture Publisher',
        },
      ];
    },
  });
  return {
    setVariant(value: string): void {
      variant = value;
    },
  };
}

describe('strict analysis rendering boundary', () => {
  it('binds every Tifton agenda timeline row to its own extracted body', () => {
    const original = {
      id: 126,
      sourceId: 'tifton-documents',
      title: 'City Council Agenda 09/08/2026',
      body: 'Award Recommendation. Zoning Application PP26-0016. Resolution granting enterprise zone incentives. Ordinance amendment. Public comments. Project update. Utility discussion. Adjournment. City Council Agenda 08/17/2026 festival resolution public comments.',
      kind: 'meeting',
      accessMode: 'full',
      titleOrigin: null,
    } as unknown as import('@optimistic-tanuki/civic-core').CivicItemRow;
    const rows = [
      ...Array.from({ length: 7 }, (_, index) => ({
        itemId: 126,
        sourceKey: 'tifton-documents',
        topicKey: `topic:agenda-${index + 2}`,
        meetingDate: '2026-09-08',
        heading: `Item ${index + 2} — ${
          [
            'Zoning Application PP26-0016',
            'Resolution granting enterprise zone incentives',
            'Ordinance amendment',
            'Public comments',
            'Project update',
            'Utility discussion',
            'Adjournment',
          ][index]
        }`,
        body: `09/08 item ${
          index + 2
        } has its distinct agenda evidence and substantive details.`,
        itemTitle: original.title,
        uris: ['https://example.test/tifton-agenda'],
        canonicalUrl: 'https://example.test/tifton-agenda',
      })),
      {
        itemId: 126,
        sourceKey: 'tifton-documents',
        topicKey: 'topic:aug17',
        meetingDate: '2026-08-17',
        heading: 'August 17 award recommendation',
        body: '08/17 item has a separate award recommendation agenda description and substantive details.',
        itemTitle: 'City Council Agenda 08/17/2026',
        uris: ['https://example.test/tifton-agenda'],
        canonicalUrl: 'https://example.test/tifton-agenda',
      },
    ];
    const events = buildAgendaEvidenceEvents(
      rows,
      new Map([[126, original]]),
      new Map([['tifton-documents', 'Tifton city documents']])
    );
    expect(new Set(events.map((event) => event.body)).size).toBe(rows.length);
    expect(events[0]!.body).toMatch(/09\/08 item 2/);
    expect(events[6]!.body).toMatch(/09\/08 item 8/);
    expect(events[7]!.body).toMatch(/08\/17 item/);
    expect(events.map((event) => event.civicItemId)).toStrictEqual(
      rows.map(() => 126)
    );
    expect(events[0]!.title).toBe('Agenda item');
    expect(events[0]!.parentDocumentContext).toStrictEqual({
      title: original.title,
      body: original.body,
    });
  });

  it('derives direct links from stored evidence and renders restricted-source disclosure', () => {
    const markdown = renderAnalysisClaim(
      'A county road project remains under review.',
      [
        {
          sourceKey: 'adel-news-tribune',
          civicItemId: 7,
          articleUrl: 'https://model.invalid/forged',
          snippetOnly: true,
        },
      ],
      'The publisher snippet does not establish the final decision.',
      new Map([
        [
          7,
          {
            id: 7,
            sourceId: 'adel-news-tribune',
            canonicalUrl: 'https://publisher.example/road-story',
            uris: null,
            unresolvedAggregateLink: false,
            accessMode: 'snippet-only',
            title: 'Road project',
            body: 'Snippet body',
            kind: 'news',
            localitySlug: 'adel-ga',
            hash: 'h',
            createdAt: '2026-09-12',
          } as never,
        ],
      ]),
      true
    );
    expect(markdown).toMatch(/Discovery\/coverage note/);
    expect(markdown).toMatch(/https:\/\/publisher\.example\/road-story/);
    expect(markdown).not.toMatch(/model\.invalid/);
    expect(markdown).toMatch(
      /publisher’s crawler policy blocks automated AI retrieval/
    );
  });

  it('rejects an analysis citation that has no direct stored article link', () => {
    expect(() =>
      renderAnalysisClaim(
        'An unsupported claim.',
        [{ sourceKey: 'source-a', civicItemId: 1 }],
        undefined,
        new Map([
          [
            1,
            {
              id: 1,
              sourceId: 'source-a',
              canonicalUrl: null,
              uris: null,
            } as never,
          ],
        ])
      )
    ).toThrow(/no direct stored article URL/);
  });

  it('passes structured agenda evidence identity to fixup and keeps its failure non-blocking', async () => {
    await withTestDataSource(async (ds) => {
      const body = `Agenda ${'background '.repeat(
        80
      )} Proposal One Proposal Two`;
      const item = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'adel-documents',
        localitySlug: 'adel-ga',
        kind: 'meeting',
        title: 'Meeting 09/12/2026',
        body,
        eventDate: '2026-09-12',
        publishedAt: null,
        topics: null,
        uris: null,
        hash: 'agenda-structured',
        createdAt: '2026-09-12T10:00:00Z',
      });
      let received: unknown;
      const result = await extractAgenda(
        ds,
        'adel-ga',
        async (input) => {
          received = input;
          throw new Error('agenda model unavailable');
        },
        { start: '2026-09-12', end: '2026-09-13' },
        'America/New_York',
        42
      );
      expect(received).toStrictEqual({
        body,
        sourceKey: 'adel-documents',
        civicItemId: item.id,
        runId: '42',
      });
      expect(result.fixupFailures).toBe(1);
      expect(await ds.getRepository(AgendaItemSchema).count()).toBe(1);
    });
  });
});

describe('strict live pipeline production flow', () => {
  it('keeps all-snippet claims out of the lead and labels discovery coverage adjacent to sources', () => {
    const disclosure =
      'Limited-access source: the publisher’s crawler policy blocks automated AI retrieval of the article body. This briefing analyzed only the headline and third-party snippet; details may be incomplete. Read the full article directly: [article](https://publisher.test/story)';
    const markdown = assembleOutsiderBriefing({
      locality: 'Adel, GA',
      periodStart: '2026-09-12',
      periodEnd: '2026-09-13',
      lede: 'One item tracked.',
      inBrief: [],
      discoveryNotes: [
        `Discovery/coverage note (limited-access source): Headline only. ${disclosure}`,
      ],
      newItems: [
        {
          title: 'Headline only',
          url: 'https://publisher.test/story',
          impact: disclosure,
        },
      ],
      upcoming: [],
      threads: [
        {
          heading: 'Headline thread',
          history: 'Headline history.',
          meetings: ['2026-09-12'],
          disclosure,
          links: [
            { title: 'Headline only', url: 'https://publisher.test/story' },
          ],
        },
      ],
      appendix: [],
      sourceCount: 1,
      model: 'fixture',
    });
    const inBrief =
      markdown.split('## The lead')[1]?.split('## New this week')[0] ?? '';
    expect(inBrief).not.toMatch(/Headline only/);
    expect(markdown).toMatch(/## Discovery \/ coverage notes/);
    expect(markdown).toMatch(
      /publisher’s crawler policy blocks automated AI retrieval/
    );
    expect(markdown).toMatch(/publisher\.test\/story/);
  });

  it('persists run-scoped generations, briefing provenance, story revision and citations', async () => {
    registerLiveSource();
    const { registry } = fixtureRegistry();
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(join(tmpdir(), 'civic-live-flow-'));
    const captured: CapturedLlmInput[] = [];
    try {
      const result = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId, false, false, captured),
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(
        ['succeeded', 'partial_success'].includes(result.status)
      ).toBeTruthy();
      expect(result.briefingId).toBeTruthy();
      const briefing = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: result.briefingId });
      expect(briefing.runId).toBe(result.runId);
      expect(briefing.markdown).toMatch(/Adel bridge project update changed/);
      expect(briefing.markdown).toMatch(/fixture.test\/adel-news\/1/);
      expect(briefing.markdown).toMatch(/Brief generation: \d+/);
      const generations = await ds
        .getRepository(LlmGenerationSchema)
        .find({ where: { runId: result.runId }, order: { id: 'ASC' } });
      expect(
        generations.some(
          (generation) =>
            generation.operation === 'cluster' &&
            generation.status === 'successful'
        )
      ).toBeTruthy();
      expect(
        generations.some(
          (generation) =>
            generation.operation === 'brief' &&
            generation.status === 'successful'
        )
      ).toBeTruthy();
      expect(
        generations.some(
          (generation) =>
            generation.operation === 'story' &&
            generation.status === 'successful'
        )
      ).toBeTruthy();
      expect(briefing.briefingGenerationId).toBe(
        generations.find((generation) => generation.operation === 'brief')?.id
      );
      const storedItems = await ds
        .getRepository(CivicItemSchema)
        .find({ order: { id: 'ASC' } });
      const expectedEvidence = storedItems.map((item) => ({
        sourceKey: 'live-integration-news',
        civicItemId: item.id as number,
        sourceName: 'Fixture local reporting',
        publisher: 'Fixture Publisher',
        localitySlug: 'adel-ga',
        scopeSlug: item.scopeSlug!,
        scopeKind: item.scopeKind!,
      }));
      for (const operation of ['cluster', 'brief', 'story'] as const) {
        const received = captured
          .filter((call) => call.operation === operation)
          .flatMap((call) => call.evidence);
        expect(
          received.map(({ body: _body, ...evidence }) => evidence)
        ).toStrictEqual(expectedEvidence);
        expect(
          received.every((evidence) =>
            evidence.body?.includes('Adel bridge project update')
          )
        ).toBeTruthy();
      }
      expect(
        captured.every((call) => call.runId === result.runId)
      ).toBeTruthy();
      const revisions = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .find();
      expect(revisions.length).toBe(1);
      expect(revisions[0]?.titleOrigin).toBe('model');
      expect(revisions[0]?.generationId).toBe(
        generations.find((generation) => generation.operation === 'story')?.id
      );
      const citations = await ds
        .getRepository(StoryRevisionCitationSchema)
        .find();
      expect(citations.length).toBe(2);
      expect(result.markdownPath).toBeTruthy();
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('skips a story whose synthesis fails, keeps its prior revision, and publishes the edition', async () => {
    registerLiveSource();
    const { registry } = fixtureRegistry();
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(join(tmpdir(), 'civic-live-rollback-'));
    try {
      const first = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId),
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(
        ['succeeded', 'partial_success'].includes(first.status)
      ).toBeTruthy();
      const before = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: first.briefingId });
      const beforeRevision = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .findOneByOrFail({});
      const beforeMarkdown = readFileSync(first.markdownPath!, 'utf8');
      const second = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId, true),
        // A changed edition boundary prevents the unchanged-run reuse path;
        // the prior successful edition must still survive the failure.
        periodStart: '2026-09-12',
        periodEnd: '2026-09-14',
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      // One story without grounded claims no longer fails the whole edition.
      expect(
        ['succeeded', 'partial_success'].includes(second.status)
      ).toBeTruthy();
      const after = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: before.id });
      expect(after.markdown).toBe(before.markdown);
      expect(readFileSync(first.markdownPath!, 'utf8')).toBe(beforeMarkdown);
      const afterRevision = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .findOneByOrFail({ id: beforeRevision.id });
      expect(afterRevision.generationId).toBe(beforeRevision.generationId);
      expect(await ds.getRepository(CanonicalStoryRevisionSchema).count()).toBe(
        1
      );
      expect(await ds.getRepository(StoryRevisionCitationSchema).count()).toBe(
        2
      );
      const failures = await ds.getRepository(LlmGenerationSchema).find({
        where: { runId: second.runId, operation: 'story', status: 'failed' },
      });
      expect(failures.length >= 1).toBeTruthy();
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps unchanged strict reruns idempotent at publication identity boundaries', async () => {
    registerLiveSource();
    const { registry } = fixtureRegistry();
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(join(tmpdir(), 'civic-live-rerun-'));
    try {
      const run = async () =>
        runPipeline({
          registry,
          localitySlug: 'adel-ga',
          cadence: 'daily' as const,
          dataSource: ds,
          summarizerFactory: ({ runId, dataSource }) =>
            strictFixtureSummarizer(dataSource, runId),
          outputRoot: root,
          now: new Date('2026-09-13T12:00:00.000Z'),
        });
      const first = await run();
      const before = {
        briefings: await ds.getRepository(BriefingSchema).count(),
        revisions: await ds.getRepository(CanonicalStoryRevisionSchema).count(),
        citations: await ds.getRepository(StoryRevisionCitationSchema).count(),
        stories: await ds.getRepository('CanonicalStory').count(),
        generations: await ds.getRepository(LlmGenerationSchema).count(),
      };
      const second = await run();
      expect(
        ['succeeded', 'partial_success'].includes(first.status)
      ).toBeTruthy();
      expect(
        ['succeeded', 'partial_success'].includes(second.status)
      ).toBeTruthy();
      expect({
        briefings: await ds.getRepository(BriefingSchema).count(),
        revisions: await ds.getRepository(CanonicalStoryRevisionSchema).count(),
        citations: await ds.getRepository(StoryRevisionCitationSchema).count(),
        stories: await ds.getRepository('CanonicalStory').count(),
        generations: await ds.getRepository(LlmGenerationSchema).count(),
      }).toStrictEqual(before);
      expect(await ds.getRepository(CivicItemSchema).count()).toBe(2);
      expect(second.briefingId).toBeTruthy();
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('invalidates strict reuse for missing or older synthesis contract metadata', async () => {
    registerLiveSource();
    const { registry } = fixtureRegistry();
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(join(tmpdir(), 'civic-live-contract-version-'));
    try {
      const run = () =>
        runPipeline({
          registry,
          localitySlug: 'adel-ga',
          cadence: 'daily' as const,
          dataSource: ds,
          summarizerFactory: ({ runId, dataSource }) =>
            strictFixtureSummarizer(dataSource, runId),
          outputRoot: root,
          now: new Date('2026-09-13T12:00:00.000Z'),
        });
      const first = await run();
      expect(
        ['succeeded', 'partial_success'].includes(first.status)
      ).toBeTruthy();
      const firstBriefing = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: first.briefingId });
      const firstCoverage = JSON.parse(
        firstBriefing.coverageRange ?? '{}'
      ) as Record<string, unknown>;
      expect(firstCoverage['synthesisContractVersion']).toBe(
        'claim-grounded-article-v21'
      );

      const generationCount = () =>
        ds.getRepository(LlmGenerationSchema).count();
      const beforeLegacy = await generationCount();
      await ds.getRepository(BriefingSchema).update(
        { id: firstBriefing.id },
        {
          coverageRange: JSON.stringify({
            ...firstCoverage,
            synthesisContractVersion: undefined,
          }),
        }
      );
      const legacy = await run();
      expect(
        ['succeeded', 'partial_success'].includes(legacy.status)
      ).toBeTruthy();
      expect((await generationCount()) > beforeLegacy).toBeTruthy();

      const regenerated = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: firstBriefing.id });
      const currentCoverage = JSON.parse(
        regenerated.coverageRange ?? '{}'
      ) as Record<string, unknown>;
      const beforeOlder = await generationCount();
      await ds.getRepository(BriefingSchema).update(
        { id: regenerated.id },
        {
          coverageRange: JSON.stringify({
            ...currentCoverage,
            synthesisContractVersion: 'claim-grounded-v0',
          }),
        }
      );
      const older = await run();
      expect(
        ['succeeded', 'partial_success'].includes(older.status)
      ).toBeTruthy();
      expect((await generationCount()) > beforeOlder).toBeTruthy();

      const current = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: regenerated.id });
      const beforeCurrent = await generationCount();
      const same = await run();
      expect(
        ['succeeded', 'partial_success'].includes(same.status)
      ).toBeTruthy();
      expect(await generationCount()).toBe(beforeCurrent);
      expect(
        JSON.parse(
          (
            await ds
              .getRepository(BriefingSchema)
              .findOneByOrFail({ id: current.id })
          ).coverageRange ?? '{}'
        ).synthesisContractVersion
      ).toBe('claim-grounded-article-v21');
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('invalidates briefing and story reuse when the story rendering contract is older', async () => {
    registerLiveSource();
    const { registry } = fixtureRegistry();
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(
      join(tmpdir(), 'civic-live-story-contract-version-')
    );
    try {
      let storySuffix = '';
      const run = () =>
        runPipeline({
          registry,
          localitySlug: 'adel-ga',
          cadence: 'daily' as const,
          dataSource: ds,
          summarizerFactory: ({ runId, dataSource }) =>
            strictFixtureSummarizer(
              dataSource,
              runId,
              false,
              false,
              undefined,
              storySuffix
            ),
          outputRoot: root,
          now: new Date('2026-09-13T12:00:00.000Z'),
        });
      const first = await run();
      expect(
        ['succeeded', 'partial_success'].includes(first.status)
      ).toBeTruthy();
      const firstBriefing = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: first.briefingId });
      const firstCoverage = JSON.parse(
        firstBriefing.coverageRange ?? '{}'
      ) as Record<string, unknown>;
      expect(firstCoverage['storySynthesisContractVersion']).toBe(
        'story-grounded-render-v3'
      );
      const firstRevisions = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .find({ order: { id: 'ASC' } });
      expect(firstRevisions.length > 0).toBeTruthy();
      const firstRevision = firstRevisions[0]!;
      const firstGeneration = await ds
        .getRepository(LlmGenerationSchema)
        .findOneByOrFail({ id: firstRevision.generationId! });
      const legacyHash = 'a'.repeat(64);
      const legacyPath = firstRevision.artifactPath!.replace(
        /[a-f0-9]{64}(?=\.md$)/u,
        legacyHash
      );
      renameSync(firstRevision.artifactPath!, legacyPath);
      await ds
        .getRepository(LlmGenerationSchema)
        .update({ id: firstGeneration.id }, { inputSha256: legacyHash });
      await ds.getRepository(CanonicalStoryRevisionSchema).update(
        { id: firstRevision.id },
        {
          inputSha256: legacyHash,
          artifactPath: legacyPath,
          artifactToken: 'story-story-grounded-render-v0-legacy',
        }
      );
      const beforeLegacy = await ds.getRepository(LlmGenerationSchema).count();

      await ds.getRepository(BriefingSchema).update(
        { id: firstBriefing.id },
        {
          coverageRange: JSON.stringify({
            ...firstCoverage,
            storySynthesisContractVersion: 'story-grounded-render-v0',
          }),
        }
      );
      storySuffix = ' The revised rendering contract remains under review.';
      const regenerated = await run();
      expect(
        ['succeeded', 'partial_success'].includes(regenerated.status)
      ).toBeTruthy();
      expect(
        (await ds.getRepository(LlmGenerationSchema).count()) > beforeLegacy
      ).toBeTruthy();
      const secondRevisions = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .find({ order: { id: 'ASC' } });
      expect(secondRevisions.length).toBe(firstRevisions.length + 1);
      const latestRevision = secondRevisions.at(-1)!;
      expect(latestRevision.id).not.toBe(firstRevision.id);
      expect(latestRevision.inputSha256).not.toBe(legacyHash);
      expect(latestRevision.artifactPath).not.toBe(legacyPath);
      expect(latestRevision.artifactSha256).not.toBe(
        firstRevision.artifactSha256
      );
      expect(latestRevision.artifactToken ?? '').toMatch(
        /^story-story-grounded-render-v3-/u
      );
      expect(readFileSync(legacyPath, 'utf8').length > 0).toBe(true);

      const beforeCurrent = await ds.getRepository(LlmGenerationSchema).count();
      const revisionsBeforeCurrent = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .count();
      const same = await run();
      expect(
        ['succeeded', 'partial_success'].includes(same.status)
      ).toBeTruthy();
      expect(await ds.getRepository(LlmGenerationSchema).count()).toBe(
        beforeCurrent
      );
      expect(await ds.getRepository(CanonicalStoryRevisionSchema).count()).toBe(
        revisionsBeforeCurrent
      );
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('invalidates strict reuse when a new historical context item arrives but daily IDs stay unchanged', async () => {
    registerLiveSource();
    const { registry } = fixtureRegistry();
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(join(tmpdir(), 'civic-live-context-fingerprint-'));
    try {
      const first = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId),
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      const firstBriefing = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: first.briefingId });
      const dailyIdsBefore = firstBriefing.itemIds;
      const ruleVersion = firstBriefing.ruleVersion!;
      const historical = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'live-integration-news',
        localitySlug: 'adel-ga',
        scopeSlug: 'adel-ga',
        scopeKind: 'town',
        kind: 'news',
        title: 'Adel bridge project historical context',
        body: 'A historical report adds context to the bridge construction matter.',
        summary: null,
        publishedAt: '2026-08-20T12:00:00.000Z',
        eventDate: null,
        topics: JSON.stringify(['bridge']),
        uris: JSON.stringify(['https://fixture.test/adel-news/history']),
        hash: 'historical-context-item',
        createdAt: '2026-08-20T12:00:00.000Z',
        geographyDecision: 'include',
        geographyEvidence: null,
        ruleVersion,
        originalSnippet: null,
        publisher: null,
        canonicalUrl: 'https://fixture.test/adel-news/history',
        articleProvenance: null,
        contentChecksum: null,
        accessMode: null,
        unresolvedAggregateLink: false,
      });
      await ds.getRepository(EditionItemSchema).save({
        localitySlug: 'adel-ga',
        civicItemId: historical.id!,
        decision: 'include',
        reason: 'historical context',
        ruleVersion,
        createdAt: '2026-08-20T12:00:00.000Z',
      });
      const beforeGenerations = await ds
        .getRepository(LlmGenerationSchema)
        .count();
      const second = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId),
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(
        ['succeeded', 'partial_success'].includes(second.status)
      ).toBeTruthy();
      const secondBriefing = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: second.briefingId });
      expect(secondBriefing.itemIds).toBe(dailyIdsBefore);
      expect(
        (await ds.getRepository(LlmGenerationSchema).count()) >
          beforeGenerations
      ).toBeTruthy();
      expect(
        JSON.parse(firstBriefing.coverageRange ?? '{}')
          .contextEvidenceFingerprint
      ).not.toBe(
        JSON.parse(secondBriefing.coverageRange ?? '{}')
          .contextEvidenceFingerprint
      );
      const revisions = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .find({ order: { revision: 'ASC' } });
      expect(revisions.length >= 2).toBeTruthy();
      const firstRevision = revisions[0]!;
      const latestRevision = revisions[revisions.length - 1]!;
      expect(firstRevision.artifactPath).not.toBe(latestRevision.artifactPath);
      expect(
        firstRevision.artifactPath && latestRevision.artifactPath
      ).toBeTruthy();
      const firstBytes = readFileSync(firstRevision.artifactPath!);
      const latestBytes = readFileSync(latestRevision.artifactPath!);
      expect(sha256(firstBytes.toString('utf8'))).toBe(
        firstRevision.artifactSha256
      );
      expect(sha256(latestBytes.toString('utf8'))).toBe(
        latestRevision.artifactSha256
      );
      expect(firstBytes).not.toStrictEqual(latestBytes);
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('compensates a strict final briefing publication failure after story preparation', async () => {
    registerLiveSource();
    const { registry } = fixtureRegistry();
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(join(tmpdir(), 'civic-live-final-boundary-'));
    try {
      const first = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId),
        outputRoot: root,
        periodStart: '2026-09-12',
        periodEnd: '2026-09-13',
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(
        ['succeeded', 'partial_success'].includes(first.status)
      ).toBeTruthy();
      const priorBriefing = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: first.briefingId });
      const priorRevisionRows = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .find();
      const priorCitationRows = await ds
        .getRepository(StoryRevisionCitationSchema)
        .find();
      const priorStories = readdirSync(join(root, 'stories', 'adel-ga')).map(
        (file) => ({
          file,
          content: readFileSync(join(root, 'stories', 'adel-ga', file), 'utf8'),
        })
      );
      const priorBriefingMarkdown = readFileSync(first.markdownPath!, 'utf8');
      const priorStoryGeneration = await ds
        .getRepository(LlmGenerationSchema)
        .findOneByOrFail({
          runId: first.runId,
          operation: 'story',
          status: 'successful',
        });
      const priorEvidence = await ds
        .getRepository(CivicItemSchema)
        .find({ order: { id: 'ASC' } });
      const changedItem = priorEvidence[0]!;
      await ds.getRepository(CivicItemSchema).update(
        { id: changedItem.id },
        {
          body: `${changedItem.body} A later historical record adds a revised construction milestone.`,
        }
      );
      const second = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId),
        outputRoot: root,
        periodStart: '2026-09-12',
        periodEnd: '2026-09-14',
        now: new Date('2026-09-13T12:00:00.000Z'),
        publisher: async () => {
          throw new Error('final briefing publication failed');
        },
      });
      expect(second.status).toBe('failed');
      const secondStoryGeneration = await ds
        .getRepository(LlmGenerationSchema)
        .findOneByOrFail({
          runId: second.runId,
          operation: 'story',
          status: 'successful',
        });
      expect(secondStoryGeneration.inputSha256).not.toBe(
        priorStoryGeneration.inputSha256
      );
      expect(await ds.getRepository(BriefingSchema).count()).toBe(1);
      expect(
        await ds.getRepository(CanonicalStoryRevisionSchema).find()
      ).toStrictEqual(priorRevisionRows);
      expect(
        await ds.getRepository(StoryRevisionCitationSchema).find()
      ).toStrictEqual(priorCitationRows);
      expect(
        await ds
          .getRepository(BriefingSchema)
          .findOneByOrFail({ id: first.briefingId })
      ).toStrictEqual(priorBriefing);
      expect(readFileSync(first.markdownPath!, 'utf8')).toBe(
        priorBriefingMarkdown
      );
      expect(
        readdirSync(join(root, 'stories', 'adel-ga')).map((file) => ({
          file,
          content: readFileSync(join(root, 'stories', 'adel-ga', file), 'utf8'),
        }))
      ).toStrictEqual(priorStories);
      const failedBriefingGenerations = await ds
        .getRepository(LlmGenerationSchema)
        .find({
          where: {
            runId: second.runId,
            operation: 'brief',
            status: 'successful',
          },
        });
      expect(failedBriefingGenerations.length >= 1).toBeTruthy();
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not silently reuse a strict edition when a referenced story artifact is corrupted', async () => {
    registerLiveSource();
    const { registry } = fixtureRegistry();
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(join(tmpdir(), 'civic-live-corrupt-receipt-'));
    const captured: CapturedLlmInput[] = [];
    try {
      const first = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId, false, false, captured),
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(first.markdownPath).toBeTruthy();
      const revision = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .findOneByOrFail({});
      expect(revision.artifactPath).toBeTruthy();
      const original = readFileSync(revision.artifactPath!, 'utf8');
      // A missing/corrupt receipt must not take the read-only shortcut.
      writeFileSync(revision.artifactPath!, `${original}\nCORRUPTED`);
      const beforeGenerations = await ds
        .getRepository(LlmGenerationSchema)
        .count();
      const second = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId, false, false, captured),
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(
        ['succeeded', 'partial_success'].includes(second.status)
      ).toBeTruthy();
      expect(
        (await ds.getRepository(LlmGenerationSchema).count()) >
          beforeGenerations
      ).toBeTruthy();
      expect(readFileSync(revision.artifactPath!, 'utf8')).toBe(original);
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a non-strict summarizer returned by the live factory before source work', async () => {
    const { registry } = fixtureRegistry();
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    try {
      let factoryCalls = 0;
      const result = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: () => {
          factoryCalls += 1;
          return { strict: false, model: 'legacy' } as unknown as Summarizer;
        },
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(result.status).toBe('failed');
      expect(factoryCalls).toBe(1);
      expect(
        (
          await ds
            .getRepository('PipelineRun')
            .findOneByOrFail({ id: result.runId })
        )['error'] ?? ''
      ).toMatch(/strict summarizer/);
      expect(await ds.getRepository(BriefingSchema).count()).toBe(0);
    } finally {
      await ds.destroy();
    }
  });

  it('persists a failed strict brief generation without replacing the prior edition', async () => {
    registerLiveSource();
    const { registry } = fixtureRegistry();
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(join(tmpdir(), 'civic-live-brief-failure-'));
    try {
      const first = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId),
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(
        ['succeeded', 'partial_success'].includes(first.status)
      ).toBeTruthy();
      const before = await ds
        .getRepository(BriefingSchema)
        .findOneByOrFail({ id: first.briefingId });
      const revisionsBefore = await ds
        .getRepository(CanonicalStoryRevisionSchema)
        .count();
      const second = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId, false, true),
        periodStart: '2026-09-12',
        periodEnd: '2026-09-14',
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(second.status).toBe('failed');
      expect(await ds.getRepository(BriefingSchema).count()).toBe(1);
      expect(
        (
          await ds
            .getRepository(BriefingSchema)
            .findOneByOrFail({ id: before.id })
        ).markdown
      ).toBe(before.markdown);
      expect(await ds.getRepository(CanonicalStoryRevisionSchema).count()).toBe(
        revisionsBefore
      );
      const failedBrief = await ds.getRepository(LlmGenerationSchema).find({
        where: { runId: second.runId, operation: 'brief', status: 'failed' },
      });
      expect(failedBrief.length >= 1).toBeTruthy();
      expect(second.briefingId).toBe(undefined);
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not present older context as news on a first edition whose week has none', async () => {
    const base = loadLocalityRegistry(
      join(__dirname, '../../../core/test/fixtures/localities')
    );
    registerAdapter({
      name: 'live-quiet-source',
      async fetch(source) {
        return [
          {
            kind: 'fetched' as const,
            status: 200 as const,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: '2026-09-12T12:00:00.000Z',
            observedDates: ['2026-09-01'],
            payload: {
              kind: 'text' as const,
              body: 'historical context record',
            },
          },
        ];
      },
      async parse(raw) {
        return [
          {
            kind: 'news' as const,
            title: 'Adel bridge project update',
            body: 'The Adel bridge project update changed for residents, according to the city. Crews expect to finish the deck next month.',
            publishedAt: '2026-09-01T15:00:00.000Z',
            topics: ['context'],
            uris: [raw.url],
            canonicalUrl: raw.url,
          },
        ];
      },
    });
    const source = {
      sourceKey: 'live-quiet-source',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'live-quiet-source',
      name: 'Quiet fixture',
      url: 'https://fixture.test/quiet',
      kind: 'news' as const,
      desk: 'community-news' as const,
      accessMode: 'full' as const,
      aggregateDiscovery: false as const,
      coverageCapabilities: {
        dateQuery: { parameter: 'from', format: 'YYYY-MM-DD' as const },
      },
    };
    const registry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source],
    };
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(join(tmpdir(), 'civic-live-quiet-'));
    let modelCalls = 0;
    try {
      const result = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) => {
          modelCalls += 1;
          return strictFixtureSummarizer(dataSource, runId);
        },
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(result.status).toBe('partial_success');
      expect(result.blockedReason).toBe(undefined);
      expect(result.briefingId).toBeTruthy();
      expect(result.editionMode).toBe('bootstrap');
      expect(await ds.getRepository(BriefingSchema).count()).toBe(1);
      expect(
        await ds
          .getRepository(LlmGenerationSchema)
          .count({ where: { operation: 'brief' } })
      ).toBe(0);
      const firstMarkdown = readFileSync(result.markdownPath!, 'utf8');
      expect(firstMarkdown).toMatch(/## No new public business in Adel/u);
      expect(firstMarkdown).toMatch(
        /no public business from Adel dated in the past week/u
      );
      expect(firstMarkdown).not.toMatch(/Adel bridge project update changed/u);
      const second = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) => {
          modelCalls += 1;
          return strictFixtureSummarizer(dataSource, runId);
        },
        outputRoot: root,
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(second.briefingId).toBeTruthy();
      expect(await ds.getRepository(BriefingSchema).count()).toBe(1);
      expect(
        readFileSync(second.markdownPath!, 'utf8').replace(
          /\d{4}-\d{2}-\d{2}T[\d:.]+Z/gu,
          ''
        )
      ).toBe(firstMarkdown.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/gu, ''));
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not invoke agenda fixup for a long context-only packet on a first edition with an empty day', async () => {
    const base = loadLocalityRegistry(
      join(__dirname, '../../../core/test/fixtures/localities')
    );
    registerAdapter({
      name: 'live-quiet-agenda-source',
      async fetch(source) {
        return [
          {
            kind: 'fetched' as const,
            status: 200 as const,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: '2026-09-12T12:00:00.000Z',
            observedDates: ['2026-09-01'],
            payload: { kind: 'text' as const, body: 'context agenda packet' },
          },
        ];
      },
      async parse(raw) {
        return [
          {
            kind: 'meeting' as const,
            title: 'City Council Agenda 09/01/2026',
            body: `Agenda packet for the prior meeting. The Adel bridge project update changed for residents. ${'A substantive listed item for context history. '.repeat(
              30
            )}`,
            eventDate: '2026-09-01',
            topics: ['context-agenda'],
            uris: [raw.url],
            canonicalUrl: raw.url,
          },
        ];
      },
    });
    const source = {
      sourceKey: 'live-quiet-agenda-source',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'live-quiet-agenda-source',
      name: 'Quiet agenda fixture',
      url: 'https://fixture.test/quiet-agenda',
      kind: 'meeting' as const,
      desk: 'community-news' as const,
      accessMode: 'full' as const,
      aggregateDiscovery: false as const,
    };
    const registry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source],
    };
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(join(tmpdir(), 'civic-live-quiet-agenda-'));
    let fixupCalls = 0;
    try {
      const result = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId),
        agendaFixup: async () => {
          fixupCalls += 1;
          return [];
        },
        outputRoot: root,
        periodStart: '2026-09-12',
        periodEnd: '2026-09-13',
        contextStart: '2026-08-14',
        contextEnd: '2026-09-13',
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(result.briefingId).toBeTruthy();
      expect(fixupCalls).toBe(0);
      expect(result.editionMode).toBe('bootstrap');
      expect(
        await ds
          .getRepository(LlmGenerationSchema)
          .count({ where: { operation: 'agenda_fixup' } })
      ).toBe(0);
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not invoke agenda fixup when only parsed daily rows are editorially withheld', async () => {
    const base = loadLocalityRegistry(
      join(__dirname, '../../../core/test/fixtures/localities')
    );
    registerAdapter({
      name: 'live-quiet-withheld-agenda-source',
      async fetch(source) {
        return [
          {
            kind: 'fetched' as const,
            status: 200 as const,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/plain',
            fetchedAt: '2026-09-12T12:00:00.000Z',
            observedDates: ['2026-09-01', '2026-09-12'],
            payload: {
              kind: 'text' as const,
              body: 'context agenda and directory',
            },
          },
        ];
      },
      async parse(raw) {
        return [
          {
            kind: 'meeting' as const,
            title: 'City Council Agenda 09/01/2026',
            body: `Agenda packet for the prior meeting. The Adel bridge project update changed for residents. ${'A substantive listed item for context history. '.repeat(
              30
            )}`,
            eventDate: '2026-09-01',
            topics: ['context-agenda'],
            uris: [raw.url],
            canonicalUrl: raw.url,
          },
          {
            kind: 'news' as const,
            title: 'eBoard Site',
            body: 'Click here to browse the directory and subscribe home navigation.',
            publishedAt: '2026-09-12T15:00:00.000Z',
            topics: ['directory'],
            uris: [`${raw.url}/directory`],
            canonicalUrl: `${raw.url}/directory`,
          },
        ];
      },
    });
    const source = {
      sourceKey: 'live-quiet-withheld-agenda-source',
      ownerSlug: 'adel-ga',
      coverage: 'mentions' as const,
      adapter: 'live-quiet-withheld-agenda-source',
      name: 'Quiet withheld agenda fixture',
      url: 'https://fixture.test/quiet-withheld-agenda',
      kind: 'meeting' as const,
      desk: 'community-news' as const,
      accessMode: 'full' as const,
      aggregateDiscovery: false as const,
    };
    const registry: LocalityRegistry = {
      ...base,
      sourcesForRun: () => [source],
    };
    const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
    const root = mkdtempSync(
      join(tmpdir(), 'civic-live-quiet-withheld-agenda-')
    );
    let fixupCalls = 0;
    try {
      const result = await runPipeline({
        registry,
        localitySlug: 'adel-ga',
        cadence: 'daily',
        dataSource: ds,
        summarizerFactory: ({ runId, dataSource }) =>
          strictFixtureSummarizer(dataSource, runId),
        agendaFixup: async () => {
          fixupCalls += 1;
          return [];
        },
        outputRoot: root,
        periodStart: '2026-09-12',
        periodEnd: '2026-09-13',
        contextStart: '2026-08-14',
        contextEnd: '2026-09-13',
        now: new Date('2026-09-13T12:00:00.000Z'),
      });
      expect(result.briefingId).toBeTruthy();
      expect(fixupCalls).toBe(0);
      expect(result.editionMode).toBe('bootstrap');
      expect(
        await ds
          .getRepository(LlmGenerationSchema)
          .count({ where: { operation: 'agenda_fixup' } })
      ).toBe(0);
    } finally {
      await ds.destroy();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('atomically rolls back earlier story revisions when a later append fails', async () => {
    await withTestDataSource(async (ds) => {
      const now = '2026-09-13T00:00:00.000Z';
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: now,
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      await ds.getRepository(SourceSchema).save({
        id: 'source-a',
        sourceKey: 'source-a',
        localitySlug: 'town-a',
        adapter: 'fixture',
        name: 'Fixture',
        url: 'https://fixture.test',
        kind: 'news',
        enabled: true,
      });
      const itemOne = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'source-a',
        localitySlug: 'town-a',
        scopeSlug: 'town-a',
        scopeKind: 'town',
        geographyDecision: 'include',
        kind: 'news',
        title: 'Road one',
        body: 'Road one body',
        hash: 'item-one',
        canonicalUrl: 'https://fixture.test/one',
        createdAt: now,
      });
      const itemTwo = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'source-a',
        localitySlug: 'town-a',
        scopeSlug: 'town-a',
        scopeKind: 'town',
        geographyDecision: 'include',
        kind: 'news',
        title: 'Road two',
        body: 'Road two body',
        hash: 'item-two',
        canonicalUrl: 'https://fixture.test/two',
        createdAt: now,
      });
      const storyOne = await ds.getRepository(CanonicalStorySchema).save({
        scopeSlug: 'town-a',
        scopeKind: 'town',
        storyKey: 'story-one',
        strategy: 'fallback',
        title: 'Story one',
        status: 'ongoing',
        createdAt: now,
        updatedAt: now,
        currentRevisionId: null,
      });
      const storyTwo = await ds.getRepository(CanonicalStorySchema).save({
        scopeSlug: 'town-a',
        scopeKind: 'town',
        storyKey: 'story-two',
        strategy: 'fallback',
        title: 'Story two',
        status: 'ongoing',
        createdAt: now,
        updatedAt: now,
        currentRevisionId: null,
      });
      await ds.getRepository(CanonicalStoryItemSchema).save([
        {
          canonicalStoryId: storyOne.id!,
          civicItemId: itemOne.id!,
          createdAt: now,
        },
        {
          canonicalStoryId: storyTwo.id!,
          civicItemId: itemTwo.id!,
          createdAt: now,
        },
      ]);
      const generationOne = await ds.getRepository(LlmGenerationSchema).save({
        runId: run.id!,
        localitySlug: 'town-a',
        operation: 'story',
        model: 'fixture',
        status: 'validated',
        attempt: 1,
        promptSha256: '1'.repeat(64),
        inputSha256: '2'.repeat(64),
        outputSha256: '3'.repeat(64),
        sourceKeys: '["source-a"]',
        output: '{}',
        error: null,
        generatedAt: now,
        latencyMs: 1,
      });
      const generationTwo = await ds.getRepository(LlmGenerationSchema).save({
        runId: run.id!,
        localitySlug: 'town-a',
        operation: 'story',
        model: 'fixture',
        status: 'validated',
        attempt: 2,
        promptSha256: '4'.repeat(64),
        inputSha256: '5'.repeat(64),
        outputSha256: '6'.repeat(64),
        sourceKeys: '["source-a"]',
        output: '{}',
        error: null,
        generatedAt: now,
        latencyMs: 1,
      });
      await expect(
        (() =>
          appendCanonicalStoryRevisions(ds, [
            {
              canonicalStoryId: storyOne.id!,
              status: 'successful',
              title: 'Story one',
              narrative: 'Story one narrative',
              storyStatus: 'ongoing',
              generationId: generationOne.id!,
              inputSha256: '2'.repeat(64),
              createdAt: now,
              citations: [
                {
                  civicItemId: itemOne.id!,
                  sourceKey: 'source-a',
                  snippetOnly: false,
                },
              ],
              publicationReceipt: {
                path: '/stories/one.md',
                sha256: 'a'.repeat(64),
                token: 'one',
              },
            },
            {
              canonicalStoryId: storyTwo.id!,
              status: 'successful',
              title: 'Story two',
              narrative: 'Story two narrative',
              storyStatus: 'ongoing',
              generationId: generationTwo.id!,
              inputSha256: '5'.repeat(64),
              createdAt: now,
              citations: [
                {
                  civicItemId: itemOne.id!,
                  sourceKey: 'source-a',
                  snippetOnly: false,
                },
              ],
              publicationReceipt: {
                path: '/stories/two.md',
                sha256: 'b'.repeat(64),
                token: 'two',
              },
            },
          ]))()
      ).rejects.toThrow(/not uniquely linked|canonical story/);
      expect(await ds.getRepository(CanonicalStoryRevisionSchema).count()).toBe(
        0
      );
      expect(await ds.getRepository(StoryRevisionCitationSchema).count()).toBe(
        0
      );
      expect(
        (
          await ds
            .getRepository(CanonicalStorySchema)
            .findOneByOrFail({ id: storyOne.id })
        ).currentRevisionId
      ).toBe(null);
      expect(
        (
          await ds
            .getRepository(CanonicalStorySchema)
            .findOneByOrFail({ id: storyTwo.id })
        ).currentRevisionId
      ).toBe(null);
    });
  });
});
