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
  meetingDateFromTitle,
  truncate,
  truncateSentences,
} from '@optimistic-tanuki/civic-core';

const UA = 'civic-pipeline/0.1 (civic intelligence POC)';

/**
 * CivicClerk (CivicWeb) meeting-list parser. EXPERIMENTAL: CivicClerk portal
 * markup varies by client; override selectors per locality.
 * Source config: { listSelector?, itemSelector?, datePattern? }.
 * Default: links whose text/URL mentions agenda, packet, or minutes.
 */
export function parseCivicClerkList(
  html: string,
  base: string,
  opts?: { listSelector?: string }
): { title: string; url: string; context: string }[] {
  const $ = cheerio.load(html);
  const out: { title: string; url: string; context: string }[] = [];
  const scope = opts?.listSelector ? $(opts.listSelector) : $.root();
  const seen = new Set<string>();
  scope.find('a[href]').each((_, el) => {
    const label = $(el).text().trim().replace(/\s+/g, ' ');
    const href = $(el).attr('href') ?? '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if (!/(agenda|packet|minutes)/i.test(`${label} ${href}`)) return;
    const abs = new URL(href, base).toString();
    if (seen.has(abs)) return;
    seen.add(abs);
    const context = $(el)
      .closest('li, tr, div')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
    out.push({ title: truncate(label, 200) || abs, url: abs, context });
  });
  return out;
}

/** A published file of one meeting, as the CivicClerk API lists it. */
interface CivicClerkFile {
  fileId: number;
  type: string;
  name: string;
  publishOn?: string | null;
}
interface CivicClerkEvent {
  id: number;
  eventName: string;
  startDateTime: string;
  categoryName?: string | null;
  eventLocation?: { address1?: string | null } | null;
  publishedFiles?: CivicClerkFile[] | null;
}

/** The text payload of one agenda or minutes file read through the API. */
export interface CivicClerkFilePayload {
  eventId: number;
  eventName: string;
  category: string | null;
  /** The meeting's local date. CivicClerk writes local wall time with a Z suffix. */
  date: string;
  type: 'Agenda' | 'Minutes';
  fileName: string;
  portalUrl: string;
  text: string;
}

/**
 * The tenant of a hosted CivicClerk portal: escambiacofl for
 * escambiacofl.civicclerk.com or escambiacofl.portal.civicclerk.com. Current
 * portals are script-built pages over a public JSON API at
 * {tenant}.api.civicclerk.com, which is what is read.
 */
export function civicClerkTenant(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const match = /^([a-z0-9-]+)\.(?:portal\.)?civicclerk\.com$/u.exec(host);
  return match && match[1] !== 'www' && match[1] !== 'api' ? match[1]! : null;
}

const DAY_MS = 86_400_000;
/** Agendas and minutes carry the business; an agenda packet repeats the agenda with hundreds of pages of backup. */
const READ_TYPES = new Set(['Agenda', 'Minutes']);
/** A county commission agenda runs past 60,000 characters; its later items are business too. */
const MAX_TEXT = 200_000;

async function fetchThroughApi(
  tenant: string,
  source: SourceConfig,
  ctx: FetchContext
): Promise<FetchResult[] | null> {
  const api = `https://${tenant}.api.civicclerk.com/v1`;
  const today = Date.now();
  const since =
    ctx.coverageRange?.requestedStart ??
    new Date(today - 180 * DAY_MS).toISOString().slice(0, 10);
  // Agendas are posted about a week ahead; later meetings have nothing yet.
  const until = new Date(today + 14 * DAY_MS).toISOString().slice(0, 10);
  const maxDocs = Number(
    (source.config as { maxDocs?: number } | undefined)?.maxDocs ?? 40
  );
  // The API pages its results (15 events a page) and names the next page.
  const events: CivicClerkEvent[] = [];
  let next: string | undefined = `${api}/Events?$filter=${encodeURIComponent(
    `startDateTime ge ${since} and startDateTime le ${until}`
  )}&$orderby=${encodeURIComponent('startDateTime asc')}`;
  for (let page = 0; next && page < 30; page += 1) {
    const res = await ctx.httpClient.fetch(next, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok || !/json/iu.test(res.headers.get('content-type') ?? ''))
      return page === 0 ? null : [];
    const body = (await res.json()) as
      | { value?: CivicClerkEvent[]; '@odata.nextLink'?: string }
      | CivicClerkEvent[];
    events.push(...(Array.isArray(body) ? body : body.value ?? []));
    next = Array.isArray(body) ? undefined : body['@odata.nextLink'];
    if (next && !next.startsWith(`${api}/`)) next = undefined;
  }
  // Most recent first, so a cap keeps the latest records.
  events.sort((a, b) => b.startDateTime.localeCompare(a.startDateTime));
  const files = events
    .flatMap((event) =>
      (event.publishedFiles ?? [])
        .filter((file) => READ_TYPES.has(file.type))
        .map((file) => ({ event, file }))
    )
    .slice(0, maxDocs);
  const results: FetchResult[] = [];
  for (const { event, file } of files) {
    const fileUrl = `${api}/Meetings/GetMeetingFileStream(fileId=${file.fileId},plainText=true)`;
    const portalUrl = `https://${tenant}.portal.civicclerk.com/event/${
      event.id
    }/files/${file.type === 'Minutes' ? 'minutes' : 'agenda'}/${file.fileId}`;
    const fetchedAt = new Date().toISOString();
    try {
      const fileRes = await ctx.httpClient.fetch(fileUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(45_000),
      });
      if (!fileRes.ok) {
        results.push({
          kind: 'failed',
          status: fileRes.status,
          url: portalUrl,
          requestUrl: fileUrl,
          contentType: 'text/plain',
          fetchedAt,
          error: {
            kind: 'http',
            message: `HTTP ${fileRes.status} for ${fileUrl}`,
            retryable: fileRes.status >= 500,
            status: fileRes.status,
          },
        });
        continue;
      }
      const text = (await fileRes.text())
        .replace(/[ \t]+/gu, ' ')
        .replace(/\n\s*\n+/gu, '\n')
        .trim()
        .slice(0, MAX_TEXT);
      const payload: CivicClerkFilePayload = {
        eventId: event.id,
        eventName: event.eventName,
        category: event.categoryName ?? null,
        date: event.startDateTime.slice(0, 10),
        type: file.type as 'Agenda' | 'Minutes',
        fileName: file.name,
        portalUrl,
        text,
      };
      results.push({
        kind: 'fetched',
        status: 200,
        url: portalUrl,
        requestUrl: fileUrl,
        contentType: 'application/civicclerk-file+json',
        payload: { kind: 'text', body: JSON.stringify(payload) },
        fetchedAt,
      });
    } catch (error) {
      results.push({
        kind: 'failed',
        status: null,
        url: portalUrl,
        requestUrl: fileUrl,
        contentType: 'text/plain',
        fetchedAt,
        error: {
          kind: /timeout|abort/i.test(String(error)) ? 'timeout' : 'network',
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      });
    }
  }
  return results;
}

export const civicClerkAdapter: SourceAdapter = {
  name: 'civicclerk',

  async fetch(source: SourceConfig, ctx: FetchContext): Promise<FetchResult[]> {
    const tenant = civicClerkTenant(source.url);
    if (tenant) {
      try {
        const viaApi = await fetchThroughApi(tenant, source, ctx);
        if (viaApi) return viaApi;
      } catch {
        // An older portal without the API is read as a page, below.
      }
    }
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
      const links = parseCivicClerkList(
        html,
        source.url,
        source.config as { listSelector?: string } | undefined
      );
      const now = new Date().toISOString();
      return links.map((l) => ({
        kind: 'fetched' as const,
        status: 200 as const,
        url: l.url,
        requestUrl: source.url,
        contentType: 'application/civicclerk-link+json',
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
      throw new Error('civicclerk parser requires text payload');
    if (raw.contentType === 'application/civicclerk-file+json') {
      const file = JSON.parse(raw.payload.body) as CivicClerkFilePayload;
      if (!file.text.trim()) return [];
      return [
        {
          // "Board of County Commissioners Agenda 2026-09-08": the body, the
          // kind of record and its date, like every other meeting document.
          title: `${file.eventName} ${file.type} ${file.date}`,
          body: file.text,
          kind: source.kind,
          eventDate: file.date,
          uris: [file.portalUrl],
        },
      ];
    }
    const link = JSON.parse(raw.payload.body) as {
      title: string;
      url: string;
      context: string;
    };
    if (!link.title) return [];
    return [
      {
        title: link.title,
        body: truncateSentences(
          `${source.name}: ${link.title} — ${link.context}`,
          1200
        ),
        kind: source.kind,
        eventDate:
          meetingDateFromTitle(`${link.title} ${link.context}`) ?? undefined,
        uris: [raw.url],
      },
    ];
  },
};
