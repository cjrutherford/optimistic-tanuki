import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'hai-engagement-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './engagement-section.component.html',
  styleUrl: './engagement-section.component.scss',
})
export class EngagementSectionComponent {
  @Input({ required: true })
  stages: Array<{ number: string; title: string; items: string[] }> = [];
}
