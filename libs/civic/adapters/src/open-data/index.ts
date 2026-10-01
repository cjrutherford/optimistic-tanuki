import type {
  DraftItem,
  FetchContext,
  FetchResult,
  RawDocumentInput,
  SourceAdapter,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';

const UA = 'civic-pipeline/0.1 (civic intelligence POC)';

interface NwsAlert {
  id: string;
  properties: {
    event?: string;
    headline?: string;
    description?: string;
    instruction?: string;
    sent?: string;
    effective?: string;
    expires?: string;
    severity?: string;
    areaDesc?: string;
  };
}

/**
 * National Weather Service active alerts for an area or lat/lon point.
 * Source config: { area: string } or { lat: number, lon: number }.
 */
export const openDataAdapter: SourceAdapter = {
  name: 'open-data',

  async fetch(source: SourceConfig, ctx: FetchContext): Promise<FetchResult[]> {
    const config = source.config ?? {};
    const url =
      typeof config['area'] === 'string' && config['area'].trim()
        ? `https://api.weather.gov/alerts/active?area=${encodeURIComponent(
            config['area'].trim()
          )}`
        : `https://api.weather.gov/alerts/active?point=${String(
            config['lat']
          )},${String(config['lon'])}`;
    try {
      const res = await ctx.httpClient.fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok)
        return [
          {
            kind: 'failed',
            status: res.status,
            url,
            requestUrl: url,
            contentType: 'application/geo+json',
            fetchedAt: new Date().toISOString(),
            error: {
              kind: 'http',
              message: `NWS HTTP ${res.status}`,
              retryable: res.status >= 500,
              status: res.status,
            },
          },
        ];
      const data = (await res.json()) as { features?: NwsAlert[] };
      const now = new Date().toISOString();
      return (data.features ?? []).map((f) => ({
        kind: 'fetched' as const,
        status: 200 as const,
        url: `${url}#${encodeURIComponent(f.id)}`,
        requestUrl: url,
        contentType: 'application/nws-alert+json',
        payload: { kind: 'text' as const, body: JSON.stringify(f) },
        fetchedAt: now,
      }));
    } catch (error) {
      return [
        {
          kind: 'failed',
          status: null,
          url,
          requestUrl: url,
          contentType: 'application/geo+json',
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
      throw new Error('open-data parser requires text payload');
    const alert = JSON.parse(raw.payload.body) as NwsAlert;
    const p = alert.properties ?? {};
    const title = p.headline || p.event || 'Weather alert';
    const body = [p.description, p.instruction]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 3000);
    return [
      {
        title,
        body: body || title,
        kind: source.kind,
        publishedAt: p.sent ?? p.effective ?? undefined,
        eventDate: p.expires ?? undefined,
        topics: p.areaDesc ? [p.areaDesc] : undefined,
        uris: [raw.url.split('#')[0]],
      },
    ];
  },
};
