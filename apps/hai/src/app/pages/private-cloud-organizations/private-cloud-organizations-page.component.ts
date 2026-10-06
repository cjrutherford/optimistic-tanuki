import { Component } from '@angular/core';
import { PageIntroComponent } from '../../components/page-intro/page-intro.component';
import { CapabilityGridComponent } from '../../components/private-cloud/capability-grid.component';
import { FreedomTeaserComponent } from '../../components/private-cloud/freedom-teaser.component';
import { CtaPanelComponent } from '../../components/private-cloud/cta-panel.component';
import {
  CAPABILITY_QUALIFIER,
  FREEDOM_COMMITMENTS,
  FREEDOM_PRINCIPLE,
  ORGANIZATION_AUDIENCES,
  ORGANIZATION_HERO,
  ORGANIZATION_OUTCOMES,
  ORGANIZATION_QUESTIONS,
} from '../../content/private-cloud';

/** Private cloud for faith groups, nonprofits, community groups, and small businesses. */
@Component({
  selector: 'hai-private-cloud-organizations-page',
  standalone: true,
  imports: [
    PageIntroComponent,
    CapabilityGridComponent,
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
      sectionId="audiences"
      eyebrow="Who we work with"
      heading="Built for groups that share their work."
      [capabilities]="audiences"
      [columns]="4"
    ></hai-capability-grid>
    <hai-capability-grid
      sectionId="outcomes"
      eyebrow="What you get"
      heading="One place for your files, kept safe and supported."
      [capabilities]="outcomes"
      [qualifier]="qualifier"
    ></hai-capability-grid>
    <hai-capability-grid
      sectionId="questions"
      eyebrow="Questions boards and owners ask"
      heading="Straight answers before you decide."
      [capabilities]="questions"
    ></hai-capability-grid>
    <hai-freedom-teaser
      [principle]="principle"
      [commitments]="commitments"
      linkLabel="See the open-source stack"
      linkRoute="/private-cloud/open-source-stack"
    ></hai-freedom-teaser>
    <hai-cta-panel
      title="See what your organization would need."
      text="Answer a few questions about the files, accounts, and subscriptions you have today, and we will recommend a setup. There is no obligation."
      [action]="hero.action"
      secondaryPrompt="Prefer to talk it through first?"
      [secondary]="{ label: 'Schedule a free audit', route: '/contact' }"
    ></hai-cta-panel>
  `,
})
export class PrivateCloudOrganizationsPageComponent {
  readonly hero = ORGANIZATION_HERO;
  readonly audiences = ORGANIZATION_AUDIENCES;
  readonly outcomes = ORGANIZATION_OUTCOMES;
  readonly qualifier = CAPABILITY_QUALIFIER;
  readonly questions = ORGANIZATION_QUESTIONS;
  readonly principle = FREEDOM_PRINCIPLE;
  readonly commitments = FREEDOM_COMMITMENTS;
}
