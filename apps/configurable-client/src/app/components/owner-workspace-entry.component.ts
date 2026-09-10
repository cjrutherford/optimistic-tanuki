import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  WorkspaceDiscoveryStore,
  type DiscoveredWorkspace,
} from '@optimistic-tanuki/app-config-data-access';

@Component({
  selector: 'app-owner-workspace-entry',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="workspace-entry" aria-labelledby="workspace-entry-title">
      <p class="eyebrow">Configurable Client / owner desk</p>
      <h1 id="workspace-entry-title">Choose a workspace.</h1>
      <p class="lede">
        Open an owner workspace to shape its client doorway and release the
        right revision.
      </p>
      @if (store.loading()) {
      <section class="entry-state" aria-live="polite">
        <span class="loader" aria-hidden="true"></span>
        <h2>Finding your workspaces</h2>
        <p>Checking your authenticated workspace memberships.</p>
      </section>
      } @else if (store.error()) {
      <section class="entry-state" role="alert">
        <h2>We could not load your workspaces</h2>
        <p>{{ store.error() }}</p>
        <button type="button" (click)="store.load()">Try again</button>
      </section>
      } @else if (!ownedWorkspaces.length) {
      <section class="entry-state">
        <h2>No owned workspaces yet</h2>
        <p>When an active owner workspace is available, it will appear here.</p>
        <button type="button" (click)="store.load()">Refresh</button>
      </section>
      } @else {
      <section class="workspace-list" aria-label="Owned workspaces">
        @for (workspace of ownedWorkspaces; track workspace.workspaceId) {
        <button
          class="workspace-choice"
          type="button"
          [attr.data-workspace-slug]="workspace.slug"
          (click)="open(workspace)"
        >
          <span class="workspace-kind">{{
            workspace.kind === 'business-site' ? 'Business site' : 'Community'
          }}</span>
          <strong>{{ workspace.displayName }}</strong
          ><small>{{ workspace.slug }}</small
          ><span class="arrow" aria-hidden="true">↗</span>
        </button>
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
        background: #f3f0e9;
        color: #1b1d1a;
      }
      .workspace-entry {
        width: min(760px, calc(100% - 3rem));
        margin: 0 auto;
        padding: 12vh 0;
      }
      .eyebrow {
        color: #6e6b63;
        font: 700 0.7rem ui-monospace, monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font: 800 clamp(3rem, 8vw, 6rem) / 0.85 Georgia, serif;
        letter-spacing: -0.07em;
      }
      .lede {
        max-width: 34rem;
        margin: 1.5rem 0 3rem;
        color: #6e6b63;
        font-size: 1.05rem;
        line-height: 1.6;
      }
      .workspace-list {
        display: grid;
        gap: 0.75rem;
      }
      .workspace-choice {
        position: relative;
        display: grid;
        gap: 0.3rem;
        padding: 1.4rem;
        border: 1px solid #c8c2b8;
        background: #f8f6f1;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      .workspace-choice:hover,
      .workspace-choice:focus-visible {
        border-color: #1b1d1a;
        box-shadow: 0.35rem 0.35rem 0 #d4f34a;
      }
      .workspace-kind {
        color: #6e6b63;
        font: 700 0.65rem ui-monospace, monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .workspace-choice strong {
        font: 2rem Georgia, serif;
      }
      .workspace-choice small {
        color: #6e6b63;
      }
      .arrow {
        position: absolute;
        right: 1.5rem;
        top: 50%;
        color: #5b690e;
        font-size: 1.5rem;
      }
      .entry-state {
        margin-top: 2rem;
        padding: 2rem;
        border: 1px solid #c8c2b8;
        background: #f8f6f1;
      }
      .entry-state h2 {
        margin: 0 0 0.5rem;
        font: 2rem Georgia, serif;
      }
      .entry-state p {
        color: #6e6b63;
        line-height: 1.6;
      }
      .entry-state button {
        padding: 0.75rem 1rem;
        border: 1px solid #1b1d1a;
        background: #d4f34a;
        font-weight: 800;
        cursor: pointer;
      }
      .loader {
        display: inline-block;
        width: 0.8rem;
        height: 0.8rem;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      button:focus-visible {
        outline: 3px solid #5b690e;
        outline-offset: 3px;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class OwnerWorkspaceEntryComponent implements OnInit {
  readonly store = inject(WorkspaceDiscoveryStore);
  private readonly router = inject(Router);

  get ownedWorkspaces(): DiscoveredWorkspace[] {
    return this.store
      .workspaces()
      .filter(
        (workspace) =>
          workspace.membershipRole === 'owner' &&
          workspace.membershipStatus === 'active' &&
          workspace.status === 'active' &&
          Boolean(workspace.workspaceId?.trim()) &&
          Boolean(workspace.slug?.trim())
      );
  }

  ngOnInit(): void {
    this.store.load();
  }
  open(workspace: DiscoveredWorkspace): void {
    this.router.navigateByUrl(
      `/owner/workspace/${encodeURIComponent(workspace.slug)}`
    );
  }
}
