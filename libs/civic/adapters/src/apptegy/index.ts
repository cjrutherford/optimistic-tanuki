import type {
  DraftItem,
  FetchContext,
  FetchResult,
  RawDocumentInput,
  SourceAdapter,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';
import { meetingDateFromTitle, truncate } from '@optimistic-tanuki/civic-core';

const UA = 'civic-pipeline/0.1 (civic intelligence POC)';

const JUNK_PATTERNS = [
  /menutranslate/i,
  /search site/i,
  /^\{"/,
  /"id":\d+/,
  /created_at/i,
  /opens_in_new_tab/i,
];

/**
 * Generic Apptegy (Thrillshare CMS) adapter. School/district pages are Nuxt
 * shells; article content ships statically in the embedded payload as escaped
 * HTML. Extracts paragraph blocks, drops nav/JSON noise.
 * Source config: { minLength?: number } (default 40).
 */
export function extractBlocks(html: string, minLength = 40): string[] {
  const unescaped = html.replace(/\\u003C/g, '<').replace(/\\u003E/g, '>');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of unescaped.matchAll(/<p[^>]*>(.*?)<\/p>/gs)) {
    const text = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < minLength || seen.has(text)) continue;
    if (JUNK_PATTERNS.some((p) => p.test(text))) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

export const apptegyAdapter: SourceAdapter = {
  name: 'apptegy',

  async fetch(source: SourceConfig, ctx: FetchContext): Promise<FetchResult[]> {
    try {
      const res = await ctx.httpClient.fetch(source.url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok)
        return [
          {
            kind: 'failed',
            status: res.status,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/html',
            fetchedAt: new Date().toISOString(),
            error: {
              kind: 'http',
              message: `HTTP ${res.status} for ${source.url}`,
              retryable: res.status >= 500,
              status: res.status,
            },
          },
        ];
      return [
        {
          kind: 'fetched',
          status: 200,
          url: source.url,
          requestUrl: source.url,
          contentType: 'text/apptegy-page',
          payload: { kind: 'text', body: await res.text() },
          fetchedAt: new Date().toISOString(),
        },
      ];
    } catch (error) {
      return [
        {
          kind: 'failed',
          status: null,
          url: source.url,
          requestUrl: source.url,
          contentType: 'text/html',
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
      throw new Error('apptegy parser requires text payload');
    const minLength = (source.config?.['minLength'] as number) ?? 40;
    return extractBlocks(raw.payload.body, minLength).map((block) => ({
      title: truncate(block, 150),
      body: `${source.name}: ${block}`,
      kind: source.kind,
      eventDate: meetingDateFromTitle(block) ?? undefined,
      uris: [raw.url],
    }));
  },
};
