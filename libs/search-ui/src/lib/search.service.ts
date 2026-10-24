import { DestroyRef, Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  of,
  shareReplay,
  catchError,
  Subject,
  defer,
  merge,
  take,
  takeUntil,
  map,
} from 'rxjs';
export * from './search.model';
import {
  SearchResult,
  SearchResponse,
  SearchOptions,
  SearchHistory,
} from './search.model';

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  private http = inject(HttpClient);
  private baseUrl = '/api/search';

  private trendingCache = new Map<number, Observable<SearchResult[]>>();
  private suggestedUsersCache = new Map<number, Observable<SearchResult[]>>();
  private suggestedCommunitiesCache = new Map<
    number,
    Observable<SearchResult[]>
  >();

  searchResults = signal<SearchResponse | null>(null);
  isLoading = signal<boolean>(false);

  private readonly reset = new Subject<void>();
  private sessionGeneration = 0;

  constructor() {
    if (typeof window === 'undefined') return;
    const reset = () => {
      this.sessionGeneration++;
      this.reset.next();
      this.trendingCache.clear();
      this.suggestedUsersCache.clear();
      this.suggestedCommunitiesCache.clear();
      this.searchResults.set(null);
      this.isLoading.set(false);
    };
    window.addEventListener('ot:session-reset', reset);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('ot:session-reset', reset);
      this.reset.next();
      this.reset.complete();
    });
  }

  private sessionCachedResults(
    request: Observable<SearchResult[]>
  ): Observable<SearchResult[]> {
    const generation = this.sessionGeneration;
    const source = request.pipe(
      takeUntil(this.reset),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    return defer(() =>
      generation !== this.sessionGeneration
        ? of([])
        : merge(
            source,
            this.reset.pipe(
              take(1),
              map(() => [] as SearchResult[])
            )
          )
    );
  }

  search(query: string, options?: SearchOptions): Observable<SearchResponse> {
    let params = new HttpParams().set('q', query);

    if (options?.type) {
      params = params.set('type', options.type);
    }
    if (options?.limit) {
      params = params.set('limit', options.limit.toString());
    }
    if (options?.offset) {
      params = params.set('offset', options.offset.toString());
    }

    return this.http.get<SearchResponse>(this.baseUrl, { params });
  }

  getTrending(limit: number = 10): Observable<SearchResult[]> {
    if (this.trendingCache.has(limit)) {
      return this.trendingCache.get(limit)!;
    }
    const request = this.sessionCachedResults(
      this.http.get<SearchResult[]>(`${this.baseUrl}/trending`, {
        params: { limit: limit.toString() },
      })
    );
    this.trendingCache.set(limit, request);
    return request;
  }

  getSuggestedUsers(limit: number = 10): Observable<SearchResult[]> {
    if (this.suggestedUsersCache.has(limit)) {
      return this.suggestedUsersCache.get(limit)!;
    }
    const request = this.sessionCachedResults(
      this.http.get<SearchResult[]>(`${this.baseUrl}/suggested-users`, {
        params: { limit: limit.toString() },
      })
    );
    this.suggestedUsersCache.set(limit, request);
    return request;
  }

  getSuggestedCommunities(limit: number = 10): Observable<SearchResult[]> {
    if (this.suggestedCommunitiesCache.has(limit)) {
      return this.suggestedCommunitiesCache.get(limit)!;
    }
    const request = this.sessionCachedResults(
      this.http.get<SearchResult[]>(`${this.baseUrl}/suggested-communities`, {
        params: { limit: limit.toString() },
      })
    );
    this.suggestedCommunitiesCache.set(limit, request);
    return request;
  }

  getSearchHistory(
    profileId: string,
    limit: number = 10
  ): Observable<SearchHistory[]> {
    return this.http.get<SearchHistory[]>(`${this.baseUrl}/history`, {
      params: { profileId, limit: limit.toString() },
    });
  }
}
