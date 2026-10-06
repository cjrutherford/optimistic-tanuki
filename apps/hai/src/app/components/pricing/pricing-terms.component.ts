import { Component } from '@angular/core';
import {
  PRICING_HEADLINE,
  PRICING_SUMMARY,
  PRICING_TERMS,
} from '../../content/pricing';

/** "How we price": the pass-through pricing structure (D018–D022). */
@Component({
  selector: 'hai-pricing-terms',
  standalone: true,
  templateUrl: './pricing-terms.component.html',
  styleUrl: './pricing-terms.component.scss',
})
export class PricingTermsComponent {
  readonly headline = PRICING_HEADLINE;
  readonly summary = PRICING_SUMMARY;
  readonly terms = PRICING_TERMS;
}
