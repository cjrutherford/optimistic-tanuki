import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AuroraRibbonComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'hai-personal-cloud-section',
  standalone: true,
  imports: [CommonModule, AuroraRibbonComponent],
  templateUrl: './personal-cloud-section.component.html',
  styleUrl: './personal-cloud-section.component.scss',
})
export class PersonalCloudSectionComponent {
  @Input({ required: true })
  ownershipNotes: string[] = [];

  @Input() reducedMotion = true;
}
