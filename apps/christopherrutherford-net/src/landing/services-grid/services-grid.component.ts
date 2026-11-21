import { Component } from '@angular/core';

import {
  CardComponent,
  SectionHeadingComponent,
} from '@optimistic-tanuki/common-ui';
import { PROFILE } from '../profile.data';
import { SERVICE_ENTRIES, WORK_MODES } from '../services.data';

@Component({
  selector: 'app-services-grid',
  imports: [SectionHeadingComponent, CardComponent],
  templateUrl: './services-grid.component.html',
  styleUrl: './services-grid.component.scss',
})
export class ServicesGridComponent {
  readonly profile = PROFILE;
  readonly modes = WORK_MODES;
  readonly services = SERVICE_ENTRIES;
}
