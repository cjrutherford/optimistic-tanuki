import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { PublishedBlogPostDto } from '@optimistic-tanuki/models';
import { BLOGGING_API_BASE_URL } from './blog-authoring-data.service';

/** Anonymous published Blog response; deliberately excludes all ownership fields. */
export type PublicBlogPost = PublishedBlogPostDto;

@Injectable({ providedIn: 'root' })
export class BlogPublicDataService {
  constructor(
    @Inject(BLOGGING_API_BASE_URL) private readonly apiUrl: string,
    private readonly http: HttpClient
  ) {}

  /**
   * Read only the catalog selected by the published capability. This request
   * intentionally carries no workspace slug, app scope, or owner headers.
   */
  getPublishedPosts(domain: string): Observable<PublicBlogPost[]> {
    const normalizedDomain = this.validateDomain(domain);
    return this.http
      .get<unknown[]>(
        `${this.apiUrl}/blog/by-domain/${encodeURIComponent(
          normalizedDomain
        )}/posts`
      )
      .pipe(
        map((posts) =>
          posts.map((post) => {
            const value = post as Partial<PublishedBlogPostDto>;
            return {
              id: String(value.id ?? ''),
              title: String(value.title ?? ''),
              content: String(value.content ?? ''),
              publishedAt: value.publishedAt ?? null,
            } satisfies PublicBlogPost;
          })
        )
      );
  }

  private validateDomain(domain: string): string {
    const normalized =
      typeof domain === 'string' ? domain.trim().toLowerCase() : '';
    if (
      !normalized ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
        normalized
      )
    ) {
      throw new Error('A valid public domain is required');
    }
    return normalized;
  }
}
