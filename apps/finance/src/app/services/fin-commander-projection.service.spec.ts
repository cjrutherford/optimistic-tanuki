import { FinCommanderProjectionService } from './fin-commander-projection.service';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn((value: string) => value) },
}));

describe('FinCommanderProjectionService', () => {
  it('projects recurring income, expenses, and monthly goal funding from scoped ledger inputs', async () => {
    const service = new FinCommanderProjectionService(
      {
        assertAccess: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue({ defaultWorkspace: 'personal' }),
      } as never,
      {
        findAll: jest
          .fn()
          .mockResolvedValue([
            { balance: 1000, isActive: true, workspace: 'personal' },
          ]),
      } as never,
      {
        findAll: jest.fn().mockResolvedValue([
          {
            id: 'income',
            name: 'Salary',
            amount: 2000,
            type: 'credit',
            cadence: 'monthly',
            nextDueDate: '2026-08-15',
            isActive: true,
            workspace: 'personal',
          },
          {
            id: 'rent',
            name: 'Rent',
            amount: 750,
            type: 'debit',
            cadence: 'monthly',
            nextDueDate: '2026-08-20',
            isActive: true,
            workspace: 'personal',
          },
        ]),
      } as never,
      {
        findAll: jest
          .fn()
          .mockResolvedValue([
            { id: 'goal', name: 'Reserve', fundingAccountId: 'account-1' },
          ]),
        getFundingDirective: jest
          .fn()
          .mockResolvedValue({ requiredMonthlyContributionCents: 10000 }),
      } as never
    );

    await expect(
      service.getProjection(
        'plan-1',
        { tenantId: 'tenant-1', appScope: 'finance' },
        new Date('2026-08-12T12:00:00.000Z')
      )
    ).resolves.toMatchObject({
      openingBalanceCents: 100000,
      projectedBalanceCents: 445000,
      horizonDays: 90,
      events: expect.arrayContaining([
        expect.objectContaining({
          date: '2026-08-15',
          amountCents: 200000,
          kind: 'recurring-income',
        }),
        expect.objectContaining({
          date: '2026-08-20',
          amountCents: -75000,
          kind: 'recurring-expense',
        }),
        expect.objectContaining({
          date: '2026-09-01',
          amountCents: -10000,
          kind: 'goal-funding',
        }),
      ]),
    });
  });
});
