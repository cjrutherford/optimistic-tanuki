import { ScopedBillingRecord } from './billing-scope';

export interface Entitlement extends ScopedBillingRecord {
  accountId: string;
  key: string;
  value: string | number | boolean;
  expiresAt?: Date | null;
}
