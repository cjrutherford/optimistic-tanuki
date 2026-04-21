import { BillingScope, ScopedBillingRecord } from './billing-scope';

export interface UsageBlockGrant extends ScopedBillingRecord {
  accountId: string;
  meterId: string;
  grantedQuantity: number;
  remainingQuantity: number;
  expiresAt?: Date | null;
}

export interface UsageBlockConsumption extends ScopedBillingRecord {
  grantId: string;
  meterId: string;
  quantity: number;
}

export interface GrantUsageBlockDto extends BillingScope {
  accountId: string;
  meterId: string;
  quantity: number;
  expiresAt?: Date | null;
}

export interface ConsumeUsageBlockDto extends BillingScope {
  accountId: string;
  meterId: string;
  quantity: number;
}
