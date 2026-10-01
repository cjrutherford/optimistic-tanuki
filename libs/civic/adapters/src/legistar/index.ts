import type {
  CivicKind,
  DraftItem,
  FetchContext,
  FetchResult,
  RawDocumentInput,
  SourceAdapter,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';

const UA = 'civic-pipeline/0.1 (civic intelligence POC)';

/** Legistar InSite Web API record shapes (OData JSON, stable public contract). */
export interface LegistarEvent {
  EventId: number;
  EventBodyName?: string;
  EventDate?: string; // .NET JSON date: /Date(172... )/
  EventTime?: string;
  EventLocation?: string;
  EventAgendaStatusName?: string;
  EventMinutesStatusName?: string;
  EventAgendaFile?: string;
  EventMinutesFile?: string;
}

export interface LegistarEventItem {
  EventItemId: number;
  EventItemMatterId?: number | null;
  EventItemMatterName?: string | null;
  EventItemTitle?: string;
  EventItemMatterType?: string | null;
}

export interface LegistarMatter {
  MatterId: number;
  MatterName?: string;
  MatterTitle?: string;
  MatterTypeName?: string;
  MatterStatusName?: string;
  MatterIntroDate?: string;
}

/** Parse .NET JSON dates (/Date(1725235200000)/) to ISO. */
export function parseNetDate(input?: string): string | undefined {
  if (!input) return undefined;
  const m = input.match(/\/Date\((-?\d+)([+-]\d{4})?\)\//);
  if (m) return new Date(Number(m[1])).toISOString();
  const t = new Date(input);
  return Number.isNaN(+t) ? undefined : t.toISOString();
}

function baseUrl(source: SourceConfig): string {
  const client = source.config?.['client'] as string;
  if (!client)
    throw new Error(
      `legistar source ${source.sourceKey} missing config.client`
    );
  return `https://webapi.legistar.com/v1/${client}`;
}

async function api<T>(
  url: string,
  httpClient: FetchContext['httpClient']
): Promise<T> {
  const res = await httpClient.fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Legistar HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function matterKind(typeName?: string | null): CivicKind {
  const t = (typeName ?? '').toLowerCase();
  if (/rezon|permit| variance|plat|zoning|land use|conditional use/.test(t))
    return 'permit';
  return 'legislation';
}

/**
 * Legistar adapter. Source config: { client, bodyIds?: number[], sinceDays?: number }.
 * Fetches recent Events (+ their EventItems/Matters) as meeting + legislation items.
 */
export const legistarAdapter: SourceAdapter = {
  name: 'legistar',

  async fetch(source: SourceConfig, ctx: FetchContext): Promise<FetchResult[]> {
    try {
      const base = baseUrl(source);
      const sinceDays = (source.config?.['sinceDays'] as number) ?? 60;
      const since = new Date(Date.now() - sinceDays * 864e5)
        .toISOString()
        .slice(0, 10);
      const now = new Date().toISOString().slice(0, 10);
      const bodyIds = source.config?.['bodyIds'] as number[] | undefined;
      const bodyFilter = bodyIds?.length
        ? ` and (${bodyIds.map((b) => `EventBodyId eq ${b}`).join(' or ')})`
        : '';
      const events = await api<LegistarEvent[]>(
        `${base}/Events?$filter=EventDate ge datetime'${since}' and EventDate le datetime'${now}'${bodyFilter}&$orderby=EventDate desc&$top=100`,
        ctx.httpClient
      );
      const nowIso = new Date().toISOString();
      const out: FetchResult[] = [];
      for (const event of events) {
        out.push({
          kind: 'fetched',
          status: 200,
          url: `${base}/Events/${event.EventId}`,
          requestUrl: `${base}/Events`,
          contentType: 'application/legistar-event+json',
          payload: { kind: 'text', body: JSON.stringify(event) },
          fetchedAt: nowIso,
        });
        let items: LegistarEventItem[] = [];
        try {
          items = await api<LegistarEventItem[]>(
            `${base}/Events/${event.EventId}/EventItems?$top=200`,
            ctx.httpClient
          );
        } catch {
          items = [];
        }
        const withMatter = items.filter((i) => i.EventItemMatterId);
        const matters = new Map<number, LegistarMatter>();
        for (const item of withMatter.slice(0, 50)) {
          try {
            const matter = await api<LegistarMatter>(
              `${base}/Matters/${item.EventItemMatterId}`,
              ctx.httpClient
            );
            matters.set(item.EventItemMatterId as number, matter);
          } catch {
            // per-matter failure must not sink the event
          }
        }
        out.push({
          kind: 'fetched',
          status: 200,
          url: `${base}/Events/${event.EventId}/EventItems`,
          requestUrl: `${base}/Events/${event.EventId}/EventItems`,
          contentType: 'application/legistar-items+json',
          payload: {
            kind: 'text',
            body: JSON.stringify({
              event,
              items,
              matters: [...matters.values()],
            }),
          },
          fetchedAt: nowIso,
        });
      }
      return out;
    } catch (error) {
      return [
        {
          kind: 'failed',
          status: null,
          url: source.config?.['client']
            ? `https://webapi.legistar.com/v1/${source.config['client']}`
            : source.url,
          requestUrl: source.url,
          contentType: 'application/json',
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
      throw new Error('legistar parser requires text payload');
    if (raw.contentType === 'application/legistar-event+json') {
      const event = JSON.parse(raw.payload.body) as LegistarEvent;
      const date = parseNetDate(event.EventDate)?.slice(0, 10);
      const title = `${event.EventBodyName ?? 'Meeting'}${
        date ? ` ${date}` : ''
      }`.trim();
      const uris = [event.EventAgendaFile, event.EventMinutesFile].filter(
        Boolean
      ) as string[];
      return [
        {
          title,
          body: `${title}${
            event.EventLocation ? ` at ${event.EventLocation}` : ''
          }${event.EventTime ? ` ${event.EventTime}` : ''}`.trim(),
          kind: source.kind,
          eventDate: date,
          topics: event.EventBodyName ? [event.EventBodyName] : undefined,
          uris: uris.length ? uris : [raw.url],
        },
      ];
    }
    const { event, items, matters } = JSON.parse(raw.payload.body) as {
      event: LegistarEvent;
      items: LegistarEventItem[];
      matters: LegistarMatter[];
    };
    const date = parseNetDate(event.EventDate)?.slice(0, 10);
    const matterById = new Map(matters.map((m) => [m.MatterId, m]));
    const drafts: DraftItem[] = [];
    for (const item of items) {
      const matter =
        item.EventItemMatterId != null
          ? matterById.get(item.EventItemMatterId)
          : undefined;
      const title = [
        item.EventItemMatterName ?? matter?.MatterName,
        item.EventItemTitle ?? matter?.MatterTitle,
      ]
        .filter(Boolean)
        .join(' — ')
        .slice(0, 250);
      if (!title) continue;
      drafts.push({
        title,
        body: `${title}${
          matter?.MatterStatusName ? ` [${matter.MatterStatusName}]` : ''
        }${matter?.MatterTypeName ? ` (${matter.MatterTypeName})` : ''}`,
        kind: matterKind(item.EventItemMatterType ?? matter?.MatterTypeName),
        eventDate: date,
        topics: [
          ...(matter?.MatterTypeName ? [matter.MatterTypeName] : []),
          ...(matter?.MatterStatusName ? [matter.MatterStatusName] : []),
        ],
        uris: [raw.url],
      });
    }
    return drafts;
  },
};
