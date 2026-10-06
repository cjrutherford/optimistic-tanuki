import { Component, Input } from '@angular/core';
import { ArchitectureTier } from '../../content/private-cloud';

/** A left-to-right (top-to-bottom on small screens) system sketch. */
@Component({
  selector: 'hai-architecture-diagram',
  standalone: true,
  templateUrl: './architecture-diagram.component.html',
  styleUrl: './architecture-diagram.component.scss',
})
export class ArchitectureDiagramComponent {
  @Input() eyebrow = 'Example setup';
  @Input({ required: true }) heading = '';
  @Input({ required: true }) tiers: ArchitectureTier[] = [];
  @Input() caption = '';
}
