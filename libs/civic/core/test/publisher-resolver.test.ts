import {
  bestHeadlineMatch,
  parseListing,
  parseRobots,
  resolvePublisherArticle,
  robotsAllows,
} from '../src/publisher-resolver.js';
import { enrichDiscoveredArticle } from '../src/article-enrichment.js';
import type { HttpClient, HttpResponse } from '../src/types.js';

/** A fake web: URL → body. Any other URL (including the aggregator) fails the test. */
function site(
  pages: Record<string, string>,
  requested: string[] = []
): HttpClient {
  return {
    fetch: async (url: string) => {
      requested.push(url);
      expect(!url.includes('news.google.com')).toBeTruthy();
      const body = pages[url];
      const response = new Response(body ?? 'not found', {
        status: body === undefined ? 404 : 200,
        headers: {
          'content-type':
            url.endsWith('.xml') || url.endsWith('/feed/')
              ? 'application/xml'
              : 'text/html',
        },
      });
      return Object.assign(response, {
        finalUrl: url,
        redirectChain: [],
      }) as HttpResponse;
    },
  };
}

const GRAY_ROBOTS = `Sitemap: https://tv.example/news-sitemap.xml
User-agent: GPTBot
User-agent: anthropic-ai
User-agent: ClaudeBot
Disallow: /
User-agent: *
Allow: /news/
Disallow: /wires/`;

const OPEN_ROBOTS = `User-Agent: *
Disallow: /cms/
Disallow: /search?
Sitemap: https://paper.example/news-sitemap.xml`;

const NEWS_SITEMAP = `<?xml version="1.0"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
<url><loc>https://paper.example/news/local/adel-business-damaged-in-early-morning-fire</loc><news:news><news:title>Adel business damaged in early morning fire</news:title></news:news></url>
<url><loc>https://paper.example/news/local/county-approves-budget</loc><news:news><news:title>Cook County approves FY27 budget</news:title></news:news></url>
</urlset>`;

const ARTICLE = `<html><head><link rel="canonical" href="https://paper.example/news/local/adel-business-damaged-in-early-morning-fire"></head><body><nav>Home News Weather</nav><article><h1>Adel business damaged in early morning fire</h1>
<p>Firefighters in Adel responded to a fire at a downtown business early Tuesday morning, according to the Adel Fire Department.</p>
<p>No one was injured. The fire started in a storage room at the back of the building and spread into the ceiling before crews contained it.</p>
<p>The cause of the fire remains under investigation, and the business will stay closed while repairs are made, the owner said.</p></article></body></html>`;

describe('publisher robots.txt', () => {
  it('applies rules written for AI crawlers before the default group', () => {
    const robots = parseRobots(GRAY_ROBOTS, 'https://tv.example/robots.txt');
    expect(robots.namedGroup).toBe(true);
    expect(robotsAllows(robots, '/news/story')).toBe(false);
    expect(robots.sitemaps).toStrictEqual([
      'https://tv.example/news-sitemap.xml',
    ]);
  });

  it('uses the default group when no AI crawler is named, longest rule first', () => {
    const robots = parseRobots(OPEN_ROBOTS, 'https://paper.example/robots.txt');
    expect(robots.namedGroup).toBe(false);
    expect(robotsAllows(robots, '/news/local/story')).toBe(true);
    expect(robotsAllows(robots, '/cms/admin')).toBe(false);
    expect(robotsAllows(robots, '/search?q=adel')).toBe(false);
    const mixed = parseRobots(
      'User-agent: *\nDisallow: /news/\nAllow: /news/local/',
      'x'
    );
    expect(robotsAllows(mixed, '/news/local/a')).toBe(true);
    expect(robotsAllows(mixed, '/news/state/a')).toBe(false);
  });
});

describe('publisher listings and headline matching', () => {
  it('reads news sitemaps, sitemap indexes, and RSS feeds', () => {
    expect(parseListing(NEWS_SITEMAP).articles[0]?.title).toBe(
      'Adel business damaged in early morning fire'
    );
    expect(
      parseListing(
        '<sitemapindex><sitemap><loc>https://a.example/s1.xml</loc></sitemap></sitemapindex>'
      ).childSitemaps
    ).toStrictEqual(['https://a.example/s1.xml']);
    const feed = parseListing(
      '<rss><channel><item><title><![CDATA[Council sets millage]]></title><link>https://a.example/council-sets-millage/</link></item></channel></rss>'
    );
    expect(feed.articles).toStrictEqual([
      {
        url: 'https://a.example/council-sets-millage/',
        title: 'Council sets millage',
      },
    ]);
  });

  it('matches a headline by title, or by URL slug when the listing has no titles, and refuses weak matches', () => {
    const listed = parseListing(NEWS_SITEMAP).articles;
    expect(
      bestHeadlineMatch('Adel business damaged in early morning fire', listed)
        ?.url
    ).toBe(
      'https://paper.example/news/local/adel-business-damaged-in-early-morning-fire'
    );
    expect(
      bestHeadlineMatch('Adel business damaged in early-morning fire', [
        {
          url: 'https://paper.example/2026/09/15/adel-business-damaged-in-early-morning-fire/',
        },
      ])?.url
    ).toBe(
      'https://paper.example/2026/09/15/adel-business-damaged-in-early-morning-fire/'
    );
    expect(
      bestHeadlineMatch('Adel council discusses water rates', listed)
    ).toBe(null);
  });
});

describe('resolving an aggregate headline on the publisher site', () => {
  it('finds the article, fetches it from the publisher, and never requests the aggregator', async () => {
    const requested: string[] = [];
    const http = site(
      {
        'https://paper.example/robots.txt': OPEN_ROBOTS,
        'https://paper.example/news-sitemap.xml': NEWS_SITEMAP,
        'https://paper.example/news/local/adel-business-damaged-in-early-morning-fire':
          ARTICLE,
      },
      requested
    );
    const result = await enrichDiscoveredArticle(
      {
        title: 'Adel business damaged in early morning fire',
        snippet: 'Adel business damaged in early morning fire',
        publisher: 'Paper',
        originalUrl: 'https://news.google.com/rss/articles/CBMiabc?oc=5',
        publisherHome: 'https://paper.example',
      },
      { httpClient: http }
    );
    expect(result.provenance.extraction).toBe('article');
    expect(result.body).toMatch(/No one was injured/);
    expect(result.canonicalUrl).toBe(
      'https://paper.example/news/local/adel-business-damaged-in-early-morning-fire'
    );
    expect(result.accessMode).toBe('full');
    expect(result.unresolvedAggregateLink).toBe(false);
    expect(result.aggregateProvenance?.resolution).toBe('publisher-match');
    expect(result.aggregateProvenance?.publisherListing).toBe(
      'https://paper.example/news-sitemap.xml'
    );
    expect(result.aggregateUrl).toBe(
      'https://news.google.com/rss/articles/CBMiabc?oc=5'
    );
  });

  it('keeps the item snippet-only, citing robots.txt, when the publisher disallows AI crawlers', async () => {
    const requested: string[] = [];
    const http = site(
      { 'https://tv.example/robots.txt': GRAY_ROBOTS },
      requested
    );
    const result = await enrichDiscoveredArticle(
      {
        title: 'Adel business damaged in early morning fire',
        snippet: 'Firefighters responded to a fire in Adel.',
        publisher: 'TV',
        originalUrl: 'https://news.google.com/rss/articles/CBMixyz?oc=5',
        publisherHome: 'https://tv.example',
      },
      { httpClient: http }
    );
    expect(result.accessMode).toBe('snippet-only');
    expect(result.body).toBe('Firefighters responded to a fire in Adel.');
    expect(result.restrictionPolicyUrl).toBe('https://tv.example/robots.txt');
    expect(result.accessRestrictionReason ?? '').toMatch(/AI crawlers/);
    expect(requested).toStrictEqual(['https://tv.example/robots.txt']);
  });

  it('stays unresolved without fetching the aggregator when the headline is not listed', async () => {
    const http = site({
      'https://paper.example/robots.txt': OPEN_ROBOTS,
      'https://paper.example/news-sitemap.xml': NEWS_SITEMAP,
    });
    const result = await enrichDiscoveredArticle(
      {
        title: 'A story the publisher no longer lists',
        snippet: 'Snippet text.',
        publisher: 'Paper',
        originalUrl: 'https://news.google.com/rss/articles/CBMinone',
        publisherHome: 'https://paper.example',
      },
      { httpClient: http }
    );
    expect(result.provenance.extraction).toBe('snippet-fallback');
    expect(result.unresolvedAggregateLink).toBe(true);
    expect(result.canonicalUrl).toBe(null);
  });

  it('looks up each publisher once per client', async () => {
    const requested: string[] = [];
    const http = site(
      {
        'https://paper.example/robots.txt': OPEN_ROBOTS,
        'https://paper.example/news-sitemap.xml': NEWS_SITEMAP,
      },
      requested
    );
    await resolvePublisherArticle(
      {
        headline: 'Cook County approves FY27 budget',
        publisherHome: 'https://paper.example',
      },
      http
    );
    await resolvePublisherArticle(
      {
        headline: 'Adel business damaged in early morning fire',
        publisherHome: 'https://paper.example',
      },
      http
    );
    expect(requested.filter((url) => url.endsWith('robots.txt')).length).toBe(
      1
    );
  });
});
