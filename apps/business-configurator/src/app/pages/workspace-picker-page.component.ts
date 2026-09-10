import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DiscoveredWorkspace,
  WorkspaceDiscoveryStore,
} from '@optimistic-tanuki/app-config-data-access';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="workspace-picker" aria-labelledby="workspace-heading">
      <header class="masthead">
        <p class="eyebrow">Configurator workspace</p>
        <h1 id="workspace-heading">Choose a surface to shape.</h1>
        <p class="lede">
          Your workspaces are resolved from your signed-in owner session. Pick
          one to continue with its configuration tools.
        </p>
      </header>

      @if (store.loading()) {
      <p class="state-message" role="status">Finding your workspaces…</p>
      } @else if (store.error()) {
      <section class="state-message error" role="alert">
        <h2>We could not load your workspaces.</h2>
        <p>{{ store.error() }}</p>
        <button type="button" (click)="store.load()">Try again</button>
      </section>
      } @else if (store.workspaces().length === 0) {
      <section class="state-message">
        <h2>No configurable workspaces yet.</h2>
        <p>
          Start a private Business Site workspace, or claim a community, then
          return here to configure it.
        </p>
        <button type="button" (click)="store.provisionBusinessSite()">
          Start a Business Site
        </button>
      </section>
      } @else {
      <section class="workspace-list" aria-label="Your workspaces">
        @for (workspace of store.workspaces(); track workspace.workspaceId) {
        <article class="workspace-card">
          <div class="workspace-card__topline">
            <span>{{
              workspace.kind === 'business-site' ? 'Business Site' : 'Community'
            }}</span>
            <span class="status">{{ workspace.status }}</span>
          </div>
          <h2>{{ workspace.displayName }}</h2>
          <p>{{ workspace.slug }}</p>
          @if (workspace.kind === 'business-site') {
          <a class="open-link" [routerLink]="editorLink(workspace)">
            Open workspace <span aria-hidden="true">→</span>
          </a>
          }
          <nav class="authoring-links" aria-label="Product authoring">
            @for (product of authoringProducts(workspace); track product.id) {
            <a [routerLink]="authoringLink(workspace, product.id)">
              {{ product.label }}
            </a>
            }
          </nav>
        </article>
        }
      </section>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }
      .workspace-picker {
        min-height: 100vh;
        padding: clamp(1.5rem, 5vw, 5rem);
        background: radial-gradient(
            circle at 86% 2%,
            color-mix(
              in srgb,
              var(--config-brand-gradient-from) 24%,
              transparent
            ),
            transparent 24rem
          ),
          linear-gradient(
            145deg,
            var(--config-shell-bg-1),
            var(--config-shell-bg-2)
          );
        color: var(--config-shell-foreground);
      }
      .masthead {
        max-width: 46rem;
        margin-bottom: clamp(2rem, 6vw, 4.5rem);
      }
      .eyebrow,
      .workspace-card__topline {
        margin: 0 0 0.8rem;
        color: var(--config-brand-gradient-from);
        font: 700 0.72rem/1.2 ui-monospace, SFMono-Regular, monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font: 600 clamp(2.5rem, 7vw, 5.6rem) / 0.94 Georgia, serif;
        letter-spacing: -0.06em;
      }
      .lede {
        max-width: 42rem;
        margin: 1.3rem 0 0;
        color: color-mix(
          in srgb,
          var(--config-shell-foreground) 76%,
          transparent
        );
        font-size: clamp(1rem, 2vw, 1.2rem);
      }
      .workspace-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
        gap: 1rem;
      }
      .workspace-card,
      .state-message {
        border: 1px solid
          color-mix(in srgb, var(--config-brand-gradient-from) 28%, transparent);
        background: color-mix(in srgb, var(--config-shell-bg-2) 76%, #000);
        box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.2);
      }
      .workspace-card {
        min-height: 16rem;
        padding: 1.35rem;
        display: flex;
        flex-direction: column;
      }
      .workspace-card__topline {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
      }
      .status {
        color: color-mix(
          in srgb,
          var(--config-shell-foreground) 62%,
          transparent
        );
      }
      h2 {
        margin: 0;
        font: 600 1.5rem/1.05 Georgia, serif;
      }
      .workspace-card > p {
        margin: 0.65rem 0 1.5rem;
        color: color-mix(
          in srgb,
          var(--config-shell-foreground) 60%,
          transparent
        );
      }
      .open-link {
        margin-top: auto;
        align-self: flex-start;
        padding: 0.62rem 0.8rem;
        color: var(--config-brand-foreground);
        background: var(--config-brand-gradient-from);
        font-weight: 700;
        text-decoration: none;
      }
      .open-link:hover,
      .open-link:focus-visible {
        background: #91f5df;
        text-decoration: none;
      }
      .future-note {
        font-size: 0.9rem;
      }
      .state-message {
        max-width: 42rem;
        padding: 1.25rem;
      }
      .state-message h2 {
        margin-bottom: 0.5rem;
      }
      .error {
        border-color: #f7a6a6;
      }
      button {
        border: 0;
        padding: 0.6rem 0.8rem;
        background: var(--config-brand-gradient-from);
        color: var(--config-brand-foreground);
        cursor: pointer;
        font-weight: 700;
      }
      @media (max-width: 600px) {
        .workspace-picker {
          padding: 1.25rem;
        }
        .workspace-card {
          min-height: 13rem;
        }
      }
    `,
  ],
})
export class WorkspacePickerPageComponent {
  readonly store = inject(WorkspaceDiscoveryStore);

  constructor() {
    this.store.load();
  }

  editorLink(workspace: DiscoveredWorkspace): string[] {
    return ['/', 'workspaces', workspace.workspaceId, 'sites', workspace.slug];
  }

  authoringLink(
    workspace: DiscoveredWorkspace,
    product: 'store' | 'blogging' | 'forum' | 'social'
  ): string[] {
    return ['/', 'workspaces', workspace.workspaceId, 'authoring', product];
  }

  authoringProducts(workspace: DiscoveredWorkspace): Array<{
    id: 'store' | 'blogging' | 'forum' | 'social';
    label: string;
  }> {
    return workspace.kind === 'business-site'
      ? [
          { id: 'store', label: 'Author store catalog' },
          { id: 'blogging', label: 'Author blog posts' },
        ]
      : [
          { id: 'forum', label: 'Author discussions' },
          { id: 'social', label: 'Author community activity' },
        ];
  }
}
