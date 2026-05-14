import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-forum-governance',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="governance-page">
      <header class="hero">
        <p class="hero-kicker">Community Ops</p>
        <h1>Forum Governance</h1>
        <p>
          Summarize the moderation controls that already exist in forum services
          and highlight the missing owner-console governance surface.
        </p>
      </header>

      <section class="panel two-column">
        <article class="subpanel">
          <h2>Existing backend controls</h2>
          <ul>
            @for (capability of existingCapabilities; track capability) {
            <li>{{ capability }}</li>
            }
          </ul>
        </article>

        <article class="subpanel">
          <h2>Current operator entry points</h2>
          <div class="link-list">
            <a class="link-card" [routerLink]="'/dashboard/community-ops'">
              <span class="eyebrow">Workspace overview</span>
              <h3>Community Ops landing</h3>
              <p>
                Current operator workspace for community/city governance while
                forum-specific tooling remains incomplete.
              </p>
            </a>
          </div>
        </article>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Known gaps</h2>
          <p>
            These items still block a fully governed forum moderation story.
          </p>
        </div>
        <ul class="gap-list">
          @for (gap of knownGaps; track gap) {
          <li>{{ gap }}</li>
          }
        </ul>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .governance-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .panel,
      .subpanel {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 24px;
        background: radial-gradient(
            circle at top left,
            rgba(96, 165, 250, 0.08),
            transparent 28%
          ),
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.96),
            rgba(246, 248, 248, 0.92)
          );
        padding: 24px;
      }

      .hero-kicker,
      .eyebrow {
        color: #1d4ed8;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero-kicker {
        margin: 0 0 8px;
      }

      .two-column {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }

      .panel-heading {
        margin-bottom: 16px;
      }

      .link-card {
        display: grid;
        gap: 10px;
        padding: 20px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.9);
        color: inherit;
        text-decoration: none;
      }

      .gap-list,
      ul {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 10px;
      }
    `,
  ],
})
export class ForumGovernanceComponent {
  readonly existingCapabilities = [
    'Topics support visibility changes, pinning, and locking.',
    'Threads support visibility changes, pinning, and locking.',
    'Forum posts support content editing, but no dedicated operator moderation surface exists.',
  ];

  readonly knownGaps = [
    'No owner-console route currently manages topic/thread moderation directly.',
    'No explicit forum moderation permissions were identified in the current owner-console matrix.',
    'No operator queue exists for forum reports, takedowns, or locked-content review.',
  ];
}
