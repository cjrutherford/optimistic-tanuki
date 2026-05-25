import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { DocsShellComponent } from '../shell/docs-shell.component';
import { ApiDocsIndexService } from '../services/api-docs-index.service';
import { DocsIndexService } from '../services/docs-index.service';
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
  selector: 'pg-api-doc-view',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, DocsShellComponent],
  template: `
    <ng-container *ngIf="vm$ | async as vm">
      @if (vm.doc) {
      <pg-docs-shell [title]="vm.doc.name" [description]="vm.doc.summary">
        <div slot="meta" class="meta-card">
          <span class="meta-kicker">Package</span>
          <strong>{{ vm.doc.packageName }}</strong>
          <p>{{ vm.doc.sourceRoot }}</p>
          <span class="meta-updated">{{ vm.updatedLabel }}</span>
        </div>

        @if (vm.doc.available && vm.frameUrl) {
        <div class="frame-shell">
          <div class="frame-meta">
            <div class="frame-links">
              <a [routerLink]="['/docs']">Back to docs</a>
              <a
                *ngIf="vm.guideDoc"
                [routerLink]="toDocRouteSegments(vm.guideDoc.slug)"
                >Read library guide</a
              >
            </div>
            <span>{{ vm.doc.readmePath }}</span>
          </div>
          <iframe
            class="api-frame"
            title="Compodoc API reference"
            [src]="vm.frameUrl"
          ></iframe>
        </div>
        } @else {
        <div class="missing-shell">
          <h2>API docs are not generated yet</h2>
          <p>
            Run the docs-content target after installing dependencies to produce
            the Compodoc output for this library.
          </p>
          <code>pnpm exec nx run ui-playground:api-docs-content</code>
        </div>
        }
      </pg-docs-shell>
      } @else {
      <pg-docs-shell
        title="API reference not found"
        description="This UI library is not part of the curated Compodoc index."
      >
        <div class="missing-shell">
          <p>API reference not found.</p>
          <a routerLink="/docs">Return to documentation home</a>
        </div>
      </pg-docs-shell>
      }
    </ng-container>
  `,
  styles: [
    `
      .meta-card,
      .frame-shell,
      .missing-shell {
        padding: 1rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1.1rem;
        background: rgba(8, 13, 22, 0.56);
      }

      .meta-kicker {
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .meta-card strong {
        display: block;
        margin-top: 0.5rem;
      }

      .meta-card p,
      .missing-shell p {
        margin: 0.7rem 0 0;
        color: var(--muted);
      }

      .meta-updated {
        display: block;
        margin-top: 0.85rem;
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .frame-shell {
        display: grid;
        gap: 0.85rem;
      }

      .frame-meta {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        color: var(--muted);
        font: 500 0.78rem/1.3 'IBM Plex Mono', monospace;
      }

      .frame-links {
        display: flex;
        flex-wrap: wrap;
        gap: 0.85rem;
      }

      .frame-meta a {
        color: color-mix(in srgb, var(--primary) 76%, white);
        text-decoration: none;
      }

      .api-frame {
        width: 100%;
        min-height: 78vh;
        border: 1px solid rgba(129, 168, 222, 0.1);
        border-radius: 0.9rem;
        background: white;
      }

      .missing-shell code {
        display: inline-block;
        margin-top: 0.85rem;
        padding: 0.5rem 0.7rem;
        border-radius: 0.8rem;
        background: rgba(5, 10, 18, 0.84);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiDocViewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly apiDocs = inject(ApiDocsIndexService);
  private readonly docsIndex = inject(DocsIndexService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly toDocRouteSegments = toDocRouteSegments;

  readonly vm$ = this.route.paramMap.pipe(
    map((params) => params.get('library') ?? ''),
    switchMap((slug) =>
      this.apiDocs
        .getBySlug(slug)
        .pipe(
          switchMap((doc) =>
            combineLatest([
              of(doc),
              doc
                ? this.docsIndex.getDocBySourcePath(doc.readmePath)
                : of(null),
            ])
          )
        )
    ),
    map(([doc, guideDoc]) => ({
      doc,
      guideDoc,
      updatedLabel: formatUpdatedLabel(doc?.generatedAt),
      frameUrl:
        doc?.available && doc.url
          ? this.sanitizer.bypassSecurityTrustResourceUrl(doc.url)
          : null,
    }))
  );
}
