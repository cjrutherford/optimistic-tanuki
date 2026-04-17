import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { FinanceController } from './finance.controller';
import {
  ServiceTokens,
  AccountCommands,
  FinanceSummaryCommands,
  FinanceTenantCommands,
  FinanceBankingCommands,
} from '@optimistic-tanuki/constants';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';

describe('FinanceController', () => {
  let controller: FinanceController;
  const financeClient = {
    send: jest.fn(),
  };
  const reflector = new Reflector();

  beforeEach(async () => {
    financeClient.send.mockReset();
    controller = new FinanceController(financeClient as any);
  });

  it('scopes account lookups to the authenticated user context', async () => {
    financeClient.send.mockReturnValue(of({ id: 'account-1' }));

    await (controller as any).getAccount(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'account-1',
      'finance'
    );

    expect(financeClient.send).toHaveBeenCalledWith(
      { cmd: AccountCommands.FIND },
      {
        id: 'account-1',
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      }
    );
  });

  it('requests a workspace summary using the authenticated user context', async () => {
    financeClient.send.mockReturnValue(of({ workspace: 'business' }));

    await (controller as any).getSummary(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'business',
      'finance'
    );

    expect(financeClient.send).toHaveBeenCalledWith(
      { cmd: FinanceSummaryCommands.GET_WORKSPACE_SUMMARY },
      {
        workspace: 'business',
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      }
    );
  });

  it('requests the workspace work queue using the authenticated user context', async () => {
    financeClient.send.mockReturnValue(
      of({ workspace: 'business', items: [] })
    );

    await (controller as any).getWorkQueue(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'business',
      'finance'
    );

    expect(financeClient.send).toHaveBeenCalledWith(
      { cmd: FinanceSummaryCommands.GET_WORK_QUEUE },
      {
        workspace: 'business',
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      }
    );
  });

  it('declares the full finance permission catalog required by the gateway contract', () => {
    const expectedPermissions = [
      'finance.account.create',
      'finance.account.read',
      'finance.account.update',
      'finance.account.delete',
      'finance.transaction.create',
      'finance.transaction.read',
      'finance.transaction.update',
      'finance.transaction.delete',
      'finance.inventory.create',
      'finance.inventory.read',
      'finance.inventory.update',
      'finance.inventory.delete',
      'finance.budget.create',
      'finance.budget.read',
      'finance.budget.update',
      'finance.budget.delete',
      'finance.recurring.create',
      'finance.recurring.read',
      'finance.recurring.update',
      'finance.recurring.delete',
      'finance.summary.read',
      'finance.onboarding.manage',
      'finance.tenant.manage',
      'finance.member.manage',
      'finance.bank.manage',
    ];

    const permissionMetadata = Object.getOwnPropertyNames(
      FinanceController.prototype
    )
      .flatMap((property) => {
        const handler =
          FinanceController.prototype[property as keyof FinanceController];
        const requirement = reflector.get(PERMISSIONS_KEY, handler);
        return requirement?.permissions ?? [];
      })
      .filter(Boolean);

    expectedPermissions.forEach((permission) => {
      expect(permissionMetadata).toContain(permission);
    });
  });

  it('protects finance read and onboarding handlers with explicit permission metadata', () => {
    const getAllAccountsPermissions = reflector.get(
      PERMISSIONS_KEY,
      FinanceController.prototype.getAllAccounts
    );
    const getAllTransactionsPermissions = reflector.get(
      PERMISSIONS_KEY,
      FinanceController.prototype.getAllTransactions
    );
    const getSummaryPermissions = reflector.get(
      PERMISSIONS_KEY,
      FinanceController.prototype.getSummary
    );
    const bootstrapPermissions = reflector.get(
      PERMISSIONS_KEY,
      FinanceController.prototype.bootstrapWorkspaces
    );

    expect(getAllAccountsPermissions?.permissions).toEqual([
      'finance.account.read',
    ]);
    expect(getAllTransactionsPermissions?.permissions).toEqual([
      'finance.transaction.read',
    ]);
    expect(getSummaryPermissions?.permissions).toEqual([
      'finance.summary.read',
    ]);
    expect(bootstrapPermissions?.permissions).toEqual([
      'finance.onboarding.manage',
    ]);
  });

  it('routes tenant and member administration through the finance service scope', async () => {
    financeClient.send.mockReturnValue(of({ id: 'tenant-1' }));

    await (controller as any).listTenants(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'finance'
    );
    await (controller as any).getCurrentTenant(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'finance'
    );
    await (controller as any).listTenantMembers(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'finance'
    );

    expect(financeClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: FinanceTenantCommands.LIST_TENANTS },
      {
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      }
    );
    expect(financeClient.send).toHaveBeenNthCalledWith(
      2,
      { cmd: FinanceTenantCommands.GET_CURRENT_TENANT },
      {
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      }
    );
    expect(financeClient.send).toHaveBeenNthCalledWith(
      3,
      { cmd: FinanceTenantCommands.LIST_TENANT_MEMBERS },
      {
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      }
    );
  });

  it('routes bank connection commands through the authenticated finance scope', async () => {
    financeClient.send.mockReturnValue(of({ id: 'connection-1' }));

    await (controller as any).createBankLinkToken(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'finance',
      'tenant-1',
      { provider: 'plaid' }
    );
    await (controller as any).listBankConnections(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'finance',
      'tenant-1'
    );
    await (controller as any).syncBankConnection(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'connection-1',
      'finance',
      'tenant-1'
    );

    expect(financeClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: FinanceBankingCommands.CREATE_LINK_TOKEN },
      expect.objectContaining({
        provider: 'plaid',
        userId: 'user-1',
        tenantId: 'tenant-1',
      })
    );
    expect(financeClient.send).toHaveBeenNthCalledWith(
      2,
      { cmd: FinanceBankingCommands.LIST_CONNECTIONS },
      {
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      }
    );
    expect(financeClient.send).toHaveBeenNthCalledWith(
      3,
      { cmd: FinanceBankingCommands.SYNC_CONNECTION },
      {
        connectionId: 'connection-1',
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      }
    );
  });

  it('creates a finance tenant with scoped account details', async () => {
    financeClient.send.mockReturnValue(of({ id: 'tenant-1' }));

    await (controller as any).createTenant(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'finance',
      {
        name: 'Household',
        type: 'household',
      }
    );

    expect(financeClient.send).toHaveBeenCalledWith(
      { cmd: FinanceTenantCommands.CREATE_TENANT },
      {
        name: 'Household',
        type: 'household',
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      }
    );
  });
});
