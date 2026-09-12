import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';

import {
  BusinessApiService,
  BusinessSiteConfig,
  BusinessSiteConfigStore,
  type BusinessBlogPost,
  injectSiteSlugSignal,
} from '@optimistic-tanuki/business-data-access';
import {
  resolvePublishedBlogCatalogId,
  type PublishedBlogCapability,
} from '@optimistic-tanuki/blogging-data-access';

@Component({
  selector: 'business-blog-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (catalogId(); as catalogId) {
    <section class="blog-runtime" aria-label="Blog posts">
      <header>
        <p class="eyebrow">From the blog</p>
        <h2>Latest updates</h2>
      </header>
      <div class="post-grid">
        @for (post of posts(); track post.id) {
        <article class="post-card">
          <h3>{{ post.name }}</h3>
          <p>{{ post.description }}</p>
        </article>
        } @empty {
        <p class="empty-state">No posts are live in this catalog yet.</p>
        }
      </div>
    </section>
    } @else {
    <section class="blog-unavailable" aria-label="Blog unavailable">
      <h1>This blog is not available.</h1>
      <p>There is no published Blog catalog for this site.</p>
    </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 72rem;
        margin: 0 auto;
        padding: 2rem 1rem;
      }
      .blog-unavailable {
        padding: 2rem;
        border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
        border-radius: 1rem;
      }
      .blog-unavailable h1 {
        margin-top: 0;
      }
      .blog-runtime {
        padding: 1.5rem;
        border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
        border-radius: 1rem;
      }
      .eyebrow {
        margin: 0;
        font: 700 0.72rem/1.2 ui-monospace, monospace;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.72;
      }
      h2 {
        margin: 0.35rem 0 1rem;
      }
      .post-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
      }
      .post-card {
        padding: 1rem;
        border-radius: 0.75rem;
        background: color-mix(in srgb, currentColor 6%, transparent);
      }
      .post-card h3,
      .post-card p {
        margin: 0;
      }
      .post-card p {
        margin-top: 0.45rem;
      }
      .empty-state {
        margin: 0;
        opacity: 0.76;
      }
    `,
  ],
})
export class BusinessBlogPageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly siteSlug = injectSiteSlugSignal();
  private readonly routeSiteSlug = computed(() => this.siteSlug());
  private readonly routeSite = toSignal(
    toObservable(this.routeSiteSlug).pipe(
      switchMap((siteSlug) =>
        this.siteConfig
          .fetch(false, siteSlug)
          .pipe(catchError(() => of<BusinessSiteConfig | null>(null)))
      )
    ),
    { initialValue: null }
  );

  readonly catalogId = computed(() =>
    resolvePublishedBlogCatalogId(
      this.routeSite()?.plugins.capabilities['blogging.posts'] as
        | PublishedBlogCapability
        | undefined
    )
  );
  readonly posts = toSignal(
    toObservable(this.catalogId).pipe(
      switchMap((catalogId) =>
        catalogId
          ? this.api
              .getBlogPosts(catalogId)
              .pipe(catchError(() => of<BusinessBlogPost[]>([])))
          : of<BusinessBlogPost[]>([])
      )
    ),
    { initialValue: [] }
  );
}
