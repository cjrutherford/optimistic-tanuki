import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BlogPostDto,
  CreateBlogPostDto,
  BlogPostQueryDto,
  UpdateBlogPostDto,
} from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class BlogService {
  private readonly http = inject(HttpClient);

  createPost(data: CreateBlogPostDto): Observable<BlogPostDto> {
    console.log(data);
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

  /**
   * Update an existing blog post
   */
  updatePost(id: string, data: UpdateBlogPostDto): Observable<BlogPostDto> {
    return this.http.put<BlogPostDto>(`/api/post/${id}`, data);
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

  /**
   * Delete a blog post
   */
  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(`/api/post/${id}`);
  }

  /**
   * Search posts by title or content
   */
  searchPosts(searchTerm: string): Observable<BlogPostDto[]> {
    return this.http.get<BlogPostDto[]>(`/api/post/search`, {
      params: { q: searchTerm as string },
    });
  }

  /**
   * Get RSS feed URL
   */
  getRssFeedUrl(baseUrl?: string): string {
    const url = '/api/post/rss/feed.xml';
    return baseUrl ? `${url}?baseUrl=${encodeURIComponent(baseUrl)}` : url;
  }

  /**
   * Get SEO metadata for a blog post
   */
  getSeoMetadata(
    postId: string,
    baseUrl?: string
  ): Observable<{ title: string; description: string; keywords: string[] }> {
    const params = new HttpParams(baseUrl ? { fromObject: { baseUrl } } : {});
    return this.http.get<{
      title: string;
      description: string;
      keywords: string[];
    }>(`/api/post/${postId}/seo`, { params });
  }

  /**
   * Get sitemap URL
   */
  getSitemapUrl(baseUrl?: string): string {
    const url = '/api/blog/sitemap.xml';
    return baseUrl ? `${url}?baseUrl=${encodeURIComponent(baseUrl)}` : url;
  }

  /**
   * Publish a draft
   */
  publishDraft(id: string): Observable<BlogPostDto> {
    return this.http.post<BlogPostDto>(`/api/post/${id}/publish`, {});
  }
}
