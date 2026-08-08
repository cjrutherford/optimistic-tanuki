import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import {
  PostDto,
  SearchPostDto,
  SearchPostOptions,
} from '@optimistic-tanuki/models';
import { API_BASE_URL, CommunityDto } from '@optimistic-tanuki/ui-models';
import { Observable } from 'rxjs';

/** Shared HTTP boundary for social feed reads. */
@Injectable({ providedIn: 'root' })
export class SocialFeedDataService {
  private readonly postUrl: string;
  private readonly apiBaseUrl: string;

  constructor(
    @Inject(API_BASE_URL) apiBaseUrl: string,
    private readonly http: HttpClient
  ) {
    this.apiBaseUrl = apiBaseUrl;
    this.postUrl = `${apiBaseUrl}/social/post`;
  }

  loadPublicFeed(
    criteria: SearchPostDto = {},
    opts: SearchPostOptions = {
      orderBy: 'createdAt',
      orderDirection: 'desc',
    }
  ): Observable<PostDto[]> {
    return this.http.post<PostDto[]>(`${this.postUrl}/find`, {
      criteria,
      opts,
    });
  }

  loadFollowingFeed(options: {
    limit: number;
    offset: number;
  }): Observable<PostDto[]> {
    const params = new URLSearchParams({
      includeFollowing: 'true',
      includePublic: 'false',
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
    return this.http.post<PostDto[]>(`${this.postUrl}/find`, {
      criteria: { communityIds },
      opts: {
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit: options.limit,
        offset: options.offset,
      },
    });
  }
}
