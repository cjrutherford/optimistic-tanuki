import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  EditionHistory,
  EditionSummary,
  PublishedBriefing,
} from '@optimistic-tanuki/models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { map, type Observable } from 'rxjs';

/** The public edition and briefing routes. */
@Injectable({ providedIn: 'root' })
export class EditionsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/local-hub/editions`;

  editions(): Observable<EditionSummary[]> {
    return this.http
      .get<{ data: EditionSummary[] }>(this.base)
      .pipe(map((response) => response.data));
  }

  history(slug: string): Observable<EditionHistory> {
    return this.http
      .get<{ data: EditionHistory }>(`${this.base}/${encodeURIComponent(slug)}`)
      .pipe(map((response) => response.data));
  }

  /** The briefing for one period end (YYYY-MM-DD), or the latest without one. */
  briefing(slug: string, date?: string): Observable<PublishedBriefing> {
    const which = date ? encodeURIComponent(date) : 'latest';
    return this.http
      .get<{ data: PublishedBriefing }>(
        `${this.base}/${encodeURIComponent(slug)}/briefings/${which}`
      )
      .pipe(map((response) => response.data));
  }
}
