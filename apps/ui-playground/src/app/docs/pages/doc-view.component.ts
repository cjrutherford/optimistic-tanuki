import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { DocsIndexService } from '../services/docs-index.service';
import { MarkdownRendererService } from '../services/markdown-renderer.service';
import { DocsShellComponent } from '../shell/docs-shell.component';
import { DocsTocComponent } from '../components/docs-toc.component';
import { MarkdownContentComponent } from '../components/markdown-content.component';

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
            <div class="doc-meta-row">
              <span class="meta-pill">{{ vm.doc.category }}</span>
              <a class="source-link" [attr.href]="vm.doc.sourcePath">{{
                vm.doc.sourcePath
              }}</a>
            </div>

            <pg-markdown-content [html]="vm.rendered.html" />

            <nav class="pager">
              @if (vm.adjacent.previous) {
              <a [routerLink]="['/docs', vm.adjacent.previous.slug]">{{
                vm.adjacent.previous.title
              }}</a>
              } @if (vm.adjacent.next) {
              <a [routerLink]="['/docs', vm.adjacent.next.slug]">{{
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

      .meta-pill {
        padding: 0.45rem 0.7rem;
        border-radius: 999px;
        background: rgba(63, 81, 181, 0.14);
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

  readonly vm$ = this.route.paramMap.pipe(
    map((params) => params.get('slug') ?? ''),
    switchMap((slug) =>
      combineLatest([
        this.docsIndex.getDocBySlug(slug),
        this.docsIndex.getAdjacentDocs(slug),
      ]).pipe(
        map(([doc, adjacent]) => ({
          doc,
          adjacent,
          rendered: doc
            ? this.markdownRenderer.render(doc.body, {
                sourcePath: doc.sourcePath,
              })
            : { html: '', toc: [], outboundLinks: [], embeddedBlocks: [] },
        }))
      )
    )
  );
}
