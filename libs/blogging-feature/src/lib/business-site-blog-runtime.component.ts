import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface BusinessSiteBlogPost {
  id: string;
  name: string;
  description: string;
}

@Component({
  selector: 'ot-blogging-business-site-runtime',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="blog-runtime" aria-label="Blog posts">
      <header>
        <p class="eyebrow">From the blog</p>
        <h2>{{ title }}</h2>
      </header>
      <div class="post-grid">
        @for (post of posts; track post.id) {
        <article class="post-card">
          <h3>{{ post.name }}</h3>
          <p>{{ post.description }}</p>
        </article>
        } @empty {
        <p class="empty-state">No posts are live in this catalog yet.</p>
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
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
export class BusinessSiteBlogRuntimeComponent {
  @Input() title = 'Latest updates';
  @Input() posts: readonly BusinessSiteBlogPost[] = [];
}
