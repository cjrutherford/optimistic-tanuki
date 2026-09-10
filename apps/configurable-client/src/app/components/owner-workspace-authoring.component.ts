import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  WorkspaceDiscoveryStore,
  type DiscoveredWorkspace,
} from '@optimistic-tanuki/app-config-data-access';
import { BlogAuthoringShellComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'app-owner-workspace-authoring',
  standalone: true,
  imports: [CommonModule, RouterModule, BlogAuthoringShellComponent],
  template: `
    <main class="authoring-page" aria-labelledby="authoring-title">
      <a class="back-link" [href]="'/owner/workspace/' + slug"
        >← Back to owner desk</a
      >
      @if (store.loading()) {
      <section class="authoring-state" role="status">
        <h1>Loading authoring</h1>
        <p>Verifying the workspace feature surface.</p>
      </section>
      } @else if (store.error()) {
      <section class="authoring-state" role="alert">
        <h1>Authoring unavailable</h1>
        <p>{{ store.error() }}</p>
      </section>
      } @else if (!workspace) {
      <section class="authoring-state" role="alert">
        <h1>Authoring unavailable</h1>
        <p>This workspace is not an active owner workspace in your session.</p>
        <a [href]="'/owner'">Choose another workspace</a>
      </section>
      } @else {
      <header class="authoring-header">
        <p class="eyebrow">{{ workspace.displayName }} / authoring</p>
        <h1 id="authoring-title">Prepare the next handoff.</h1>
        <p>
          Use the supported authoring surface for this workspace. Every route
          below stays scoped to {{ workspace.slug }}.
        </p>
      </header>
      @if (workspace.kind === 'business-site') {
      <nav class="feature-nav" aria-label="Supported authoring features">
        <a
          class="feature-link feature-link--active"
          [href]="featureHref('blog')"
          >Blog publishing</a
        >
      </nav>
      @if (feature === 'blog' || !feature) {
      <p class="contract-note">
        New posts are saved as drafts until you explicitly publish them.
      </p>
      <ot-blog-authoring-shell
        [workspaceId]="workspace.workspaceId"
        [workspaceSlug]="workspace.slug"
        [appScope]="workspace.appScope"
        state="ready"
      />
      } @else {
      <section class="authoring-state">
        <h2>Feature unavailable</h2>
        <p>This workspace supports blog publishing only.</p>
        <a [href]="featureHref('blog')">Open blog publishing</a>
      </section>
      } } @else {
      <section class="authoring-state" role="status">
        <h2>Community authoring currently unavailable</h2>
        <p>
          Forum and social authoring are not available until their workspace
          shells are functional.
        </p>
        <a [href]="'/owner/workspace/' + slug">Back to owner desk</a>
      </section>
      } }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: var(--background, #f3f0e9);
        color: var(--foreground, #1b1d1a);
      }
      .authoring-page {
        width: min(1000px, calc(100% - 3rem));
        margin: 0 auto;
        padding: 2rem 0 5rem;
      }
      .back-link,
      .feature-link,
      .authoring-state a {
        color: var(--primary, #5b690e);
        font-weight: 800;
      }
      .authoring-header {
        padding: 5rem 0 2rem;
      }
      .eyebrow {
        color: var(--muted-foreground, #6e6b63);
        font: 700 0.7rem ui-monospace, monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .authoring-header h1 {
        max-width: 12ch;
        margin: 0;
        font: 800 clamp(3rem, 7vw, 5.5rem) / 0.88 Georgia, serif;
        letter-spacing: -0.07em;
      }
      .authoring-header p:last-child {
        max-width: 38rem;
        color: var(--muted-foreground, #6e6b63);
        line-height: 1.6;
      }
      .feature-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        margin-bottom: 1rem;
      }
      .feature-link {
        padding: 0.75rem 1rem;
        border: 1px solid var(--border, #c8c2b8);
        background: var(--surface, #f8f6f1);
        text-decoration: none;
      }
      .feature-link--active {
        border-color: var(--foreground, #1b1d1a);
        background: var(--accent, #d4f34a);
      }
      .authoring-state {
        margin-top: 2rem;
        padding: 2rem;
        border: 1px solid var(--border, #c8c2b8);
        background: var(--surface, #f8f6f1);
      }
      .authoring-state h1,
      .authoring-state h2 {
        margin-top: 0;
        font-family: Georgia, serif;
      }
      .authoring-state p {
        color: var(--muted-foreground, #6e6b63);
        line-height: 1.6;
      }
      @media (prefers-reduced-motion: reduce) {
        .loader {
          animation: none;
        }
      }
    `,
  ],
})
export class OwnerWorkspaceAuthoringComponent implements OnInit {
  readonly store = inject(WorkspaceDiscoveryStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  slug = '';
  feature = '';

  get workspace(): DiscoveredWorkspace | undefined {
    return this.store
      .workspaces()
      .find(
        (candidate) =>
          candidate.slug === this.slug &&
          candidate.workspaceId &&
          candidate.status === 'active' &&
          candidate.membershipRole === 'owner' &&
          candidate.membershipStatus === 'active'
      );
  }

  ngOnInit(): void {
    this.applyRouteContext(
      this.route.snapshot.paramMap.get('workspaceSlug'),
      this.route.snapshot.paramMap.get('feature')
    );
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) =>
        this.applyRouteContext(
          params.get('workspaceSlug'),
          params.get('feature')
        )
      );
  }

  featureHref(feature: string): string {
    return `/owner/workspace/${encodeURIComponent(
      this.slug
    )}/author/${feature}`;
  }

  private applyRouteContext(slug: string | null, feature: string | null): void {
    this.slug = slug ?? '';
    this.feature = feature ?? '';
    this.store.load();
  }
}
