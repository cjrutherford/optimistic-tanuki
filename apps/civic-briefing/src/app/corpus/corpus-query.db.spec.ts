import {
  CanonicalStoryItemSchema,
  CanonicalStorySchema,
  CivicItemSchema,
  createFoundationDataSource,
  EditionStorySchema,
  FoundationSourceSchema,
} from '@optimistic-tanuki/civic-core';
import type { DataSource } from 'typeorm';
import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import { CorpusQueryService, DEFAULT_TOPIC } from './corpus-query.service';

const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

describe('CorpusQueryService', () => {
  let ds: DataSource;
  let corpus: CorpusQueryService;
  const now = new Date('2026-09-20T12:00:00Z');

  beforeAll(async () => {
    ds = await createFoundationDataSource((await createTestSchema()).url);
    const source = (id: string, name: string, desk: string | null) => ({
      id,
      sourceKey: id,
      ownerSlug: 'riverton-ga',
      coverage: 'all',
      adapter: 'rss',
      name,
      url: `https://example.test/${id}`,
      kind: 'news',
      enabled: true,
      desk,
    });
    await ds
      .getRepository(FoundationSourceSchema)
      .save([
        source('paper', 'Riverton Ledger', 'local-reporting'),
        source('council', 'Riverton Council', 'government'),
      ] as never);
    const item = (overrides: Record<string, unknown>) => ({
      sourceId: 'paper',
      localitySlug: 'riverton-ga',
      kind: 'news',
      title: 't',
      body: '',
      hash: `h-${Math.random()}`,
      createdAt: '2026-09-01T00:00:00Z',
      ...overrides,
    });
    await ds.getRepository(CivicItemSchema).save([
      item({
        title: 'Long article',
        body: words(80),
        publisher: 'A. Reporter',
        canonicalUrl: 'https://example.test/a',
        publishedAt: '2026-09-10',
      }),
      item({
        title: 'Same article, other feed',
        body: words(80),
        canonicalUrl: 'https://example.test/a',
        publishedAt: '2026-09-10',
      }),
      item({ title: 'Teaser', body: words(10), publishedAt: '2026-09-11' }),
      item({
        sourceId: 'council',
        kind: 'meeting',
        title: 'Council 09/15',
        body: 'agenda',
        eventDate: '2026-09-15',
        canonicalUrl: 'https://example.test/m1',
      }),
      item({
        sourceId: 'council',
        kind: 'meeting',
        title: 'Council 03/01',
        body: 'agenda',
        eventDate: '2026-03-01',
      }),
      item({
        sourceId: 'council',
        kind: 'meeting',
        title: 'Elsewhere',
        localitySlug: 'other-ga',
        body: 'agenda',
        eventDate: '2026-09-15',
      }),
    ] as never);
    const story = await ds.getRepository(CanonicalStorySchema).save({
      scopeSlug: 'riverton-ga',
      scopeKind: 'town',
      storyKey: 'k',
      strategy: 's',
      title: 'Paving plan',
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
      lastEvidenceDate: '2026-09-15',
    });
    await ds.getRepository(EditionStorySchema).save({
      localitySlug: 'riverton-ga',
      canonicalStoryId: story.id as number,
      ruleVersion: 'v',
      createdAt: '2026-09-16',
    });
    const meeting = await ds
      .getRepository(CivicItemSchema)
      .findOneByOrFail({ title: 'Council 09/15' });
    await ds.getRepository(CanonicalStoryItemSchema).save({
      canonicalStoryId: story.id as number,
      civicItemId: meeting.id as number,
      localitySlug: 'riverton-ga',
      ruleVersion: 'v',
      createdAt: '2026-09-16',
      evidenceDate: '2026-09-15',
      matchReason: 'opened',
    } as never);
    corpus = new CorpusQueryService(ds, () => now);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('indexes full news articles once, named by their source', async () => {
    const news = await corpus.news();
    expect(news).toHaveLength(1);
    expect(news[0]).toMatchObject({
      publisher: 'Riverton Ledger',
      title: 'Long article',
      url: 'https://example.test/a',
    });
  });

  it('offers recent meetings and current stories in the town only', async () => {
    const subjects = await corpus.subjects('riverton-ga');
    expect(subjects.map((s) => [s.kind, s.title, s.date])).toStrictEqual([
      ['meeting', 'Council 09/15', '2026-09-15'],
      ['story', 'Paving plan', '2026-09-15'],
    ]);
  });

  it('takes the topic from the source desk, else government', async () => {
    const [meeting, story] = await corpus.subjects('riverton-ga');
    expect(
      await corpus.topicFor('riverton-ga', {
        kind: 'meeting',
        ref: meeting!.ref,
      })
    ).toBe('government');
    expect(
      await corpus.topicFor('riverton-ga', { kind: 'story', ref: story!.ref })
    ).toBe('government');
    expect(
      await corpus.topicFor('riverton-ga', { kind: 'town', ref: null })
    ).toBe(DEFAULT_TOPIC);
  });

  it('lists records since a day in date order, news marked as news', async () => {
    const records = await corpus.recordsSince('riverton-ga', '2026-09-11');
    expect(records.map((r) => [r.kind, r.title, r.date])).toStrictEqual([
      ['news', 'Teaser', '2026-09-11'],
      ['record', 'Council 09/15', '2026-09-15'],
    ]);
  });
});
