import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import { TenantContextService } from '../../tenant-context.service';
import { tenantPlanRoute } from '../../tenant-routes';

@Component({
  selector: 'fc-plans-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="plans-page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Plans</p>
          <h1>Planning workflows for this tenant</h1>
          <p class="lede">
            Plans live alongside accounts and transactions so the operational
            money work and the forward plan stay connected.
          </p>
        </div>
      </header>

      <section class="composer">
        <div class="composer-header">
          <span class="eyebrow">New Plan</span>
          <h2>Create a plan</h2>
        </div>
        <div class="composer-grid">
          <label class="field">
            <span>Plan name</span>
            <input
              [(ngModel)]="newPlanName"
              name="name"
              placeholder="Annual household plan"
            />
          </label>
          <label class="field field-wide">
            <span>Description</span>
            <textarea
              [(ngModel)]="newPlanDescription"
              name="description"
              placeholder="Track priorities, funding goals, and what-if scenarios."
            ></textarea>
          </label>
        </div>
        <button
          type="button"
          class="primary-btn"
          [disabled]="!newPlanName.trim()"
          (click)="createPlan()"
        >
          Create plan
        </button>
      </section>

      @if (plans().length > 0) {
      <section class="plans-grid">
        @for (plan of plans(); track plan.id) {
        <article class="plan-card">
          <div class="plan-card-header">
            <div>
              <p class="eyebrow">Plan</p>
              <h2>{{ plan.name }}</h2>
            </div>
            <a [routerLink]="planRoute(plan.id)">Open plan</a>
          </div>
          <p class="plan-description">
            {{ plan.description || 'No description yet.' }}
          </p>
          <div class="plan-actions">
            <a [routerLink]="planRoute(plan.id, 'overview')">Overview</a>
            <a [routerLink]="planRoute(plan.id, 'goals')">Goals</a>
            <a [routerLink]="planRoute(plan.id, 'scenarios')">Scenarios</a>
          </div>
        </article>
        }
      </section>
      } @else {
      <section class="empty-state">
        <h2>No plans yet</h2>
        <p>
          Create the first plan for this tenant to start tracking goals and
          scenarios.
        </p>
      </section>
      }
    </section>
  `,
  styles: [
    `
      .plans-page {
        display: grid;
        gap: 1rem;
      }

      .page-header,
      .composer,
      .plan-card,
      .empty-state {
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 45%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
        padding: 1.4rem;
      }

      .eyebrow {
        margin: 0 0 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.68rem;
        font-weight: 700;
        color: var(--primary);
      }

      h1,
      h2 {
        margin: 0 0 0.45rem;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        color: var(--foreground);
      }

      .lede,
      .plan-description,
      .empty-state p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .composer {
        display: grid;
        gap: 1rem;
      }

      .composer-grid,
      .plans-grid {
        display: grid;
        gap: 1rem;
      }

      .composer-grid {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .plans-grid {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .field {
        display: grid;
        gap: 0.35rem;
      }

      .field span {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--foreground);
      }

      .field-wide {
        grid-column: 1 / -1;
      }

      textarea {
        min-height: 120px;
        resize: vertical;
      }

      .primary-btn {
        justify-self: start;
        background: var(--primary);
        color: var(--background);
      }

      .plan-card {
        display: grid;
        gap: 0.9rem;
      }

      .plan-card-header,
      .plan-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .plan-actions {
        justify-content: flex-start;
      }

      a {
        color: var(--primary);
        text-decoration: none;
        font-weight: 700;
      }
    `,
  ],
})
export class PlansPageComponent {
  private readonly store = inject(FinCommanderPlanStore);
  private readonly tenantContext = inject(TenantContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly plans = computed(() => {
    this.store.getScope();
    return this.store.listPlans();
  });

  newPlanName = '';
  newPlanDescription = '';

  private tenantId(): string {
    return (
      this.route.snapshot.paramMap.get('tenantId') ??
      this.tenantContext.activeTenantId() ??
      'active'
    );
  }

  planRoute(
    planId: string,
    section:
      | 'overview'
      | 'goals'
      | 'scenarios'
      | 'cash-flow'
      | 'imports' = 'overview'
  ): string[] {
    return tenantPlanRoute(this.tenantId(), planId, section);
  }

  async createPlan(): Promise<void> {
    const name = this.newPlanName.trim();
    if (!name) {
      return;
    }

    const planId = this.slugify(name);
    this.store.savePlan({
      id: planId,
      name,
      description:
        this.newPlanDescription.trim() ||
        'Plan created from the tenant planning workspace.',
      defaultWorkspace: 'personal',
      updatedAt: new Date().toISOString(),
    });

    this.newPlanName = '';
    this.newPlanDescription = '';

    await this.router.navigate(this.planRoute(planId));
  }

  private slugify(value: string): string {
    return `${
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'plan'
    }-${Date.now()}`;
  }
}
