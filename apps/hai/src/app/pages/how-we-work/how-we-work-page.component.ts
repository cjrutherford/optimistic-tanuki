import { Component, PLATFORM_ID, inject } from '@angular/core';
import { ManifestoSectionComponent } from '../../components/landing/manifesto-section.component';
import { EngagementSectionComponent } from '../../components/landing/engagement-section.component';
import { ENGAGEMENT_STAGES, MANIFESTO } from '../../content/site-content';
import { RelatedLinksComponent } from '../../components/shared/related-links.component';
import {
  HOW_WE_WORK_RELATED_PROMPT,
  LEARN_AND_SUPPORT_LINKS,
} from '../../content/related-links';
import { prefersReducedMotion } from '../../services/reduced-motion';

@Component({
  selector: 'hai-how-we-work-page',
  standalone: true,
  imports: [
    ManifestoSectionComponent,
    EngagementSectionComponent,
    RelatedLinksComponent,
  ],
  template: `
    <h1 class="visually-hidden">How we work</h1>
    <hai-manifesto-section
      [manifesto]="manifesto"
      [reducedMotion]="reducedMotion"
    ></hai-manifesto-section>
    <hai-engagement-section [stages]="stages"></hai-engagement-section>
    <hai-related-links
      [prompt]="relatedPrompt"
      [links]="relatedLinks"
    ></hai-related-links>
  `,
})
export class HowWeWorkPageComponent {
  private readonly platformId = inject(PLATFORM_ID);

  readonly manifesto = MANIFESTO;
  readonly stages = ENGAGEMENT_STAGES;
  readonly relatedPrompt = HOW_WE_WORK_RELATED_PROMPT;
  readonly relatedLinks = LEARN_AND_SUPPORT_LINKS;

  get reducedMotion(): boolean {
    return prefersReducedMotion(this.platformId);
  }
}
