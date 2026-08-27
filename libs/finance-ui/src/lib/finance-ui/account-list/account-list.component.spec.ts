import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AccountListComponent } from './account-list.component';
import { FinanceService } from '../services/finance.service';

describe('AccountListComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountListComponent],
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
            getAccounts: jest.fn().mockResolvedValue([
              {
                id: 'acct-1',
                name: 'Checking',
                type: 'bank',
                balance: 2450,
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
            getBankConnections: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders accounts using the shared finance workspace grid pattern', async () => {
    const fixture = TestBed.createComponent(AccountListComponent);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Accounts');
    expect(text).toContain('Manage your ledger without leaving the workspace');
    expect(fixture.nativeElement.querySelector('otui-ag-grid')).not.toBeNull();
  });

  it('reserves enough fixed width for every account action', () => {
    const fixture = TestBed.createComponent(AccountListComponent);
    const actionsColumn = fixture.componentInstance.columnDefs.find(
      (column) => column.headerName === 'Actions'
    );

    expect(actionsColumn).toMatchObject({
      flex: 0,
      minWidth: 300,
      maxWidth: 300,
    });
  });
});
