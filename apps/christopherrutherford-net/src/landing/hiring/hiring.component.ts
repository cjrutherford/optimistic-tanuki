import { Component } from '@angular/core';
import {
  CardComponent,
  SectionHeadingComponent,
} from '@optimistic-tanuki/common-ui';

import { PROFILE } from '../profile.data';
import { HIRING_HIGHLIGHTS, HIRING_TARGETS } from './hiring.data';

@Component({
  selector: 'app-hiring',
  imports: [SectionHeadingComponent, CardComponent],
  templateUrl: './hiring.component.html',
  styleUrl: './hiring.component.scss',
})
export class HiringComponent {
  readonly profile = PROFILE;
  readonly highlights = HIRING_HIGHLIGHTS;
  readonly targets = HIRING_TARGETS;
}
