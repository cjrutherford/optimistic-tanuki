import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BudgetPlannerComponent } from './budget-planner.component';
import { FinanceService } from '../services/finance.service';

describe('BudgetPlannerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetPlannerComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'workspace' ? 'personal' : null),
              },
            },
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getBudgets: jest.fn().mockResolvedValue([
              {
                id: 'budget-1',
                name: 'Groceries',
                category: 'Food',
                limit: 600,
                spent: 225,
                period: 'monthly',
                startDate: new Date('2026-06-01T00:00:00.000Z'),
                endDate: new Date('2026-06-30T00:00:00.000Z'),
                userId: 'user-1',
                profileId: 'profile-1',
                appScope: 'finance',
                createdAt: new Date('2026-06-01T00:00:00.000Z'),
                updatedAt: new Date('2026-06-01T00:00:00.000Z'),
                isActive: true,
                alertOnExceed: true,
                workspace: 'personal',
              },
            ]),
            getCategorySuggestions: jest.fn().mockResolvedValue(['Food']),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders budgets using the shared finance workspace grid pattern', async () => {
    const fixture = TestBed.createComponent(BudgetPlannerComponent);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Budgets');
    expect(text).toContain('Track targets and spend in one operating view');
    expect(fixture.nativeElement.querySelector('otui-ag-grid')).not.toBeNull();
  });
});
