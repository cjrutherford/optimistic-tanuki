import { ScopedBillingRecord } from './billing-scope';

export type BillingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled';

export interface BillingSubscription extends ScopedBillingRecord {
  accountId: string;
  planId: string;
  priceId: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}
