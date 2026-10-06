import { TestBed } from '@angular/core/testing';
import { PricingTermsComponent } from './pricing-terms.component';
import { LABOR_RATE_PER_HOUR } from '../../content/pricing';

describe('PricingTermsComponent', () => {
  it('explains each part of the pass-through pricing structure', () => {
    const fixture = TestBed.createComponent(PricingTermsComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const terms = Array.from(element.querySelectorAll('dt')).map(
      (term) => term.textContent
    );

    expect(element.querySelector('h2')?.textContent).toBe(
      `Hardware at cost. Labor at $${LABOR_RATE_PER_HOUR} an hour.`
    );
    expect(terms).toEqual([
      'Hardware',
      'Freight and tax',
      'Labor',
      'Ongoing support',
      'Leasing',
      'Everything else',
    ]);
    expect(element.textContent).toContain('no markup');
    expect(element.textContent).toContain('actual amounts');
    expect(element.textContent).toContain('third-party lender');
    expect(element.textContent).toContain('quoted per project');
  });
});
