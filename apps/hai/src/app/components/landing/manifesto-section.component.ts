import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ShimmerBeamComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'hai-manifesto-section',
  standalone: true,
  imports: [CommonModule, ShimmerBeamComponent],
  templateUrl: './manifesto-section.component.html',
  styleUrl: './manifesto-section.component.scss',
})
export class ManifestoSectionComponent {
  @Input({ required: true })
  manifesto: Array<{ label: string; value: string }> = [];

  @Input() reducedMotion = true;
}
