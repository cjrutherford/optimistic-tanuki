import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShimmerBeamComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'fc-cash-flow-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ShimmerBeamComponent],
  template: `
    <section class="page">
      <header class="page-header">
        <span class="eyebrow">Cash Flow</span>
        <h2>Finance workspaces</h2>
      </header>

      <div class="workspaces-grid">
        @for (workspace of workspaces; track workspace.id; let i = $index) {
        <article
          class="workspace-card"
          [attr.data-workspace]="workspace.id"
          [style.animation-delay]="i * 0.08 + 0.05 + 's'"
        >
          <!-- shimmer on hover via CSS sibling trick -->
          <div class="card-shimmer-wrap">
            <otui-shimmer-beam
              [height]="'100%'"
              [speed]="1.4"
              [intensity]="0.22"
            ></otui-shimmer-beam>
          </div>

          <div class="card-top">
            <div class="card-icon-wrap">
              <span class="card-icon">{{ workspace.icon }}</span>
            </div>
            <div class="card-identity">
              <span class="workspace-label">{{ workspace.label }}</span>
              <h3 class="workspace-headline">{{ workspace.headline }}</h3>
            </div>
          </div>

          <p class="workspace-copy">{{ workspace.copy }}</p>

          <nav class="card-links">
            <a class="link-primary" [routerLink]="['/finance', workspace.id]">
              Overview →
            </a>
            <div class="link-secondary-group">
              <a
                class="link-pill"
                [routerLink]="['/finance', workspace.id, 'accounts']"
                >Accounts</a
              >
              <a
                class="link-pill"
                [routerLink]="['/finance', workspace.id, 'transactions']"
                >Transactions</a
              >
              @if (workspace.id !== 'net-worth') {
              <a
                class="link-pill"
                [routerLink]="['/finance', workspace.id, 'budgets']"
                >Budgets</a
              >
              <a
                class="link-pill"
                [routerLink]="['/finance', workspace.id, 'recurring']"
                >Recurring</a
              >
              }
            </div>
          </nav>
        </article>
        }
      </div>
    </section>
  `,
  styles: [
    `
      @keyframes cardReveal {
        from {
          opacity: 0;
          transform: translateY(14px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .page {
        display: grid;
        gap: 1.75rem;
      }

      .page-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.62rem;
        font-weight: 700;
        color: var(--primary);
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        border-radius: var(--fc-button-radius, 9999px);
      }

      h2 {
        margin: 0;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: clamp(1.2rem, 2.5vw, 1.5rem);
        font-weight: 700;
        color: var(--foreground);
      }

      .workspaces-grid {
        display: grid;
        gap: 1.25rem;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      }

      .workspace-card {
        position: relative;
        overflow: hidden;
        display: grid;
        gap: 1.1rem;
        padding: 1.6rem;
        background: color-mix(in srgb, var(--surface) 88%, transparent);
        backdrop-filter: blur(12px);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 45%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );
        animation: cardReveal 0.55s
          var(--fc-transition-easing, cubic-bezier(0.16, 1, 0.3, 1)) both;

        &:hover {
          transform: translateY(-5px);
          box-shadow: var(
            --fc-card-shadow-hover,
            0 28px 56px rgba(4, 16, 28, 0.32)
          );
        }

        &[data-workspace='personal'] {
          &:hover {
            border-color: var(--primary);
          }
          .card-icon-wrap {
            background: color-mix(in srgb, var(--primary) 12%, transparent);
            border-color: color-mix(in srgb, var(--primary) 25%, transparent);
          }
          .card-icon {
            color: var(--primary);
          }
        }

        &[data-workspace='business'] {
          &:hover {
            border-color: var(--secondary, var(--primary));
          }
          .card-icon-wrap {
            background: color-mix(
              in srgb,
              var(--secondary, var(--primary)) 12%,
              transparent
            );
            border-color: color-mix(
              in srgb,
              var(--secondary, var(--primary)) 25%,
              transparent
            );
          }
          .card-icon {
            color: var(--secondary, var(--primary));
          }
        }

        &[data-workspace='net-worth'] {
          &:hover {
            border-color: var(--success, #22c55e);
          }
          .card-icon-wrap {
            background: color-mix(
              in srgb,
              var(--success, #22c55e) 12%,
              transparent
            );
            border-color: color-mix(
              in srgb,
              var(--success, #22c55e) 25%,
              transparent
            );
          }
          .card-icon {
            color: var(--success, #22c55e);
          }
        }
      }

      /* shimmer only visible on hover via parent hover */
      .card-shimmer-wrap {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: 0;
      }

      .workspace-card:hover .card-shimmer-wrap {
        opacity: 1;
      }

      .card-top {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        gap: 1rem;
      }

      .card-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 3rem;
        height: 3rem;
        border-radius: 12px;
        border: 1px solid transparent;
        flex-shrink: 0;
        font-size: 1.4rem;
      }

      .card-icon {
        line-height: 1;
      }

      .card-identity {
        display: grid;
        gap: 0.25rem;
      }

      .workspace-label {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.65rem;
        font-weight: 700;
        color: var(--muted);
      }

      .workspace-headline {
        position: relative;
        z-index: 1;
        margin: 0;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 1.05rem;
        font-weight: 700;
        line-height: 1.35;
        color: var(--foreground);
      }

      .workspace-copy {
        position: relative;
        z-index: 1;
        margin: 0;
        font-size: 0.85rem;
        color: var(--muted);
        line-height: 1.6;
      }

      .card-links {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 0.75rem;
      }

      .link-primary {
        display: inline-flex;
        align-items: center;
        padding: 0.65rem 1.25rem;
        background: var(--primary);
        color: var(--background);
        font-size: 0.82rem;
        font-weight: 700;
        text-decoration: none;
        border-radius: var(--fc-button-radius, 9999px);
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );
        width: fit-content;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px
            color-mix(in srgb, var(--primary) 38%, transparent);
        }
      }

      .link-secondary-group {
        display: flex;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .link-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.45rem 0.85rem;
        background: color-mix(in srgb, var(--surface) 95%, var(--primary) 5%);
        border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
        border-radius: var(--fc-button-radius, 9999px);
        text-decoration: none;
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--foreground);
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover {
          background: color-mix(in srgb, var(--primary) 14%, var(--surface));
          border-color: var(--primary);
          color: var(--primary);
          transform: translateY(-1px);
        }
      }

      @media (max-width: 480px) {
        .workspaces-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CashFlowPageComponent {
  readonly workspaces = [
    {
      id: 'personal',
      label: 'Personal',
      icon: '💰',
      headline: 'Short-horizon cash flow and household budgets.',
      copy: 'Track everyday money, reconcile imports, and keep reserve goals funded.',
    },
    {
      id: 'business',
      label: 'Business',
      icon: '📊',
      headline: 'Operating cash and owner transfer discipline.',
      copy: 'Keep runway, recurring obligations, and business inflow visible.',
    },
    {
      id: 'net-worth',
      label: 'Net Worth',
      icon: '📈',
      headline: 'Asset coverage and balance aggregation.',
      copy: 'Use the ledger rollup and tracked assets to verify long-range position.',
    },
  ];
}
