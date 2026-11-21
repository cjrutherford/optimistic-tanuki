import { Component } from '@angular/core';
import { SectionHeadingComponent } from '@optimistic-tanuki/common-ui';

import { PROFILE } from '../profile.data';

@Component({
  selector: 'app-about',
  imports: [SectionHeadingComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  readonly profile = PROFILE;
}
