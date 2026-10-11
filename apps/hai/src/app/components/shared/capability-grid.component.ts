import { Component, Input } from '@angular/core';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { PrivateCloudCapability } from '../../content/private-cloud';

@Component({
  selector: 'hai-capability-grid',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './capability-grid.component.html',
  styleUrl: './capability-grid.component.scss',
})
export class CapabilityGridComponent {
  @Input() sectionId = 'capabilities';
  @Input() eyebrow = 'Capabilities';
  @Input() heading = 'What your private cloud can hold.';
  @Input({ required: true }) capabilities: PrivateCloudCapability[] = [];
  @Input() qualifier = '';
  /** Columns on wide screens; grids drop to two, then one, on narrower ones. */
  @Input() columns = 3;
}
