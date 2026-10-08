import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import {
  PostDto,
  SearchPostDto,
  SearchPostOptions,
} from '@optimistic-tanuki/models';
import { API_BASE_URL, CommunityDto } from '@optimistic-tanuki/ui-models';
import { Observable } from 'rxjs';
import { of } from 'rxjs';

/** Shared HTTP boundary for social feed reads. */
@Injectable({ providedIn: 'root' })
export class SocialFeedDataService {
  private readonly apiBaseUrl: string;

  constructor(
    @Inject(API_BASE_URL) apiBaseUrl: string,
    private readonly http: HttpClient
  ) {
    this.apiBaseUrl = apiBaseUrl;
  }

  loadPublicFeed(
    _criteria: SearchPostDto = {},
    opts: SearchPostOptions = {
      orderBy: 'createdAt',
      orderDirection: 'desc',
    }
  ): Observable<PostDto[]> {
    const params = new URLSearchParams({
      includePublic: 'true',
      includeFollowing: 'false',
      includeCommunities: 'false',
      limit: String(opts.limit ?? 20),
      offset: String(opts.offset ?? 0),
    });
    return this.http.get<PostDto[]>(`${this.apiBaseUrl}/social/feed?${params}`);
  }

  loadFollowingFeed(options: {
    limit: number;
    offset: number;
  }): Observable<PostDto[]> {
    const params = new URLSearchParams({
      includeFollowing: 'true',
      includePublic: 'false',
      includeCommunities: 'false',
      limit: options.limit.toString(),
      offset: options.offset.toString(),
    });
    return this.http.get<PostDto[]>(`${this.apiBaseUrl}/social/feed?${params}`);
  }

  loadUserCommunities(): Observable<CommunityDto[]> {
    return this.http.get<CommunityDto[]>(
      `${this.apiBaseUrl}/social/community/user/communities`
    );
  }

  loadCommunityFeed(
    communityIds: string[],
    options: { limit: number; offset: number }
  ): Observable<PostDto[]> {
    if (communityIds.length === 0) return of([]);
    const params = new URLSearchParams({
      includePublic: 'false',
      includeFollowing: 'false',
      includeCommunities: 'true',
      communityIds: communityIds.join(','),
      limit: options.limit.toString(),
      offset: options.offset.toString(),
    });
    return this.http.get<PostDto[]>(`${this.apiBaseUrl}/social/feed?${params}`);
  }
}
