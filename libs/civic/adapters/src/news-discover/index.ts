import Parser from 'rss-parser';
import type {
  DraftItem,
  FetchContext,
  FetchResult,
  RawDocumentInput,
  SourceAdapter,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';
import { assertSourceRuntimeAccess } from '@optimistic-tanuki/civic-core';

const parser = new Parser({
  headers: { 'User-Agent': 'civic-pipeline/0.1 (civic intelligence POC)' },
  timeout: 20_000,
});

function originOf(value: string): string | null {
  try {
    const parsed = new URL(value.replace(/&amp;/gu, '&'));
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
}

/**
 * Publisher sites from `<source url="...">Publisher</source>`, keyed by item
 * link. rss-parser keeps only the element text, so the attribute is read from
 * the feed XML. The value is a homepage, never an article URL.
 */
export function publisherHomesByLink(xml: string): Map<string, string> {
  const homes = new Map<string, string>();
  for (const [item] of xml.matchAll(/<item\b[\s\S]*?<\/item>/gu)) {
    const link = item
      .match(/<link>([^<]+)<\/link>/u)?.[1]
      ?.replace(/&amp;/gu, '&')
      .trim();
    const url = item.match(/<source\b[^>]*\burl="([^"]+)"/u)?.[1];
    const home = url ? originOf(url) : null;
    if (link && home) homes.set(link, home);
  }
  return homes;
}

/**
 * Automatic local news discovery via Google News geo search.
 * Source config: { query, matchNames: string[] }.
 * Deterministic relevance gate: at least one match name (town, county,
 * landmarks) must appear in title/description. No human curation.
 */
export function isLocal(text: string, matchNames: string[]): boolean {
  const lower = text.toLowerCase();
  return matchNames.some((n) => lower.includes(n.toLowerCase()));
}

/** Obituaries dominate local search results but are not civic news. */
export function isObituary(title: string, publisher?: string | null): boolean {
  return (
    /\bobituar(?:y|ies)\b/iu.test(title) ||
    /obituar|\bobits\b|tribute archive|funeral home/iu.test(publisher ?? '')
  );
}

export function cleanTitle(title: string): {
  title: string;
  publisher?: string;
} {
  const m = title.match(/^(.*)\s+-\s+(.+)$/);
  if (m) return { title: m[1].trim(), publisher: m[2].trim() };
  return { title: title.trim() };
}

function requestUrlFor(
  source: SourceConfig,
  range?: FetchContext['coverageRange'],
  page?: number
): string {
  const query = source.config?.['query'] as string;
  const url = new URL(
    `https://news.google.com/rss/search?q=${encodeURIComponent(
      query
    )}&hl=en-US&gl=US&ceid=US:en`
  );
  const dateQuery = source.coverageCapabilities?.dateQuery;
  if (dateQuery && range)
    url.searchParams.set(
      dateQuery.parameter,
      dateQuery.format === 'RFC3339'
        ? `${range.requestedStart}T00:00:00Z`
        : range.requestedStart
    );
  if (
    page !== undefined &&
    source.coverageCapabilities?.pagination?.mode === 'page'
  )
    url.searchParams.set('page', String(page));
  return url.toString();
}

export interface NewsDiscoverCoverageMetadata {
  requestedStart?: string;
  requestedEnd?: string;
  observedDates: string[];
}

export const newsDiscoverAdapter: SourceAdapter = {
  name: 'news-discover',

  async fetch(source: SourceConfig, ctx: FetchContext): Promise<FetchResult[]> {
    assertSourceRuntimeAccess(source);
    const query = source.config?.['query'] as string;
    const url = requestUrlFor(source, ctx.coverageRange);
    try {
      const capability = source.coverageCapabilities?.pagination;
      const maxPages = capability?.maxPages ?? 1;
      const pages: {
        feed: Awaited<ReturnType<typeof parser.parseString>>;
        requestUrl: string;
        homes: Map<string, string>;
      }[] = [];
      let nextUrl: string | null = requestUrlFor(
        source,
        ctx.coverageRange,
        capability?.mode === 'page' ? 1 : undefined
      );
      for (let page = 1; nextUrl && page <= maxPages; page += 1) {
        const requestUrl: string = nextUrl;
        const response = await ctx.httpClient.fetch(requestUrl, {
          headers: {
            'User-Agent': 'civic-pipeline/0.1 (civic intelligence POC)',
          },
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok)
          throw new Error(
            `News discovery HTTP ${response.status} for ${requestUrl}`
          );
        const xml = await response.text();
        pages.push({
          feed: await parser.parseString(xml),
          requestUrl,
          homes: publisherHomesByLink(xml),
        });
        if (!capability || page >= maxPages) break;
        if (capability.mode === 'next-link') {
          const record = pages[pages.length - 1]!.feed as unknown as Record<
            string,
            unknown
          >;
          const candidate = record['next'] ?? record['nextLink'];
          nextUrl =
            typeof candidate === 'string' && candidate
              ? new URL(candidate, requestUrl).toString()
              : null;
        } else if (capability.mode === 'cursor') {
          const record = pages[pages.length - 1]!.feed as unknown as Record<
            string,
            unknown
          >;
          const cursor = record['nextCursor'] ?? record['cursor'];
          if (typeof cursor !== 'string' || !cursor) nextUrl = null;
          else {
            const parsed = new URL(requestUrl);
            parsed.searchParams.set('cursor', cursor);
            nextUrl = parsed.toString();
          }
        } else nextUrl = requestUrlFor(source, ctx.coverageRange, page + 1);
      }
      const now = new Date().toISOString();
      const range = ctx.coverageRange;
      return pages.flatMap(({ feed, requestUrl, homes }) =>
        (feed.items ?? [])
          .filter((i) => i.link && i.title)
          .map((i) => ({
            kind: 'fetched' as const,
            status: 200 as const,
            url: i.link as string,
            requestUrl,
            contentType: 'application/gnews-item+json',
            payload: {
              kind: 'text' as const,
              body: JSON.stringify({
                title: i.title as string,
                description: (i.contentSnippet ?? '').slice(0, 1000),
                pubDate: i.pubDate ?? null,
                // Google/Bing links are retained as aggregate provenance. A direct
                // publisher URL is accepted only when the feed explicitly exposes
                // one in its item metadata; no redirect is resolved here.
                canonicalUrl:
                  (i as unknown as Record<string, unknown>)['canonicalUrl'] ??
                  null,
                articleUrl:
                  (i as unknown as Record<string, unknown>)['articleUrl'] ??
                  null,
                publisherUrl:
                  (i as unknown as Record<string, unknown>)['publisherUrl'] ??
                  null,
                sourceUrl:
                  (i as unknown as Record<string, unknown>)['sourceUrl'] ??
                  null,
                publisherHome: homes.get(i.link as string) ?? null,
                ...(range
                  ? {
                      requestedStart: range.requestedStart,
                      requestedEnd: range.requestedEnd,
                    }
                  : {}),
                observedDate: i.pubDate ?? null,
                source: source.sourceKey,
              }),
            },
            fetchedAt: now,
            ...(i.pubDate ? { observedDates: [i.pubDate] } : {}),
          }))
      );
    } catch (error) {
      return [
        {
          kind: 'failed',
          status: null,
          url,
          requestUrl: url,
          contentType: 'application/rss+xml',
          fetchedAt: new Date().toISOString(),
          error: {
            kind: /timeout|abort/i.test(String(error)) ? 'timeout' : 'network',
            message: error instanceof Error ? error.message : String(error),
            retryable: true,
          },
        },
      ];
    }
  },

  async parse(
    raw: RawDocumentInput,
    source: SourceConfig
  ): Promise<DraftItem[]> {
    if (raw.payload.kind !== 'text')
      throw new Error('news discovery parser requires text payload');
    const item = JSON.parse(raw.payload.body) as {
      title: string;
      description: string;
      pubDate: string | null;
      canonicalUrl?: string | null;
      articleUrl?: string | null;
      publisherUrl?: string | null;
      sourceUrl?: string | null;
      publisherHome?: string | null;
      requestedStart?: string;
      requestedEnd?: string;
    };
    const matchNames =
      (source.config?.['matchNames'] as string[] | undefined) ?? [];
    if (!isLocal(`${item.title} ${item.description}`, matchNames)) return [];
    const { title, publisher } = cleanTitle(item.title);
    if (isObituary(item.title, publisher)) return [];
    // Publishers a source opts out of, e.g. arrest-booking listings.
    const excluded = (
      (source.config?.['excludePublishers'] as string[] | undefined) ?? []
    ).map((name) => name.toLowerCase());
    if (publisher && excluded.includes(publisher.toLowerCase())) return [];
    return [
      {
        title,
        body: `${publisher ? `[${publisher}] ` : ''}${
          item.description || title
        }`,
        kind: source.kind,
        publishedAt: item.pubDate ?? undefined,
        originalSnippet: item.description,
        publisher: publisher ?? null,
        originalUrl: raw.url,
        ...(item.canonicalUrl ||
        item.articleUrl ||
        item.publisherUrl ||
        item.sourceUrl
          ? {
              canonicalUrl:
                item.canonicalUrl ??
                item.articleUrl ??
                item.publisherUrl ??
                item.sourceUrl,
            }
          : {}),
        ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
        ...(item.publisherHome ? { publisherHome: item.publisherHome } : {}),
        topics: ['auto-discovered', ...(publisher ? [publisher] : [])],
        uris: [raw.url],
      },
    ];
  },
};
