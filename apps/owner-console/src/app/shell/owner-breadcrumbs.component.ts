import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { breadcrumbsFor } from '../owner-nav';

/** Group › page › detail crumbs for the current URL, from `OWNER_NAV`. */
@Component({
  selector: 'app-owner-breadcrumbs',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (crumbs().length > 0) {
    <nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        @for (crumb of crumbs(); track $index; let last = $last) {
        <li>
          @if (crumb.path) {
          <a [routerLink]="crumb.path">{{ crumb.label }}</a>
          } @else {
          <span [attr.aria-current]="last ? 'page' : null">{{
            crumb.label
          }}</span>
          }
        </li>
        }
      </ol>
    </nav>
    }
  `,
  styles: [
    `
      ol {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin: 0 0 16px;
        padding: 0;
        list-style: none;
        font-size: var(--type-small, 0.875rem);
        color: var(--foreground);
      }

      li:not(:last-child)::after {
        content: '›';
        margin-left: 4px;
        opacity: 0.6;
      }

      a {
        color: var(--primary-text, var(--primary));
      }

      [aria-current='page'] {
        font-weight: 700;
      }
    `,
  ],
})
export class OwnerBreadcrumbsComponent {
  readonly url = input.required<string>();
  /** Selected town; names the town crumb on town pages. */
  readonly town = input<{ id: string; name: string } | null>(null);
  readonly crumbs = computed(() =>
    breadcrumbsFor(this.url(), undefined, this.town())
  );
}
