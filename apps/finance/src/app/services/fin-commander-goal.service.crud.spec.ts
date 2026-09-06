import { BadRequestException, NotFoundException } from '@nestjs/common';

import { FinCommanderGoalService } from './fin-commander-goal.service';
import { FinanceScope } from './finance-scope';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn((value: string) => `clean(${value})`) },
}));

/**
 * The spec beside this one covers the funding-directive arithmetic. These cover
 * the write paths: the cents guard that keeps money off floats, the funding
 * account check that stops a goal pointing at another tenant's account, and the
 * scoping on every read.
 */
interface RepoMock {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

describe('FinCommanderGoalService writes', () => {
  let goalRepo: RepoMock;
  let accountRepo: RepoMock;
  let service: FinCommanderGoalService;

  const scope: FinanceScope = { tenantId: 'tenant-1', appScope: 'finance' };
  const goal = { id: 'goal-1', name: 'clean(Reserve)' };
  const account = { id: 'account-1', name: 'Savings', balance: '100.00' };

  const makeRepo = (): RepoMock => ({
    create: jest.fn((input: unknown) => input),
    save: jest.fn(async (input: unknown) => input),
    find: jest.fn().mockResolvedValue([goal]),
    findOne: jest.fn().mockResolvedValue(goal),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  });

  beforeEach(() => {
    goalRepo = makeRepo();
    accountRepo = makeRepo();
    accountRepo.findOne.mockResolvedValue(account);
    service = new FinCommanderGoalService(
      goalRepo as never,
      accountRepo as never
    );
  });

  describe('create', () => {
    const baseGoal = {
      name: '<b>Reserve</b>',
      targetAmountCents: 500000,
      dueDate: '2027-01-01',
      tenantId: 'tenant-1',
    };

    it('sanitizes the name and defaults the current amount to zero', async () => {
      const saved = (await service.create(baseGoal as never)) as unknown as {
        name: string;
        currentAmountCents: number;
        strategy: string;
      };

      expect(saved.name).toBe('clean(<b>Reserve</b>)');
      expect(saved.currentAmountCents).toBe(0);
      expect(saved.strategy).toBe('');
    });

    it('sanitizes a supplied strategy', async () => {
      const saved = (await service.create({
        ...baseGoal,
        strategy: '<i>Sweep surplus</i>',
      } as never)) as unknown as { strategy: string };

      expect(saved.strategy).toBe('clean(<i>Sweep surplus</i>)');
    });

    it.each([
      ['a fractional target', { targetAmountCents: 1000.5 }],
      ['a negative target', { targetAmountCents: -1 }],
      ['a fractional current amount', { currentAmountCents: 12.34 }],
      ['a negative current amount', { currentAmountCents: -5 }],
    ])('rejects %s', async (_case, overrides) => {
      // Money is integer cents everywhere; a float here would silently drift.
      await expect(
        service.create({ ...baseGoal, ...overrides } as never)
      ).rejects.toThrow(BadRequestException);
      expect(goalRepo.save).not.toHaveBeenCalled();
    });

    it('checks the funding account belongs to the tenant and is active', async () => {
      await service.create({
        ...baseGoal,
        fundingAccountId: 'account-1',
      } as never);

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: 'account-1',
          tenantId: 'tenant-1',
          appScope: 'finance',
          isActive: true,
        },
      });
    });

    it('refuses a funding account the tenant cannot see', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ ...baseGoal, fundingAccountId: 'other' } as never)
      ).rejects.toThrow('Funding account not found');
      expect(goalRepo.save).not.toHaveBeenCalled();
    });

    it('skips the account check when no funding account is named', async () => {
      await service.create(baseGoal as never);

      expect(accountRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('reads', () => {
    it('applies the scope to the list query', async () => {
      await expect(service.findAll(scope)).resolves.toEqual([goal]);

      expect(goalRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', appScope: 'finance' },
      });
    });

    it('constrains a single lookup by both id and scope', async () => {
      await service.findOne('goal-1', scope);

      expect(goalRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'goal-1', tenantId: 'tenant-1', appScope: 'finance' },
      });
    });
  });

  describe('update', () => {
    it('sanitizes the name and passes the amounts through the cents guard', async () => {
      await service.update(
        'goal-1',
        {
          name: '<b>Reserve v2</b>',
          targetAmountCents: 600000,
          currentAmountCents: 1000,
          dueDate: '2028-01-01',
        } as never,
        scope
      );

      expect(goalRepo.update).toHaveBeenCalledWith('goal-1', {
        name: 'clean(<b>Reserve v2</b>)',
        targetAmountCents: 600000,
        currentAmountCents: 1000,
        dueDate: '2028-01-01',
      });
    });

    it.each([
      ['target', { targetAmountCents: 0.5 }],
      ['current', { currentAmountCents: -2 }],
    ])('rejects a bad %s amount without writing', async (_case, overrides) => {
      await expect(
        service.update('goal-1', overrides as never, scope)
      ).rejects.toThrow(BadRequestException);
      expect(goalRepo.update).not.toHaveBeenCalled();
    });

    it('sanitizes a replacement strategy', async () => {
      await service.update(
        'goal-1',
        { strategy: '<i>New plan</i>' } as never,
        scope
      );

      expect(goalRepo.update).toHaveBeenCalledWith('goal-1', {
        strategy: 'clean(<i>New plan</i>)',
      });
    });

    it('re-checks a replacement funding account', async () => {
      await service.update(
        'goal-1',
        { fundingAccountId: 'account-2' } as never,
        scope
      );

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: 'account-2',
          tenantId: 'tenant-1',
          appScope: 'finance',
          isActive: true,
        },
      });
      expect(goalRepo.update).toHaveBeenCalledWith('goal-1', {
        fundingAccountId: 'account-2',
      });
    });

    it('allows the funding account to be detached', async () => {
      // null is a deliberate clear and skips the lookup entirely.
      await service.update(
        'goal-1',
        { fundingAccountId: null } as never,
        scope
      );

      expect(accountRepo.findOne).not.toHaveBeenCalled();
      expect(goalRepo.update).toHaveBeenCalledWith('goal-1', {
        fundingAccountId: null,
      });
    });

    it('refuses to update a goal outside the scope', async () => {
      goalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('goal-1', { name: 'Hijack' } as never, scope)
      ).rejects.toThrow('Goal with ID goal-1 not found');
      expect(goalRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('funding directive without a usable account', () => {
    const unfunded = {
      id: 'goal-1',
      name: 'Reserve',
      fundingAccountId: null,
      targetAmountCents: 500000,
      dueDate: '2027-01-01',
    };

    it('has no directive when the goal names no funding account', async () => {
      await expect(
        service.getFundingDirective(unfunded as never, scope)
      ).resolves.toBeNull();
      expect(accountRepo.findOne).not.toHaveBeenCalled();
    });

    it('has no directive when the named account is gone or inactive', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getFundingDirective(
          { ...unfunded, fundingAccountId: 'account-1' } as never,
          scope
        )
      ).resolves.toBeNull();
    });

    it('has no approval preview without a directive to approve', async () => {
      await expect(
        service.getFundingApprovalPreview(unfunded as never, scope)
      ).resolves.toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes a goal inside the scope', async () => {
      await expect(service.remove('goal-1', scope)).resolves.toBeUndefined();

      expect(goalRepo.delete).toHaveBeenCalledWith('goal-1');
    });

    it('refuses to delete a goal outside the scope', async () => {
      goalRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('goal-1', scope)).rejects.toThrow(
        NotFoundException
      );
      expect(goalRepo.delete).not.toHaveBeenCalled();
    });
  });
});
