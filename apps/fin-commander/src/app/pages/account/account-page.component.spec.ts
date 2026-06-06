import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { AccountPageComponent } from './account-page.component';
import { TenantContextService } from '../../tenant-context.service';

describe('AccountPageComponent', () => {
  const financeService = {
    getWorkspaceSummary: jest.fn(),
  };
  const tenantContext = {
    activeTenant: jest.fn().mockReturnValue({
      id: 'tenant-1',
      name: 'Household',
      type: 'household',
      profileId: 'p',
      appScope: 'finance',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [AccountPageComponent],
      providers: [
        provideRouter([]),
        { provide: FinanceService, useValue: financeService },
        { provide: TenantContextService, useValue: tenantContext },
      ],
    }).compileComponents();
  });

  it('formats finance metrics using Intl currency formatting', async () => {
    financeService.getWorkspaceSummary.mockResolvedValue({
      metrics: {
        totalBalance: 12500,
        netWorth: 48200,
        budgetsAtRiskCount: 2,
      },
    });
    const fixture = TestBed.createComponent(AccountPageComponent);
    await fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.formatCurrency(12500)).toMatch(/\$12,500/);
    expect(fixture.componentInstance.summary()?.metrics.totalBalance).toBe(
      12500
    );
    expect(fixture.componentInstance.loadError()).toBe('');
  });

  it('surfaces a retry message when the summary fails to load', async () => {
    financeService.getWorkspaceSummary.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(AccountPageComponent);
    await fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.summary()).toBeNull();
    expect(fixture.componentInstance.loadError()).toContain('finance health');
  });

  it('retries loading when reloadSummary is invoked again', async () => {
    financeService.getWorkspaceSummary
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        metrics: { totalBalance: 100, netWorth: 200, budgetsAtRiskCount: 0 },
      });

    const fixture = TestBed.createComponent(AccountPageComponent);
    await fixture.componentInstance.ngOnInit();
    expect(fixture.componentInstance.loadError()).not.toBe('');

    await fixture.componentInstance.reloadSummary();
    expect(fixture.componentInstance.loadError()).toBe('');
    expect(fixture.componentInstance.summary()?.metrics.totalBalance).toBe(100);
  });
});
