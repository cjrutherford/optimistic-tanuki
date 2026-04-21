import { ScopedBillingRecord } from './billing-scope';

export type BillingInterval = 'month' | 'year' | 'one_time';

export interface BillingPrice extends ScopedBillingRecord {
  planId: string;
  currency: string;
  amountCents: number;
  interval: BillingInterval;
}
