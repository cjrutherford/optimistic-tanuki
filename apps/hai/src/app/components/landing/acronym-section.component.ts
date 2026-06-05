import { Component } from '@angular/core';
import { HaiExpansionComponent } from '@optimistic-tanuki/hai-ui';

@Component({
  selector: 'hai-acronym-section',
  standalone: true,
  imports: [HaiExpansionComponent],
  templateUrl: './acronym-section.component.html',
  styleUrl: './acronym-section.component.scss',
})
export class AcronymSectionComponent {}
