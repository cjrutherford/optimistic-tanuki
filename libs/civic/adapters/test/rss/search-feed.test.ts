import { searchFeedUrls } from '../../src/rss/index.js';
import type { SourceConfig } from '@optimistic-tanuki/civic-core';

const source = (config: Record<string, unknown>) =>
  ({
    sourceKey: 'gazette',
    adapter: 'rss',
    name: 'Gazette',
    url: 'https://paper.example/feed/',
    kind: 'news',
    config,
  } as unknown as SourceConfig);

describe('publisher search feeds', () => {
  it('builds one encoded URL per query', () => {
    expect(
      searchFeedUrls(
        source({
          searchUrl: 'https://paper.example/?s={query}&feed=rss2',
          searchQueries: ['city council approves', 'commission votes'],
        })
      )
    ).toStrictEqual([
      'https://paper.example/?s=city%20council%20approves&feed=rss2',
      'https://paper.example/?s=commission%20votes&feed=rss2',
    ]);
  });

  it('is off unless both a template and queries are configured', () => {
    expect(searchFeedUrls(source({}))).toStrictEqual([]);
    expect(
      searchFeedUrls(source({ searchQueries: ['council approves'] }))
    ).toStrictEqual([]);
    expect(
      searchFeedUrls(source({ searchUrl: 'https://paper.example/?s={query}' }))
    ).toStrictEqual([]);
  });
});
