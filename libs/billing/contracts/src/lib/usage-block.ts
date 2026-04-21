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
  occurredAt?: Date;
}

export interface GrantUsageBlockResult {
  grant: UsageBlockGrant;
}

export interface ConsumeUsageBlockResult {
  requestedQuantity: number;
  consumedQuantity: number;
  unfilledQuantity: number;
  consumptions: UsageBlockConsumption[];
}
