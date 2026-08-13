import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import {
  FinCommanderGoal,
  FinCommanderPlanStore,
} from '@optimistic-tanuki/fin-commander-data-access';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { of } from 'rxjs';
import { GoalsPageComponent } from './goals-page.component';

const seedGoals: FinCommanderGoal[] = [
  {
    id: 'goal-existing',
    planId: 'plan-1',
    name: 'Emergency Fund',
    // $10,000.00 and $2,500.00 in integer cents.
    targetAmountCents: 1_000_000,
    currentAmountCents: 250_000,
    dueDate: '2026-12-31',
    strategy: 'Auto-transfer $500/month',
    fundingAccountId: 'account-1',
    fundingDirective: {
      fundingAccountId: 'account-1',
      fundingAccountName: 'Emergency savings',
      fundingAccountBalanceCents: 250_000,
      remainingAmountCents: 750_000,
      monthsRemaining: 15,
      requiredMonthlyContributionCents: 50_000,
      isOverdue: false,
    },
  },
];

function setup() {
  const store = {
    getScope: () => 'personal',
    listPlans: () => [{ id: 'plan-1' }],
    listGoals: () => [...seedGoals],
    refreshGoals: jest.fn().mockResolvedValue(seedGoals),
    saveGoal: jest.fn().mockResolvedValue(seedGoals[0]),
    deleteGoal: jest.fn().mockResolvedValue(undefined),
  } as unknown as FinCommanderPlanStore;

  TestBed.configureTestingModule({
    imports: [GoalsPageComponent],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of({ get: () => 'plan-1' }),
          snapshot: { paramMap: { get: () => 'plan-1' } },
        },
      },
      { provide: FinCommanderPlanStore, useValue: store },
      {
        provide: FinanceService,
        useValue: { getAccounts: jest.fn().mockResolvedValue([]) },
      },
    ],
  });

  return store;
}

describe('GoalsPageComponent', () => {
  it('reports validation errors for an empty draft', () => {
    setup();
    const fixture = TestBed.createComponent(GoalsPageComponent);
    fixture.detectChanges();

    const errors = fixture.componentInstance.draftErrors();
    expect(errors).toEqual(
      expect.arrayContaining([
        'Goal name is required.',
        'Target amount must be greater than zero.',
        'Strategy is required.',
      ])
    );
  });

  it('rejects current amount greater than target', () => {
    setup();
    const fixture = TestBed.createComponent(GoalsPageComponent);
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    cmp.draft.name = 'Test';
    cmp.draft.targetAmount = 100;
    cmp.draft.currentAmount = 200;
    cmp.draft.strategy = 'Save';
    cmp.onDraftChange();

    expect(cmp.draftErrors()).toContain(
      'Current amount cannot exceed the target.'
    );
  });

  it('requires confirmation before deleting a goal', async () => {
    const store = setup();
    const fixture = TestBed.createComponent(GoalsPageComponent);
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    cmp.requestDelete('goal-existing');
    expect(cmp.pendingDeleteId()).toBe('goal-existing');
    expect(store.deleteGoal as jest.Mock).not.toHaveBeenCalled();

    cmp.cancelDelete();
    expect(cmp.pendingDeleteId()).toBeNull();
    expect(store.deleteGoal as jest.Mock).not.toHaveBeenCalled();

    cmp.requestDelete('goal-existing');
    await cmp.confirmDelete('goal-existing');
    expect(store.deleteGoal as jest.Mock).toHaveBeenCalledWith('goal-existing');
    expect(cmp.pendingDeleteId()).toBeNull();
    expect(cmp.statusMessage()).toContain('Emergency Fund');
  });

  it('renders the server-calculated funding directive for a goal', () => {
    setup();
    const fixture = TestBed.createComponent(GoalsPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Fund monthly');
    expect(fixture.nativeElement.textContent).toContain('$500.00');
    expect(fixture.nativeElement.textContent).toContain('Emergency savings');
    expect(fixture.nativeElement.textContent).toContain('15 months remaining');
  });
});
