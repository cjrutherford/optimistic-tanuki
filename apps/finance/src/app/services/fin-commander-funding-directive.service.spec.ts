import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Account, FinCommanderGoalEntity, RecurringItem } from '../../entities';
import { FinCommanderFundingDirectiveEntity } from '../../entities/fin-commander-funding-directive.entity';
import { FinCommanderFundingDirectiveService } from './fin-commander-funding-directive.service';
import { FinCommanderGoalService } from './fin-commander-goal.service';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn((value: string) => value) },
}));

describe('FinCommanderFundingDirectiveService', () => {
  let service: FinCommanderFundingDirectiveService;
  let directiveRepo: jest.Mocked<
    Repository<FinCommanderFundingDirectiveEntity>
  >;
  let goalRepo: jest.Mocked<Repository<FinCommanderGoalEntity>>;
  let recurringRepo: jest.Mocked<Repository<RecurringItem>>;

  const repo = () => ({
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    update: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinCommanderFundingDirectiveService,
        {
          provide: getRepositoryToken(FinCommanderFundingDirectiveEntity),
          useFactory: repo,
        },
        {
          provide: getRepositoryToken(FinCommanderGoalEntity),
          useFactory: repo,
        },
        { provide: getRepositoryToken(RecurringItem), useFactory: repo },
        {
          provide: FinCommanderGoalService,
          useValue: { getFundingApprovalPreview: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(FinCommanderFundingDirectiveService);
    directiveRepo = module.get(
      getRepositoryToken(FinCommanderFundingDirectiveEntity)
    );
    goalRepo = module.get(getRepositoryToken(FinCommanderGoalEntity));
    recurringRepo = module.get(getRepositoryToken(RecurringItem));
    (
      module.get(FinCommanderGoalService).getFundingApprovalPreview as jest.Mock
    ).mockResolvedValue({
      goalId: 'goal-1',
      amountCents: 200_000,
      cadence: 'monthly',
      startDate: '2026-09-01',
      fundingAccountId: 'account-1',
      fundingAccountName: 'Savings',
      effect: 'forecast-only; no transaction or account balance change',
    });
  });

  const scope = {
    tenantId: 'tenant-1',
    profileId: 'profile-1',
    userId: 'user-1',
    appScope: 'finance',
  };
  const goal = {
    id: 'goal-1',
    name: 'Emergency fund',
    targetAmountCents: 1_000_000,
    currentAmountCents: 0,
    dueDate: '2026-10-15',
    fundingAccountId: 'account-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    profileId: 'profile-1',
    appScope: 'finance',
  } as FinCommanderGoalEntity;

  it('rejects approval when the goal is outside the requested tenant', async () => {
    goalRepo.findOne.mockResolvedValue(null);

    await expect(service.approve('goal-1', scope)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(directiveRepo.save).not.toHaveBeenCalled();
    expect(recurringRepo.save).not.toHaveBeenCalled();
  });

  it('creates one forecast recurring instruction with deliberate cents-to-dollars conversion', async () => {
    goalRepo.findOne.mockResolvedValue(goal);
    directiveRepo.findOne.mockResolvedValue(null);
    recurringRepo.save.mockImplementation(
      async (value) => ({ id: 'recurring-1', ...value } as RecurringItem)
    );
    directiveRepo.save.mockImplementation(
      async (value) =>
        ({ id: 'directive-1', ...value } as FinCommanderFundingDirectiveEntity)
    );

    const result = await service.approve('goal-1', scope);

    expect(recurringRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2000,
        tenantId: 'tenant-1',
        accountId: 'account-1',
        type: 'goal-funding',
        status: 'scheduled',
        isActive: true,
      })
    );
    expect(directiveRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: 'goal-1',
        recurringItemId: 'recurring-1',
        amountCents: 200_000,
        status: 'approved',
        approvedByUserId: 'user-1',
        tenantId: 'tenant-1',
      })
    );
    expect(result).toMatchObject({
      id: 'directive-1',
      recurringItemId: 'recurring-1',
    });
  });

  it('returns the existing approval without creating a duplicate', async () => {
    goalRepo.findOne.mockResolvedValue(goal);
    const existing = {
      id: 'directive-1',
      goalId: 'goal-1',
      recurringItemId: 'recurring-1',
      status: 'approved',
    } as FinCommanderFundingDirectiveEntity;
    directiveRepo.findOne.mockResolvedValue(existing);

    await expect(service.approve('goal-1', scope)).resolves.toBe(existing);
    expect(recurringRepo.save).not.toHaveBeenCalled();
    expect(directiveRepo.save).not.toHaveBeenCalled();
  });

  it('cancels the directive and generated recurring item while preserving the directive row', async () => {
    goalRepo.findOne.mockResolvedValue(goal);
    const existing = {
      id: 'directive-1',
      goalId: 'goal-1',
      recurringItemId: 'recurring-1',
      status: 'approved',
      tenantId: 'tenant-1',
    } as FinCommanderFundingDirectiveEntity;
    directiveRepo.findOne.mockResolvedValue(existing);
    recurringRepo.findOne.mockResolvedValue({
      id: 'recurring-1',
      tenantId: 'tenant-1',
    } as RecurringItem);

    await service.cancel('goal-1', scope);

    expect(directiveRepo.update).toHaveBeenCalledWith(
      'directive-1',
      expect.objectContaining({
        status: 'cancelled',
        cancelledByUserId: 'user-1',
      })
    );
    expect(recurringRepo.update).toHaveBeenCalledWith('recurring-1', {
      isActive: false,
      status: 'cancelled',
    });
  });
});
