import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ActOnTakedownNoticeBody,
  ConfirmOfficialCallbackBody,
  OfficialStanding,
  TownDensity,
} from '@optimistic-tanuki/models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { map, type Observable } from 'rxjs';

/**
 * The target band from the corroboration plan: enough people that
 * independent accounts are ordinary. Matches civic-community's.
 */
export const DENSITY_TARGET = { low: 8, high: 12 } as const;

/**
 * The operator routes. They replace the POC's operator CLI (D24); the
 * gateway refuses each to anyone without its permission.
 */
@Injectable({ providedIn: 'root' })
export class OperationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/local-hub/operations`;

  /** Per-town contributor density. Not public: it shows which town is easiest to flood. */
  density(): Observable<TownDensity[]> {
    return this.http
      .get<{ data: { rows: TownDensity[] } }>(`${this.base}/density`)
      .pipe(map((response) => response.data.rows));
  }

  confirmOfficialCallback(
    body: ConfirmOfficialCallbackBody
  ): Observable<{ standing: OfficialStanding }> {
    return this.http
      .post<{ data: { standing: OfficialStanding } }>(
        `${this.base}/officials/confirm-callback`,
        body
      )
      .pipe(map((response) => response.data));
  }

  takedownNotices(state?: string): Observable<unknown[]> {
    return this.http
      .get<{ data: unknown[] }>(`${this.base}/takedown-notices`, {
        params: state ? { state } : {},
      })
      .pipe(map((response) => response.data));
  }

  actOnTakedownNotice(
    id: string,
    body: ActOnTakedownNoticeBody
  ): Observable<{ contributions: string[]; suspended: string[] }> {
    return this.http
      .post<{ data: { contributions: string[]; suspended: string[] } }>(
        `${this.base}/takedown-notices/${encodeURIComponent(id)}/act`,
        body
      )
      .pipe(map((response) => response.data));
  }

  /** Re-review held contributions now, instead of waiting for the schedule. */
  rereview(): Observable<{ changed: number }> {
    return this.http
      .post<{ data: { changed: number } }>(`${this.base}/rereview`, {})
      .pipe(map((response) => response.data));
  }

  /** Compare reports against the records published since. */
  sweepOutcomes(): Observable<unknown> {
    return this.http
      .post<{ data: unknown }>(`${this.base}/outcomes/sweep`, {})
      .pipe(map((response) => response.data));
  }

  /** Write the quotable-material snapshots. */
  exportPromotions(): Observable<{ towns: unknown }> {
    return this.http
      .post<{ data: { towns: unknown } }>(`${this.base}/promotions/export`, {})
      .pipe(map((response) => response.data));
  }
}
