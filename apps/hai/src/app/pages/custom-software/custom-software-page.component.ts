import { Component } from '@angular/core';
import { ServicesSectionComponent } from '../../components/landing/services-section.component';
import { SERVICE_PILLARS, SERVICE_PROOF } from '../../content/site-content';
import { RelatedLinksComponent } from '../../components/shared/related-links.component';
import {
  CUSTOM_SOFTWARE_RELATED_PROMPT,
  LEARN_AND_SUPPORT_LINKS,
} from '../../content/related-links';

@Component({
  selector: 'hai-custom-software-page',
  standalone: true,
  imports: [ServicesSectionComponent, RelatedLinksComponent],
  template: `
    <h1 class="visually-hidden">Custom software</h1>
    <hai-services-section
      [serviceProof]="serviceProof"
      [servicePillars]="servicePillars"
    ></hai-services-section>
    <hai-related-links
      [prompt]="relatedPrompt"
      [links]="relatedLinks"
    ></hai-related-links>
  `,
})
export class CustomSoftwarePageComponent {
  readonly servicePillars = SERVICE_PILLARS;
  readonly serviceProof = SERVICE_PROOF;
  readonly relatedPrompt = CUSTOM_SOFTWARE_RELATED_PROMPT;
  readonly relatedLinks = LEARN_AND_SUPPORT_LINKS;
}
