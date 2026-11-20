import { Component } from '@angular/core';

import {
  CardComponent,
  SectionHeadingComponent,
} from '@optimistic-tanuki/common-ui';
import { PROFILE } from '../profile.data';
import { SERVICE_ENTRIES } from '../services.data';

@Component({
  selector: 'app-services-grid',
  imports: [SectionHeadingComponent, CardComponent],
  templateUrl: './services-grid.component.html',
  styleUrl: './services-grid.component.scss',
})
export class ServicesGridComponent {
  readonly profile = PROFILE;
  readonly services = SERVICE_ENTRIES;
}
