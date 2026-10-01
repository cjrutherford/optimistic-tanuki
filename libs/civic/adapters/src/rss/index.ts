import Parser from 'rss-parser';
import type {
  DraftItem,
  FetchContext,
  FetchResult,
  RawDocumentInput,
  SourceAdapter,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';
import {
  assertSourceRuntimeAccess,
  isRestrictedPublisher,
} from '@optimistic-tanuki/civic-core';

const parser = new Parser({
  headers: { 'User-Agent': 'civic-pipeline/0.1 (civic intelligence POC)' },
  timeout: 20_000,
});

/**
 * A publisher's own search feed, one URL per query. Councils act between
 * editions and the result is reported in an article that a front-page feed
 * may have already pushed off: searching the publisher for decision wording
 * ("city council approves") recovers those outcomes from the publisher's own
 * site, with no aggregator involved.
 */
export function searchFeedUrls(source: SourceConfig): string[] {
  const template = source.config?.['searchUrl'] as string | undefined;
  const queries =
    (source.config?.['searchQueries'] as string[] | undefined) ?? [];
  if (!template || !queries.length) return [];
  return queries.map((query) =>
    template.replace('{query}', encodeURIComponent(query))
  );
}

function requestUrlFor(
  source: SourceConfig,
  range?: FetchContext['coverageRange'],
  page?: number
): string {
  const url = new URL(source.url);
  const dateQuery = source.coverageCapabilities?.dateQuery;
  if (dateQuery && range)
    url.searchParams.set(
      dateQuery.parameter,
      dateQuery.format === 'RFC3339'
        ? `${range.requestedStart}T00:00:00Z`
        : range.requestedStart
    );
  const pagination = source.coverageCapabilities?.pagination;
  if (page !== undefined && pagination?.mode === 'page')
    url.searchParams.set(pagination.parameter ?? 'page', String(page));
  return url.toString();
}

async function loadFeed(url: string, httpClient: FetchContext['httpClient']) {
  const response = await httpClient.fetch(url, {
    headers: { 'User-Agent': 'civic-pipeline/0.1 (civic intelligence POC)' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`RSS HTTP ${response.status} for ${url}`);
  return parser.parseString(await response.text());
}

/** Whether a feed page already reaches back to the requested start, so the next page would only be older. */
function reachesBack(
  items: readonly { pubDate?: string }[],
  requestedStart: string
): boolean {
  const days = items
    .map((item) => (item.pubDate ? new Date(item.pubDate) : null))
    .filter(
      (date): date is Date => date !== null && !Number.isNaN(date.getTime())
    );
  // A page with no dates says nothing about where it sits; keep going, up to the ceiling.
  if (!days.length) return false;
  const oldest = new Date(Math.min(...days.map((date) => date.getTime())))
    .toISOString()
    .slice(0, 10);
  return oldest < requestedStart;
}

export const rssAdapter: SourceAdapter = {
  name: 'rss',

  async fetch(source: SourceConfig, ctx: FetchContext): Promise<FetchResult[]> {
    assertSourceRuntimeAccess(source);
    try {
      const capability = source.coverageCapabilities?.pagination;
      const maxPages = capability?.maxPages ?? 1;
      const feeds: {
        feed: Awaited<ReturnType<typeof loadFeed>>;
        requestUrl: string;
      }[] = [];
      let nextUrl: string | null = requestUrlFor(
        source,
        ctx.coverageRange,
        capability?.mode === 'page' ? 1 : undefined
      );
      for (let page = 1; nextUrl && page <= maxPages; page += 1) {
        const requestUrl: string = nextUrl;
        let feed: Awaited<ReturnType<typeof loadFeed>>;
        try {
          feed = await loadFeed(requestUrl, ctx.httpClient);
        } catch (error) {
          // A feed returns an error past its last page; the pages already read stand.
          if (page > 1) break;
          throw error;
        }
        feeds.push({ feed, requestUrl });
        if (!capability || page >= maxPages) break;
        if (
          capability.untilCovered &&
          ctx.coverageRange &&
          reachesBack(feed.items ?? [], ctx.coverageRange.requestedStart)
        )
          break;
        if (capability.mode === 'next-link') {
          const candidate =
            (feed as unknown as Record<string, unknown>)['next'] ??
            (feed as unknown as Record<string, unknown>)['nextLink'];
          nextUrl =
            typeof candidate === 'string' && candidate
              ? new URL(candidate, requestUrl).toString()
              : null;
        } else if (capability.mode === 'cursor') {
          const value =
            (feed as unknown as Record<string, unknown>)['nextCursor'] ??
            (feed as unknown as Record<string, unknown>)['cursor'];
          if (typeof value !== 'string' || !value) nextUrl = null;
          else {
            const parsed = new URL(requestUrl);
            parsed.searchParams.set('cursor', value);
            nextUrl = parsed.toString();
          }
        } else {
          nextUrl = requestUrlFor(source, ctx.coverageRange, page + 1);
        }
      }
      for (const searchUrl of searchFeedUrls(source)) {
        try {
          feeds.push({
            feed: await loadFeed(searchUrl, ctx.httpClient),
            requestUrl: searchUrl,
          });
        } catch {
          // A search feed is supplementary; the configured feed still stands.
        }
      }
      const now = new Date().toISOString();
      return feeds.flatMap(({ feed, requestUrl }) =>
        (feed.items ?? [])
          .filter((i) => i.link)
          .map((i) => ({
            kind: 'fetched' as const,
            status: 200 as const,
            url: i.link as string,
            requestUrl,
            contentType: 'application/rss-item+json',
            payload: {
              kind: 'text' as const,
              body: JSON.stringify({
                title: i.title ?? '',
                content: i.contentSnippet ?? i.content ?? '',
                pubDate: i.pubDate ?? null,
                creator: i.creator ?? null,
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
                  (
                    (i as unknown as Record<string, unknown>)['enclosure'] as
                      | { url?: string }
                      | undefined
                  )?.url ??
                  null,
                ...(ctx.coverageRange
                  ? {
                      requestedStart: ctx.coverageRange.requestedStart,
                      requestedEnd: ctx.coverageRange.requestedEnd,
                    }
                  : {}),
                observedDate: i.pubDate ?? null,
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
          url: source.url,
          requestUrl: source.url,
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
      throw new Error('rss parser requires text payload');
    const item = JSON.parse(raw.payload.body) as {
      title: string;
      content: string;
      pubDate: string | null;
      creator?: string | null;
      canonicalUrl?: string | null;
      articleUrl?: string | null;
      publisherUrl?: string | null;
      sourceUrl?: string | null;
      requestedStart?: string;
      requestedEnd?: string;
    };
    if (!item.title) return [];
    // Aggregate titles end in " - Publisher"; a configured restricted
    // publisher suffix outranks a generic feed creator such as "Google News".
    const titleSuffix = item.title.match(/\s+-\s+([^-]+?)\s*$/u)?.[1] ?? null;
    const titlePublisher =
      titleSuffix && isRestrictedPublisher(titleSuffix) ? titleSuffix : null;
    return [
      {
        title: item.title,
        body: item.content || item.title,
        kind: source.kind,
        publishedAt: item.pubDate ?? undefined,
        originalSnippet: item.content,
        // A recognized restricted publisher suffix is stronger than a
        // generic feed creator (often "Google News" or a syndicator).
        publisher: titlePublisher ?? item.creator,
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
        topics:
          (source.config?.['topics'] as string[] | undefined) ?? undefined,
        uris: [raw.url],
      },
    ];
  },
};
