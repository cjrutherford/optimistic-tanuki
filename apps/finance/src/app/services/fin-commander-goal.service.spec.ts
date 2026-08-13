import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FinCommanderGoalService } from './fin-commander-goal.service';
import { Account, FinCommanderGoalEntity } from '../../entities';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn((value: string) => value) },
}));

describe('FinCommanderGoalService funded directives', () => {
  let service: FinCommanderGoalService;
  let accountRepo: jest.Mocked<Repository<Account>>;
  let goalRepo: jest.Mocked<Repository<FinCommanderGoalEntity>>;

  const goalRepoFactory = () => ({
    create: jest.fn((value) => value),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });
  const accountRepoFactory = () => ({ findOne: jest.fn() });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinCommanderGoalService,
        {
          provide: getRepositoryToken(FinCommanderGoalEntity),
          useFactory: goalRepoFactory,
        },
        {
          provide: getRepositoryToken(Account),
          useFactory: accountRepoFactory,
        },
      ],
    }).compile();

    service = module.get(FinCommanderGoalService);
    goalRepo = module.get(getRepositoryToken(FinCommanderGoalEntity));
    accountRepo = module.get(getRepositoryToken(Account));
  });

  it('rejects a funding account outside the active tenant', async () => {
    accountRepo.findOne.mockResolvedValue(null);

    await expect(
      service.create({
        planId: '6d25b998-4034-47ac-8b6c-f5635ef9d08c',
        name: 'Emergency fund',
        targetAmountCents: 1_000_000,
        dueDate: '2027-01-01',
        fundingAccountId: '37cb1c7e-9310-4273-8520-2f725df9cb6b',
        tenantId: 'b5b90314-cc1e-43ef-b3d7-5f29a4b4d8d3',
        appScope: 'finance',
        userId: 'user-1',
        profileId: 'profile-1',
      } as never)
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(accountRepo.findOne).toHaveBeenCalledWith({
      where: {
        id: '37cb1c7e-9310-4273-8520-2f725df9cb6b',
        tenantId: 'b5b90314-cc1e-43ef-b3d7-5f29a4b4d8d3',
        appScope: 'finance',
        isActive: true,
      },
    });
    expect(goalRepo.save).not.toHaveBeenCalled();
  });

  it('calculates a ceiling-rounded monthly contribution from the dedicated account balance', async () => {
    accountRepo.findOne.mockResolvedValue({
      id: '37cb1c7e-9310-4273-8520-2f725df9cb6b',
      name: 'Emergency savings',
      balance: 4000,
      currency: 'USD',
    } as Account);

    await expect(
      (service as any).getFundingDirective(
        {
          id: 'goal-1',
          targetAmountCents: 1_000_000,
          fundingAccountId: '37cb1c7e-9310-4273-8520-2f725df9cb6b',
          dueDate: '2026-10-15',
        },
        {
          tenantId: 'b5b90314-cc1e-43ef-b3d7-5f29a4b4d8d3',
          appScope: 'finance',
        },
        new Date('2026-08-12T12:00:00.000Z')
      )
    ).resolves.toEqual({
      fundingAccountId: '37cb1c7e-9310-4273-8520-2f725df9cb6b',
      fundingAccountName: 'Emergency savings',
      fundingAccountBalanceCents: 400_000,
      remainingAmountCents: 600_000,
      monthsRemaining: 3,
      requiredMonthlyContributionCents: 200_000,
      isOverdue: false,
    });
  });
});
