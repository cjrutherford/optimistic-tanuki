import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CashFlowPageComponent } from './cash-flow-page.component';

describe('CashFlowPageComponent', () => {
  it('exposes integrated financial utility links on the business workspace card', async () => {
    await TestBed.configureTestingModule({
      imports: [CashFlowPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(CashFlowPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Invoices');
    expect(text).toContain('Checkout');
    expect(text).toContain('Payments');
    expect(text).not.toContain('business-site');
  });
});
