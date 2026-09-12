import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  DiscoveredWorkspace,
  WorkspaceDiscoveryApiService,
} from '@optimistic-tanuki/app-config-data-access';
import { BlogAuthoringShellComponent } from '@optimistic-tanuki/blogging-ui';
import { ForumAuthoringShellComponent } from '@optimistic-tanuki/forum-ui';
import { SocialAuthoringShellComponent } from '@optimistic-tanuki/social-ui';
import { StoreAuthoringShellComponent } from '@optimistic-tanuki/store-ui';

type AuthoringProduct = 'store' | 'blogging' | 'forum' | 'social';
type AuthoringState = 'loading' | 'denied' | 'ready';

const eligibleKinds: Record<AuthoringProduct, DiscoveredWorkspace['kind'][]> = {
  store: ['business-site'],
  blogging: ['business-site', 'community'],
  forum: ['community'],
  social: ['community'],
};

@Component({
  standalone: true,
  imports: [
    RouterLink,
    StoreAuthoringShellComponent,
    BlogAuthoringShellComponent,
    ForumAuthoringShellComponent,
    SocialAuthoringShellComponent,
  ],
  template: `
    <main class="authoring-page" aria-labelledby="authoring-heading">
      <a routerLink="/" class="back-link">← All workspaces</a>
      @if (state() === 'loading') {
      <p role="status">Checking workspace access…</p>
      } @else if (state() === 'denied') {
      <section data-authoring-denied role="alert">
        <h1 id="authoring-heading">This authoring surface is not available.</h1>
        <p>
          The workspace could not be resolved for this signed-in session, or
          does not support this product.
        </p>
      </section>
      } @else if (workspace(); as resolvedWorkspace) {
      <header>
        <p class="eyebrow">{{ resolvedWorkspace.displayName }}</p>
        <h1 id="authoring-heading">{{ title }}</h1>
      </header>
      @switch (product) { @case ('store') {
      <ot-store-authoring-shell
        [workspaceId]="resolvedWorkspace.workspaceId"
        [workspaceSlug]="resolvedWorkspace.slug"
        state="ready"
        ><p data-authoring-ready>
          Catalog authoring is ready for this workspace.
        </p></ot-store-authoring-shell
      >
      } @case ('blogging') {
      <ot-blog-authoring-shell
        [workspaceId]="resolvedWorkspace.workspaceId"
        [workspaceSlug]="resolvedWorkspace.slug"
        [appScope]="resolvedWorkspace.appScope"
        state="ready"
        ><p data-authoring-ready>
          Publishing authoring is ready for this workspace.
        </p></ot-blog-authoring-shell
      >
      } @case ('forum') {
      <ot-forum-authoring-shell
        [workspaceId]="resolvedWorkspace.workspaceId"
        state="ready"
        ><p data-authoring-ready>
          Discussion authoring is ready for this workspace.
        </p></ot-forum-authoring-shell
      >
      } @case ('social') {
      <ot-social-authoring-shell
        [workspaceId]="resolvedWorkspace.workspaceId"
        state="ready"
        ><p data-authoring-ready>
          Community authoring is ready for this workspace.
        </p></ot-social-authoring-shell
      >
      } } }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .authoring-page {
        min-height: 100vh;
        padding: clamp(1.5rem, 5vw, 4rem);
        background: var(--config-shell-bg-1);
        color: var(--config-shell-foreground);
      }
      header {
        margin: 2rem 0;
      }
      .eyebrow {
        color: var(--config-brand-gradient-from);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .back-link {
        color: inherit;
      }
      .authoring-page h1 {
        font: 600 clamp(2rem, 5vw, 4rem) / 1 Georgia, serif;
      }
    `,
  ],
})
export class ProductAuthoringPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(WorkspaceDiscoveryApiService);

  readonly workspace = signal<DiscoveredWorkspace | null>(null);
  readonly state = signal<AuthoringState>('loading');
  readonly product = this.readProduct();

  constructor() {
    const workspaceId = this.route.snapshot.paramMap.get('workspaceId') ?? '';
    if (!workspaceId || !this.product) {
      this.state.set('denied');
      return;
    }
    this.api.get(workspaceId).subscribe({
      next: (workspace) => {
        if (!eligibleKinds[this.product!].includes(workspace.kind)) {
          this.state.set('denied');
          return;
        }
        this.workspace.set(workspace);
        this.state.set('ready');
      },
      error: () => this.state.set('denied'),
    });
  }

  get title(): string {
    return {
      store: 'Store catalog authoring',
      blogging: 'Blog publishing authoring',
      forum: 'Forum discussion authoring',
      social: 'Community activity authoring',
    }[this.product ?? 'store'];
  }

  private readProduct(): AuthoringProduct | null {
    const product = this.route.snapshot.paramMap.get('product');
    return product && product in eligibleKinds
      ? (product as AuthoringProduct)
      : null;
  }
}
