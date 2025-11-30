import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { 
  BlogPostDto, 
  CreateBlogPostDto,
  BlogPostQueryDto 
} from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private readonly http = inject(HttpClient);

  createPost(data: CreateBlogPostDto): Observable<BlogPostDto> {
    return this.http.post<BlogPostDto>('/api/post', data);
  }

  getAllPosts(query?: BlogPostQueryDto): Observable<BlogPostDto[]> {
    return this.http.post<BlogPostDto[]>('/api/post/find', query || {});
  }

  getPost(id: string): Observable<BlogPostDto> {
    return this.http.get<BlogPostDto>(`/api/post/${id}`);
  }

  updatePost(id: string, data: Partial<CreateBlogPostDto>): Observable<BlogPostDto> {
    return this.http.patch<BlogPostDto>(`/api/post/${id}`, data);
  }

  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(`/api/post/${id}`);
  }
}
