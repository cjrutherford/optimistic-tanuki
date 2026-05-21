import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { WorkspaceActionCard } from '../operator-workspaces';

interface WorkspaceLandingData {
  title: string;
  description: string;
  summary: string;
  checklist: string[];
  cards: WorkspaceActionCard[];
}

@Component({
  selector: 'app-workspace-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="workspace-page">
      <header class="workspace-hero">
        <p class="workspace-kicker">Operator Workspace</p>
        <h1>{{ data.title }}</h1>
        <p class="workspace-description">{{ data.description }}</p>
        <p class="workspace-summary">{{ data.summary }}</p>
      </header>

      <section class="workspace-panel">
        <h2>Operating Checklist</h2>
        <ul>
          @for (item of data.checklist; track item) {
          <li>{{ item }}</li>
          }
        </ul>
      </section>

      <section class="workspace-grid">
        @for (card of data.cards; track card.title) {
        <a class="workspace-card" [routerLink]="card.route">
          <span class="workspace-card__eyebrow">{{ card.highlight }}</span>
          <h3>{{ card.title }}</h3>
          <p>{{ card.description }}</p>
          <span class="workspace-card__cta">Open workspace tool</span>
        </a>
        }
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .workspace-page {
        display: grid;
        gap: 24px;
      }

      .workspace-hero,
      .workspace-panel {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(248, 248, 248, 0.92));
        padding: 24px;
      }

      .workspace-kicker {
        margin: 0 0 8px;
        color: var(--accent, #0a6c74);
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1,
      h2,
      h3 {
        margin: 0;
      }

      .workspace-description,
      .workspace-summary {
        margin: 12px 0 0;
        max-width: 68ch;
        line-height: 1.6;
      }

      .workspace-panel ul {
        margin: 16px 0 0;
        padding-left: 20px;
        display: grid;
        gap: 10px;
      }

      .workspace-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
      }

      .workspace-card {
        display: grid;
        gap: 10px;
        padding: 20px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 18px;
        background: var(--surface-color, rgba(255, 255, 255, 0.94));
        color: inherit;
        text-decoration: none;
        transition:
          transform 160ms ease,
          border-color 160ms ease,
          box-shadow 160ms ease;
      }

      .workspace-card:hover,
      .workspace-card:focus-visible {
        transform: translateY(-2px);
        border-color: var(--accent, #0a6c74);
        box-shadow: 0 14px 24px rgba(0, 0, 0, 0.08);
      }

      .workspace-card__eyebrow,
      .workspace-card__cta {
        font-size: 0.82rem;
        font-weight: 600;
      }

      .workspace-card__eyebrow {
        color: var(--accent, #0a6c74);
      }

      .workspace-card__cta {
        color: var(--foreground-secondary, #555);
      }
    `,
  ],
})
export class WorkspaceLandingComponent {
  private readonly route = inject(ActivatedRoute);

  get data(): WorkspaceLandingData {
    return this.route.snapshot.data as WorkspaceLandingData;
  }
}
