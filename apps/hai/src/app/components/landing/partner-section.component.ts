import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'hai-partner-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './partner-section.component.html',
  styleUrl: './partner-section.component.scss',
})
export class PartnerSectionComponent {
  @Input({ required: true }) benefits: string[] = [];
}
