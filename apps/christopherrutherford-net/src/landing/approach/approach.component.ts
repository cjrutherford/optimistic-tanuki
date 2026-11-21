import { Component } from '@angular/core';
import { SectionHeadingComponent } from '@optimistic-tanuki/common-ui';

import { PRINCIPLES } from './approach.data';

@Component({
  selector: 'app-approach',
  imports: [SectionHeadingComponent],
  templateUrl: './approach.component.html',
  styleUrl: './approach.component.scss',
})
export class ApproachComponent {
  readonly principles = PRINCIPLES;
}
