import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { HaiResolvedAppLink } from '@optimistic-tanuki/hai-ui';

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
}
