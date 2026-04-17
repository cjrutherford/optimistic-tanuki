import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DashboardComponent } from './dashboard.component';
import { FinanceService } from '../services/finance.service';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]),
        {
          provide: FinanceService,
          useValue: {
            getWorkspaceSummary: jest.fn().mockResolvedValue({
              workspace: 'personal',
              headline: 'Personal cash flow and day-to-day spending',
              metrics: {
                accountCount: 0,
                budgetCount: 0,
                totalBalance: 0,
                netWorth: 0,
                monthlySpend: 0,
                assetValue: 0,
                liabilityValue: 0,
                budgetsAtRiskCount: 0,
                upcomingRecurringCount: 0,
              },
              coachCards: [],
            }),
            getWorkQueue: jest.fn().mockResolvedValue({
              workspace: 'personal',
              items: [],
            }),
            getTransactions: jest.fn().mockResolvedValue([]),
            getBudgets: jest.fn().mockResolvedValue([]),
            getRecurringItems: jest.fn().mockResolvedValue([]),
            getInventoryItems: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'personal',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows only the currently supported quick actions', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.quick-actions a')
    ) as HTMLAnchorElement[];
    const labels = links.map((link) => link.textContent?.trim());

    expect(labels).toEqual(['Accounts', 'Transactions']);
  });

  it('uses shared theme variables instead of hardcoded finance branding tokens', () => {
    const sourceText = readFileSync(join(__dirname, 'dashboard.component.ts'), 'utf8');

    expect(sourceText).toContain('var(--font-heading');
    expect(sourceText).toContain('var(--surface');
    expect(sourceText).not.toContain("font-family: Georgia, 'Times New Roman', serif");
    expect(sourceText).not.toContain('background: #22492d;');
    expect(sourceText).not.toContain('color: #55715a;');
  });
});
