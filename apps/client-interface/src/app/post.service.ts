import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreatePostDto, PostDto, UpdatePostDto, SearchPostDto, SearchPostOptions } from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';



@Injectable({
  providedIn: 'root'
})
export class PostService {
  private baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private http: HttpClient
  ) {
    this.baseUrl = `${this.apiBaseUrl}/social/post`;
  }

  createPost(postDto: CreatePostDto): Observable<PostDto> {
    return this.http.post<PostDto>(this.baseUrl, postDto);
  }

  getPost(id: string): Observable<PostDto> {
    return this.http.get<PostDto>(`${this.baseUrl}/${id}`);
  }

  updatePost(id: string, updatePostDto: UpdatePostDto): Observable<PostDto> {
    return this.http.put<PostDto>(`${this.baseUrl}/update/${id}`, updatePostDto);
  }

  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  searchPosts(searchCriteria: SearchPostDto, opts?: SearchPostOptions): Observable<PostDto[]> {
    return this.http.post<PostDto[]>(`${this.baseUrl}/find`, { criteria: searchCriteria, opts });
  }
}
