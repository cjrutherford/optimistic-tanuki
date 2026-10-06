import { Component } from '@angular/core';
import { PageIntroComponent } from '../../components/page-intro/page-intro.component';
import { CapabilityGridComponent } from '../../components/private-cloud/capability-grid.component';
import { ArchitectureDiagramComponent } from '../../components/private-cloud/architecture-diagram.component';
import { FreedomTeaserComponent } from '../../components/private-cloud/freedom-teaser.component';
import { CtaPanelComponent } from '../../components/private-cloud/cta-panel.component';
import {
  CAPABILITY_QUALIFIER,
  FREEDOM_COMMITMENTS,
  FREEDOM_PRINCIPLE,
  HOME_ARCHITECTURE,
  HOME_ARCHITECTURE_CAPTION,
  HOME_HERO,
  HOME_OUTCOMES,
  HOME_USE_CASES,
} from '../../content/private-cloud';

/** Household private cloud: outcomes first, no product names. */
@Component({
  selector: 'hai-private-cloud-home-page',
  standalone: true,
  imports: [
    PageIntroComponent,
    CapabilityGridComponent,
    ArchitectureDiagramComponent,
    FreedomTeaserComponent,
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
      sectionId="outcomes"
      eyebrow="What you get"
      heading="Your household's digital life, kept at home."
      [capabilities]="outcomes"
      [qualifier]="qualifier"
    ></hai-capability-grid>
    <hai-capability-grid
      sectionId="use-cases"
      eyebrow="Sound familiar?"
      heading="Why families start."
      [capabilities]="useCases"
    ></hai-capability-grid>
    <hai-architecture-diagram
      heading="How it fits together."
      [tiers]="architecture"
      [caption]="architectureCaption"
    ></hai-architecture-diagram>
    <hai-freedom-teaser
      [principle]="principle"
      [commitments]="commitments"
      linkLabel="See the open-source stack"
      linkRoute="/private-cloud/open-source-stack"
    ></hai-freedom-teaser>
    <hai-cta-panel
      title="Tell us what your household keeps."
      text="Answer a few questions about your photos, files, and devices, and we will recommend a setup. There is no obligation."
      [action]="hero.action"
      secondaryPrompt="Running an organization instead?"
      [secondary]="{
        label: 'Private cloud for organizations',
        route: '/private-cloud/organizations'
      }"
    ></hai-cta-panel>
  `,
})
export class PrivateCloudHomePageComponent {
  readonly hero = HOME_HERO;
  readonly outcomes = HOME_OUTCOMES;
  readonly qualifier = CAPABILITY_QUALIFIER;
  readonly useCases = HOME_USE_CASES;
  readonly architecture = HOME_ARCHITECTURE;
  readonly architectureCaption = HOME_ARCHITECTURE_CAPTION;
  readonly principle = FREEDOM_PRINCIPLE;
  readonly commitments = FREEDOM_COMMITMENTS;
}
