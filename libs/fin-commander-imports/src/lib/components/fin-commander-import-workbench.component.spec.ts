import { TestBed } from '@angular/core/testing';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { FinCommanderImportWorkbenchComponent } from './fin-commander-import-workbench.component';
import {
  FinCommanderImportPreview,
  FinCommanderImportRegistryService,
} from '../providers/fin-commander-import-registry.service';

const previewFixture: FinCommanderImportPreview = {
  providerId: 'csv',
  title: 'CSV Preview',
  warnings: [],
  transactions: [
    {
      postedOn: '2026-04-11',
      description: 'Coffee',
      type: 'debit',
      amountCents: 550,
      category: 'Food',
    } as never,
    {
      postedOn: '2026-04-12',
      description: 'Salary',
      type: 'credit',
      amountCents: 100000,
      category: 'Income',
    } as never,
  ],
};

function setup(financeOverrides?: Partial<FinanceService>) {
  const finance = {
    getAccounts: jest
      .fn()
      .mockResolvedValue([{ id: 'acct-1', name: 'Checking' }]),
    createTransaction: jest.fn().mockResolvedValue(undefined),
    ...financeOverrides,
  } as unknown as FinanceService;

  const registry = {
    manifests: [
      {
        id: 'csv',
        name: 'CSV',
        inputLabel: 'CSV',
      },
    ],
    loadProvider: jest.fn().mockResolvedValue({
      preview: jest.fn().mockResolvedValue(previewFixture),
    }),
  } as unknown as FinCommanderImportRegistryService;

  TestBed.configureTestingModule({
    imports: [FinCommanderImportWorkbenchComponent],
    providers: [
      { provide: FinanceService, useValue: finance },
      { provide: FinCommanderImportRegistryService, useValue: registry },
    ],
  });

  return { finance, registry };
}

describe('FinCommanderImportWorkbenchComponent', () => {
  it('requires confirmation between preview and commit', async () => {
    const { finance } = setup();
    const fixture = TestBed.createComponent(
      FinCommanderImportWorkbenchComponent
    );
    fixture.detectChanges();
    await fixture.componentInstance.ngOnInit();

    await fixture.componentInstance.previewImport();
    expect(fixture.componentInstance.preview()).not.toBeNull();
    expect(fixture.componentInstance.status()).toContain('2 transactions');
    expect(fixture.componentInstance.pendingCommit()).toBe(false);

    fixture.componentInstance.requestCommit();
    expect(fixture.componentInstance.pendingCommit()).toBe(true);
    expect(finance.createTransaction as jest.Mock).not.toHaveBeenCalled();

    fixture.componentInstance.cancelCommit();
    expect(fixture.componentInstance.pendingCommit()).toBe(false);

    fixture.componentInstance.requestCommit();
    await fixture.componentInstance.commitPreview();

    expect(finance.createTransaction as jest.Mock).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.preview()).toBeNull();
    expect(fixture.componentInstance.status()).toContain('Committed 2');
  });

  it('reports failures during commit without claiming success', async () => {
    const failingFinance = {
      getAccounts: jest
        .fn()
        .mockResolvedValue([{ id: 'acct-1', name: 'Checking' }]),
      createTransaction: jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(new Error('boom'))),
    } as unknown as FinanceService;
    setup(failingFinance);
    const fixture = TestBed.createComponent(
      FinCommanderImportWorkbenchComponent
    );
    fixture.detectChanges();
    await fixture.componentInstance.ngOnInit();

    await fixture.componentInstance.previewImport();
    fixture.componentInstance.requestCommit();
    await fixture.componentInstance.commitPreview();

    expect(fixture.componentInstance.status()).toContain('halted after 1 of 2');
    expect(fixture.componentInstance.preview()).not.toBeNull();
  });
});
