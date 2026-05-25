import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { DocsShellComponent } from '../shell/docs-shell.component';
import { DocsIndexService } from '../services/docs-index.service';
import { DocsSearchComponent } from '../components/docs-search.component';
import { ApiDocsIndexService } from '../services/api-docs-index.service';
import { toDocRouteSegments } from '../utils/docs-slug';

function formatUpdatedLabel(timestamp?: string): string {
  if (!timestamp) {
    return 'Updated recently';
  }

  return `Updated ${new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

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
      description="Read the repo through curated operational markdown: operator runbooks, onboarding, architecture, devops, testing, and key project entry points sourced directly from the codebase."
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
        <div class="meta-card">
          <span class="meta-label">Updated</span>
          <strong>{{ stats.updated }}</strong>
        </div>
      </div>

      <section class="home-grid">
        <div class="home-main">
          <section class="lane-grid" *ngIf="laneVm$ | async as laneVm">
            <article class="lane-card lane-card-operator">
              <span class="lane-kicker">Operate the platform</span>
              <h2>Reach runbooks, health checks, and recovery first</h2>
              <p>
                Start with the handbook and the highest-frequency operator
                procedures instead of scanning the full markdown catalog.
              </p>
              <div class="lane-links">
                <a
                  *ngFor="let document of laneVm.operatorDocs"
                  [routerLink]="toDocRouteSegments(document.slug)"
                >
                  <strong>{{ document.title }}</strong>
                  <span>{{ document.docRole || 'guide' }}</span>
                </a>
              </div>
            </article>

            <article class="lane-card lane-card-developer">
              <span class="lane-kicker">Explore libraries and APIs</span>
              <h2>Jump from package guides into generated API reference</h2>
              <p>
                Use library READMEs for package-level orientation, then move
                directly into Compodoc for component and symbol detail.
              </p>
              <div class="lane-links">
                <a
                  *ngFor="let document of laneVm.libraryGuides"
                  [routerLink]="toDocRouteSegments(document.slug)"
                >
                  <strong>{{ document.title }}</strong>
                  <span>Guide</span>
                </a>
                <a
                  *ngFor="let document of laneVm.apiDocs"
                  [routerLink]="['/docs/api', document.slug]"
                >
                  <strong>{{ document.name }}</strong>
                  <span>{{
                    document.available ? 'Compodoc ready' : 'Pending generation'
                  }}</span>
                </a>
              </div>
            </article>
          </section>

          <section
            class="operator-hub"
            *ngIf="operatorHubDocs$ | async as operatorHubDocs"
          >
            <div class="operator-header">
              <span class="operator-kicker">Operator Command Deck</span>
              <h2>Server administration without scavenger hunts</h2>
              <p>
                The operator handbook is the formal home for local stack
                administration, deployment environment workflows, and recovery
                runbooks.
              </p>
            </div>

            <div class="operator-grid">
              <a
                *ngFor="let document of operatorHubDocs"
                class="operator-card"
                [routerLink]="toDocRouteSegments(document.slug)"
              >
                <span class="operator-role">{{
                  document.docRole || 'guide'
                }}</span>
                <h3>{{ document.title }}</h3>
                <p>{{ document.summary }}</p>
                <span class="card-updated">{{
                  formatUpdatedLabel(document.lastUpdated)
                }}</span>
              </a>
            </div>
          </section>

          <section
            class="featured-strip"
            *ngIf="featuredDocs$ | async as featuredDocs"
          >
            <a
              *ngFor="let document of featuredDocs"
              class="featured-card"
              [routerLink]="toDocRouteSegments(document.slug)"
            >
              <span class="featured-kicker">{{ document.category }}</span>
              <h2>{{ document.title }}</h2>
              <p>{{ document.summary }}</p>
              <span class="card-updated">{{
                formatUpdatedLabel(document.lastUpdated)
              }}</span>
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
                  [routerLink]="toDocRouteSegments(document.slug)"
                >
                  <h3>{{ document.title }}</h3>
                  <p>{{ document.summary }}</p>
                  <span class="document-path">{{ document.sourcePath }}</span>
                  <span class="card-updated">{{
                    formatUpdatedLabel(document.lastUpdated)
                  }}</span>
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
      .operator-grid,
      .document-grid,
      .home-grid,
      .lane-grid {
        display: grid;
      }

      .meta-grid {
        gap: 0.75rem;
      }

      .meta-card,
      .operator-hub,
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
        font-size: 1.55rem;
        font-family: var(--font-heading);
        line-height: 0.94;
      }

      .home-grid {
        grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.72fr);
        gap: 1rem;
      }

      .lane-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .lane-card {
        padding: 1.2rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1.15rem;
        background: rgba(8, 13, 22, 0.5);
      }

      .lane-card-operator {
        background: radial-gradient(
            circle at top left,
            rgba(246, 207, 105, 0.14),
            transparent 32%
          ),
          linear-gradient(180deg, rgba(24, 18, 7, 0.96), rgba(9, 12, 17, 0.98));
      }

      .lane-card-developer {
        background: radial-gradient(
            circle at top right,
            rgba(124, 186, 255, 0.16),
            transparent 34%
          ),
          linear-gradient(180deg, rgba(8, 14, 26, 0.96), rgba(9, 12, 17, 0.98));
      }

      .lane-kicker {
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .lane-card h2 {
        margin: 0.45rem 0 0;
        font-family: var(--font-heading);
        letter-spacing: -0.04em;
      }

      .lane-card p {
        margin: 0.7rem 0 0;
        color: var(--muted);
      }

      .lane-links {
        display: grid;
        gap: 0.7rem;
        margin-top: 1rem;
      }

      .lane-links a {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 0.95rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 0.9rem;
        background: rgba(10, 14, 22, 0.68);
        color: inherit;
        text-decoration: none;
      }

      .lane-links a strong {
        font-family: var(--font-heading);
        font-size: 1rem;
        letter-spacing: -0.02em;
      }

      .lane-links a span {
        color: var(--muted);
        font: 600 0.68rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .operator-hub,
      .featured-strip,
      .category-stack {
        gap: 1rem;
      }

      .operator-hub {
        padding: 1.2rem;
        margin-bottom: 1rem;
        background: radial-gradient(
            circle at top left,
            rgba(218, 165, 32, 0.18),
            transparent 34%
          ),
          linear-gradient(180deg, rgba(24, 18, 7, 0.96), rgba(9, 12, 17, 0.98));
      }

      .operator-header h2 {
        margin: 0.45rem 0 0;
        font-family: var(--font-heading);
        letter-spacing: -0.04em;
      }

      .operator-header p {
        margin: 0.7rem 0 0;
        color: var(--muted);
      }

      .operator-kicker,
      .operator-role {
        color: #f6cf69;
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .operator-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.8rem;
        margin-top: 1rem;
      }

      .operator-card {
        display: grid;
        gap: 0.45rem;
        padding: 1rem;
        border: 1px solid rgba(246, 207, 105, 0.22);
        border-radius: 1rem;
        background: rgba(13, 17, 24, 0.72);
        text-decoration: none;
        color: inherit;
      }

      .operator-card h3 {
        margin: 0;
        font-family: var(--font-heading);
        letter-spacing: -0.03em;
      }

      .operator-card p {
        margin: 0;
        color: var(--muted);
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

      .card-updated {
        display: block;
        margin-top: 0.7rem;
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.68rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.1em;
        text-transform: uppercase;
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
        .featured-strip,
        .lane-grid {
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
  private readonly apiDocsIndex = inject(ApiDocsIndexService);

  readonly categories$ = this.docsIndex.getCategories();
  readonly searchDocuments$ = this.docsIndex.getSearchDocuments();
  readonly featuredDocs$ = this.docsIndex.getDocs().pipe(
    map((docs) =>
      docs
        .filter((doc) => doc.featured)
        .sort(
          (left, right) =>
            (left.order ?? 999) - (right.order ?? 999) ||
            left.title.localeCompare(right.title)
        )
        .slice(0, 4)
    )
  );
  readonly operatorHubDocs$ = this.docsIndex.getOperatorHubDocs();
  readonly laneVm$ = combineLatest([
    this.docsIndex.getOperatorHubDocs(),
    this.docsIndex.getLibraryGuideDocs(),
    this.apiDocsIndex.getIndex(),
  ]).pipe(
    map(([operatorDocs, libraryGuides, apiDocs]) => ({
      operatorDocs: operatorDocs.slice(0, 3),
      libraryGuides: libraryGuides.slice(0, 2),
      apiDocs: apiDocs.filter((doc) => doc.available).slice(0, 2),
    }))
  );
  readonly stats$ = combineLatest([
    this.docsIndex.getDocs(),
    this.docsIndex.getCategories(),
    this.docsIndex.getDocs().pipe(map((docs) => docs[0]?.lastUpdated)),
  ]).pipe(
    map(([docs, categories, updated]) => ({
      docs: docs.length,
      categories: categories.length,
      updated: formatUpdatedLabel(updated),
    }))
  );

  protected readonly formatUpdatedLabel = formatUpdatedLabel;
  protected readonly toDocRouteSegments = toDocRouteSegments;
}
