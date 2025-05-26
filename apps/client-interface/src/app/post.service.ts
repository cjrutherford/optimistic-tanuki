import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreatePostDto, PostDto, UpdatePostDto, SearchPostDto, SearchPostOptions } from '@optimistic-tanuki/social-ui';



@Injectable({
  providedIn: 'root'
})
export class PostService {
  private baseUrl = '/api/social/post';

  constructor(private http: HttpClient) { }

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
