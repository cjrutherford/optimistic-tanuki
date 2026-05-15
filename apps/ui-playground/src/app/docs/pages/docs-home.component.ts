import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { DocsShellComponent } from '../shell/docs-shell.component';
import { DocsIndexService } from '../services/docs-index.service';
import { DocsSearchComponent } from '../components/docs-search.component';

@Component({
  selector: 'pg-docs-home',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    RouterLink,
    DocsShellComponent,
    DocsSearchComponent,
  ],
  template: `
    <pg-docs-shell
      title="Operational Documentation"
      description="Read the repo through curated markdown: onboarding, architecture, devops, testing, and key project entry points sourced directly from the codebase."
    >
      <div slot="meta" class="meta-grid" *ngIf="stats$ | async as stats">
        <div class="meta-card">
          <span class="meta-label">Documents</span>
          <strong>{{ stats.docs }}</strong>
        </div>
        <div class="meta-card">
          <span class="meta-label">Categories</span>
          <strong>{{ stats.categories }}</strong>
        </div>
      </div>

      <section class="home-grid">
        <div class="home-main">
          <section
            class="featured-strip"
            *ngIf="featuredDocs$ | async as featuredDocs"
          >
            <a
              *ngFor="let document of featuredDocs"
              class="featured-card"
              [routerLink]="['/docs', document.slug]"
            >
              <span class="featured-kicker">{{ document.category }}</span>
              <h2>{{ document.title }}</h2>
              <p>{{ document.summary }}</p>
            </a>
          </section>

          <section
            class="category-stack"
            *ngIf="categories$ | async as categories"
          >
            <div class="category-block" *ngFor="let category of categories">
              <div class="category-heading">
                <span class="category-kicker">{{ category.title }}</span>
                <strong>{{ category.documents.length }} pages</strong>
              </div>
              <div class="document-grid">
                <a
                  *ngFor="let document of category.documents"
                  class="document-card"
                  [routerLink]="['/docs', document.slug]"
                >
                  <h3>{{ document.title }}</h3>
                  <p>{{ document.summary }}</p>
                  <span class="document-path">{{ document.sourcePath }}</span>
                </a>
              </div>
            </div>
          </section>
        </div>

        <aside
          class="home-side"
          *ngIf="searchDocuments$ | async as searchDocuments"
        >
          <pg-docs-search [documents]="searchDocuments" />
        </aside>
      </section>
    </pg-docs-shell>
  `,
  styles: [
    `
      .meta-grid,
      .featured-strip,
      .document-grid,
      .home-grid {
        display: grid;
      }

      .meta-grid {
        gap: 0.75rem;
      }

      .meta-card,
      .featured-card,
      .document-card,
      .category-block,
      .home-side {
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1.15rem;
        background: rgba(8, 13, 22, 0.5);
      }

      .meta-card {
        padding: 1rem;
      }

      .meta-label,
      .featured-kicker,
      .category-kicker,
      .document-path {
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.7rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .meta-card strong {
        display: block;
        margin-top: 0.45rem;
        font-size: 2rem;
        font-family: var(--font-heading);
        line-height: 0.94;
      }

      .home-grid {
        grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.72fr);
        gap: 1rem;
      }

      .featured-strip,
      .category-stack {
        gap: 1rem;
      }

      .featured-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin-bottom: 1rem;
      }

      .featured-card,
      .document-card,
      .home-side,
      .category-block {
        padding: 1rem;
        text-decoration: none;
        color: inherit;
      }

      .featured-card h2,
      .document-card h3 {
        margin: 0.55rem 0 0;
        font-family: var(--font-heading);
        letter-spacing: -0.03em;
      }

      .featured-card p,
      .document-card p {
        margin: 0.65rem 0 0;
        color: var(--muted);
      }

      .category-block {
        display: grid;
        gap: 0.9rem;
      }

      .category-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .document-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.8rem;
      }

      .home-side {
        align-self: start;
        position: sticky;
        top: 6.4rem;
      }

      @media (max-width: 1080px) {
        .home-grid,
        .featured-strip {
          grid-template-columns: 1fr;
        }

        .home-side {
          position: static;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsHomeComponent {
  private readonly docsIndex = inject(DocsIndexService);

  readonly categories$ = this.docsIndex.getCategories();
  readonly searchDocuments$ = this.docsIndex.getSearchDocuments();
  readonly featuredDocs$ = this.docsIndex
    .getDocs()
    .pipe(map((docs) => docs.slice(0, 4)));
  readonly stats$ = combineLatest([
    this.docsIndex.getDocs(),
    this.docsIndex.getCategories(),
  ]).pipe(
    map(([docs, categories]) => ({
      docs: docs.length,
      categories: categories.length,
    }))
  );
}
