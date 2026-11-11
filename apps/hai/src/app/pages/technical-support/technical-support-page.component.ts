import { Component } from '@angular/core';
import { PageIntroComponent } from '../../components/page-intro/page-intro.component';
import { CapabilityGridComponent } from '../../components/shared/capability-grid.component';
import { HowItWorksComponent } from '../../components/shared/how-it-works.component';
import { CtaPanelComponent } from '../../components/shared/cta-panel.component';
import {
  SUPPORT_AREA,
  SUPPORT_AREA_HEADING,
  SUPPORT_AUDIENCES,
  SUPPORT_BOUNDARY,
  SUPPORT_BOUNDARY_HEADING,
  SUPPORT_CTA,
  SUPPORT_HERO,
  SUPPORT_PRICING,
  SUPPORT_PRICING_HEADING,
  SUPPORT_SERVICES,
  SUPPORT_STEPS,
} from '../../content/technical-support';
import {
  SUPPORT_TRAINING_PROMPT,
  TRAINING_LINK,
} from '../../content/related-links';

/** Practical technical support: what it covers, how a request works, and its limits. */
@Component({
  selector: 'hai-technical-support-page',
  standalone: true,
  imports: [
    PageIntroComponent,
    CapabilityGridComponent,
    HowItWorksComponent,
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
      sectionId="who-its-for"
      eyebrow="Who it's for"
      heading="Help for people who are not technical."
      [capabilities]="audiences"
      [columns]="3"
    ></hai-capability-grid>
    <hai-capability-grid
      sectionId="services"
      eyebrow="What we help with"
      heading="Everyday problems, new setups, and moving data."
      [capabilities]="services"
      [columns]="2"
    ></hai-capability-grid>
    <hai-how-it-works [steps]="steps"></hai-how-it-works>
    <hai-capability-grid
      sectionId="boundaries"
      eyebrow="Limits"
      [heading]="boundaryHeading"
      [capabilities]="boundary"
      [columns]="3"
    ></hai-capability-grid>
    <hai-capability-grid
      sectionId="pricing"
      eyebrow="Pricing"
      [heading]="pricingHeading"
      [capabilities]="pricing"
      [columns]="2"
    ></hai-capability-grid>
    <hai-capability-grid
      sectionId="service-area"
      eyebrow="Service area"
      [heading]="areaHeading"
      [capabilities]="area"
      [columns]="1"
    ></hai-capability-grid>
    <hai-cta-panel
      [title]="cta.title"
      [text]="cta.text"
      [action]="cta.action"
      [secondaryPrompt]="trainingPrompt"
      [secondary]="trainingLink"
    ></hai-cta-panel>
  `,
})
export class TechnicalSupportPageComponent {
  readonly hero = SUPPORT_HERO;
  readonly audiences = SUPPORT_AUDIENCES;
  readonly services = SUPPORT_SERVICES;
  readonly steps = SUPPORT_STEPS;
  readonly boundaryHeading = SUPPORT_BOUNDARY_HEADING;
  readonly boundary = SUPPORT_BOUNDARY;
  readonly pricingHeading = SUPPORT_PRICING_HEADING;
  readonly pricing = SUPPORT_PRICING;
  readonly areaHeading = SUPPORT_AREA_HEADING;
  readonly area = SUPPORT_AREA;
  readonly cta = SUPPORT_CTA;
  readonly trainingPrompt = SUPPORT_TRAINING_PROMPT;
  readonly trainingLink = TRAINING_LINK;
}
