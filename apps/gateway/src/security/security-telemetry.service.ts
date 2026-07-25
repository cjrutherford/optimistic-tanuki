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
    const response = await this.fetchImpl(
      `${this.options.lokiUrl}/loki/api/v1/query_range?${this.toSearchParams(
        query
      )}`
    );

    if (!response.ok) {
      throw new Error('Security event store is unavailable.');
    }

    const payload = (await response.json()) as LokiResponse;
    const events = (payload.data?.result ?? []).flatMap((stream) =>
      (stream.values ?? []).flatMap(([, line]) => {
        const event = this.parseEvent(line);
        if (!event) {
          return [];
        }

        return [
          {
            ...event,
            clientAddress:
              options.revealClientAddress || !event.clientAddress
                ? event.clientAddress
                : maskClientAddress(event.clientAddress),
          },
        ];
      })
    );

    return { events };
  }

  private toSearchParams(query: SecurityEventQuery): string {
    const params = new URLSearchParams({
      query: '{service_name="public-edge"}',
      start: query.from,
      limit: String(Math.min(Math.max(query.limit ?? 100, 1), 200)),
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
