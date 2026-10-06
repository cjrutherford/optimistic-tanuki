import { Component } from '@angular/core';
import { ServicesSectionComponent } from '../../components/landing/services-section.component';
import { SERVICE_PILLARS, SERVICE_PROOF } from '../../content/site-content';

@Component({
  selector: 'hai-custom-software-page',
  standalone: true,
  imports: [ServicesSectionComponent],
  template: `
    <h1 class="visually-hidden">Custom software</h1>
    <hai-services-section
      [serviceProof]="serviceProof"
      [servicePillars]="servicePillars"
    ></hai-services-section>
  `,
})
export class CustomSoftwarePageComponent {
  readonly servicePillars = SERVICE_PILLARS;
  readonly serviceProof = SERVICE_PROOF;
}
