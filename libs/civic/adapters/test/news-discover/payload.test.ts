import { newsDiscoverAdapter } from '../../src/news-discover/index.js';
import { loadLocalityRegistry } from '@optimistic-tanuki/civic-core';
import { join } from 'node:path';

// Restricted publishers are derived from the checked-in locality configuration.
loadLocalityRegistry(join(__dirname, '../../../core/test/fixtures/localities'));

const source = {
  sourceKey: 'discover-test',
  ownerSlug: 'town-a',
  coverage: 'mentions' as const,
  adapter: 'news-discover',
  name: 'Discovery',
  url: 'https://news.example.test',
  kind: 'news' as const,
  config: { matchNames: ['Town A'] },
};

describe('news discovery payload contract', () => {
  it('applies locality matching to text payloads', async () => {
    const [item] = await newsDiscoverAdapter.parse(
      {
        url: 'https://news.example.test/story',
        contentType: 'application/gnews-item+json',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            title: 'Town A council - Local paper',
            description: 'Town A approved a measure',
            pubDate: null,
          }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.title).toMatch(/Town A council/);
    expect(item.originalSnippet).toBe('Town A approved a measure');
    expect(item.publisher).toBe('Local paper');
    expect(item.originalUrl).toBe('https://news.example.test/story');
  });

  it('preserves explicit aggregate article metadata without resolving redirects', async () => {
    const [item] = await newsDiscoverAdapter.parse(
      {
        url: 'https://news.google.com/rss/articles/redirect',
        contentType: 'application/gnews-item+json',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            title: 'Adel update - Adel News Tribune',
            description: 'A short aggregate snippet',
            pubDate: '2026-09-12T00:00:00Z',
            canonicalUrl: 'https://www.adelnewstribune.com/story/42',
            articleUrl: 'https://www.adelnewstribune.com/story/42',
          }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      { ...source, config: { matchNames: ['Adel'] } }
    );
    expect(item.canonicalUrl).toBe('https://www.adelnewstribune.com/story/42');
    expect(item.originalUrl).toBe(
      'https://news.google.com/rss/articles/redirect'
    );
  });

  it('preserves a hyphenated restricted publisher suffix for item-level policy', async () => {
    const [item] = await newsDiscoverAdapter.parse(
      {
        url: 'https://news.google.com/rss/articles/redirect',
        contentType: 'application/gnews-item+json',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            title: 'Adel update - Adel News-Tribune',
            description: 'A short aggregate snippet',
            pubDate: null,
          }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      { ...source, config: { matchNames: ['Adel'] } }
    );
    expect(item.publisher).toBe('Adel News-Tribune');
  });

  it('rejects a restricted source row before making discovery requests', async () => {
    let requests = 0;
    await expect(
      (() =>
        newsDiscoverAdapter.fetch(
          {
            ...source,
            url: 'https://edge.adelnewstribune.com:8443/feed',
            config: { query: 'Adel', matchNames: ['Adel'] },
          },
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
