import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { BadgeComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { ShimmerBeamComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'hai-manifesto-section',
  standalone: true,
  imports: [CommonModule, ShimmerBeamComponent, CardComponent, BadgeComponent],
  templateUrl: './manifesto-section.component.html',
  styleUrl: './manifesto-section.component.scss',
})
export class ManifestoSectionComponent {
  readonly manifestoLabelTones: Array<'brand' | 'info'> = [
    'brand',
    'info',
    'brand',
  ];

  @Input({ required: true })
  manifesto: Array<{ label: string; value: string }> = [];

  @Input() reducedMotion = true;
}
