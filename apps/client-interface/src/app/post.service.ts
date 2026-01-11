import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import {
  CreatePostDto,
  PostDto,
  UpdatePostDto,
  SearchPostDto,
  SearchPostOptions,
} from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private baseApiUrl = inject(API_BASE_URL);
  private baseUrl = `${this.baseApiUrl}/social/post`;
  private http = inject(HttpClient);

  createPost(postDto: CreatePostDto): Observable<PostDto> {
    return this.http.post<PostDto>(this.baseUrl, postDto);
  }

  getPost(id: string): Observable<PostDto> {
    return this.http.get<PostDto>(`${this.baseUrl}/${id}`);
  }

  updatePost(id: string, updatePostDto: UpdatePostDto): Observable<PostDto> {
    return this.http.put<PostDto>(
      `${this.baseUrl}/update/${id}`,
      updatePostDto
    );
  }

  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  searchPosts(
    searchCriteria: SearchPostDto,
    opts?: SearchPostOptions
  ): Observable<PostDto[]> {
    return this.http.post<PostDto[]>(`${this.baseUrl}/find`, {
      criteria: searchCriteria,
      opts,
    });
  }

  getPosts(filter: {
    visibility: 'public' | 'followers';
    profileId?: string;
  }): Observable<PostDto[]> {
    if (filter.visibility === 'public') {
      return this.http.post<PostDto[]>(`${this.baseUrl}/find`, {
        criteria: {
          visibility: filter.visibility,
        },
      });
    } else if (filter.visibility === 'followers' && filter.profileId) {
      return this.http
        .get<string[]>(
          `${this.baseApiUrl}/social/follow/following/${filter.profileId}`
        )
        .pipe(
          switchMap((userIds) =>
            this.http.post<PostDto[]>(`${this.baseUrl}/find`, {
              criteria: {
                visibility: filter.visibility,
                userIds,
              },
            })
          )
        );
    } else {
      throw new Error('Profile ID is required for followers visibility');
    }
  }
}
