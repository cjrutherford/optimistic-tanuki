import { Component } from '@angular/core';
import { SectionHeadingComponent } from '@optimistic-tanuki/common-ui';

import { PROFILE } from '../profile.data';
import { EXPERIENCE, EXPERIENCE_INTRO } from './experience.data';

@Component({
  selector: 'app-experience',
  imports: [SectionHeadingComponent],
  templateUrl: './experience.component.html',
  styleUrl: './experience.component.scss',
})
export class ExperienceComponent {
  readonly profile = PROFILE;
  readonly intro = EXPERIENCE_INTRO;
  readonly entries = EXPERIENCE;
}
