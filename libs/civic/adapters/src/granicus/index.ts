import * as cheerio from 'cheerio';
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

export interface MeetingLink {
  dateText: string;
  rowTitle: string;
  docType: 'Agenda' | 'Minutes' | 'Packet' | 'Video';
  url: string;
}

/**
 * Parse a Granicus ViewPublisher meeting list. Rows carry a date/title plus
 * per-row Agenda / Minutes / Packet / Video links.
 * Source config: { rowSelector?, dateSelector? } to override defaults.
 */
export function parseMeetingList(
  html: string,
  base: string,
  opts?: { rowSelector?: string; dateSelector?: string }
): MeetingLink[] {
  const $ = cheerio.load(html);
  const out: MeetingLink[] = [];
  const rows = $(opts?.rowSelector ?? 'tr, .meeting-row, .event-row');
  rows.each((_, row) => {
    const $row = $(row);
    const rowText = $row.text().replace(/\s+/g, ' ').trim();
    if (!/(agenda|minutes|packet|video)/i.test(rowText)) return;
    const dateText =
      opts?.dateSelector != null
        ? $row.find(opts.dateSelector).text().trim()
        : rowText.slice(0, 120);
    const rowTitle =
      truncate($row.find('td').first().text().trim(), 150) ||
      truncate(rowText, 150);
    $row.find('a[href]').each((_, el) => {
      const label = $(el).text().trim();
      const href = $(el).attr('href') ?? '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:'))
        return;
      const m = label.match(/agenda packet|packet|agenda|minutes|video/i);
      if (!m) return;
      const kind = m[0].toLowerCase();
      out.push({
        dateText,
        rowTitle,
        docType:
          kind === 'packet' || kind === 'agenda packet'
            ? 'Packet'
            : kind === 'minutes'
            ? 'Minutes'
            : kind === 'video'
            ? 'Video'
            : 'Agenda',
        url: new URL(href, base).toString(),
      });
    });
  });
  return out;
}

export const granicusAdapter: SourceAdapter = {
  name: 'granicus',

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
      const html = await res.text();
      const links = parseMeetingList(
        html,
        source.url,
        source.config as
          | { rowSelector?: string; dateSelector?: string }
          | undefined
      );
      const now = new Date().toISOString();
      const seen = new Set<string>();
      return links
        .filter(
          (l) =>
            l.docType !== 'Video' && !seen.has(l.url) && (seen.add(l.url), true)
        )
        .map((l) => ({
          kind: 'fetched' as const,
          status: 200 as const,
          url: l.url,
          requestUrl: source.url,
          contentType: 'application/granicus-link+json',
          payload: { kind: 'text' as const, body: JSON.stringify(l) },
          fetchedAt: now,
        }));
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
      throw new Error('granicus parser requires text payload');
    const link = JSON.parse(raw.payload.body) as MeetingLink;
    const title = truncate(`${link.rowTitle} — ${link.docType}`, 200);
    return [
      {
        title,
        body: `${source.name}: ${title} (${link.dateText})`,
        kind: source.kind,
        eventDate: meetingDateFromTitle(link.dateText) ?? undefined,
        uris: [raw.url],
      },
    ];
  },
};
