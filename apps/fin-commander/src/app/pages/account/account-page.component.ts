import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FinanceService, FinanceWorkspaceSummary } from '@optimistic-tanuki/finance-ui';
import { TenantContextService } from '../../tenant-context.service';

@Component({
  selector: 'fc-account-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="account-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Account</p>
          <h1>{{ tenantName() }}</h1>
          <p class="lede">
            Manage the active Fin Commander account, its workspaces, and the finance surfaces attached to it.
          </p>
        </div>
        <div class="actions">
          <a routerLink="/settings">Edit settings</a>
          <a routerLink="/finance/personal/accounts">Open finance accounts</a>
        </div>
      </header>

      <section class="grid">
        <article class="card">
          <h2>Context</h2>
          <p><strong>Type:</strong> {{ tenantType() }}</p>
          <p><strong>Members:</strong> {{ tenantContext.tenantMembers().length }}</p>
          <p><strong>Active workspaces:</strong> Personal, Business, Net Worth</p>
        </article>

        <article class="card">
          <h2>Finance health</h2>
          @if (summary()) {
            <p><strong>Total balance:</strong> \${{ summary()?.metrics?.totalBalance ?? 0 }}</p>
            <p><strong>Net worth:</strong> \${{ summary()?.metrics?.netWorth ?? 0 }}</p>
            <p><strong>Budgets at risk:</strong> {{ summary()?.metrics?.budgetsAtRiskCount ?? 0 }}</p>
          } @else {
            <p>Loading account health…</p>
          }
        </article>

        <article class="card">
          <h2>Next actions</h2>
          <div class="link-list">
            <a routerLink="/finance/personal/accounts">Linked and manual accounts</a>
            <a routerLink="/finance/personal/transactions">Review transactions</a>
            <a routerLink="/onboarding">Onboarding and setup</a>
          </div>
        </article>
      </section>
    </section>
  `,
  styles: [`
    .account-shell {
      width: min(1180px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 1.5rem 0 4rem;
      display: grid;
      gap: 1rem;
    }
    .hero,
    .card {
      background: color-mix(in srgb, var(--surface) 90%, transparent);
      backdrop-filter: blur(14px);
      border: var(--fc-border-width, 2px) solid
        color-mix(in srgb, var(--border) 50%, transparent);
      border-radius: var(--fc-card-radius, 18px);
      padding: 1.4rem;
      box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
    }
    .hero {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.7rem;
      margin: 0 0 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.66rem;
      font-weight: 700;
      color: var(--primary);
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      border-radius: var(--fc-button-radius, 9999px);
      width: fit-content;
    }
    h1, h2 {
      margin: 0 0 0.5rem;
      font-family: var(--fc-font-heading, 'Sora', sans-serif);
      color: var(--foreground);
    }
    .lede, p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }
    .actions,
    .link-list {
      display: grid;
      gap: 0.75rem;
    }
    a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }
  `],
})
export class AccountPageComponent implements OnInit {
  readonly tenantContext = inject(TenantContextService);
  private readonly financeService = inject(FinanceService);
  readonly summary = signal<FinanceWorkspaceSummary | null>(null);
  readonly tenantName = computed(
    () => this.tenantContext.activeTenant()?.name ?? 'Active account'
  );
  readonly tenantType = computed(
    () => this.tenantContext.activeTenant()?.type ?? 'Unspecified'
  );

  async ngOnInit() {
    try {
      this.summary.set(await this.financeService.getWorkspaceSummary('personal'));
    } catch {
      this.summary.set(null);
    }
  }
}
