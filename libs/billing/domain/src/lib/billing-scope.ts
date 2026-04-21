import { BillingScope } from '@optimistic-tanuki/billing-contracts';

export type BillingScopeInput = Partial<BillingScope>;

export function assertBillingScope(input: BillingScopeInput): BillingScope {
  if (!input.tenantId) {
    throw new Error('Billing records require tenantId');
  }

  if (!input.appScope) {
    throw new Error('Billing records require appScope');
  }

  return {
    tenantId: input.tenantId,
    appScope: input.appScope,
  };
}
