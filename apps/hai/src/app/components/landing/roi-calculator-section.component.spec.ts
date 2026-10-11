import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoiCalculatorSectionComponent } from './roi-calculator-section.component';

describe('RoiCalculatorSectionComponent', () => {
  let component: RoiCalculatorSectionComponent;
  let fixture: ComponentFixture<RoiCalculatorSectionComponent>;
  let element: HTMLElement;

  const fill = (values: Partial<RoiCalculatorSectionComponent>) => {
    Object.assign(component, values);
    component.recalculate();
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(RoiCalculatorSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('assumes no HAI prices: it asks for the visitor’s own quote first', () => {
    expect(component.hardwareCost).toBeNull();
    expect(component.setupHours).toBeNull();
    expect(component.monthlySpend).toBeNull();
    expect(component.result).toBeNull();
    expect(element.querySelector('.needs-input')?.textContent).toContain(
      'No quote yet? Start an assessment'
    );
    expect((element.textContent ?? '').replace('$65 per hour', '')).not.toMatch(
      /\$\s?\d/
    );
  });

  it('offers no lease options', () => {
    expect(element.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    expect(element.textContent).not.toMatch(/lease/i);
  });

  it('uses the published labor rate', () => {
    expect(element.querySelector('.lede')?.textContent).toContain(
      '$65 per hour'
    );
    fill({ hardwareCost: 1000, setupHours: 10, monthlySpend: 200 });

    expect(component.result?.ownedLaborTotal).toBe(650);
  });

  it('shows a neutral outcome when owning costs less', () => {
    fill({
      hardwareCost: 1000,
      setupHours: 10,
      monthlySupportHours: 1,
      monthlyServiceCosts: 5,
      monthlySpend: 200,
    });

    expect(element.textContent).toContain('Owning costs $6,050 less');
    expect(element.textContent).toContain('Owning catches up in month 14');
    expect(element.querySelectorAll('.yearly-table tbody tr')).toHaveLength(5);
  });

  it('says so plainly when subscriptions cost less', () => {
    fill({ hardwareCost: 3000, setupHours: 20, monthlySpend: 30 });

    expect(element.textContent).toMatch(/Subscriptions cost \$[\d,]+ less/);
    expect(element.textContent).toContain(
      'Subscriptions stay cheaper across five years'
    );
  });

  it('lists what the comparison leaves out', () => {
    fill({ hardwareCost: 1000, setupHours: 10, monthlySpend: 200 });

    expect(element.querySelector('.assumptions-list')?.textContent).toContain(
      'Not included: replacing or repairing hardware'
    );
  });

  it('reports invalid input instead of a result', () => {
    fill({ hardwareCost: -5, setupHours: 10, monthlySpend: 200 });

    expect(component.result).toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Hardware cost must be zero or positive.'
    );
  });

  it('emits the comparison and its assumptions for the contact form', () => {
    const emitted: string[] = [];
    component.emailComparison.subscribe((message) => emitted.push(message));
    fill({ hardwareCost: 1000, setupHours: 10, monthlySpend: 200 });

    (element.querySelector('.btn-email') as HTMLButtonElement).click();

    expect(emitted[0]).toContain(
      'Please check this five-year comparison against a quote'
    );
    expect(emitted[0]).toContain('Assumes: Not included');
  });
});
