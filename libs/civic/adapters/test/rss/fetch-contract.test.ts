import { rssAdapter } from '../../src/rss/index.js';
import { loadLocalityRegistry } from '@optimistic-tanuki/civic-core';
import { join } from 'node:path';

// Restricted publishers are derived from the checked-in locality configuration.
loadLocalityRegistry(join(__dirname, '../../../core/test/fixtures/localities'));

const source = {
  sourceKey: 'rss-test',
  ownerSlug: 'town-a',
  coverage: 'mentions' as const,
  adapter: 'rss',
  name: 'RSS',
  url: 'https://example.test/feed',
  kind: 'news' as const,
};

describe('rss fetch contract', () => {
  it('parses one item from the text payload emitted by a 200 item result', async () => {
    const [item] = await rssAdapter.parse(
      {
        url: 'https://example.test/story',
        contentType: 'application/rss-item+json',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            title: 'Town story',
            content: 'Details',
            pubDate: '2026-09-12T00:00:00Z',
            creator: 'Local Ledger',
          }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.title).toBe('Town story');
    expect(item.publishedAt).toBe('2026-09-12T00:00:00Z');
    expect(item.originalSnippet).toBe('Details');
    expect(item.publisher).toBe('Local Ledger');
    expect(item.originalUrl).toBe('https://example.test/story');
  });

  it('preserves explicit canonical metadata carried by an aggregate item', async () => {
    const [item] = await rssAdapter.parse(
      {
        url: 'https://news.google.com/rss/articles/redirect',
        contentType: 'application/rss-item+json',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            title: 'Berrien update',
            content: 'Snippet',
            pubDate: '2026-09-12T00:00:00Z',
            creator: 'The Berrien Press',
            canonicalUrl: 'https://www.theberrienpress.com/story/8',
          }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.canonicalUrl).toBe('https://www.theberrienpress.com/story/8');
    expect(item.originalUrl).toBe(
      'https://news.google.com/rss/articles/redirect'
    );
  });

  it('pages WordPress feeds with a configured parameter and stops at the last page', async () => {
    const requested: string[] = [];
    const client = {
      fetch: async (url: string) => {
        requested.push(url);
        const page = new URL(url).searchParams.get('paged') ?? '1';
        if (page === '3')
          return Object.assign(new Response('not found', { status: 404 }), {
            finalUrl: url,
            redirectChain: [url],
          });
        const body = `<rss version="2.0"><channel><title>Feed</title><item><title>Story ${page}</title><link>https://example.test/story-${page}</link><description>Details</description><pubDate>Wed, 16 Sep 2026 11:26:59 +0000</pubDate></item></channel></rss>`;
        return Object.assign(
          new Response(body, {
            status: 200,
            headers: { 'content-type': 'application/rss+xml' },
          }),
          { finalUrl: url, redirectChain: [url] }
        );
      },
    };
    const results = await rssAdapter.fetch(
      {
        ...source,
        url: 'https://example.test/feed/',
        coverageCapabilities: {
          pagination: { mode: 'page', parameter: 'paged', maxPages: 5 },
        },
      },
      { locality: {} as never, httpClient: client as never }
    );
    expect(requested).toStrictEqual([
      'https://example.test/feed/?paged=1',
      'https://example.test/feed/?paged=2',
      'https://example.test/feed/?paged=3',
    ]);
    expect(results.map((result) => result.url)).toStrictEqual([
      'https://example.test/story-1',
      'https://example.test/story-2',
    ]);
  });

  it('uses documented date and page capabilities only when configured', async () => {
    const requests: string[] = [];
    const client = {
      fetch: async (url: string) => {
        requests.push(url);
        const page = new URL(url).searchParams.get('page');
        const title = page === '2' ? 'Second story' : 'First story';
        const response = new Response(
          `<rss version="2.0"><channel><title>Feed</title><item><title>${title}</title><link>https://example.test/${
            page ?? '1'
          }</link><description>Details</description><pubDate>2026-09-12T00:00:00Z</pubDate></item></channel></rss>`,
          { status: 200, headers: { 'content-type': 'application/rss+xml' } }
        );
        return Object.assign(response, { finalUrl: url, redirectChain: [url] });
      },
    };
    const results = await rssAdapter.fetch(
      {
        ...source,
        url: 'https://example.test/feed',
        coverageCapabilities: {
          dateQuery: { parameter: 'from', format: 'YYYY-MM-DD' },
          pagination: { mode: 'page', maxPages: 2 },
        },
      },
      {
        locality: {} as never,
        httpClient: client,
        coverageRange: {
          requestedStart: '2026-09-01',
          requestedEnd: '2026-09-13',
        },
      }
    );
    expect(results.length).toBe(2);
    expect(requests[0]!).toMatch(/from=2026-09-01/);
    expect(requests[0]!).toMatch(/page=1/);
    expect(requests[1]!).toMatch(/page=2/);
  });

  it('retains a direct RSS link for a restricted publisher as explicit metadata', async () => {
    const [item] = await rssAdapter.parse(
      {
        url: 'https://www.theberrienpress.com/story/8',
        contentType: 'application/rss-item+json',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            title: 'Berrien update',
            content: 'Snippet',
            pubDate: null,
            creator: 'The Berrien Press',
          }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.originalUrl).toBe('https://www.theberrienpress.com/story/8');
  });

  it('preserves a restricted title publisher even when a generic feed creator is present', async () => {
    const [item] = await rssAdapter.parse(
      {
        url: 'https://news.google.com/rss/articles/redirect',
        contentType: 'application/rss-item+json',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            title: 'Berrien update - The Berrien Press',
            content: 'Snippet',
            pubDate: null,
            creator: 'Google News',
          }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.publisher).toBe('The Berrien Press');
  });

  it('rejects a restricted source before making a feed request', async () => {
    let requests = 0;
    await expect(
      (() =>
        rssAdapter.fetch(
          { ...source, url: 'https://THEBERRIENPRESS.com/feed' },
          {
            locality: {} as never,
            httpClient: {
              fetch: async () => {
                requests += 1;
                throw new Error('must not fetch');
              },
            },
          }
        ))()
    ).rejects.toThrow(/restricted|aggregate|news-discover/i);
    expect(requests).toBe(0);
  });
});
