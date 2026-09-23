import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BlogPostDto,
  CreateBlogPostDto,
  BlogPostQueryDto,
  UpdateBlogPostDto,
  BlogComponentDto,
  CreateBlogComponentDto,
  UpdateBlogComponentDto,
} from '@optimistic-tanuki/ui-models';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';

@Injectable({
  providedIn: 'root',
})
export class BlogService {
  private readonly blogging = inject(OptomisitcTanukiAPIService);

  createPost(data: CreateBlogPostDto): Observable<BlogPostDto> {
    console.log(data);
    return this.blogging.postControllerCreatePost<BlogPostDto>(data);
  }

  getAllPosts(query?: BlogPostQueryDto): Observable<BlogPostDto[]> {
    const { createdAt, updatedAt, ...rest } = query || {};
    const wireRange = (range: [Date, Date] | undefined): string[] | undefined =>
      range === undefined
        ? undefined
        : range.map((d) => (d instanceof Date ? d.toISOString() : String(d)));
    return this.blogging.postControllerFindAllPosts<BlogPostDto[]>({
      ...rest,
      createdAt: wireRange(createdAt),
      updatedAt: wireRange(updatedAt),
    });
  }

  /**
   * Get only published posts (for public display)
   */
  getPublishedPosts(): Observable<BlogPostDto[]> {
    return this.blogging.postControllerGetPublishedPosts<BlogPostDto[]>();
  }

  /**
   * Get drafts for a specific author
   */
  getDraftsByAuthor(authorId: string): Observable<BlogPostDto[]> {
    return this.blogging.postControllerGetDraftsByAuthor<BlogPostDto[]>(
      authorId
    );
  }

  getPost(id: string): Observable<BlogPostDto> {
    return this.blogging.postControllerGetPost<BlogPostDto>(id);
  }

  /**
   * Update an existing blog post
   */
  updatePost(id: string, data: UpdateBlogPostDto): Observable<BlogPostDto> {
    return this.blogging.postControllerUpdatePost<BlogPostDto>(id, data);
  }

  /**
   * Publish a draft post
   */
  publishPost(id: string): Observable<BlogPostDto> {
    return this.blogging.postControllerPublishPost<BlogPostDto>(id);
  }

  /**
   * Save post as draft
   */
  saveDraft(data: CreateBlogPostDto): Observable<BlogPostDto> {
    return this.blogging.postControllerCreatePost<BlogPostDto>({
      ...data,
      isDraft: true,
    });
  }

  /**
   * Delete a blog post
   */
  deletePost(id: string): Observable<void> {
    return this.blogging.postControllerDeletePost<void>(id);
  }

  /**
   * Search posts by title or content
   */
  searchPosts(searchTerm: string): Observable<BlogPostDto[]> {
    return this.blogging.postControllerSearchPosts<BlogPostDto[]>({
      q: searchTerm,
    });
  }

  /**
   * Get RSS feed URL
   */
  getRssFeedUrl(baseUrl?: string): string {
    const url = '/api/blog-posts/rss/feed.xml';
    return baseUrl ? `${url}?baseUrl=${encodeURIComponent(baseUrl)}` : url;
  }

  /**
   * Get SEO metadata for a blog post
   */
  getSeoMetadata(
    postId: string,
    baseUrl?: string
  ): Observable<{ title: string; description: string; keywords: string[] }> {
    return this.blogging.postControllerGetPostSeoMetadata<{
      title: string;
      description: string;
      keywords: string[];
    }>(postId, baseUrl === undefined ? {} : { baseUrl });
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
    return this.blogging.postControllerPublishPost<BlogPostDto>(id);
  }

  // ========== Blog Component Methods ==========

  /**
   * Get components for a blog post
   */
  getComponentsForPost(postId: string): Observable<BlogComponentDto[]> {
    return this.blogging.blogComponentControllerGetBlogComponents<
      BlogComponentDto[]
    >(postId);
  }

  /**
   * Create a blog component
   */
  createComponent(
    component: CreateBlogComponentDto
  ): Observable<BlogComponentDto> {
    return this.blogging.blogComponentControllerCreateBlogComponent<BlogComponentDto>(
      component
    );
  }

  /**
   * Update a blog component
   */
  updateComponent(
    id: string,
    component: UpdateBlogComponentDto
  ): Observable<BlogComponentDto> {
    return this.blogging.blogComponentControllerUpdateBlogComponent<BlogComponentDto>(
      id,
      component
    );
  }

  /**
   * Delete a blog component
   */
  deleteComponent(id: string): Observable<void> {
    return this.blogging.blogComponentControllerDeleteBlogComponent<void>(id);
  }

  /**
   * Delete all components for a post
   */
  deleteComponentsByPost(postId: string): Observable<void> {
    return this.blogging.blogComponentControllerDeleteComponentsByPost<void>(
      postId
    );
  }
}
