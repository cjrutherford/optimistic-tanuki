import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

interface GovernanceLinkCard {
  title: string;
  description: string;
  route: string;
  eyebrow: string;
}

@Component({
  selector: 'app-social-governance',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="governance-page">
      <header class="hero">
        <p class="hero-kicker">Community Ops</p>
        <h1>Social Governance</h1>
        <p>
          Review the current moderation and isolation posture for social
          surfaces, including community governance, member controls, and
          privacy/reporting seams.
        </p>
      </header>

      <section class="panel">
        <div class="panel-heading">
          <h2>Live governance surfaces</h2>
          <p>
            These routes already let operators intervene in social/community
            lifecycle flows.
          </p>
        </div>
        <div class="card-grid">
          @for (card of liveSurfaces; track card.title) {
          <a class="link-card" [routerLink]="card.route">
            <span class="eyebrow">{{ card.eyebrow }}</span>
            <h3>{{ card.title }}</h3>
            <p>{{ card.description }}</p>
          </a>
          }
        </div>
      </section>

      <section class="panel two-column">
        <article class="subpanel">
          <h2>Current permissions</h2>
          <ul>
            @for (permission of socialPermissions; track permission) {
            <li>
              <code>{{ permission }}</code>
            </li>
            }
          </ul>
        </article>

        <article class="subpanel">
          <h2>Report pipeline status</h2>
          <ul>
            @for (status of reportStatuses; track status) {
            <li>{{ status }}</li>
            }
          </ul>
          <p class="muted">
            Content-report entities already model operator review states, but no
            owner-console triage queue is wired yet.
          </p>
        </article>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Known gaps</h2>
          <p>
            These are the next missing governance capabilities before Social can
            score as complete.
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
            rgba(45, 212, 191, 0.08),
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
        color: #0f766e;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero-kicker {
        margin: 0 0 8px;
      }

      h1,
      h2,
      h3,
      p {
        margin-top: 0;
      }

      .panel-heading {
        margin-bottom: 16px;
      }

      .card-grid,
      .two-column {
        display: grid;
        gap: 16px;
      }

      .card-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .two-column {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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

      .muted {
        color: var(--foreground-secondary, #555);
        margin-bottom: 0;
      }
    `,
  ],
})
export class SocialGovernanceComponent {
  readonly liveSurfaces: GovernanceLinkCard[] = [
    {
      title: 'Communities',
      description:
        'Inspect community lifecycle state, local rollout posture, and current moderation surfaces.',
      route: '/dashboard/communities',
      eyebrow: 'Community lifecycle',
    },
    {
      title: 'Community Members',
      description:
        'Use community-specific member flows to manage invites, roles, removals, and manager assignment.',
      route: '/dashboard/communities',
      eyebrow: 'Membership governance',
    },
    {
      title: 'Cities',
      description:
        'Track locality records that affect community availability, trust, and rollout boundaries.',
      route: '/dashboard/cities',
      eyebrow: 'Locality coverage',
    },
  ];

  readonly socialPermissions = [
    'community.create',
    'community.update',
    'community.delete',
    'community.invite',
    'community.manage',
  ];

  readonly reportStatuses = ['Pending', 'Reviewed', 'Actioned', 'Dismissed'];

  readonly knownGaps = [
    'No owner-console report triage queue exists for social content reports.',
    'No operator-facing takedown UI exists for social posts or comments.',
    'Privacy controls expose user block/mute/report signals, but not an operator review workflow.',
  ];
}
