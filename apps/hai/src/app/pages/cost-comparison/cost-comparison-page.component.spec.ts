import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { CostComparisonPageComponent } from './cost-comparison-page.component';
import { RoiCalculatorSectionComponent } from '../../components/landing/roi-calculator-section.component';
import { ContactRequestService } from '../../services/contact-request.service';
import {
  COMPARISON_ROWS,
  SUBSCRIPTION_BETTER_WHEN,
} from '../../content/cost-comparison';

describe('CostComparisonPageComponent', () => {
  let fixture: ComponentFixture<CostComparisonPageComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CostComparisonPageComponent, HttpClientTestingModule],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(CostComparisonPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('has one visible h1 that does not presume ownership wins', () => {
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toBe(
      'Subscriptions or ownership?'
    );
    expect(element.querySelector('.summary')?.textContent).toContain(
      'not always cheaper'
    );
  });

  it('compares ownership, licensing, portability, control, support, and expansion', () => {
    const topics = Array.from(
      element.querySelectorAll('#comparison tbody th')
    ).map((topic) => topic.textContent);

    expect(topics).toEqual(COMPARISON_ROWS.map((row) => row.topic));
    expect(topics).toEqual(
      expect.arrayContaining([
        'Ownership',
        'Licensing',
        'Portability',
        'Control',
        'Support',
        'Expansion',
      ])
    );
  });

  it('is balanced: every row speaks for both sides, and subscriptions get their own case', () => {
    for (const row of COMPARISON_ROWS) {
      expect(row.subscription.length).toBeGreaterThan(10);
      expect(row.owned.length).toBeGreaterThan(10);
    }
    expect(element.querySelectorAll('.subscription-wins li')).toHaveLength(
      SUBSCRIPTION_BETTER_WHEN.length
    );
    expect(element.textContent).toContain(
      'Hardware and setup labor are paid up front.'
    );
  });

  it('makes no guaranteed-savings claims', () => {
    expect(element.textContent).not.toMatch(
      /guarantee[sd]? (savings|to save)|(?<!not )always cheaper|save money|you will save/i
    );
  });

  it('links to the assessment and the private cloud page', () => {
    const hrefs = Array.from(element.querySelectorAll('a')).map((link) =>
      link.getAttribute('href')
    );

    expect(hrefs).toContain('/private-cloud/assessment');
    expect(hrefs).toContain('/private-cloud');
  });

  it('explains the pricing structure the calculator uses', () => {
    expect(element.querySelector('#pricing h2')?.textContent).toContain(
      'Hardware at cost'
    );
  });

  it('carries a calculated comparison to the contact page', () => {
    const navigate = jest
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    const calculator = fixture.debugElement.query(
      By.directive(RoiCalculatorSectionComponent)
    ).componentInstance as RoiCalculatorSectionComponent;
    Object.assign(calculator, {
      hardwareCost: 1000,
      setupHours: 10,
      monthlySpend: 200,
    });
    calculator.recalculate();
    fixture.detectChanges();

    (element.querySelector('.btn-email') as HTMLButtonElement).click();

    expect(TestBed.inject(ContactRequestService).prefill()).toContain(
      'Please check this five-year comparison'
    );
    expect(navigate).toHaveBeenCalledWith('/contact');
  });
});
