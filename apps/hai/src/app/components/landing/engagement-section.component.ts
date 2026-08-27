import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { BadgeComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'hai-engagement-section',
  standalone: true,
  imports: [CommonModule, CardComponent, BadgeComponent],
  templateUrl: './engagement-section.component.html',
  styleUrl: './engagement-section.component.scss',
})
export class EngagementSectionComponent {
  @Input({ required: true })
  stages: Array<{ number: string; title: string; items: string[] }> = [];
}
