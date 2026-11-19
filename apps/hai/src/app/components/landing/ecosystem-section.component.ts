import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  HAI_APP_STATUS_LABELS,
  HaiResolvedAppLink,
} from '@optimistic-tanuki/hai-ui';

@Component({
  selector: 'hai-ecosystem-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ecosystem-section.component.html',
  styleUrl: './ecosystem-section.component.scss',
})
export class EcosystemSectionComponent {
  @Input({ required: true })
  apps: HaiResolvedAppLink[] = [];

  /**
   * Planned products, and products with no app or repository URL we can point
   * to, have nothing to open, so they render without a link.
   */
  isPlanned(app: HaiResolvedAppLink): boolean {
    return app.status === 'planned' || !app.resolvedHref;
  }

  statusLabel(app: HaiResolvedAppLink): string {
    return app.status ? HAI_APP_STATUS_LABELS[app.status] : '';
  }
}
