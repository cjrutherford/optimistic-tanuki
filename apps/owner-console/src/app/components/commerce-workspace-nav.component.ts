import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-commerce-workspace-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="commerce-nav" aria-label="Commerce workspace navigation">
      <a
        *ngFor="let item of items"
        class="commerce-nav-link"
        [routerLink]="item.route"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: item.exact ?? true }"
      >
        {{ item.label }}
      </a>
    </nav>
  `,
  styles: [
    `
      .commerce-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .commerce-nav-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 0 16px;
        border-radius: 999px;
        border: 1px solid
          color-mix(
            in srgb,
            var(--accent, #2563eb) 24%,
            var(--border-color, #d6d6d6)
          );
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--background, #f8fafc)
        );
        color: var(--foreground, #111827);
        font-weight: 700;
        text-decoration: none;
      }

      .commerce-nav-link.active {
        background: var(--accent, #2563eb);
        border-color: var(--accent, #2563eb);
        color: var(--on-primary, var(--primary-foreground, #ffffff));
      }
    `,
  ],
})
export class CommerceWorkspaceNavComponent {
  @Input() items: Array<{ label: string; route: string; exact?: boolean }> = [
    { label: 'Overview', route: '/dashboard/store/overview' },
    { label: 'Products', route: '/dashboard/store/products' },
    { label: 'Catalog', route: '/dashboard/store/business-site' },
    { label: 'Orders', route: '/dashboard/store/orders' },
    { label: 'Appointments', route: '/dashboard/store/appointments' },
    { label: 'Availability', route: '/dashboard/store/availability' },
    { label: 'Resources', route: '/dashboard/store/resources' },
  ];
}
