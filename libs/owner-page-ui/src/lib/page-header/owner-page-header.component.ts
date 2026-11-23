import { Component, input } from '@angular/core';

/**
 * Working-page header: breadcrumb, title, optional description and actions.
 * Deliberately plain: no hero banner, no gradient.
 *
 * Slots: `[ot-breadcrumb]` above the title, `[ot-actions]` on the right.
 */
@Component({
  selector: 'ot-owner-page-header',
  standalone: true,
  templateUrl: './owner-page-header.component.html',
  styleUrl: './owner-page-header.component.scss',
})
export class OwnerPageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
}
