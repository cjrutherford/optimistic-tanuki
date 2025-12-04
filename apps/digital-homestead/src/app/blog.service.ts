import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { 
  BlogPostDto, 
  CreateBlogPostDto,
  BlogPostQueryDto,
  UpdateBlogPostDto 
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

  /**
   * Get only published posts (for public display)
   */
  getPublishedPosts(): Observable<BlogPostDto[]> {
    return this.http.get<BlogPostDto[]>('/api/post/published');
  }

  /**
   * Get drafts for a specific author
   */
  getDraftsByAuthor(authorId: string): Observable<BlogPostDto[]> {
    return this.http.get<BlogPostDto[]>(`/api/post/drafts/${authorId}`);
  }

  getPost(id: string): Observable<BlogPostDto> {
    return this.http.get<BlogPostDto>(`/api/post/${id}`);
  }

  updatePost(id: string, data: Partial<UpdateBlogPostDto>): Observable<BlogPostDto> {
    return this.http.patch<BlogPostDto>(`/api/post/${id}`, data);
  }

  /**
   * Publish a draft post
   */
  publishPost(id: string): Observable<BlogPostDto> {
    return this.http.post<BlogPostDto>(`/api/post/${id}/publish`, {});
  }

  /**
   * Save post as draft
   */
  saveDraft(data: CreateBlogPostDto): Observable<BlogPostDto> {
    return this.http.post<BlogPostDto>('/api/post', { ...data, isDraft: true });
  }

  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(`/api/post/${id}`);
  }
}
