import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { TransactionListComponent } from './transaction-list.component';
import { FinanceService } from '../services/finance.service';

describe('TransactionListComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionListComponent],
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
            getTransactions: jest.fn().mockResolvedValue([
              {
                id: 'txn-1',
                amount: 42,
                type: 'debit',
                category: 'Groceries',
                accountId: 'acct-1',
                transactionDate: new Date('2026-06-01T00:00:00.000Z'),
                createdAt: new Date('2026-06-01T00:00:00.000Z'),
                updatedAt: new Date('2026-06-01T00:00:00.000Z'),
                userId: 'user-1',
                profileId: 'profile-1',
                appScope: 'finance',
                isRecurring: false,
                workspace: 'personal',
                reviewStatus: 'needs-review',
                sourceType: 'manual',
                payeeOrVendor: 'Corner Market',
              },
            ]),
            getAccounts: jest.fn().mockResolvedValue([
              {
                id: 'acct-1',
                name: 'Checking',
                type: 'bank',
                balance: 1000,
                currency: 'USD',
                userId: 'user-1',
                profileId: 'profile-1',
                appScope: 'finance',
                createdAt: new Date('2026-06-01T00:00:00.000Z'),
                updatedAt: new Date('2026-06-01T00:00:00.000Z'),
                isActive: true,
                workspace: 'personal',
              },
            ]),
            getCategorySuggestions: jest.fn().mockResolvedValue(['Groceries']),
            updateTransaction: jest.fn().mockResolvedValue(undefined),
            createTransaction: jest.fn().mockResolvedValue(undefined),
            deleteTransaction: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the transaction workspace as an AG Grid screen with inline editing guidance', async () => {
    const fixture = TestBed.createComponent(TransactionListComponent);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Transactions');
    expect(text).toContain('Update rows directly in the ledger');
    expect(fixture.nativeElement.querySelector('otui-ag-grid')).not.toBeNull();
  });
});
