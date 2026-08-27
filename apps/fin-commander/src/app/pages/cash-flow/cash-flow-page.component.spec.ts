import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { CashFlowPageComponent } from './cash-flow-page.component';
import {
  FinCommanderPlanApiService,
  FinCommanderPlanStore,
} from '@optimistic-tanuki/fin-commander-data-access';

describe('CashFlowPageComponent', () => {
  it('exposes integrated financial utility links on the business workspace card', async () => {
    await TestBed.configureTestingModule({
      imports: [CashFlowPageComponent],
      providers: [
        provideRouter([]),
        { provide: FinCommanderPlanStore, useValue: { getScope: () => null } },
        {
          provide: FinCommanderPlanApiService,
          useValue: { getCashFlowProjection: jest.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CashFlowPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Invoices');
    expect(text).toContain('Checkout');
    expect(text).toContain('Payments');
    expect(text).not.toContain('business-site');
  });

  it('renders an explainable 90-day forecast for the active plan', async () => {
    await TestBed.configureTestingModule({
      imports: [CashFlowPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'planId' ? 'plan-1' : null),
              },
            },
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: { getScope: () => ({ tenantId: 'tenant-1' }) },
        },
        {
          provide: FinCommanderPlanApiService,
          useValue: {
            getCashFlowProjection: jest.fn().mockResolvedValue({
              calculatedAt: '2026-08-12T12:00:00.000Z',
              openingBalanceCents: 100000,
              projectedBalanceCents: 445000,
              events: [{ id: 'income' }],
            }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CashFlowPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('90-day forecast');
    expect(fixture.nativeElement.textContent).toContain(
      '$1,000.00 → $4,450.00'
    );
  });
});
