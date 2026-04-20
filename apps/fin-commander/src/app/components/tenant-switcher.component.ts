import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TenantContextService } from '../tenant-context.service';
import { FinanceAccountType } from '@optimistic-tanuki/finance-ui';

@Component({
  selector: 'fc-tenant-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tenant-switcher" aria-label="Active account selector">
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
              <span class="type-badge"
                >({{ accountTypeLabel(tenant.type) }})</span
              >
            }
          </option>
        }
      </select>
    </div>
  `,
  styles: [
    `
      .tenant-switcher {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.75rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--surface, #fff) 88%, transparent);
        color: var(--foreground, #0f172a);
        border: 1px solid var(--border, rgba(148, 163, 184, 0.22));
      }

      .tenant-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted, #64748b);
      }

      .tenant-select {
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        min-width: 10rem;
      }

      .type-badge {
        font-size: 0.7rem;
        opacity: 0.7;
        margin-left: 0.25rem;
      }
    `,
  ],
})
export class TenantSwitcherComponent {
  readonly tenantContext = inject(TenantContextService);

  onSelect(event: Event): void {
    const tenantId = (event.target as HTMLSelectElement).value;
    if (tenantId) {
      this.tenantContext.selectTenant(tenantId);
    }
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
