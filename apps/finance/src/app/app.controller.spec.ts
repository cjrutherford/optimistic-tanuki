import { RpcException } from '@nestjs/microservices';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((value: string) => value),
  },
}));

import { AppController } from './app.controller';
import { AccountService } from './services/account.service';
import { TransactionService } from './services/transaction.service';
import { InventoryItemService } from './services/inventory-item.service';
import { BudgetService } from './services/budget.service';
import { FinanceSummaryService } from './services/finance-summary.service';
import { RecurringItemService } from './services/recurring-item.service';
import { FinanceTenantService } from './services/finance-tenant.service';
import { BankConnectionService } from './services/bank-connection.service';
import { FinancialUtilitiesService } from './services/financial-utilities.service';
import { FinCommanderPlanService } from './services/fin-commander-plan.service';
import { FinCommanderGoalService } from './services/fin-commander-goal.service';
import { FinCommanderScenarioService } from './services/fin-commander-scenario.service';

describe('AppController (tenant isolation)', () => {
  let controller: AppController;

  let accountService: jest.Mocked<
    Pick<AccountService, 'create' | 'findOne' | 'findAll' | 'update' | 'remove'>
  >;
  let financeTenantService: jest.Mocked<
    Pick<FinanceTenantService, 'assertTenantAccess' | 'getCurrentTenant'>
  >;
  let finCommanderPlanService: jest.Mocked<
    Pick<FinCommanderPlanService, 'create' | 'findOne' | 'findAll'>
  >;
  let bankConnectionService: jest.Mocked<
    Pick<
      BankConnectionService,
      'exchangePublicToken' | 'createConnection' | 'createLinkToken'
    >
  >;

  const accessDenied = () =>
    new RpcException({
      statusCode: 404,
      message: 'Finance tenant not found or access denied',
      error: 'Not Found',
    });

  beforeEach(() => {
    accountService = {
      create: jest.fn().mockResolvedValue({ id: 'account-1' }),
      findOne: jest.fn().mockResolvedValue({ id: 'account-1' }),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'account-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    financeTenantService = {
      assertTenantAccess: jest.fn().mockResolvedValue(undefined),
      getCurrentTenant: jest.fn().mockResolvedValue({ id: 'default-tenant' }),
    };
    finCommanderPlanService = {
      create: jest.fn().mockResolvedValue({ id: 'plan-1' }),
      findOne: jest.fn().mockResolvedValue({ id: 'plan-1' }),
      findAll: jest.fn().mockResolvedValue([]),
    };
    bankConnectionService = {
      exchangePublicToken: jest.fn().mockResolvedValue({ id: 'connection-1' }),
      createConnection: jest.fn().mockResolvedValue({ id: 'connection-1' }),
      createLinkToken: jest.fn().mockResolvedValue({ linkToken: 'link-1' }),
    };

    controller = new AppController(
      accountService as unknown as AccountService,
      {} as TransactionService,
      {} as InventoryItemService,
      {} as BudgetService,
      {} as FinanceSummaryService,
      {} as RecurringItemService,
      financeTenantService as unknown as FinanceTenantService,
      bankConnectionService as unknown as BankConnectionService,
      {} as FinancialUtilitiesService,
      finCommanderPlanService as unknown as FinCommanderPlanService,
      {} as FinCommanderGoalService,
      {} as FinCommanderScenarioService
    );
  });

  describe('reads (resolveScope chokepoint)', () => {
    it('rejects a foreign tenantId and never calls the underlying service', async () => {
      financeTenantService.assertTenantAccess.mockRejectedValue(accessDenied());

      await expect(
        controller.findOneAccount({
          id: 'account-1',
          userId: 'user-1',
          profileId: 'caller-profile',
          tenantId: 'foreign-tenant',
        })
      ).rejects.toBeInstanceOf(RpcException);

      expect(financeTenantService.assertTenantAccess).toHaveBeenCalledWith(
        'caller-profile',
        'foreign-tenant'
      );
      expect(accountService.findOne).not.toHaveBeenCalled();
    });

    it('passes through with scope intact for an owned/member tenantId', async () => {
      const result = await controller.findOneAccount({
        id: 'account-1',
        userId: 'user-1',
        profileId: 'caller-profile',
        tenantId: 'own-tenant',
      });

      expect(financeTenantService.assertTenantAccess).toHaveBeenCalledWith(
        'caller-profile',
        'own-tenant'
      );
      expect(accountService.findOne).toHaveBeenCalledWith('account-1', {
        userId: 'user-1',
        profileId: 'caller-profile',
        tenantId: 'own-tenant',
        appScope: undefined,
      });
      expect(result).toEqual({ id: 'account-1' });
    });

    it('skips the membership lookup entirely for internal calls without profileId', async () => {
      await controller.findOneAccount({
        id: 'account-1',
        tenantId: 'some-tenant',
      } as never);

      expect(financeTenantService.assertTenantAccess).not.toHaveBeenCalled();
      expect(accountService.findOne).toHaveBeenCalledWith('account-1', {
        tenantId: 'some-tenant',
        userId: undefined,
        profileId: undefined,
        appScope: undefined,
      });
    });

    it('rejects a foreign tenantId on the fin-commander plan read path', async () => {
      financeTenantService.assertTenantAccess.mockRejectedValue(accessDenied());

      await expect(
        controller.findOneFinCommanderPlan({
          id: 'plan-1',
          userId: 'user-1',
          profileId: 'caller-profile',
          tenantId: 'foreign-tenant',
        })
      ).rejects.toBeInstanceOf(RpcException);

      expect(finCommanderPlanService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('creates (withResolvedTenant chokepoint)', () => {
    it('rejects a create for a foreign tenantId — the cross-tenant write hole', async () => {
      financeTenantService.assertTenantAccess.mockRejectedValue(accessDenied());

      await expect(
        controller.createAccount({
          userId: 'user-1',
          profileId: 'caller-profile',
          tenantId: 'foreign-tenant',
          name: 'Sneaky account',
        } as never)
      ).rejects.toBeInstanceOf(RpcException);

      expect(financeTenantService.assertTenantAccess).toHaveBeenCalledWith(
        'caller-profile',
        'foreign-tenant'
      );
      expect(accountService.create).not.toHaveBeenCalled();
    });

    it('allows a create for the caller own/member tenantId', async () => {
      const payload = {
        userId: 'user-1',
        profileId: 'caller-profile',
        tenantId: 'own-tenant',
        name: 'My account',
      };

      await controller.createAccount(payload as never);

      expect(financeTenantService.assertTenantAccess).toHaveBeenCalledWith(
        'caller-profile',
        'own-tenant'
      );
      expect(accountService.create).toHaveBeenCalledWith(payload);
    });

    it('rejects a fin-commander plan create for a foreign tenantId', async () => {
      financeTenantService.assertTenantAccess.mockRejectedValue(accessDenied());

      await expect(
        controller.createFinCommanderPlan({
          userId: 'user-1',
          profileId: 'caller-profile',
          tenantId: 'foreign-tenant',
        } as never)
      ).rejects.toBeInstanceOf(RpcException);

      expect(finCommanderPlanService.create).not.toHaveBeenCalled();
    });

    it('leaves internal creates without profileId unscoped-trusted (no membership lookup)', async () => {
      const payload = { tenantId: 'some-tenant', name: 'Seed account' };

      await controller.createAccount(payload as never);

      expect(financeTenantService.assertTenantAccess).not.toHaveBeenCalled();
      expect(accountService.create).toHaveBeenCalledWith(payload);
    });

    it('resolves the current tenant when no tenantId is supplied at all', async () => {
      const payload = { userId: 'user-1', profileId: 'caller-profile' };

      await controller.createAccount(payload as never);

      expect(financeTenantService.assertTenantAccess).not.toHaveBeenCalled();
      expect(financeTenantService.getCurrentTenant).toHaveBeenCalledWith({
        userId: 'user-1',
        profileId: 'caller-profile',
        tenantId: undefined,
        appScope: undefined,
      });
      expect(accountService.create).toHaveBeenCalledWith({
        ...payload,
        tenantId: 'default-tenant',
      });
    });
  });

  describe('bank-connection handlers (previously bypassed the chokepoint)', () => {
    it('rejects exchangePublicToken for a foreign tenantId — the cross-tenant bank-write hole', async () => {
      financeTenantService.assertTenantAccess.mockRejectedValue(accessDenied());

      await expect(
        controller.exchangePublicToken({
          userId: 'user-1',
          profileId: 'caller-profile',
          tenantId: 'foreign-tenant',
          provider: 'plaid',
          publicToken: 'public-token',
        } as never)
      ).rejects.toBeInstanceOf(RpcException);

      expect(financeTenantService.assertTenantAccess).toHaveBeenCalledWith(
        'caller-profile',
        'foreign-tenant'
      );
      expect(bankConnectionService.exchangePublicToken).not.toHaveBeenCalled();
    });

    it('passes exchangePublicToken through with the validated tenant for an owned/member tenantId', async () => {
      const payload = {
        userId: 'user-1',
        profileId: 'caller-profile',
        tenantId: 'own-tenant',
        provider: 'plaid',
        publicToken: 'public-token',
      };

      await controller.exchangePublicToken(payload as never);

      expect(financeTenantService.assertTenantAccess).toHaveBeenCalledWith(
        'caller-profile',
        'own-tenant'
      );
      expect(bankConnectionService.exchangePublicToken).toHaveBeenCalledWith(
        payload
      );
    });

    it('leaves an internal exchangePublicToken call without profileId unscoped-trusted', async () => {
      const payload = {
        tenantId: 'some-tenant',
        provider: 'plaid',
        publicToken: 'public-token',
      };

      await controller.exchangePublicToken(payload as never);

      expect(financeTenantService.assertTenantAccess).not.toHaveBeenCalled();
      expect(bankConnectionService.exchangePublicToken).toHaveBeenCalledWith(
        payload
      );
    });

    it('rejects createBankConnection for a foreign tenantId', async () => {
      financeTenantService.assertTenantAccess.mockRejectedValue(accessDenied());

      await expect(
        controller.createBankConnection({
          userId: 'user-1',
          profileId: 'caller-profile',
          tenantId: 'foreign-tenant',
          appScope: 'finance',
          provider: 'plaid',
          itemId: 'item-1',
          accessToken: 'access-token',
          status: 'healthy',
          accounts: [],
        } as never)
      ).rejects.toBeInstanceOf(RpcException);

      expect(financeTenantService.assertTenantAccess).toHaveBeenCalledWith(
        'caller-profile',
        'foreign-tenant'
      );
      expect(bankConnectionService.createConnection).not.toHaveBeenCalled();
    });

    it('passes createBankConnection through with the validated tenant for an owned/member tenantId', async () => {
      const payload = {
        userId: 'user-1',
        profileId: 'caller-profile',
        tenantId: 'own-tenant',
        appScope: 'finance',
        provider: 'plaid',
        itemId: 'item-1',
        accessToken: 'access-token',
        status: 'healthy',
        accounts: [],
      };

      await controller.createBankConnection(payload as never);

      expect(financeTenantService.assertTenantAccess).toHaveBeenCalledWith(
        'caller-profile',
        'own-tenant'
      );
      expect(bankConnectionService.createConnection).toHaveBeenCalledWith(
        payload
      );
    });

    it('leaves an internal createBankConnection call without profileId unscoped-trusted', async () => {
      const payload = {
        tenantId: 'some-tenant',
        appScope: 'finance',
        provider: 'plaid',
        itemId: 'item-1',
        accessToken: 'access-token',
        status: 'healthy',
        accounts: [],
      };

      await controller.createBankConnection(payload as never);

      expect(financeTenantService.assertTenantAccess).not.toHaveBeenCalled();
      expect(bankConnectionService.createConnection).toHaveBeenCalledWith(
        payload
      );
    });

    it('rejects createBankLinkToken for a foreign tenantId', async () => {
      financeTenantService.assertTenantAccess.mockRejectedValue(accessDenied());

      await expect(
        controller.createBankLinkToken({
          userId: 'user-1',
          profileId: 'caller-profile',
          tenantId: 'foreign-tenant',
          provider: 'plaid',
        } as never)
      ).rejects.toBeInstanceOf(RpcException);

      expect(financeTenantService.assertTenantAccess).toHaveBeenCalledWith(
        'caller-profile',
        'foreign-tenant'
      );
      expect(bankConnectionService.createLinkToken).not.toHaveBeenCalled();
    });

    it('passes createBankLinkToken through for an owned/member tenantId', async () => {
      const payload = {
        userId: 'user-1',
        profileId: 'caller-profile',
        tenantId: 'own-tenant',
        provider: 'plaid',
      };

      await controller.createBankLinkToken(payload as never);

      expect(financeTenantService.assertTenantAccess).toHaveBeenCalledWith(
        'caller-profile',
        'own-tenant'
      );
      expect(bankConnectionService.createLinkToken).toHaveBeenCalledWith(
        payload
      );
    });
  });
});
