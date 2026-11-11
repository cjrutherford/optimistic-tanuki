import { Component } from '@angular/core';
import { SolutionsMatrixComponent } from '../../components/solutions-matrix/solutions-matrix.component';
import { PricingTermsComponent } from '../../components/pricing/pricing-terms.component';
import { PageIntroComponent } from '../../components/page-intro/page-intro.component';
import { StackSummaryComponent } from '../../components/private-cloud/stack-summary.component';
import {
  CORE_SERVICES,
  PLATFORM_COMPONENTS,
  PRIVATE_CLOUD_STACK_SUMMARY,
  SOFTWARE_STACKS_HERO,
  STACK_QUALIFIER,
} from '../../content/private-cloud';
import { RelatedLinksComponent } from '../../components/shared/related-links.component';
import {
  LEARN_AND_SUPPORT_LINKS,
  SOFTWARE_STACKS_RELATED_PROMPT,
} from '../../content/related-links';

@Component({
  selector: 'hai-software-stacks-page',
  standalone: true,
  imports: [
    PageIntroComponent,
    PricingTermsComponent,
    SolutionsMatrixComponent,
    StackSummaryComponent,
    RelatedLinksComponent,
  ],
  template: `
    <hai-page-intro
      [eyebrow]="hero.eyebrow"
      [title]="hero.title"
      [summary]="hero.summary"
      [action]="hero.action"
      [links]="hero.links"
    ></hai-page-intro>
    <hai-solutions-matrix></hai-solutions-matrix>
    <hai-pricing-terms></hai-pricing-terms>
    <hai-stack-summary
      [summary]="summary"
      [services]="services"
      [platform]="platform"
      [qualifier]="qualifier"
    ></hai-stack-summary>
    <hai-related-links
      [prompt]="relatedPrompt"
      [links]="relatedLinks"
    ></hai-related-links>
  `,
})
export class SoftwareStacksPageComponent {
  readonly hero = SOFTWARE_STACKS_HERO;
  readonly summary = PRIVATE_CLOUD_STACK_SUMMARY;
  readonly services = CORE_SERVICES;
  readonly platform = PLATFORM_COMPONENTS;
  readonly qualifier = STACK_QUALIFIER;
  readonly relatedPrompt = SOFTWARE_STACKS_RELATED_PROMPT;
  readonly relatedLinks = LEARN_AND_SUPPORT_LINKS;
}
