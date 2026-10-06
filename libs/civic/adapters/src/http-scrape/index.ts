import * as cheerio from 'cheerio';
import type {
  DraftItem,
  FetchContext,
  FetchResult,
  RawDocumentInput,
  SourceAdapter,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';
import {
  isCalendarDate,
  readablePageText,
} from '@optimistic-tanuki/civic-core';

export type CheerioAPI = ReturnType<typeof cheerio.load>;

/** Honor <base href> when resolving relative links (e.g. Tift County). */
export function pageBase($: CheerioAPI, pageUrl: string): string {
  const base = $('base[href]').attr('href');
  if (!base) return pageUrl;
  try {
    return new URL(base, pageUrl).toString();
  } catch {
    return pageUrl;
  }
}

const UA = 'civic-pipeline/0.1 (civic intelligence POC)';

async function get(
  url: string,
  httpClient: FetchContext['httpClient']
): Promise<{ html: string; type: string }> {
  const res = await httpClient.fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return {
    html: await res.text(),
    type: res.headers.get('content-type') ?? 'text/html',
  };
}

const MONTH_RE =
  '(January|February|March|April|May|June|July|August|September|October|November|December)';

/**
 * Derive "Minutes 07/27/2026" from document URLs with empty anchor text.
 * Handles CivicPlus ViewFile, MonthName-DD-YYYY, YYYY-MM-DD, MMDDYYYY forms.
 */
export function titleFromUrl(url: string): string | null {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    /* keep the raw URL */
  }
  // Query strings carry cache busters ("?t=202609110946340"), not titles.
  url = decoded.split(/[?#]/u)[0] ?? decoded;
  const file = url.split('/').pop() ?? url;
  const kindMatch = url.match(/ViewFile\/(Agenda|Minutes|Packet)/i);
  const kind = kindMatch
    ? kindMatch[1].charAt(0).toUpperCase() + kindMatch[1].slice(1).toLowerCase()
    : 'Document';
  // A digit run only names a date when it reads as one: opaque file ids such as
  // "109363" must not become "10/93/2063".
  const dated = (month: string, day: string, year: string): string | null =>
    isCalendarDate(Number(year), Number(month), Number(day))
      ? `${kind} ${month}/${day}/${year}`
      : null;
  const patterns: [RegExp, string, (m: RegExpMatchArray) => string | null][] = [
    [/_(\d{2})(\d{2})(\d{4})/, url, (m) => dated(m[1], m[2], m[3])],
    [
      new RegExp(`${MONTH_RE}[-_](\\d{1,2})[-_](\\d{4})`, 'i'),
      file,
      (m) => `${kind} ${m[1]} ${m[2]}, ${m[3]}`,
    ],
    [/(\d{4})-(\d{2})-(\d{2})/, file, (m) => dated(m[2], m[3], m[1])],
    // County style: Regular-Session-Minutes-020326 or "07 07 2026" spaced,
    // Tift style: Agenda - Regular Session - 09.14.26.pdf
    [
      /(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/,
      file,
      (m) => dated(m[1], m[2], `20${m[3]}`),
    ],
    [
      /(?<!\d)(\d{2})\.(\d{2})\.(\d{2})(?!\d)/,
      file,
      (m) => dated(m[1], m[2], `20${m[3]}`),
    ],
    [
      /(?<!\d)(\d{1,2})\s(\d{1,2})\s(20\d{2})(?!\d)/,
      file,
      (m) => dated(m[1].padStart(2, '0'), m[2].padStart(2, '0'), m[3]),
    ],
    [
      /(?<!\d)(\d{2})(\d{2})(\d{4})(?!\d)/,
      file,
      (m) => dated(m[1], m[2], m[3]),
    ],
  ];
  for (const [pattern, subject, toTitle] of patterns) {
    const match = subject.match(pattern);
    const title = match ? toTitle(match) : null;
    if (title) return title;
  }
  return null;
}
/**
 * Generic HTML scraper. Source config:
 *   linkPattern: regex matched against anchor hrefs (e.g. "Agenda|Minutes|\\.pdf$")
 *   textSelector: optional CSS selector for the readable body; by default page chrome is removed generically
 */
export const httpScrapeAdapter: SourceAdapter = {
  name: 'http-scrape',

  async fetch(source: SourceConfig, ctx: FetchContext): Promise<FetchResult[]> {
    try {
      const { html, type } = await get(source.url, ctx.httpClient);
      const $ = cheerio.load(html);
      const base = pageBase($, source.url);
      const pattern = new RegExp(
        (source.config?.['linkPattern'] as string) ?? '.'
      );
      const seen = new Set<string>();
      const out: FetchResult[] = [];
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        const text = $(el).text().trim();
        if (!pattern.test(href) && !pattern.test(text)) return;
        const abs = new URL(href, base).toString();
        if (seen.has(abs)) return;
        seen.add(abs);
        out.push({
          kind: 'fetched',
          status: 200,
          url: abs,
          requestUrl: source.url,
          contentType: 'text/html-link',
          payload: { kind: 'text', body: JSON.stringify({ anchorText: text }) },
          fetchedAt: new Date().toISOString(),
        });
      });
      // Keep the index page itself only when no document links matched,
      // so nav/index titles don't pollute the briefing.
      if (out.length === 0) {
        out.push({
          kind: 'fetched',
          status: 200,
          url: source.url,
          requestUrl: source.url,
          contentType: type,
          payload: { kind: 'text', body: html },
          fetchedAt: new Date().toISOString(),
        });
      }
      return out;
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
            kind: /timeout|abort/i.test(String(error))
              ? 'timeout'
              : /HTTP\s+\d+/i.test(String(error))
              ? 'http'
              : 'network',
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
      throw new Error('http scraper requires text payload');
    const body = raw.payload.body;
    if (raw.contentType === 'text/html-link') {
      const { anchorText } = JSON.parse(body) as { anchorText: string };
      const title = anchorText.slice(0, 200) || titleFromUrl(raw.url);
      if (!title) return [];
      return [
        {
          title,
          body: `${source.name}: ${title} (${raw.url})`,
          kind: source.kind,
          uris: [raw.url],
        },
      ];
    }
    const $ = cheerio.load(body);
    const selector = source.config?.['textSelector'] as string | undefined;
    // An explicit selector is a per-site override; otherwise navigation,
    // headers, footers, and link lists are stripped generically.
    const text = (
      selector
        ? $(selector).first().text().replace(/\s+/g, ' ').trim()
        : readablePageText(body)
    ).slice(0, 3000);
    const title = $('title').text().trim() || source.name;
    if (!text) return [];
    return [{ title, body: text, kind: source.kind, uris: [raw.url] }];
  },
};
