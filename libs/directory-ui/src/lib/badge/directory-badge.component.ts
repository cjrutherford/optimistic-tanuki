import { Component, computed, input } from '@angular/core';
import { DirectoryBadgeKind } from '../models';

/**
 * Says whether a business has a page of its own or is only a public directory listing. The free directory
 * is never presented as a lesser or paid-only thing: both labels are plain statements of fact.
 */
@Component({
  selector: 'otd-directory-badge',
  standalone: true,
  template: `<span
    class="badge"
    [class.badge--page]="kind() === 'business-page'"
    [attr.data-kind]="kind()"
    >{{ label() }}</span
  >`,
  styleUrls: ['./directory-badge.component.scss'],
})
export class DirectoryBadgeComponent {
  readonly kind = input<DirectoryBadgeKind>('directory-listing');
  readonly label = computed(() =>
    this.kind() === 'business-page'
      ? 'Business page'
      : 'Directory listing (not claimed)'
  );
}
