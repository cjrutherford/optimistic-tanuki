import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface PerformanceMetricSummary {
  samples: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface PerformanceSummary {
  appId: string;
  route: string;
  renderMode: string;
  metrics: Record<string, PerformanceMetricSummary>;
}

export interface PerformanceAlert {
  id: string;
  appId: string;
  route: string;
  metric: string;
  severity: 'warning' | 'critical';
  state: 'active' | 'recovered' | 'acknowledged';
  threshold: number;
  observed: number;
  createdAt: string;
  recoveredAt?: string;
}

export interface RuntimeSummary {
  appId: string;
  source: 'otel';
  observedAt: string;
  cpuUtilization?: number;
  memoryRssBytes?: number;
  gcPauseMs?: number;
  gcPauseCount?: number;
}

@Injectable({ providedIn: 'root' })
export class PerformanceObservabilityService {
  private readonly http = inject(HttpClient);

  summary(): Observable<PerformanceSummary[]> {
    return this.http.get<PerformanceSummary[]>('/api/performance/summary');
  }

  alerts(): Observable<PerformanceAlert[]> {
    return this.http.get<PerformanceAlert[]>('/api/performance/alerts');
  }

  runtime(): Observable<RuntimeSummary[]> {
    return this.http.get<RuntimeSummary[]>('/api/performance/runtime');
  }

  acknowledge(id: string): Observable<PerformanceAlert> {
    return this.http.post<PerformanceAlert>(
      `/api/performance/alerts/${encodeURIComponent(id)}/acknowledge`,
      {}
    );
  }
}
