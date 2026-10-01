import {
  newsDiscoverAdapter,
  publisherHomesByLink,
} from '../../src/news-discover/index.js';
import type { SourceConfig } from '@optimistic-tanuki/civic-core';

describe('news discovery publisher site', () => {
  it('reads the publisher site from a real Google News item as an origin, never an article URL', () => {
    const xml = `<rss><channel><item><title>Adel business damaged in early morning fire - WALB</title><link>https://news.google.com/rss/articles/CBMifkFVX3?oc=5</link><guid isPermaLink="false">CBMifkFVX3</guid><source url="https://www.walb.com">WALB</source></item>
<item><title>Story - Paper</title><link>https://news.google.com/rss/articles/CBMiother?oc=5&amp;x=1</link><source url="https://paper.example/section/">Paper</source></item>
<item><title>No source</title><link>https://news.google.com/rss/articles/none</link></item></channel></rss>`;
    const homes = publisherHomesByLink(xml);
    expect(
      homes.get('https://news.google.com/rss/articles/CBMifkFVX3?oc=5')
    ).toBe('https://www.walb.com');
    expect(
      homes.get('https://news.google.com/rss/articles/CBMiother?oc=5&x=1')
    ).toBe('https://paper.example');
    expect(homes.has('https://news.google.com/rss/articles/none')).toBe(false);
  });

  it('carries the publisher site into the draft without treating it as canonical', async () => {
    const source = {
      sourceKey: 's',
      adapter: 'news-discover',
      name: 'S',
      url: 'https://news.google.com/rss/search?q=x',
      kind: 'news',
      config: { query: 'Adel', matchNames: ['Adel'] },
    } as unknown as SourceConfig;
    const [draft] = await newsDiscoverAdapter.parse(
      {
        url: 'https://news.google.com/rss/articles/CBMiabc',
        contentType: 'application/gnews-item+json',
        fetchedAt: '2026-09-19T00:00:00Z',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            title: 'Adel business damaged in early morning fire - WTXL',
            description: 'Adel fire',
            pubDate: null,
            publisherHome: 'https://www.wtxl.com',
          }),
        },
      },
      source
    );
    expect(draft?.publisherHome).toBe('https://www.wtxl.com');
    expect(draft?.canonicalUrl).toBe(undefined);
    expect(draft?.publisher).toBe('WTXL');
  });
});

describe('news discovery filters', () => {
  const source = {
    sourceKey: 's',
    adapter: 'news-discover',
    name: 'S',
    url: 'https://news.google.com/rss/search?q=x',
    kind: 'news',
    config: {
      query: 'Adel',
      matchNames: ['Adel'],
      excludePublishers: ['The Georgia Gazette'],
    },
  } as unknown as SourceConfig;
  const parse = (title: string) =>
    newsDiscoverAdapter.parse(
      {
        url: 'https://news.google.com/rss/articles/x',
        contentType: 'application/gnews-item+json',
        fetchedAt: '2026-09-19T00:00:00Z',
        payload: {
          kind: 'text',
          body: JSON.stringify({ title, description: title, pubDate: null }),
        },
      },
      source
    );

  it('drops obituaries and excluded publishers but keeps civic news', async () => {
    expect(
      (
        await parse(
          'William Cowart Obituary (2026) - Adel, GA - Legacy obituary'
        )
      ).length
    ).toBe(0);
    expect((await parse('Jane Doe - Adel - Tribute Archive')).length).toBe(0);
    expect((await parse('Adel man booked - The Georgia Gazette')).length).toBe(
      0
    );
    expect(
      (await parse('Adel business damaged in early morning fire - WTXL')).length
    ).toBe(1);
  });
});
