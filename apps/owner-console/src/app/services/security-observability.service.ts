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
}
