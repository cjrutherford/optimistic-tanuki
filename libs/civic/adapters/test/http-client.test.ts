import { apptegyAdapter } from '../src/apptegy/index.js';
import { civicClerkAdapter } from '../src/civicclerk/index.js';
import { documentAdapter } from '../src/document/index.js';
import { granicusAdapter } from '../src/granicus/index.js';
import { httpScrapeAdapter } from '../src/http-scrape/index.js';
import { legistarAdapter } from '../src/legistar/index.js';
import { newsDiscoverAdapter } from '../src/news-discover/index.js';
import { openDataAdapter } from '../src/open-data/index.js';
import { rssAdapter } from '../src/rss/index.js';
import type {
  HttpResponse,
  SourceAdapter,
} from '@optimistic-tanuki/civic-core';

class StrictTestResponse extends Response implements HttpResponse {
  readonly finalUrl: string;
  readonly redirectChain: readonly string[];

  constructor(body: BodyInit | null, url: string) {
    super(body, { status: 200, headers: { 'content-type': 'text/xml' } });
    this.finalUrl = url;
    this.redirectChain = [url];
  }
}

const locality = {} as never;
const source = (adapter: string, config: Record<string, unknown> = {}) => ({
  sourceKey: `${adapter}-source`,
  ownerSlug: 'town-a',
  coverage: 'mentions' as const,
  adapter,
  name: adapter,
  url: `https://${adapter}.example.test/feed`,
  kind: 'news' as const,
  config,
});

describe('shared HTTP client delegation', () => {
  it('routes every network adapter through FetchContext.httpClient', async () => {
    let calls = 0;
    const httpClient = {
      fetch: async (_input: string) => {
        calls += 1;
        return new StrictTestResponse(
          '<rss><channel><item><title>Town update</title><link>https://town.example/story</link></item></channel></rss>',
          _input
        );
      },
    };
    const cases: [SourceAdapter, ReturnType<typeof source>][] = [
      [rssAdapter, source('rss')],
      [httpScrapeAdapter, source('http-scrape')],
      [openDataAdapter, source('open-data', { area: 'GA' })],
      [newsDiscoverAdapter, source('news-discover', { query: 'town' })],
      [civicClerkAdapter, source('civicclerk')],
      [granicusAdapter, source('granicus')],
      [legistarAdapter, source('legistar', { client: 'town' })],
      [apptegyAdapter, source('apptegy')],
      [documentAdapter, source('document')],
    ];
    for (const [adapter, config] of cases)
      await adapter.fetch(config, { locality, httpClient });
    expect(calls).toBe(cases.length);
  });
});
