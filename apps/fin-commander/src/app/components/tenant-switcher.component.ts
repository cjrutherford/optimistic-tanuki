import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TenantContextService } from '../tenant-context.service';
import { FinanceAccountType } from '@optimistic-tanuki/finance-ui';

@Component({
  selector: 'fc-tenant-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tenant-switcher">
      <div class="tenant-switcher-row" aria-label="Active account selector">
        <label class="tenant-label" for="fin-tenant-selector">Account</label>
        <select
          id="fin-tenant-selector"
          class="tenant-select"
          [value]="tenantContext.activeTenantId() ?? ''"
          (change)="onSelect($event)"
        >
          @for (tenant of tenantContext.availableTenants(); track tenant.id) {
            <option [value]="tenant.id">
              {{ tenant.name }}
              @if (tenant.type) {
                ({{ accountTypeLabel(tenant.type) }})
              }
            </option>
          }
        </select>
        <button
          type="button"
          class="tenant-action"
          (click)="toggleCreate()"
          [attr.aria-expanded]="createOpen()"
        >
          {{ createOpen() ? 'Close' : 'New account' }}
        </button>
      </div>

      @if (createOpen()) {
        <form class="tenant-create" (ngSubmit)="createTenant()">
          <input
            [(ngModel)]="draftName"
            name="draftName"
            type="text"
            placeholder="North Household"
            required
          />
          <select [(ngModel)]="draftType" name="draftType">
            @for (type of accountTypes; track type.value) {
              <option [value]="type.value">{{ type.label }}</option>
            }
          </select>
          <button type="submit" class="tenant-submit" [disabled]="creating()">
            {{ creating() ? 'Creating…' : 'Create account' }}
          </button>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .tenant-switcher {
        display: grid;
        gap: 0.45rem;
        padding: 0.35rem 0.6rem;
        border-radius: 1rem;
        background: color-mix(in srgb, var(--surface, #fff) 88%, transparent);
        color: var(--foreground, #0f172a);
        border: 1px solid var(--border, rgba(148, 163, 184, 0.22));
      }

      .tenant-switcher-row {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
      }

      .tenant-label {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted, #64748b);
      }

      .tenant-select {
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        min-width: 9rem;
      }

      .tenant-action,
      .tenant-submit {
        border: 1px solid var(--border, rgba(148, 163, 184, 0.22));
        background: color-mix(in srgb, var(--surface, #fff) 90%, transparent);
        color: inherit;
        border-radius: 999px;
        padding: 0.45rem 0.8rem;
        font: inherit;
        cursor: pointer;
      }

      .tenant-create {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
        gap: 0.45rem;
      }

      .tenant-create input,
      .tenant-create select {
        min-width: 0;
        border: 1px solid var(--border, rgba(148, 163, 184, 0.22));
        background: var(--surface, #fff);
        color: inherit;
        border-radius: 0.85rem;
        padding: 0.55rem 0.7rem;
        font: inherit;
      }

      .type-badge {
        font-size: 0.7rem;
        opacity: 0.7;
        margin-left: 0.25rem;
      }

      @media (max-width: 720px) {
        .tenant-switcher-row,
        .tenant-create {
          grid-template-columns: 1fr;
          display: grid;
        }
      }
    `,
  ],
})
export class TenantSwitcherComponent {
  readonly tenantContext = inject(TenantContextService);
  private readonly router = inject(Router);
  readonly createOpen = signal(false);
  readonly creating = signal(false);

  draftName = '';
  draftType: FinanceAccountType = 'household';
  readonly accountTypes: Array<{ value: FinanceAccountType; label: string }> = [
    { value: 'household', label: 'Household' },
    { value: 'individual', label: 'Individual' },
    { value: 'business', label: 'Business' },
    { value: 'nonprofit', label: 'Non-profit' },
  ];

  async onSelect(event: Event): Promise<void> {
    const tenantId = (event.target as HTMLSelectElement).value;
    if (tenantId) {
      this.tenantContext.selectTenant(tenantId);
      await this.navigateAfterTenantChange();
    }
  }

  toggleCreate(): void {
    this.createOpen.update((value) => !value);
  }

  async createTenant(): Promise<void> {
    const name = this.draftName.trim();
    if (!name) {
      return;
    }

    this.creating.set(true);

    try {
      await this.tenantContext.createTenant({
        name,
        type: this.draftType,
      });
      this.draftName = '';
      this.draftType = 'household';
      this.createOpen.set(false);
      await this.router.navigate(['/onboarding']);
    } finally {
      this.creating.set(false);
    }
  }

  private async navigateAfterTenantChange(): Promise<void> {
    if (this.router.url.startsWith('/commander')) {
      await this.router.navigate(['/account']);
      return;
    }

    const workspaceMatch = this.router.url.match(/^\/finance\/([^/]+)/);
    if (workspaceMatch?.[1]) {
      await this.router.navigate(['/finance', workspaceMatch[1]]);
      return;
    }

    await this.router.navigate(['/finance']);
  }

  accountTypeLabel(type: FinanceAccountType): string {
    const labels: Record<FinanceAccountType, string> = {
      individual: 'Individual',
      business: 'Business',
      nonprofit: 'Non-profit',
      household: 'Household',
    };
    return labels[type] || type;
  }
}
