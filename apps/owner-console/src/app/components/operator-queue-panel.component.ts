import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  OperatorQueueDomain,
  OperatorQueueItem,
} from '../services/operator-queue.service';

@Component({
  selector: 'app-operator-queue-panel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="queue-panel">
      <div class="panel-heading">
        <div>
          <h2>{{ heading }}</h2>
          <p>{{ description }}</p>
        </div>
        <span class="queue-count">{{ items.length }} {{ countLabel }}</span>
      </div>

      <div class="domain-summary" *ngIf="items.length > 0">
        @for (domain of domains; track domain) {
        <div class="domain-chip" *ngIf="countByDomain(domain) > 0">
          <span>{{ domain }}</span>
          <strong>{{ countByDomain(domain) }}</strong>
        </div>
        }
      </div>

      <div class="queue-list" *ngIf="items.length > 0; else emptyState">
        @for (item of items; track item.id) {
        <a class="queue-card" [routerLink]="item.route">
          <div class="queue-card__header">
            <span
              class="severity"
              [class.severity-high]="item.severity === 'high'"
              [class.severity-medium]="item.severity === 'medium'"
            >
              {{ item.severity }}
            </span>
            <span class="domain">{{ item.domain }}</span>
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.detail }}</p>
        </a>
        }
      </div>

      <ng-template #emptyState>
        <div class="empty-state">{{ emptyStateCopy }}</div>
      </ng-template>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .queue-panel {
        border-radius: 24px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--accent, var(--primary)) 10%, transparent),
            transparent 30%
          ),
          linear-gradient(
            180deg,
            color-mix(in srgb, var(--surface, #ffffff) 96%, transparent),
            color-mix(
              in srgb,
              var(--surface, #ffffff) 88%,
              var(--background, #f8fafc)
            )
          );
        padding: 24px;
        color: var(--foreground, #111827);
      }

      .panel-heading {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 16px;
      }

      .panel-heading h2,
      .queue-card h3 {
        margin: 0;
      }

      .panel-heading p,
      .queue-card p,
      .empty-state {
        margin: 8px 0 0;
        line-height: 1.5;
      }

      .queue-count,
      .severity,
      .domain {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.3rem 0.7rem;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .queue-count,
      .domain-chip,
      .domain {
        background: color-mix(
          in srgb,
          var(--accent, var(--primary)) 12%,
          transparent
        );
        color: var(--accent, var(--primary));
      }

      .domain-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 16px;
      }

      .domain-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 0.35rem 0.8rem;
      }

      .queue-list {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        margin-top: 20px;
      }

      .queue-card {
        display: grid;
        gap: 10px;
        border-radius: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          transparent
        );
        color: inherit;
        padding: 18px;
        text-decoration: none;
      }

      .queue-card__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .severity {
        background: color-mix(in srgb, var(--danger) 12%, transparent);
        color: color-mix(in srgb, var(--danger) 82%, var(--foreground));
        text-transform: uppercase;
      }

      .severity-medium {
        background: color-mix(in srgb, var(--warning) 12%, transparent);
        color: color-mix(in srgb, var(--warning) 82%, var(--foreground));
      }

      .severity-high {
        background: color-mix(in srgb, var(--danger) 12%, transparent);
        color: color-mix(in srgb, var(--danger) 82%, var(--foreground));
      }

      .empty-state {
        margin-top: 20px;
        color: var(--foreground-secondary, #666);
      }
    `,
  ],
})
export class OperatorQueuePanelComponent {
  @Input() items: OperatorQueueItem[] = [];
  @Input() heading = 'Operator Queue';
  @Input() description =
    'Prioritized cross-domain work that still needs operator action.';
  @Input() emptyStateCopy =
    'No queue items are currently prioritized across the tracked domains.';
  @Input() countLabel = 'items';

  readonly domains: OperatorQueueDomain[] = [
    'Governance',
    'Experience',
    'Commerce',
    'CRM',
    'Community Ops',
  ];

  countByDomain(domain: OperatorQueueDomain): number {
    return this.items.filter((item) => item.domain === domain).length;
  }
}
