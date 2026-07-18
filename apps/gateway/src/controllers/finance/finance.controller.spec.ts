import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { throwError, of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { FinanceController } from './finance.controller';
import {
  ServiceTokens,
  AccountCommands,
  FinanceSummaryCommands,
  FinanceTenantCommands,
  FinanceBankingCommands,
  FinancialUtilitiesCommands,
  FinCommanderPlanCommands,
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
      'finance.invoice.create',
      'finance.invoice.read',
      'finance.invoice.update',
      'finance.invoice.pay',
      'finance.checkout.create',
      'finance.checkout.read',
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

  it('maps rpc not found errors for current tenant requests into http exceptions', async () => {
    financeClient.send.mockReturnValue(
      throwError(() => ({
        statusCode: 404,
        message: 'Active finance tenant not found',
      }))
    );

    await expect(
      (controller as any).getCurrentTenant(
        { userId: 'user-1', profileId: 'profile-1' } as any,
        'finance',
        null
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps rpc bad request errors into http exceptions', async () => {
    financeClient.send.mockReturnValue(
      throwError(() => ({ statusCode: 400, message: 'Invalid tenant scope' }))
    );

    await expect(
      (controller as any).getCurrentTenant(
        { userId: 'user-1', profileId: 'profile-1' } as any,
        'finance',
        null
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps unknown rpc failures into internal server errors', async () => {
    financeClient.send.mockReturnValue(
      throwError(() => new Error('finance service offline'))
    );

    await expect(
      (controller as any).getCurrentTenant(
        { userId: 'user-1', profileId: 'profile-1' } as any,
        'finance',
        null
      )
    ).rejects.toBeInstanceOf(InternalServerErrorException);
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

  it('routes invoice lifecycle commands through the authenticated tenant scope', async () => {
    financeClient.send.mockReturnValue(of({ id: 'invoice-1' }));

    await (controller as any).createInvoice(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'finance',
      'tenant-1',
      {
        customerName: 'Acme Bakery',
        lines: [{ description: 'Retainer', quantity: 1, unitAmount: 500 }],
      }
    );
    await (controller as any).recordInvoicePayment(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'invoice-1',
      'finance',
      'tenant-1',
      { amount: 500, accountId: 'account-1', method: 'card' }
    );

    expect(financeClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: FinancialUtilitiesCommands.CREATE_INVOICE },
      expect.objectContaining({
        customerName: 'Acme Bakery',
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      })
    );
    expect(financeClient.send).toHaveBeenNthCalledWith(
      2,
      { cmd: FinancialUtilitiesCommands.RECORD_INVOICE_PAYMENT },
      {
        id: 'invoice-1',
        data: { amount: 500, accountId: 'account-1', method: 'card' },
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      }
    );
  });

  it('routes checkout sessions through the authenticated tenant scope', async () => {
    financeClient.send.mockReturnValue(of({ id: 'checkout-1' }));

    await (controller as any).createCheckoutSession(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'finance',
      'tenant-1',
      {
        invoiceId: 'invoice-1',
        amount: 250,
        customerName: 'Acme Bakery',
      }
    );

    expect(financeClient.send).toHaveBeenCalledWith(
      { cmd: FinancialUtilitiesCommands.CREATE_CHECKOUT_SESSION },
      expect.objectContaining({
        invoiceId: 'invoice-1',
        amount: 250,
        customerName: 'Acme Bakery',
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      })
    );
  });

  it('forwards the server-derived profileId alongside the client-supplied tenant header on fin-commander plan creation', async () => {
    financeClient.send.mockReturnValue(of({ id: 'plan-1' }));

    await (controller as any).createFinCommanderPlan(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'finance',
      'tenant-1',
      { name: 'Runway plan' }
    );

    // The finance microservice is the authority on whether profile-1
    // actually belongs to tenant-1 (see finance-tenant.service.ts
    // assertTenantAccess) — the gateway's job is only to forward both
    // the authenticated profileId and the client-controlled tenant
    // header so the microservice chokepoint can verify membership.
    // A client cannot spoof profileId (it's derived from the auth
    // token), only tenantId, which is exactly the vector the
    // service-side check closes.
    expect(financeClient.send).toHaveBeenCalledWith(
      { cmd: FinCommanderPlanCommands.CREATE },
      expect.objectContaining({
        name: 'Runway plan',
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      })
    );
  });
});
