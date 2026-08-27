import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { BadgeComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'hai-partner-section',
  standalone: true,
  imports: [CommonModule, CardComponent, BadgeComponent],
  templateUrl: './partner-section.component.html',
  styleUrl: './partner-section.component.scss',
})
export class PartnerSectionComponent {
  @Input({ required: true }) benefits: string[] = [];
}
