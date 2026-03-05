import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, shareReplay, catchError } from 'rxjs';
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
    const request = this.http
      .get<SearchResult[]>(`${this.baseUrl}/trending`, {
        params: { limit: limit.toString() },
      })
      .pipe(shareReplay(1));
    this.trendingCache.set(limit, request);
    return request;
  }

  getSuggestedUsers(limit: number = 10): Observable<SearchResult[]> {
    if (this.suggestedUsersCache.has(limit)) {
      return this.suggestedUsersCache.get(limit)!;
    }
    const request = this.http
      .get<SearchResult[]>(`${this.baseUrl}/suggested-users`, {
        params: { limit: limit.toString() },
      })
      .pipe(shareReplay(1));
    this.suggestedUsersCache.set(limit, request);
    return request;
  }

  getSuggestedCommunities(limit: number = 10): Observable<SearchResult[]> {
    if (this.suggestedCommunitiesCache.has(limit)) {
      return this.suggestedCommunitiesCache.get(limit)!;
    }
    const request = this.http
      .get<SearchResult[]>(`${this.baseUrl}/suggested-communities`, {
        params: { limit: limit.toString() },
      })
      .pipe(shareReplay(1));
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
