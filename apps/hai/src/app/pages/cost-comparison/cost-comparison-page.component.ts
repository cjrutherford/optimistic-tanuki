import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RoiCalculatorSectionComponent } from '../../components/landing/roi-calculator-section.component';
import { PageIntroComponent } from '../../components/page-intro/page-intro.component';
import { ComparisonTableComponent } from '../../components/cost-comparison/comparison-table.component';
import { PricingTermsComponent } from '../../components/pricing/pricing-terms.component';
import { CtaPanelComponent } from '../../components/private-cloud/cta-panel.component';
import { ContactRequestService } from '../../services/contact-request.service';
import {
  COMPARISON_ROWS,
  COST_COMPARISON_HERO,
  SUBSCRIPTION_BETTER_WHEN,
} from '../../content/cost-comparison';

/** Neutral subscription-vs-owned comparison with a calculator for real quotes. */
@Component({
  selector: 'hai-cost-comparison-page',
  standalone: true,
  imports: [
    PageIntroComponent,
    ComparisonTableComponent,
    RoiCalculatorSectionComponent,
    PricingTermsComponent,
    CtaPanelComponent,
  ],
  template: `
    <hai-page-intro
      [eyebrow]="hero.eyebrow"
      [title]="hero.title"
      [summary]="hero.summary"
      [action]="hero.action"
    ></hai-page-intro>
    <hai-comparison-table
      [rows]="rows"
      [subscriptionBetterWhen]="subscriptionBetterWhen"
    ></hai-comparison-table>
    <hai-roi-calculator
      (emailComparison)="sendComparison($event)"
    ></hai-roi-calculator>
    <hai-pricing-terms></hai-pricing-terms>
    <hai-cta-panel
      title="Get real numbers for your situation."
      text="An assessment ends with an itemized quote: each part at its actual cost, and the labor hours we expect. Put those numbers into the calculator and decide for yourself."
      [action]="hero.action"
      secondaryPrompt="Want to see what a private cloud includes first?"
      [secondary]="{ label: 'Explore private cloud', route: '/private-cloud' }"
    ></hai-cta-panel>
  `,
})
export class CostComparisonPageComponent {
  private readonly contact = inject(ContactRequestService);
  private readonly router = inject(Router);

  readonly hero = COST_COMPARISON_HERO;
  readonly rows = COMPARISON_ROWS;
  readonly subscriptionBetterWhen = SUBSCRIPTION_BETTER_WHEN;

  sendComparison(message: string): void {
    this.contact.setPrefill(message);
    void this.router.navigateByUrl('/contact');
  }
}
