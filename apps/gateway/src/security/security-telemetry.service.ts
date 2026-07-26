export type SecurityEventClassification =
  | 'supported'
  | 'unsupported_url'
  | 'denied'
  | 'rate_limited'
  | 'blocked'
  | 'edge_error';

export interface SecurityEventQuery {
  from: string;
  to?: string;
  classification?: SecurityEventClassification;
  host?: string;
  limit?: number;
}

export interface SecurityEvent {
  timestamp: string;
  host: string;
  path: string;
  method: string;
  status: number;
  classification: SecurityEventClassification;
  clientAddress?: string;
}

export type SecurityMetricBucket = '1m' | '5m' | '15m';
export interface SecurityMetricsQuery
  extends Omit<SecurityEventQuery, 'limit'> {
  bucket?: SecurityMetricBucket;
}
export interface SecurityMetricPoint {
  start: string;
  requests: number;
  denied: number;
  rateLimited: number;
  blocked: number;
  errors: number;
  serverErrors: number;
}
export interface SecurityMetrics {
  from: string;
  to: string;
  bucket: SecurityMetricBucket;
  totals: Omit<SecurityMetricPoint, 'start'>;
  series: SecurityMetricPoint[];
  topPaths: Array<{ path: string; count: number; serverErrors: number }>;
  topHosts: Array<{ host: string; count: number }>;
}

type LokiResponse = {
  data?: {
    result?: Array<{ values?: Array<[string, string]> }>;
  };
};

export interface SecurityTelemetryOptions {
  lokiUrl: string;
  crowdsecUrl: string;
  fetch?: typeof fetch;
}

export class SecurityTelemetryService {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SecurityTelemetryOptions) {
    this.fetchImpl = options.fetch ?? global.fetch;
  }

  async listEvents(
    query: SecurityEventQuery,
    options: { revealClientAddress?: boolean } = {}
  ): Promise<{ events: SecurityEvent[] }> {
    const events = await this.readEvents(query);

    return {
      events: events.map((event) => ({
        ...event,
        clientAddress:
          options.revealClientAddress || !event.clientAddress
            ? event.clientAddress
            : maskClientAddress(event.clientAddress),
      })),
    };
  }

  async metrics(query: SecurityMetricsQuery): Promise<SecurityMetrics> {
    const from = new Date(query.from);
    const to = new Date(query.to ?? Date.now());
    if (
      Number.isNaN(from.valueOf()) ||
      Number.isNaN(to.valueOf()) ||
      to <= from ||
      to.valueOf() - from.valueOf() > 24 * 60 * 60 * 1000
    )
      throw new Error(
        'Metrics time range must be valid and no longer than 24 hours.'
      );
    const bucket = query.bucket ?? '5m';
    if (bucket !== '1m' && bucket !== '5m' && bucket !== '15m') {
      throw new Error('Metrics bucket must be one of: 1m, 5m, 15m.');
    }
    const bucketMs =
      bucket === '1m' ? 60_000 : bucket === '15m' ? 900_000 : 300_000;
      ...query,
      to: to.toISOString(),
      limit: 5000,
    });
    const blank = (): Omit<SecurityMetricPoint, 'start'> => ({
      requests: 0,
      denied: 0,
      rateLimited: 0,
      blocked: 0,
      errors: 0,
      serverErrors: 0,
    });
    const buckets = new Map<number, SecurityMetricPoint>();
    for (let cursor = from.valueOf(); cursor < to.valueOf(); cursor += bucketMs)
      buckets.set(cursor, {
        start: new Date(cursor).toISOString(),
        ...blank(),
      });
    const totals = blank();
    const paths = new Map<string, { count: number; serverErrors: number }>();
    const hosts = new Map<string, number>();
    for (const event of events) {
      const point = buckets.get(
        Math.floor(
          (new Date(event.timestamp).valueOf() - from.valueOf()) / bucketMs
        ) *
          bucketMs +
          from.valueOf()
      );
      const targets = point ? [totals, point] : [totals];
      for (const target of targets) {
        target.requests++;
        if (event.classification === 'denied') target.denied++;
        if (event.classification === 'rate_limited') target.rateLimited++;
        if (event.classification === 'blocked') target.blocked++;
        if (event.classification === 'edge_error') target.errors++;
        if (event.status >= 500) target.serverErrors++;
      }
      const path = paths.get(event.path) ?? { count: 0, serverErrors: 0 };
      path.count++;
      if (event.status >= 500) path.serverErrors++;
      paths.set(event.path, path);
      hosts.set(event.host, (hosts.get(event.host) ?? 0) + 1);
    }
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      bucket,
      totals,
      series: [...buckets.values()],
      topPaths: [...paths]
        .map(([path, value]) => ({ path, ...value }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      topHosts: [...hosts]
        .map(([host, count]) => ({ host, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    };
  }

  private async readEvents(
    query: SecurityEventQuery
  ): Promise<SecurityEvent[]> {
    const response = await this.fetchImpl(
      `${this.options.lokiUrl}/loki/api/v1/query_range?${this.toSearchParams(
        query
      )}`
    );
    if (!response.ok) throw new Error('Security event store is unavailable.');
    const payload = (await response.json()) as LokiResponse;
    return (payload.data?.result ?? []).flatMap((stream) =>
      (stream.values ?? []).flatMap(([, line]) => {
        const event = this.parseEvent(line);
        return event &&
          (!query.host || event.host === query.host) &&
          (!query.classification ||
            event.classification === query.classification)
          ? [event]
          : [];
      })
    );
  }

  private toSearchParams(query: SecurityEventQuery): string {
    const params = new URLSearchParams({
      query: '{service_name="public-edge"}',
      start: query.from,
      limit: String(Math.min(Math.max(query.limit ?? 100, 1), 5000)),
    });

    if (query.to) {
      params.set('end', query.to);
    }

    return params.toString();
  }

  private parseEvent(line: string): SecurityEvent | null {
    try {
      const value = JSON.parse(line) as Partial<SecurityEvent>;
      if (
        !value.timestamp ||
        !value.host ||
        !value.path ||
        !value.method ||
        typeof value.status !== 'number' ||
        !value.classification
      ) {
        return null;
      }

      return value as SecurityEvent;
    } catch {
      return null;
    }
  }
}

const maskClientAddress = (address: string): string => {
  const parts = address.split('.');
  return parts.length === 4 ? `${parts.slice(0, 3).join('.')}.*` : 'masked';
};
