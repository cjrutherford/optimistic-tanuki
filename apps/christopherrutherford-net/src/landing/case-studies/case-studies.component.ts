import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  CardComponent,
  SectionHeadingComponent,
} from '@optimistic-tanuki/common-ui';

import { CASE_STUDIES } from './case-studies.data';

@Component({
  selector: 'app-case-studies',
  imports: [CommonModule, SectionHeadingComponent, CardComponent],
  templateUrl: './case-studies.component.html',
  styleUrl: './case-studies.component.scss',
})
export class CaseStudiesComponent {
  readonly featured = CASE_STUDIES.filter((study) => study.featured);
  readonly supporting = CASE_STUDIES.filter((study) => !study.featured);
}
