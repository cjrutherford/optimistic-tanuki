import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AppConfigService } from './app-config.service';

/** One thing that may need the owner: a queue, a count, or a failed read. */
export interface OwnerAttentionItem {
  source: string;
  label: string;
  townId?: string;
  /** Null when the source could not be read. Never 0 for a failure. */
  count: number | null;
  /** True when `count` is a lower bound. */
  capped?: boolean;
  oldest: string | null;
  link: string;
  status: 'ok' | 'unavailable';
  error?: string;
}

export interface OwnerAttentionReport {
  generatedAt: string;
  items: OwnerAttentionItem[];
}

export interface OwnerServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latencyMs: number | null;
  checkedAt: string;
  detail?: string;
}

/** What a nav leaf shows: nothing for zero, a number, or "!" for a failed read. */
export type NavBadge =
  | { kind: 'count'; count: number; capped: boolean; label: string }
  | { kind: 'unavailable'; label: string };

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Source key for draft app configurations, composed here (see load()). */
export const CONFIG_DRAFT_SOURCE = 'experience.configs';

@Injectable({ providedIn: 'root' })
export class AttentionService {
  private readonly http = inject(HttpClient);
  private readonly appConfigs = inject(AppConfigService);

  private readonly reportState = signal<OwnerAttentionReport | null>(null);
  private readonly stateSignal = signal<LoadState>('idle');
  private readonly healthState = signal<OwnerServiceHealth[] | null>(null);
  private readonly healthStateSignal = signal<LoadState>('idle');

  readonly report = this.reportState.asReadonly();
  readonly state = this.stateSignal.asReadonly();
  readonly health = this.healthState.asReadonly();
  readonly healthLoad = this.healthStateSignal.asReadonly();

  /** Badge per attention source, summed across towns. Zero has no entry. */
  readonly badges = computed<Readonly<Record<string, NavBadge>>>(() =>
    this.badgesFor(this.reportState()?.items ?? [], null)
  );

  /** `GET /api/owner/attention`, plus draft configurations from this console. */
  fetchAttention(): Observable<OwnerAttentionReport> {
    return forkJoin({
      report: this.http.get<OwnerAttentionReport>('/api/owner/attention'),
      configs: this.appConfigs.getConfigurations().pipe(
        map((configs) => ({ configs, failed: false })),
        catchError(() => of({ configs: [], failed: true }))
      ),
    }).pipe(
      map(({ report, configs }) => ({
        generatedAt: report.generatedAt,
        items: [...report.items, this.draftConfigItem(configs)],
      }))
    );
  }

  fetchHealth(): Observable<OwnerServiceHealth[]> {
    return this.http.get<OwnerServiceHealth[]>('/api/owner/health');
  }

  /** Reload attention into the shared state. */
  load(): void {
    this.stateSignal.set('loading');
    this.fetchAttention().subscribe({
      next: (report) => {
        this.reportState.set(report);
        this.stateSignal.set('ready');
      },
      error: () => this.stateSignal.set('error'),
    });
  }

  loadHealth(): void {
    this.healthStateSignal.set('loading');
    this.fetchHealth().subscribe({
      next: (health) => {
        this.healthState.set(health);
        this.healthStateSignal.set('ready');
      },
      error: () => this.healthStateSignal.set('error'),
    });
  }

  /**
   * Badges from attention items. With a town id, per-town sources count only
   * that town's rows; without one they are summed across towns.
   */
  badgesFor(
    items: readonly OwnerAttentionItem[],
    townId: string | null
  ): Record<string, NavBadge> {
    const out: Record<string, NavBadge> = {};
    const sources = new Set(items.map((item) => item.source));
    for (const source of sources) {
      const mine = items.filter(
        (item) =>
          item.source === source &&
          (!townId || !item.townId || item.townId === townId)
      );
      if (mine.some((item) => item.status === 'unavailable')) {
        out[source] = {
          kind: 'unavailable',
          label: 'Could not be loaded; this is not zero',
        };
        continue;
      }
      const count = mine.reduce((sum, item) => sum + (item.count ?? 0), 0);
      if (count > 0) {
        const capped = mine.some((item) => item.capped);
        out[source] = {
          kind: 'count',
          count,
          capped,
          label: `${count}${capped ? ' or more' : ''} waiting`,
        };
      }
    }
    return out;
  }

  private draftConfigItem(result: {
    configs: { active?: boolean }[];
    failed: boolean;
  }): OwnerAttentionItem {
    const base = {
      source: CONFIG_DRAFT_SOURCE,
      label: 'Draft app configurations',
      link: '/dashboard/app-config',
    };
    if (result.failed) {
      return {
        ...base,
        count: null,
        oldest: null,
        status: 'unavailable',
        error: 'App configurations could not be loaded',
      };
    }
    return {
      ...base,
      count: result.configs.filter((config) => !config.active).length,
      oldest: null,
      status: 'ok',
    };
  }
}
