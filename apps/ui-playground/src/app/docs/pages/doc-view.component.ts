import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { DocsIndexService } from '../services/docs-index.service';
import { MarkdownRendererService } from '../services/markdown-renderer.service';
import { DocsShellComponent } from '../shell/docs-shell.component';
import { DocsTocComponent } from '../components/docs-toc.component';
import { MarkdownContentComponent } from '../components/markdown-content.component';
import { ApiDocsIndexService } from '../services/api-docs-index.service';
import { getCatalogEntryByPackageSlug } from '../../catalog-data';
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
  selector: 'pg-doc-view',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    RouterLink,
    DocsShellComponent,
    DocsTocComponent,
    MarkdownContentComponent,
  ],
  template: `
    <ng-container *ngIf="vm$ | async as vm">
      @if (vm.doc) {
      <pg-docs-shell [title]="vm.doc.title" [description]="vm.doc.summary">
        <div slot="meta" class="doc-meta-card">
          <span class="meta-kicker">Source</span>
          <strong>{{ vm.doc.sourcePath }}</strong>
          <p>Rendered directly from repository markdown.</p>
        </div>

        <section class="doc-layout">
          <div class="doc-main">
            <nav class="doc-breadcrumbs">
              <a routerLink="/docs">Docs</a>
              <span *ngIf="vm.doc.section || vm.doc.category"
                >/ {{ vm.doc.section || vm.doc.category }}</span
              >
              <ng-container *ngIf="vm.parentDoc">
                <span>/</span>
                <a [routerLink]="toDocRouteSegments(vm.parentDoc.slug)">{{
                  vm.parentDoc.title
                }}</a>
              </ng-container>
            </nav>

            <div class="doc-meta-row">
              <span class="meta-pill">{{ vm.doc.category }}</span>
              <a class="source-link" [attr.href]="vm.doc.sourcePath">{{
                vm.doc.sourcePath
              }}</a>
            </div>

            <div class="doc-updated">{{ vm.updatedLabel }}</div>

            <div
              class="doc-context"
              *ngIf="vm.doc.section || vm.doc.parent || vm.doc.docRole"
            >
              <span *ngIf="vm.doc.section" class="context-pill">{{
                vm.doc.section
              }}</span>
              <span *ngIf="vm.doc.docRole" class="context-pill">{{
                vm.doc.docRole
              }}</span>
              <span *ngIf="vm.parentDoc" class="context-copy"
                >Parent: {{ vm.parentDoc.title }}</span
              >
            </div>

            <pg-markdown-content [html]="vm.rendered.html" />

            <section class="related-block" *ngIf="vm.relatedDocs.length > 0">
              <span class="meta-kicker">Section Navigation</span>
              <div class="related-grid">
                <a
                  *ngFor="let document of vm.relatedDocs"
                  [routerLink]="toDocRouteSegments(document.slug)"
                >
                  <strong>{{ document.title }}</strong>
                  <span>{{ document.docRole || document.category }}</span>
                </a>
              </div>
            </section>

            <section
              class="related-block"
              *ngIf="vm.relatedPackages.length > 0"
            >
              <span class="meta-kicker">Related packages</span>
              <div class="related-grid">
                <div
                  *ngFor="let pkg of vm.relatedPackages"
                  class="package-link-group"
                >
                  @if (pkg.playgroundPath) {
                  <a [routerLink]="[pkg.playgroundPath]">
                    <strong>{{ pkg.name }} preview</strong>
                    <span>Component page</span>
                  </a>
                  }
                  <a [routerLink]="['/docs/api', pkg.slug]">
                    <strong>{{ pkg.name }} API</strong>
                    <span>API reference</span>
                  </a>
                </div>
              </div>
            </section>

            <nav class="pager">
              @if (vm.adjacent.previous) {
              <a [routerLink]="toDocRouteSegments(vm.adjacent.previous.slug)">{{
                vm.adjacent.previous.title
              }}</a>
              } @if (vm.adjacent.next) {
              <a [routerLink]="toDocRouteSegments(vm.adjacent.next.slug)">{{
                vm.adjacent.next.title
              }}</a>
              }
            </nav>
          </div>

          <aside class="doc-side">
            <pg-docs-toc [headings]="vm.rendered.toc" />
          </aside>
        </section>
      </pg-docs-shell>
      } @else {
      <pg-docs-shell
        title="Document not found"
        description="This markdown route does not map to a generated repository document."
      >
        <div class="missing-state">
          <p>Document not found</p>
          <a routerLink="/docs">Return to documentation home</a>
        </div>
      </pg-docs-shell>
      }
    </ng-container>
  `,
  styles: [
    `
      .doc-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.45fr) minmax(240px, 0.55fr);
        gap: 1rem;
      }

      .doc-main,
      .doc-meta-card,
      .missing-state {
        padding: 1rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1.15rem;
        background: rgba(8, 13, 22, 0.56);
      }

      .doc-meta-card strong,
      .meta-kicker,
      .meta-pill {
        display: block;
      }

      .meta-kicker,
      .meta-pill {
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .doc-meta-card strong {
        margin-top: 0.45rem;
        line-height: 1.4;
      }

      .doc-meta-card p,
      .missing-state p {
        margin: 0.65rem 0 0;
        color: var(--muted);
      }

      .doc-meta-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .doc-breadcrumbs {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.45rem;
        margin-bottom: 1rem;
        color: var(--muted);
        font: 500 0.78rem/1.3 'IBM Plex Mono', monospace;
      }

      .doc-breadcrumbs a {
        color: color-mix(in srgb, var(--primary) 76%, white);
        text-decoration: none;
      }

      .doc-context {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.65rem;
        margin-bottom: 1rem;
      }

      .doc-updated {
        margin-bottom: 1rem;
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .meta-pill {
        padding: 0.45rem 0.7rem;
        border-radius: 999px;
        background: rgba(63, 81, 181, 0.14);
      }

      .context-pill,
      .context-copy {
        font: 600 0.75rem/1.3 'IBM Plex Mono', monospace;
      }

      .context-pill {
        padding: 0.38rem 0.65rem;
        border-radius: 999px;
        background: rgba(246, 207, 105, 0.12);
        color: #f6cf69;
        text-transform: uppercase;
      }

      .context-copy {
        color: var(--muted);
      }

      .source-link {
        color: var(--muted);
        font: 500 0.8rem/1.3 'IBM Plex Mono', monospace;
        text-decoration: none;
      }

      .pager {
        display: flex;
        justify-content: space-between;
        gap: 0.8rem;
        margin-top: 1.2rem;
      }

      .related-block {
        margin-top: 1.25rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(129, 168, 222, 0.12);
      }

      .related-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.8rem;
        margin-top: 0.8rem;
      }

      .related-grid a {
        display: grid;
        gap: 0.35rem;
        padding: 0.9rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 0.95rem;
        background: rgba(10, 14, 22, 0.5);
        color: inherit;
        text-decoration: none;
      }

      .package-link-group {
        display: grid;
        gap: 0.8rem;
      }

      .related-grid a strong {
        font-family: var(--font-heading);
      }

      .related-grid a span {
        color: var(--muted);
        font: 600 0.68rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .pager a,
      .missing-state a {
        color: color-mix(in srgb, var(--primary) 76%, white);
        text-decoration: none;
      }

      @media (max-width: 1080px) {
        .doc-layout {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocViewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly docsIndex = inject(DocsIndexService);
  private readonly markdownRenderer = inject(MarkdownRendererService);
  private readonly apiDocsIndex = inject(ApiDocsIndexService);
  protected readonly toDocRouteSegments = toDocRouteSegments;

  readonly vm$ = this.route.paramMap.pipe(
    map((params) => params.get('slug') ?? ''),
    switchMap((slug) =>
      this.docsIndex.getDocBySlug(slug).pipe(
        switchMap((doc) =>
          combineLatest([
            this.docsIndex.getAdjacentDocs(slug),
            doc?.parent ? this.docsIndex.getDocBySlug(doc.parent) : of(null),
            doc?.section ? this.docsIndex.getSectionDocs(doc.section) : of([]),
            this.apiDocsIndex.getIndex(),
          ]).pipe(
            map(([adjacent, parentDoc, sectionDocs, apiDocs]) => ({
              doc,
              parentDoc,
              adjacent,
              updatedLabel: formatUpdatedLabel(doc?.lastUpdated),
              relatedDocs: (sectionDocs ?? [])
                .filter((sectionDoc) => sectionDoc.slug !== doc?.slug)
                .slice(0, 4),
              relatedPackages: (doc?.relatedPackages ?? [])
                .map((packageSlug) => {
                  const apiDoc = apiDocs.find(
                    (item) => item.slug === packageSlug
                  );
                  if (!apiDoc) {
                    return null;
                  }

                  return {
                    slug: apiDoc.slug,
                    name: apiDoc.name,
                    playgroundPath:
                      getCatalogEntryByPackageSlug(apiDoc.slug)?.path ?? null,
                  };
                })
                .filter(
                  (value): value is NonNullable<typeof value> => value !== null
                ),
              rendered: doc
                ? this.markdownRenderer.render(doc.body, {
                    sourcePath: doc.sourcePath,
                  })
                : { html: '', toc: [], outboundLinks: [], embeddedBlocks: [] },
            }))
          )
        )
      )
    )
  );
}
