import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';

/** Whether Daylight has sources for a town (D32). */
export interface TownSourceStatus {
  slug: string;
  name: string;
  status: 'has-sources' | 'no-sources' | 'not-sourced-yet';
  requestCount: number;
}

export interface TownSourceRequestResult {
  requestCount: number;
  alreadyRequested: boolean;
}

/** The longest note a reader may attach to a source request. */
export const SOURCE_REQUEST_NOTE_MAX = 500;

@Injectable({ providedIn: 'root' })
export class TownSourcesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/local-hub/localities`;

  status(slug: string): Promise<TownSourceStatus> {
    return firstValueFrom(
      this.http.get<TownSourceStatus>(
        `${this.baseUrl}/${encodeURIComponent(slug)}/source-status`
      )
    );
  }

  /** Needs a signed-in user; repeats are idempotent. */
  request(slug: string, note?: string): Promise<TownSourceRequestResult> {
    return firstValueFrom(
      this.http.post<TownSourceRequestResult>(
        `${this.baseUrl}/${encodeURIComponent(slug)}/source-requests`,
        note ? { note } : {}
      )
    );
  }
}
