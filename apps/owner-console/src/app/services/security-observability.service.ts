import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type SecurityEventClassification =
  | 'supported'
  | 'unsupported_url'
  | 'denied'
  | 'rate_limited'
  | 'blocked'
  | 'edge_error';

export interface SecurityEvent {
  timestamp: string;
  host: string;
  path: string;
  method: string;
  status: number;
  classification: SecurityEventClassification;
  clientAddress?: string;
}

export interface SecurityMetrics {
  totals: {
    requests: number;
    denied: number;
    rateLimited: number;
    blocked: number;
    errors: number;
    serverErrors: number;
  };
  series: Array<{
    start: string;
    requests: number;
    denied: number;
    rateLimited: number;
    blocked: number;
    errors: number;
    serverErrors: number;
  }>;
  topPaths: Array<{ path: string; count: number; serverErrors: number }>;
  topHosts: Array<{ host: string; count: number }>;
}

@Injectable({ providedIn: 'root' })
export class SecurityObservabilityService {
  constructor(private readonly http: HttpClient) {}

  events(query: {
    from: string;
    limit?: number;
  }): Observable<{ events: SecurityEvent[] }> {
    let params = new HttpParams().set('from', query.from);
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http.get<{ events: SecurityEvent[] }>('/api/security/events', {
      params,
    });
  }

  metrics(query: {
    from: string;
    to: string;
    bucket: '1m' | '5m' | '15m';
  }): Observable<SecurityMetrics> {
    const params = new HttpParams()
      .set('from', query.from)
      .set('to', query.to)
      .set('bucket', query.bucket);
    return this.http.get<SecurityMetrics>('/api/security/metrics', { params });
  }
}
