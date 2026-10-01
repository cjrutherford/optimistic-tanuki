import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFoundationDataSource } from '@optimistic-tanuki/civic-core';
import {
  classifyArticleAccess,
  enrichDraft,
} from '@optimistic-tanuki/civic-core';
import { brief, parseAll } from '@optimistic-tanuki/civic-core';
import { projectItems } from '@optimistic-tanuki/civic-core';
import { registerAdapter } from '@optimistic-tanuki/civic-core';
import { rssAdapter } from '../../src/rss/index.js';
import {
  FoundationSourceSchema,
  RawDocumentSchema,
  RawDocumentVersionSchema,
} from '@optimistic-tanuki/civic-core';
import { CivicItemSchema } from '@optimistic-tanuki/civic-core';
import { loadLocalityRegistry } from '@optimistic-tanuki/civic-core';
import {
  withTestDataSource,
  createTestSchema,
} from '../../../core/test/db/helpers/postgres.js';
import type {
  HttpClient,
  HttpResponse,
  LocalityConfig,
  SourceConfig,
  Summarizer,
} from '@optimistic-tanuki/civic-core';
import { articleHtml } from '../../../core/test/helpers/article-html.js';

// Restricted publishers are derived from the checked-in locality configuration.
loadLocalityRegistry(
  join(__dirname, '../../../core/test/fixtures/localities-snapshot')
);

const source = (overrides: Partial<SourceConfig> = {}): SourceConfig => ({
  sourceKey: 'generic-news',
  ownerSlug: 'berrien-county-ga',
  coverage: 'mentions',
  adapter: 'rss',
  name: 'Generic news',
  url: 'https://news.google.com/rss/search?q=Berrien',
  kind: 'news',
  accessMode: 'full',
  aggregateDiscovery: true,
  aggregateUrl: 'https://news.google.com/rss/search?q=Berrien',
  ...overrides,
});

describe('restricted source ingestion', () => {
  it('downgrades Berrien/Cook publisher names and domains from generic full sources', async () => {
    for (const [publisher, url] of [
      ['THE BERRIEN PRESS', 'https://news.google.com/rss/articles/abc'],
      ['adel news-tribune', 'https://aggregate.example/result'],
      ['Other name', 'https://www.AdelNewsTribune.com/story/123'],
    ] as const) {
      const draft = classifyArticleAccess(
        {
          title: 'Update',
          body: 'Aggregate snippet',
          kind: 'news',
          originalSnippet: 'Aggregate snippet',
          publisher,
          originalUrl: url,
        },
        source()
      );
      expect(draft.accessMode).toBe('snippet-only');
      expect(draft.body).toBe('Aggregate snippet');
      expect(draft.articleProvenance?.extraction).toBe('snippet-fallback');
      expect(draft.unresolvedAggregateLink).toBe(
        !url.toLowerCase().includes('adelnewstribune.com/story')
      );
    }
  });

  it('requests only aggregate metadata and persists unresolved/direct access metadata', async () => {
    registerAdapter(rssAdapter);
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    let requests: string[] = [];
    const httpClient: HttpClient = {
      fetch: async (url) => {
        requests.push(url);
        const response = new Response(
          '<html><body><article>Publisher body must never be fetched.</article></body></html>',
          { status: 200 }
        );
        return Object.assign(response, {
          finalUrl: url,
          redirectChain: [url],
        }) as HttpResponse;
      },
    };
    const locality: LocalityConfig = {
      slug: 'restricted-town',
      name: 'Restricted Town',
      state: 'GA',
      timezone: 'America/New_York',
      lat: 31,
      lon: -83,
      topics: ['news'],
      cadence: ['daily'],
      kind: 'town',
      parents: ['berrien-county-ga'],
      edition: true,
      ruleVersion: 'berrien-county.v1',
      sources: [
        source({
          sourceKey: 'generic-news',
          ownerSlug: 'berrien-county-ga',
          coverage: 'mentions',
        }),
      ],
    };
    try {
      await ds.getRepository(FoundationSourceSchema).save({
        id: 'generic-news',
        sourceKey: 'generic-news',
        ownerSlug: 'berrien-county-ga',
        coverage: 'mentions',
        adapter: 'rss',
        name: 'Generic news',
        url: locality.sources[0]!.url,
        kind: 'news',
        enabled: true,
        config: null,
        accessMode: 'full',
        aggregateDiscovery: true,
        aggregateUrl: source().aggregateUrl,
      });
      const version = await ds.getRepository(RawDocumentVersionSchema).save({
        sourceId: 'generic-news',
        url: 'https://news.google.com/rss/articles/redirect',
        checksum: 'restricted',
        payloadKind: 'text',
        body: JSON.stringify({
          title: 'Berrien roads - The Berrien Press',
          content: 'Aggregate snippet only',
          pubDate: '2026-09-12T00:00:00Z',
        }),
        contentType: 'application/rss-item+json',
        fetchedAt: '2026-09-12T00:00:00Z',
      });
      await ds.getRepository(RawDocumentSchema).save({
        sourceId: 'generic-news',
        urlHash: 'restricted',
        url: 'https://news.google.com/rss/articles/redirect',
        contentType: 'application/rss-item+json',
        body: null,
        checksum: 'restricted',
        fetchedAt: '2026-09-12T00:00:00Z',
        activeVersionId: version.id,
      });
      const parsed = await parseAll(ds, locality, { httpClient });
      expect(parsed.inserted).toBe(1);
      expect(requests).toStrictEqual([]);
      const row = (
        await ds.query(
          'SELECT body, "accessMode", "accessRestrictionReason", "restrictionPolicyUrl", "aggregateUrl", "observedAt", "canonicalUrl", "articleProvenance", "unresolvedAggregateLink", uris FROM civic_items'
        )
      )[0] as Record<string, string | null>;
      expect(row['body']).toBe('Aggregate snippet only');
      expect(row['accessMode']).toBe('snippet-only');
      expect(row['canonicalUrl']).toBe(null);
      expect(row['unresolvedAggregateLink']).toBe(true);
      expect(row['articleProvenance'] ?? '').toMatch(/unresolved/);
      expect(row['aggregateUrl']).toBe(source().aggregateUrl);
      // Raw fetch time is transport freshness, not editorial observation
      // provenance. No adapter-supplied observedAt was present here.
      expect(row['observedAt']).toBe(null);
      expect(row['uris'] ?? '').toMatch(/news\.google\.com/);
    } finally {
      await ds.destroy();
    }
  });

  it('keeps explicit adapter observation while rejecting raw fetch time as editorial observation', async () => {
    const result = await enrichDraft(
      {
        title: 'Observed road update',
        body: 'A short snippet',
        kind: 'news',
        originalSnippet: 'A short snippet',
        publisher: 'WALB',
        originalUrl: 'https://walb.com/story/2',
      },
      {
        httpClient: {
          fetch: async () =>
            Object.assign(
              new Response(
                articleHtml(
                  'A sufficiently substantive publisher article body for this observation test.'
                ),
                { status: 200 }
              ),
              { finalUrl: 'https://walb.com/story/2', redirectChain: [] }
            ) as HttpResponse,
        },
      },
      source({
        sourceKey: 'walb',
        name: 'WALB',
        accessMode: 'full',
        aggregateDiscovery: false,
        aggregateUrl: undefined,
      }),
      '2026-09-12T12:00:00Z'
    );
    expect(result.observedAt).toBe('2026-09-12T12:00:00Z');
    expect(
      (
        await enrichDraft(
          {
            title: 'Unobserved road update',
            body: 'A short snippet',
            kind: 'news',
            originalSnippet: 'A short snippet',
            publisher: 'WALB',
            originalUrl: 'https://walb.com/story/3',
          },
          {
            httpClient: {
              fetch: async () =>
                Object.assign(
                  new Response(
                    articleHtml(
                      'A sufficiently substantive publisher article body for this no-observation test.'
                    ),
                    { status: 200 }
                  ),
                  { finalUrl: 'https://walb.com/story/3', redirectChain: [] }
                ) as HttpResponse,
            },
          },
          source({
            sourceKey: 'walb',
            name: 'WALB',
            accessMode: 'full',
            aggregateDiscovery: false,
            aggregateUrl: undefined,
          })
        )
      ).observedAt
    ).toBe(undefined);
  });

  it('keeps an explicit restricted publisher URL through storage, projection, and briefing rendering', async () => {
    registerAdapter(rssAdapter);
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    const registry = loadLocalityRegistry(
      join(__dirname, '../../../core/test/fixtures/localities-snapshot')
    );
    const aggregateUrl = 'https://news.google.com/rss/search?q=Berrien';
    const directUrl = 'https://www.theberrienpress.com/story/8';
    const locality: LocalityConfig = {
      slug: 'nashville-ga',
      name: 'Nashville',
      state: 'GA',
      timezone: 'America/New_York',
      lat: 31,
      lon: -83,
      topics: ['news'],
      cadence: ['daily'],
      kind: 'town',
      parents: ['berrien-county-ga'],
      edition: true,
      ruleVersion: registry.ruleVersion('nashville-ga'),
      // Reuse a registered generic Berrien discovery identity so projection
      // can resolve its source ownership while the test supplies its own raw
      // aggregate payload.
      sources: [
        source({
          sourceKey: 'berrien-news-discover',
          ownerSlug: 'berrien-county-ga',
          coverage: 'mentions',
          url: aggregateUrl,
          aggregateUrl,
        }),
      ],
    };
    const fetchedAt = '2026-09-12T12:00:00Z';
    try {
      await ds.getRepository(FoundationSourceSchema).save({
        id: 'berrien-news-discover',
        sourceKey: 'berrien-news-discover',
        ownerSlug: 'berrien-county-ga',
        coverage: 'mentions',
        adapter: 'rss',
        name: 'Generic news',
        url: aggregateUrl,
        kind: 'news',
        enabled: true,
        config: null,
        accessMode: 'full',
        aggregateDiscovery: true,
        aggregateUrl,
      });
      const version = await ds.getRepository(RawDocumentVersionSchema).save({
        sourceId: 'berrien-news-discover',
        url: aggregateUrl,
        checksum: 'restricted-direct',
        payloadKind: 'text',
        body: JSON.stringify({
          title: 'Berrien roads update - The Berrien Press',
          content:
            'Aggregate snippet only for this Nashville, Ga. publisher story.',
          pubDate: fetchedAt,
          creator: 'Google News',
          canonicalUrl: directUrl,
        }),
        contentType: 'application/rss-item+json',
        fetchedAt,
      });
      await ds.getRepository(RawDocumentSchema).save({
        sourceId: 'berrien-news-discover',
        urlHash: 'restricted-direct',
        url: aggregateUrl,
        contentType: 'application/rss-item+json',
        body: null,
        checksum: 'restricted-direct',
        fetchedAt,
        activeVersionId: version.id,
      });
      const parsed = await parseAll(ds, locality, {
        httpClient: {
          fetch: async () => {
            throw new Error(
              'publisher and aggregate network must not be requested during parse'
            );
          },
        },
        registry,
      });
      expect(parsed.inserted).toBe(1);
      const row = (
        await ds.query(
          'SELECT "canonicalUrl", "aggregateUrl", "unresolvedAggregateLink", "articleProvenance", uris FROM civic_items'
        )
      )[0] as Record<string, string | number | null>;
      expect(row['canonicalUrl']).toBe(directUrl);
      expect(row['aggregateUrl']).toBe(aggregateUrl);
      expect(row['unresolvedAggregateLink']).toBe(false);
      expect(row['articleProvenance'] as string).toMatch(/aggregate-metadata/);
      expect(row['uris'] as string).toMatch(/news\.google\.com/);
      expect(row['uris'] as string).toMatch(/theberrienpress\.com/);

      const projection = await projectItems(ds, 'nashville-ga', registry);
      expect(projection.included.length).toBe(1);
      const summarizer = {
        model: 'test',
        summarizeCluster: async () => ({
          summary: 'Aggregate-only summary.',
          model: 'test',
        }),
        tldr: async () => ({ bullets: [], model: 'test' }),
        summarizeThread: async () => ({
          summary: 'Aggregate-only thread.',
          model: 'test',
        }),
        developStory: async () => ({
          title: 'Aggregate-only story',
          narrative: 'Aggregate-only narrative.',
          status: 'developing',
          model: 'test',
        }),
      } as Summarizer;
      const rendered = await brief(
        ds,
        locality,
        'daily',
        '2026-09-12',
        '2026-09-13',
        summarizer,
        undefined,
        0
      );
      // The item is reported and cited; its citation and source entry link the
      // publisher's own address, never the aggregator's.
      expect(rendered.markdown.includes(`](${directUrl})`)).toBeTruthy();
      expect(!rendered.markdown.includes(`](${aggregateUrl})`)).toBeTruthy();
    } finally {
      await ds.destroy();
    }
  });

  it('allows canonical enrichment for WALB and Tifton Gazette items', async () => {
    let requests = 0;
    const httpClient: HttpClient = {
      fetch: async (url) => {
        requests += 1;
        const publisher = url.includes('tiftongazette.com')
          ? 'Tifton Gazette'
          : 'WALB';
        const response = new Response(
          articleHtml(
            `${publisher} reports a detailed road update with enough meaningful text for extraction.`
          ),
          { status: 200 }
        );
        return Object.assign(response, {
          finalUrl: url,
          redirectChain: [],
        }) as HttpResponse;
      },
    };
    const result = await enrichDraft(
      {
        title: 'Road update',
        body: 'A short snippet',
        kind: 'news',
        originalSnippet: 'A short snippet',
        publisher: 'WALB',
        originalUrl: 'https://walb.com/story/1',
      },
      { httpClient },
      source({
        sourceKey: 'walb',
        name: 'WALB',
        accessMode: 'full',
        aggregateDiscovery: false,
        aggregateUrl: undefined,
      })
    );
    expect(requests).toBe(1);
    expect(result.provenance.extraction).toBe('article');
    expect(result.body).toMatch(/WALB reports/);
    const tifton = await enrichDraft(
      {
        title: 'Road update',
        body: 'A short snippet',
        kind: 'news',
        originalSnippet: 'A short snippet',
        publisher: 'Tifton Gazette',
        originalUrl: 'https://tiftongazette.com/story/1',
      },
      { httpClient },
      source({
        sourceKey: 'tifton-gazette',
        name: 'Tifton Gazette',
        accessMode: 'full',
        aggregateDiscovery: false,
        aggregateUrl: undefined,
      })
    );
    expect(requests).toBe(2);
    expect(tifton.provenance.extraction).toBe('article');
    expect(tifton.body).toMatch(/Tifton Gazette reports/);
  });

  it('withholds a manually created unresolved item using its first-class flag', async () => {
    const registry = loadLocalityRegistry(
      join(__dirname, '../../../core/test/fixtures/localities-snapshot')
    );
    await withTestDataSource(async (ds) => {
      await ds.getRepository(CivicItemSchema).save({
        sourceId: 'adel-news-tribune',
        localitySlug: 'adel-ga',
        scopeSlug: 'cook-county-ga',
        scopeKind: 'county',
        kind: 'news',
        title: 'Aggregate result',
        body: 'Snippet only',
        summary: null,
        publishedAt: '2026-09-12T00:00:00Z',
        topics: '[]',
        uris: '["https://news.google.com/item"]',
        hash: 'manual-unresolved',
        createdAt: '2026-09-12T00:00:00Z',
        accessMode: 'snippet-only',
        unresolvedAggregateLink: true,
      });
      const result = await projectItems(ds, 'adel-ga', registry);
      expect(result.diagnostics[0]?.evidence.reason).toBe(
        'restricted aggregate article link is unresolved'
      );
      expect(await ds.getRepository('EditionItem').count()).toBe(0);
    });
  });
});
