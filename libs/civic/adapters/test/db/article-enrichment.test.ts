import { createTestSchema } from '../../../core/test/db/helpers/postgres.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanEditorialBody,
  enrichDiscoveredArticle,
  enrichDraft,
  isEditoriallyEligibleBody,
  isRestrictedPublisher,
  classifyArticleAccess,
  classifyPublisherAccess,
} from '@optimistic-tanuki/civic-core';
import { createFoundationDataSource } from '@optimistic-tanuki/civic-core';
import { registerAdapter } from '@optimistic-tanuki/civic-core';
import { parseAll } from '@optimistic-tanuki/civic-core';
import {
  FoundationSourceSchema,
  RawDocumentSchema,
  RawDocumentVersionSchema,
} from '@optimistic-tanuki/civic-core';
import { rssAdapter } from '../../src/rss/index.js';
import type {
  HttpClient,
  HttpResponse,
  LocalityConfig,
} from '@optimistic-tanuki/civic-core';
import { loadLocalityRegistry } from '@optimistic-tanuki/civic-core';

// Restricted publishers are derived from the checked-in locality configuration.
loadLocalityRegistry(join(__dirname, '../../../core/test/fixtures/localities'));

const fixture = (name: string) =>
  readFileSync(
    join(__dirname, '../../../core/test/fixtures/articles', name),
    'utf8'
  );

function client(
  body: string,
  meta: { finalUrl?: string; redirectChain?: string[]; error?: Error } = {}
): HttpClient {
  return {
    fetch: async () => {
      if (meta.error) throw meta.error;
      const response = new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
      return Object.assign(response, {
        finalUrl: meta.finalUrl ?? 'https://publisher.example/story/123',
        redirectChain: meta.redirectChain ?? [],
      }) as HttpResponse;
    },
  };
}

describe('discovered article enrichment', () => {
  it('cleans extracted navigation chrome while preserving article content', () => {
    const body =
      'Subscribe Home News Services Contact Us About Us Published 9:48 pm Saturday, September 12, 2026 The board announced a workshop. Most Popular 1 2 Sections Home News Privacy Policy';
    expect(cleanEditorialBody(body)).toBe(
      'Published 9:48 pm Saturday, September 12, 2026 The board announced a workshop.'
    );
  });

  it('removes carousel counters and swipe instructions from editorial evidence', () => {
    const body =
      'County budget update. 1/2 Swipe or click to see more The county proposed a balanced budget. 2 / 2 Swipe or click to see more Read the full notice.';
    const cleaned = cleanEditorialBody(body);
    expect(cleaned).toMatch(/County budget update/);
    expect(cleaned).toMatch(/proposed a balanced budget/);
    expect(cleaned).not.toMatch(
      /(?:1\s*\/\s*2|2\s*\/\s*2|swipe or click to see more)/i
    );
  });

  it('withholds navigation-only and empty extracted bodies from editorial evidence', () => {
    expect(
      isEditoriallyEligibleBody(
        'Subscribe Home News Services Contact About Sections Home News'
      )
    ).toBe(false);
    expect(
      isEditoriallyEligibleBody(
        'Meeting links and records are available here.',
        'meeting',
        'eBoard Site'
      )
    ).toBe(false);
    expect(
      isEditoriallyEligibleBody(
        'The board announced a workshop with a public agenda and meeting date.',
        'meeting',
        'School board workshop notice'
      )
    ).toBe(true);
  });

  it('classifies restricted publisher names and domains before enrichment', () => {
    expect(
      isRestrictedPublisher(
        'The BERRIEN Press',
        'https://news.google.com/rss/item'
      )
    ).toBe(true);
    expect(
      isRestrictedPublisher('Adel News-Tribune', 'https://example.test/story')
    ).toBe(true);
    expect(
      isRestrictedPublisher(
        'Other source',
        'https://WWW.TheBerrienPress.com/story/1'
      )
    ).toBe(true);
    expect(
      isRestrictedPublisher('Other source', 'https://publisher.example/story/1')
    ).toBe(false);
    expect(
      classifyPublisherAccess({
        publisher: 'Berrien Press',
        url: 'https://news.google.com/item',
      }).accessMode
    ).toBe('snippet-only');
  });

  it('downgrades restricted aggregate metadata without requesting the publisher body', async () => {
    let requests = 0;
    const result = await enrichDiscoveredArticle(
      {
        title: 'Road work',
        snippet: 'The county announced road work.',
        publisher: 'The Berrien Press',
        originalUrl: 'https://news.google.com/rss/articles/redirect',
      },
      {
        httpClient: {
          fetch: async () => {
            requests += 1;
            throw new Error('must not fetch');
          },
        },
      },
      {
        sourceKey: 'berrien-press',
        ownerSlug: 'berrien-county-ga',
        coverage: 'mentions',
        adapter: 'news-discover',
        name: 'The Berrien Press',
        url: 'https://news.google.com/rss/search?q=Berrien',
        kind: 'news',
        accessMode: 'snippet-only',
        accessRestrictionReason: 'Automated AI body retrieval is disallowed.',
        restrictionPolicyUrl: 'https://www.theberrienpress.com/robots.txt',
        aggregateDiscovery: true,
        aggregateUrl: 'https://news.google.com/rss/search?q=Berrien',
      }
    );
    expect(requests).toBe(0);
    expect(result.body).toBe('The county announced road work.');
    expect(result.provenance.extraction).toBe('snippet-fallback');
    expect(result.accessMode).toBe('snippet-only');
    expect(result.canonicalUrl).toBe(null);
    expect(result.aggregateUrl).toBe(
      'https://news.google.com/rss/search?q=Berrien'
    );
  });

  it('keeps an explicitly supplied direct publisher URL but not an aggregate redirect', () => {
    const direct = classifyArticleAccess(
      {
        title: 'Story',
        body: 'Snippet',
        kind: 'news',
        originalSnippet: 'Snippet',
        publisher: 'Adel News Tribune',
        originalUrl: 'https://news.google.com/rss/item',
        canonicalUrl: 'https://www.adelnewstribune.com/story/42',
      },
      {
        sourceKey: 'adel-news-tribune',
        ownerSlug: 'cook-county-ga',
        coverage: 'mentions',
        adapter: 'news-discover',
        name: 'Adel News Tribune',
        url: 'https://news.google.com/rss/search?q=Adel',
        kind: 'news',
        accessMode: 'snippet-only',
        accessRestrictionReason: 'blocked',
        restrictionPolicyUrl: 'https://www.adelnewstribune.com/robots.txt',
        aggregateDiscovery: true,
        aggregateUrl: 'https://news.google.com/rss/search?q=Adel',
      }
    );
    expect(direct.canonicalUrl).toBe(
      'https://www.adelnewstribune.com/story/42'
    );
    const unresolved = classifyArticleAccess(
      {
        title: 'Story',
        body: 'Snippet',
        kind: 'news',
        originalSnippet: 'Snippet',
        publisher: 'Adel News Tribune',
        originalUrl: 'https://news.google.com/rss/articles/redirect',
      },
      {
        sourceKey: 'adel-news-tribune',
        ownerSlug: 'cook-county-ga',
        coverage: 'mentions',
        adapter: 'news-discover',
        name: 'Adel News Tribune',
        url: 'https://news.google.com/rss/search?q=Adel',
        kind: 'news',
        accessMode: 'snippet-only',
        accessRestrictionReason: 'blocked',
        restrictionPolicyUrl: 'https://www.adelnewstribune.com/robots.txt',
        aggregateDiscovery: true,
        aggregateUrl: 'https://news.google.com/rss/search?q=Adel',
      }
    );
    expect(unresolved.canonicalUrl).toBe(null);
    expect(unresolved.unresolvedAggregateLink).toBe(true);
  });
  it('extracts readable article text, strips page chrome, and preserves final redirect provenance', async () => {
    const result = await enrichDiscoveredArticle(
      {
        title: 'Local road update',
        snippet: 'A short feed summary.',
        publisher: 'Local Ledger',
        originalUrl: 'https://news.example/item',
      },
      {
        httpClient: client(fixture('normal.html'), {
          finalUrl: 'https://publisher.example/story/123',
          redirectChain: [
            'https://news.example/item',
            'https://publisher.example/story/123',
          ],
        }),
      }
    );
    expect(result.body).toMatch(
      /^The county approved a bridge repair project on Old Mill Road/
    );
    expect(result.body).toMatch(/public works office during business hours\.$/);
    expect(result.body.split('\n\n').length).toBe(4);
    for (const chrome of [
      'Skip to content',
      'Subscribe',
      'Obituaries',
      'Swipe or click',
      'Email newsletter signup',
      'You Might Like',
      'School board sets budget hearing',
      'Most Popular',
      'Privacy Policy',
      'untrusted',
    ]) {
      expect(!result.body.includes(chrome)).toBeTruthy();
    }
    expect(result.canonicalUrl).toBe('https://publisher.example/story/123');
    expect(result.provenance).toStrictEqual({
      originalUrl: 'https://news.example/item',
      resolvedUrl: 'https://publisher.example/story/123',
      extraction: 'article',
      redirectChain: [
        'https://news.example/item',
        'https://publisher.example/story/123',
      ],
      checksum: createHash('sha256').update(result.body).digest('hex'),
      publisher: 'Local Ledger',
      extractionQuality: {
        method: 'readability',
        words: 113,
        proseRatio: 1,
        menuRatio: 0,
      },
    });
  });

  it('extracts a government news post without its menus, recent-post list, or footer', async () => {
    const result = await enrichDiscoveredArticle(
      {
        title: 'Flu vaccines',
        snippet: 'Vaccines available.',
        publisher: 'District Health',
        originalUrl: 'https://health.example/flu',
      },
      { httpClient: client(fixture('government-post.html')) }
    );
    expect(result.provenance.extraction).toBe('article');
    expect(result.body).toMatch(/^RIVERTON – The district health department/);
    for (const chrome of [
      'Skip to content',
      'Careers',
      'Recent Posts',
      'Clinic hours update',
      'All rights reserved',
    ])
      expect(!result.body.includes(chrome)).toBeTruthy();
  });

  it('rejects a listing page as boilerplate and keeps the feed snippet with quality diagnostics', async () => {
    const result = await enrichDiscoveredArticle(
      {
        title: 'Bridge repair',
        snippet: 'The county approved a bridge repair project.',
        publisher: 'Local Ledger',
        originalUrl: 'https://publisher.example/news',
      },
      { httpClient: client(fixture('listing.html')) }
    );
    expect(result.body).toBe('The county approved a bridge repair project.');
    expect(result.provenance.extraction).toBe('rejected-boilerplate');
    expect(result.provenance.extractionQuality?.proseRatio).toBe(0);
  });

  it('accepts same-origin canonical metadata and normalizes equivalent syndicated URLs', async () => {
    const first = await enrichDiscoveredArticle(
      {
        title: 'Same',
        snippet: 'Snippet',
        publisher: 'Paper',
        originalUrl: 'https://news.example/a',
      },
      {
        httpClient: client(fixture('duplicate-syndicated-a.html'), {
          finalUrl: 'https://publisher.example/story/123',
        }),
      }
    );
    const second = await enrichDiscoveredArticle(
      {
        title: 'Same',
        snippet: 'Snippet',
        publisher: 'Paper',
        originalUrl: 'https://news.example/b',
      },
      {
        httpClient: client(fixture('duplicate-syndicated-b.html'), {
          finalUrl: 'https://publisher.example/story/123',
        }),
      }
    );
    expect(first.canonicalUrl).toBe(second.canonicalUrl);
    expect(first.provenance.resolvedUrl).toBe(
      'https://publisher.example/story/123'
    );
  });

  it('falls back to a usable snippet for fetch, malformed, meaningless, and cross-origin canonical failures', async () => {
    const input = {
      title: 'Bridge repair',
      snippet: 'The county approved a bridge repair project for next month.',
      publisher: 'Local Ledger',
      originalUrl: 'https://news.example/story',
    };
    for (const [httpClient, extraction] of [
      [client('', { error: new Error('network failure') }), 'snippet-fallback'],
      [client(fixture('malformed.html')), 'rejected-boilerplate'],
      [
        client('<html><body><article>tiny</article></body></html>'),
        'rejected-boilerplate',
      ],
      [
        client(
          '<html><head><link rel="canonical" href="https://evil.example/steal"></head><body><article>Readable but rejected canonical.</article></body></html>'
        ),
        'snippet-fallback',
      ],
    ] as const) {
      const result = await enrichDiscoveredArticle(input, { httpClient });
      expect(result.body).toBe(input.snippet);
      expect(result.provenance.extraction).toBe(extraction);
      expect(result.canonicalUrl).toBe(input.originalUrl);
    }
  });

  it('uses fetch-failed only when no usable snippet exists', async () => {
    const result = await enrichDiscoveredArticle(
      {
        title: 'No details',
        snippet: '   ',
        originalUrl: 'https://news.example/empty',
      },
      { httpClient: client('', { error: new Error('network failure') }) }
    );
    expect(result.body).toBe('');
    expect(result.provenance.extraction).toBe('fetch-failed');
    expect(result.provenance.publisher).toBe(null);
  });

  it('retains redirect provenance when the final response is non-OK', async () => {
    const response = Object.assign(new Response('not found', { status: 404 }), {
      finalUrl: 'https://publisher.example/missing',
      redirectChain: [
        'https://news.example/missing',
        'https://publisher.example/missing',
      ],
    }) as HttpResponse;
    const result = await enrichDiscoveredArticle(
      {
        title: 'Missing',
        snippet: 'A useful feed summary.',
        originalUrl: 'https://news.example/missing',
      },
      { httpClient: { fetch: async () => response } }
    );
    expect(result.body).toBe('A useful feed summary.');
    expect(result.provenance.extraction).toBe('snippet-fallback');
    expect(result.provenance.resolvedUrl).toBe(
      'https://publisher.example/missing'
    );
    expect(result.provenance.redirectChain).toStrictEqual([
      'https://news.example/missing',
      'https://publisher.example/missing',
    ]);
  });

  it('uses finite timeout and deterministic byte-bounded snippet fallback', async () => {
    const hanging = {
      fetch: async (_input: string, init?: RequestInit) =>
        new Promise<HttpResponse>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('timeout')),
            { once: true }
          );
        }),
    };
    const timeoutResult = await enrichDiscoveredArticle(
      {
        title: 'Timeout',
        snippet: 'A useful timeout summary.',
        originalUrl: 'https://news.example/timeout',
      },
      { httpClient: hanging, timeoutMs: 10 }
    );
    expect(timeoutResult.body).toBe('A useful timeout summary.');
    expect(timeoutResult.provenance.extraction).toBe('snippet-fallback');

    const oversized = Object.assign(
      new Response('x', { status: 200, headers: { 'content-length': '999' } }),
      {
        finalUrl: 'https://news.example/oversized',
        redirectChain: ['https://news.example/oversized'],
      }
    ) as HttpResponse;
    const declaredResult = await enrichDiscoveredArticle(
      {
        title: 'Large',
        snippet: 'A useful size summary.',
        originalUrl: 'https://news.example/oversized',
      },
      { httpClient: { fetch: async () => oversized }, maxBytes: 4 }
    );
    expect(declaredResult.body).toBe('A useful size summary.');
    expect(declaredResult.provenance.extraction).toBe('snippet-fallback');

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('123'));
        controller.enqueue(new TextEncoder().encode('456'));
        controller.close();
      },
    });
    const chunked = Object.assign(new Response(stream, { status: 200 }), {
      finalUrl: 'https://news.example/chunked',
      redirectChain: ['https://news.example/chunked'],
    }) as HttpResponse;
    const chunkedResult = await enrichDiscoveredArticle(
      {
        title: 'Chunked',
        snippet: 'A useful chunk summary.',
        originalUrl: 'https://news.example/chunked',
      },
      { httpClient: { fetch: async () => chunked }, maxBytes: 4 }
    );
    expect(chunkedResult.body).toBe('A useful chunk summary.');
    expect(chunkedResult.provenance.extraction).toBe('snippet-fallback');
  });

  it('refuses a restricted final target even when a misconfigured source bypasses parser policy', async () => {
    let bodyRead = false;
    const response = Object.assign(
      new Response('restricted body', { status: 200 }),
      {
        finalUrl: 'https://theberrienpress.com/story/blocked',
        redirectChain: [
          'https://aggregate.example/item',
          'https://theberrienpress.com/story/blocked',
        ],
      }
    ) as HttpResponse;
    const originalText = response.text.bind(response);
    response.text = (() => {
      bodyRead = true;
      return originalText();
    }) as typeof response.text;
    const result = await enrichDiscoveredArticle(
      {
        title: 'Blocked',
        snippet: 'Aggregate-only details.',
        originalUrl: 'https://aggregate.example/item',
        publisher: 'Unknown aggregate source',
      },
      { httpClient: { fetch: async () => response } }
    );
    expect(bodyRead).toBe(false);
    expect(result.provenance.extraction).toBe('snippet-fallback');
    expect(result.body).toBe('Aggregate-only details.');
    expect(result.canonicalUrl).toBe(null);
  });

  it('refuses a restricted configured source URL before any body request', async () => {
    let requests = 0;
    const source = {
      sourceKey: 'misconfigured-berrien',
      ownerSlug: 'article-town',
      coverage: 'mentions',
      adapter: 'rss',
      name: 'Generic News Feed',
      url: 'https://www.theberrienpress.com/feed',
      kind: 'news',
      accessMode: 'full',
      enabled: true,
    } as const;
    const result = await enrichDraft(
      {
        title: 'Restricted story',
        body: 'Aggregate snippet only.',
        kind: 'news',
        originalSnippet: 'Aggregate snippet only.',
        originalUrl: 'https://news.google.com/rss/item',
        publisher: 'Unknown aggregate source',
      },
      {
        httpClient: {
          fetch: async () => {
            requests += 1;
            throw new Error('must not fetch');
          },
        },
      },
      source,
      '2026-09-13T00:00:00Z'
    );
    expect(requests).toBe(0);
    expect(result.accessMode).toBe('snippet-only');
    expect(result.body).toBe('Aggregate snippet only.');
    expect(result.provenance.extraction).toBe('snippet-fallback');
  });

  it('classifies an explicit restricted canonical metadata URL before body enrichment', async () => {
    let requests = 0;
    const result = await enrichDiscoveredArticle(
      {
        title: 'Restricted story',
        snippet: 'Aggregate snippet only.',
        publisher: 'Unknown aggregate source',
        originalUrl: 'https://news.google.com/rss/item',
        canonicalUrl: 'https://adelnewstribune.com/story/42',
      },
      {
        httpClient: {
          fetch: async () => {
            requests += 1;
            throw new Error('must not fetch');
          },
        },
      }
    );
    expect(requests).toBe(0);
    expect(result.accessMode).toBe('snippet-only');
    expect(result.canonicalUrl).toBe('https://adelnewstribune.com/story/42');
    expect(result.unresolvedAggregateLink).toBe(false);
  });

  it('accepts an explicit sourceUrl alias for restricted direct metadata', async () => {
    let requests = 0;
    const result = await enrichDraft(
      {
        title: 'Restricted source URL',
        body: 'Aggregate snippet only.',
        kind: 'news',
        originalSnippet: 'Aggregate snippet only.',
        originalUrl: 'https://news.google.com/rss/item',
        publisher: 'Unknown aggregate source',
        sourceUrl: 'https://www.theberrienpress.com/story/9',
      },
      {
        httpClient: {
          fetch: async () => {
            requests += 1;
            throw new Error('must not fetch');
          },
        },
      }
    );
    expect(requests).toBe(0);
    expect(result.canonicalUrl).toBe('https://www.theberrienpress.com/story/9');
    expect(result.unresolvedAggregateLink).toBe(false);
  });

  it('refuses a restricted aggregateUrl in a bypassed source row before body enrichment', async () => {
    let requests = 0;
    const result = await enrichDraft(
      {
        title: 'Restricted aggregate result',
        body: 'Snippet only.',
        kind: 'news',
        originalSnippet: 'Snippet only.',
        originalUrl: 'https://news.google.com/rss/item',
        publisher: 'Unknown source',
      },
      {
        httpClient: {
          fetch: async () => {
            requests += 1;
            throw new Error('must not fetch');
          },
        },
      },
      {
        sourceKey: 'misconfigured-adel',
        ownerSlug: 'article-town',
        coverage: 'mentions',
        adapter: 'news-discover',
        name: 'Generic discovery',
        url: 'https://news.google.com/rss/search?q=Adel',
        kind: 'news',
        accessMode: 'full',
        aggregateUrl: 'https://adelnewstribune.com/feed',
      }
    );
    expect(requests).toBe(0);
    expect(result.accessMode).toBe('snippet-only');
    expect(result.body).toBe('Snippet only.');
  });

  it('passes explicit canonical metadata through draft enrichment for unrestricted aggregate results', async () => {
    const result = await enrichDraft(
      {
        title: 'Syndicated story',
        body: 'Aggregate snippet.',
        kind: 'news',
        originalSnippet: 'Aggregate snippet.',
        publisher: 'Local Ledger',
        originalUrl: 'https://news.google.com/rss/item',
        canonicalUrl: 'https://publisher.example/story/42',
      },
      {
        httpClient: client(
          '<html><body><article>The aggregate result contains enough detailed article text for extraction.</article></body></html>',
          { finalUrl: 'https://news.google.com/rss/item' }
        ),
      }
    );
    expect(result.canonicalUrl).toBe('https://publisher.example/story/42');
    expect(result.provenance.canonicalUrlSource).toBe('aggregate-metadata');
  });

  it('keeps a successful aggregate-host response snippet-only instead of extracting the aggregate page', async () => {
    const result = await enrichDiscoveredArticle(
      {
        title: 'Aggregate result',
        snippet: 'The county approved a bridge project.',
        publisher: 'Local Ledger',
        originalUrl: 'https://news.example/story',
      },
      {
        httpClient: client(
          '<html><body><article>This is aggregate page chrome with a long article-like result that must never be treated as the publisher article.</article></body></html>',
          {
            finalUrl: 'https://news.google.com/articles/aggregate-result',
            redirectChain: [
              'https://news.example/story',
              'https://news.google.com/articles/aggregate-result',
            ],
          }
        ),
      }
    );
    expect(result.body).toBe('The county approved a bridge project.');
    expect(result.provenance.extraction).toBe('snippet-fallback');
    expect(result.canonicalUrl).toBe(null);
    expect(result.accessMode).toBe('snippet-only');
    expect(result.aggregateUrl).toBe(
      'https://news.google.com/articles/aggregate-result'
    );
    expect(result.unresolvedAggregateLink).toBe(true);
    expect(result.provenance.canonicalUrlSource).toBe('unresolved');
  });

  it('keeps a direct metadata canonical URL when the successful response ends at an aggregate host', async () => {
    const result = await enrichDiscoveredArticle(
      {
        title: 'Aggregate result',
        snippet: 'The county approved a bridge project.',
        publisher: 'Local Ledger',
        originalUrl: 'https://news.example/story',
        canonicalUrl: 'https://publisher.example/story/42',
      },
      {
        httpClient: client(
          '<html><body><article>Aggregate page text that is not the publisher article.</article></body></html>',
          {
            finalUrl: 'https://news.google.com/articles/aggregate-result',
            redirectChain: [
              'https://news.example/story',
              'https://news.google.com/articles/aggregate-result',
            ],
          }
        ),
      }
    );
    expect(result.body).toBe('The county approved a bridge project.');
    expect(result.provenance.extraction).toBe('snippet-fallback');
    expect(result.canonicalUrl).toBe('https://publisher.example/story/42');
    expect(result.provenance.canonicalUrlSource).toBe('aggregate-metadata');
    expect(result.unresolvedAggregateLink).toBe(false);
  });

  it('loads and exercises the redirect and failure-snippet fixtures', async () => {
    const failure = JSON.parse(fixture('failure-snippet.json')) as {
      title: string;
      snippet: string;
      publisher: string;
      originalUrl: string;
    };
    const redirected = await enrichDiscoveredArticle(
      {
        title: 'Redirected',
        snippet: 'Feed snippet',
        publisher: 'Local Ledger',
        originalUrl: 'https://news.example/redirect',
      },
      {
        httpClient: client(fixture('redirect.html'), {
          finalUrl: 'https://publisher.example/redirected',
          redirectChain: [
            'https://news.example/redirect',
            'https://publisher.example/redirected',
          ],
        }),
      }
    );
    expect(redirected.body).toMatch(/Redirected article body/);
    expect(redirected.provenance.resolvedUrl).toBe(
      'https://publisher.example/redirected'
    );
    const failed = await enrichDiscoveredArticle(failure, {
      httpClient: client('', { error: new Error('fixture failure') }),
    });
    expect(failed.originalSnippet).toBe(failure.snippet);
    expect(failed.publisher).toBe(failure.publisher);
    expect(failed.provenance.extraction).toBe('snippet-fallback');
  });

  it('never promotes an aggregate URL to canonical article evidence after a 503', async () => {
    const result = await enrichDiscoveredArticle(
      {
        title: 'Aggregate-only result',
        snippet: 'A useful snippet.',
        publisher: 'Unknown aggregate source',
        originalUrl: 'https://news.google.com/rss/articles/abc',
      },
      { httpClient: client('', { error: new Error('HTTP 503') }) }
    );
    expect(result.canonicalUrl).toBe(null);
    expect(result.unresolvedAggregateLink).toBe(true);
    expect(result.provenance.canonicalUrlSource).toBe('unresolved');
  });

  it('enriches RSS news drafts in parseAll with the injected client and persists provenance metadata', async () => {
    registerAdapter(rssAdapter);
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    const locality: LocalityConfig = {
      slug: 'article-town',
      name: 'Article Town',
      state: 'GA',
      timezone: 'America/New_York',
      lat: 31,
      lon: -83,
      topics: ['news'],
      cadence: ['daily'],
      kind: 'town',
      parents: [],
      edition: true,
      sources: [
        {
          sourceKey: 'article-rss',
          ownerSlug: 'article-town',
          coverage: 'mentions',
          adapter: 'rss',
          name: 'RSS',
          url: 'https://news.example/feed',
          kind: 'news',
          enabled: true,
        },
      ],
    };
    try {
      await ds.getRepository(FoundationSourceSchema).save({
        id: 'article-rss',
        sourceKey: 'article-rss',
        ownerSlug: 'article-town',
        coverage: 'mentions',
        adapter: 'rss',
        name: 'RSS',
        url: locality.sources[0]!.url,
        kind: 'news',
        enabled: true,
        config: null,
      });
      const version = await ds.getRepository(RawDocumentVersionSchema).save({
        sourceId: 'article-rss',
        url: 'https://news.example/item',
        checksum: 'raw-checksum',
        payloadKind: 'text',
        body: JSON.stringify({
          title: 'Local road update',
          content: 'A short feed summary.',
          pubDate: '2026-09-12T00:00:00Z',
          creator: 'Local Ledger',
        }),
        contentType: 'application/rss-item+json',
        fetchedAt: '2026-09-12T00:00:00Z',
      });
      await ds.getRepository(RawDocumentSchema).save({
        sourceId: 'article-rss',
        urlHash: 'article-url',
        url: 'https://news.example/item',
        contentType: 'application/rss-item+json',
        body: null,
        checksum: 'raw-checksum',
        fetchedAt: '2026-09-12T00:00:00Z',
        activeVersionId: version.id,
      });
      const parsed = await parseAll(ds, locality, {
        httpClient: client(fixture('normal.html'), {
          finalUrl: 'https://publisher.example/story/123',
        }),
      });
      expect(parsed.inserted).toBe(1);
      const row = (
        await ds.query(
          'SELECT body, "originalSnippet", publisher, "canonicalUrl", "articleProvenance", "contentChecksum", uris FROM civic_items'
        )
      )[0] as Record<string, string>;
      expect(row['originalSnippet']).toBe('A short feed summary.');
      expect(row['publisher']).toBe('Local Ledger');
      expect(row['canonicalUrl']).toBe('https://publisher.example/story/123');
      expect(JSON.parse(row['articleProvenance']).extraction).toBe('article');
      expect(JSON.parse(row['uris'])).toStrictEqual([
        'https://news.example/item',
        'https://publisher.example/story/123',
      ]);
      expect(row['contentChecksum']).toBe(
        createHash('sha256')
          .update(row['body'] ?? '')
          .digest('hex')
      );
    } finally {
      await ds.destroy();
    }
  });
});
