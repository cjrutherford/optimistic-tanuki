import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import type { PublishedFeatureContext } from '@optimistic-tanuki/configurable-plugin-contracts';
import {
  BlogPublicDataService,
  type PublicBlogPost,
} from '@optimistic-tanuki/blogging-data-access';
import { Subscription } from 'rxjs';

/**
 * Public Blogging composition. It reads through the dedicated anonymous
 * adapter and never receives owner or workspace records.
 */
@Component({
  selector: 'ot-published-blogging-feature',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section
      class="blog-feature"
      aria-labelledby="published-blog-title"
      [attr.data-blog-catalog]="publishedContext?.resourceRef?.id"
    >
      <p class="eyebrow">Published writing</p>
      <h1 id="published-blog-title">Latest posts</h1>
      <p class="intro">Notes and updates shared through this app.</p>
      @if (state === 'loading') {
      <p class="empty-state" role="status" aria-busy="true">
        Loading published posts…
      </p>
      } @else if (state === 'error') {
      <div class="empty-state error-state" role="alert">
        <strong>Posts are unavailable right now.</strong>
        <p>{{ errorMessage }}</p>
        <button type="button" (click)="loadPosts()">Try again</button>
      </div>
      } @else if (state === 'empty') {
      <p class="empty-state" role="status">No published posts yet.</p>
      } @else {
      <div class="post-grid">
        @for (post of posts; track post.id) {
        <article class="post-card">
          <h2>{{ post.title }}</h2>
          <p>{{ post.content }}</p>
        </article>
        }
      </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .blog-feature {
        padding: clamp(1rem, 3vw, 2rem);
        border: 1px solid var(--border, #d8e1ea);
        border-radius: 1rem;
        background: var(--surface, #fff);
      }
      .eyebrow {
        margin: 0;
        color: var(--primary, #356c91);
        font-size: 0.75rem;
        font-weight: 850;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0.35rem 0 0.5rem;
        font-size: clamp(1.65rem, 4vw, 2.6rem);
      }
      .intro {
        margin: 0 0 1.3rem;
        opacity: 0.78;
      }
      .post-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
        gap: 1rem;
      }
      .post-card {
        padding: 1rem;
        border: 1px solid var(--border, #d8e1ea);
        border-radius: 0.75rem;
        background: color-mix(
          in srgb,
          var(--primary, #356c91) 5%,
          var(--surface, #fff)
        );
      }
      .post-card h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .post-card p {
        margin: 0.5rem 0 0;
        line-height: 1.55;
      }
      .empty-state {
        margin: 0;
        padding: 1rem;
        border-radius: 0.65rem;
        background: color-mix(
          in srgb,
          var(--foreground, #172033) 6%,
          transparent
        );
      }
      .error-state p {
        margin: 0.5rem 0;
      }
      .error-state button {
        min-height: 2.5rem;
        padding: 0.5rem 0.8rem;
        border: 1px solid var(--primary, #356c91);
        border-radius: 0.45rem;
        background: var(--primary, #356c91);
        color: var(--primary-foreground, #fff);
        font: inherit;
        font-weight: 750;
        cursor: pointer;
      }
    `,
  ],
})
export class PublishedBloggingFeatureComponent implements OnChanges, OnDestroy {
  @Input() publishedContext: PublishedFeatureContext | null = null;
  posts: readonly PublicBlogPost[] = [];
  state: 'loading' | 'success' | 'empty' | 'error' = 'loading';
  errorMessage = '';
  private requestSubscription: Subscription | null = null;

  constructor(private readonly publicData: BlogPublicDataService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['publishedContext']) {
      this.loadPosts();
    }
  }

  ngOnDestroy(): void {
    this.requestSubscription?.unsubscribe();
  }

  loadPosts(): void {
    this.requestSubscription?.unsubscribe();
    const catalog = this.publishedContext?.resourceRef;
    const domain = this.publishedContext?.domain;
    if (
      this.publishedContext?.capabilityId !== 'blogging.posts' ||
      catalog?.type !== 'blog-catalog' ||
      !catalog.id.trim() ||
      !domain
    ) {
      this.state = 'error';
      this.errorMessage = 'The published Blog catalog reference is invalid.';
      return;
    }

    this.state = 'loading';
    this.errorMessage = '';
    this.requestSubscription = this.publicData
      .getPublishedPosts(domain)
      .subscribe({
        next: (posts) => {
          this.posts = posts;
          this.state = posts.length ? 'success' : 'empty';
        },
        error: () => {
          this.posts = [];
          this.state = 'error';
          this.errorMessage = 'The published Blog catalog could not be loaded.';
        },
      });
  }
}
