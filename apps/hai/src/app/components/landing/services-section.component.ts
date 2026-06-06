import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'hai-services-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services-section.component.html',
  styleUrl: './services-section.component.scss',
})
export class ServicesSectionComponent {
  @Input({ required: true })
  serviceProof: string[] = [];

  @Input({ required: true })
  servicePillars: Array<{
    icon: string;
    title: string;
    description: string;
  }> = [];
}
