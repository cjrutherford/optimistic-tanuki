import { Component, PLATFORM_ID, inject } from '@angular/core';
import { PageIntroComponent } from '../../components/page-intro/page-intro.component';
import { PersonalCloudSectionComponent } from '../../components/landing/personal-cloud-section.component';
import { CapabilityGridComponent } from '../../components/private-cloud/capability-grid.component';
import { AudienceSelectorComponent } from '../../components/private-cloud/audience-selector.component';
import { HowItWorksComponent } from '../../components/private-cloud/how-it-works.component';
import { FreedomTeaserComponent } from '../../components/private-cloud/freedom-teaser.component';
import { CtaPanelComponent } from '../../components/private-cloud/cta-panel.component';
import { OWNERSHIP_NOTES } from '../../content/site-content';
import {
  AUDIENCE_PATHS,
  CAPABILITY_QUALIFIER,
  FREEDOM_COMMITMENTS,
  FREEDOM_PRINCIPLE,
  PRIVATE_CLOUD_CAPABILITY_LIST,
  PRIVATE_CLOUD_HERO,
  PRIVATE_CLOUD_STEPS,
} from '../../content/private-cloud';
import { prefersReducedMotion } from '../../services/reduced-motion';

/** The private-cloud landing page and print/QR destination. */
@Component({
  selector: 'hai-private-cloud-page',
  standalone: true,
  imports: [
    PageIntroComponent,
    CapabilityGridComponent,
    AudienceSelectorComponent,
    HowItWorksComponent,
    FreedomTeaserComponent,
    PersonalCloudSectionComponent,
    CtaPanelComponent,
  ],
  template: `
    <hai-page-intro
      [eyebrow]="hero.eyebrow"
      [title]="hero.title"
      [summary]="hero.summary"
      [action]="hero.action"
    ></hai-page-intro>
    <hai-capability-grid
      [capabilities]="capabilities"
      [qualifier]="qualifier"
    ></hai-capability-grid>
    <hai-audience-selector [paths]="paths"></hai-audience-selector>
    <hai-how-it-works
      [steps]="steps"
      moreRoute="/how-we-work"
    ></hai-how-it-works>
    <hai-freedom-teaser
      [principle]="principle"
      [commitments]="commitments"
      linkLabel="See the open-source stack"
      linkRoute="/private-cloud/open-source-stack"
    ></hai-freedom-teaser>
    <hai-personal-cloud-section
      [ownershipNotes]="ownershipNotes"
      [reducedMotion]="reducedMotion"
    ></hai-personal-cloud-section>
    <hai-cta-panel
      title="Find out what you would need."
      text="Answer a few questions about what you store and who uses it, and we will recommend a setup. There is no obligation."
      [action]="hero.action"
      secondaryPrompt="Prefer to talk first?"
      [secondary]="{ label: 'Contact us', route: '/contact' }"
    ></hai-cta-panel>
  `,
})
export class PrivateCloudPageComponent {
  private readonly platformId = inject(PLATFORM_ID);

  readonly hero = PRIVATE_CLOUD_HERO;
  readonly capabilities = PRIVATE_CLOUD_CAPABILITY_LIST;
  readonly qualifier = CAPABILITY_QUALIFIER;
  readonly paths = AUDIENCE_PATHS;
  readonly steps = PRIVATE_CLOUD_STEPS;
  readonly principle = FREEDOM_PRINCIPLE;
  readonly commitments = FREEDOM_COMMITMENTS;
  readonly ownershipNotes = OWNERSHIP_NOTES;

  get reducedMotion(): boolean {
    return prefersReducedMotion(this.platformId);
  }
}
