import { Component } from '@angular/core';
import { PageIntroComponent } from '../../components/page-intro/page-intro.component';
import { StackListComponent } from '../../components/private-cloud/stack-list.component';
import { ArchitectureDiagramComponent } from '../../components/private-cloud/architecture-diagram.component';
import { FreedomTeaserComponent } from '../../components/shared/freedom-teaser.component';
import { CtaPanelComponent } from '../../components/shared/cta-panel.component';
import {
  CORE_SERVICES,
  FREEDOM_COMMITMENTS,
  FREEDOM_PRINCIPLE,
  PLATFORM_COMPONENTS,
  STACK_ARCHITECTURE,
  STACK_ARCHITECTURE_CAPTION,
  STACK_HERO,
  STACK_QUALIFIER,
} from '../../content/private-cloud';

/** The open-source projects a private cloud is built from. */
@Component({
  selector: 'hai-open-source-stack-page',
  standalone: true,
  imports: [
    PageIntroComponent,
    StackListComponent,
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
    <p class="stack-qualifier" role="note">{{ qualifier }}</p>
    <hai-stack-list
      sectionId="core-services"
      eyebrow="Core services"
      heading="What you use day to day."
      [components]="coreServices"
    ></hai-stack-list>
    <hai-stack-list
      sectionId="platform"
      eyebrow="Platform and operations"
      heading="What keeps it running."
      intro="You rarely see these parts, but they decide whether the system is easy to maintain, back up, and hand over."
      [components]="platform"
    ></hai-stack-list>
    <hai-architecture-diagram
      eyebrow="Stack diagram"
      heading="How the pieces fit."
      [tiers]="architecture"
      [caption]="architectureCaption"
    ></hai-architecture-diagram>
    <hai-freedom-teaser
      [principle]="principle"
      [commitments]="commitments"
      linkLabel="Back to private cloud"
      linkRoute="/private-cloud"
    ></hai-freedom-teaser>
    <hai-cta-panel
      title="Find out which parts you need."
      text="Answer a few questions about what you store and who uses it, and we will recommend the services that fit. There is no obligation."
      [action]="hero.action"
      secondaryPrompt="Prefer to talk first?"
      [secondary]="{ label: 'Contact us', route: '/contact' }"
    ></hai-cta-panel>
  `,
  styleUrl: './open-source-stack-page.component.scss',
})
export class OpenSourceStackPageComponent {
  readonly hero = STACK_HERO;
  readonly qualifier = STACK_QUALIFIER;
  readonly coreServices = CORE_SERVICES;
  readonly platform = PLATFORM_COMPONENTS;
  readonly architecture = STACK_ARCHITECTURE;
  readonly architectureCaption = STACK_ARCHITECTURE_CAPTION;
  readonly principle = FREEDOM_PRINCIPLE;
  readonly commitments = FREEDOM_COMMITMENTS;
}
