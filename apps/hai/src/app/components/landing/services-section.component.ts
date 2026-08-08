import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'hai-services-section',
  standalone: true,
  imports: [CommonModule, CardComponent],
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
