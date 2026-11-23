import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OWNER_NAV, flattenNav, resolveLeafPath } from '../owner-nav';

/** Tabs for the selected town's pages, generated from the town leaves in the nav. */
@Component({
  selector: 'app-town-tabs',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="tabs" aria-label="Town pages">
      @for (tab of tabs(); track tab.path) {
      <a
        class="tab"
        [routerLink]="tab.href"
        [class.tab--active]="tab.path === activePath()"
        [attr.aria-current]="tab.path === activePath() ? 'page' : null"
        >{{ tab.label }}</a
      >
      }
    </nav>
  `,
  styles: [
    `
      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin: 0 0 16px;
        border-bottom: 1px solid var(--border-color, #d6d6d6);
      }

      .tab {
        padding: 8px 12px;
        border-radius: var(--personality-input-radius, 8px)
          var(--personality-input-radius, 8px) 0 0;
        color: var(--foreground, #111827);
        font-size: var(--type-small, 0.875rem);
        text-decoration: none;
      }

      .tab:hover {
        background: color-mix(
          in srgb,
          var(--primary, #2563eb) 10%,
          transparent
        );
      }

      .tab:focus-visible {
        outline: 2px solid var(--primary, #2563eb);
        outline-offset: -2px;
      }

      .tab--active {
        background: color-mix(
          in srgb,
          var(--primary, #2563eb) 18%,
          transparent
        );
        font-weight: 700;
      }
    `,
  ],
})
export class TownTabsComponent {
  readonly townId = input.required<string>();
  readonly activePath = input<string | undefined>();

  readonly tabs = computed(() =>
    flattenNav(OWNER_NAV)
      .filter((entry) => entry.leaf.needsTown)
      .map(({ leaf }) => ({
        label: leaf.label,
        path: leaf.path,
        href: resolveLeafPath(leaf, this.townId()) as string,
      }))
  );
}
