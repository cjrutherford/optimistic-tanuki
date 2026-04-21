import { ScopedBillingRecord } from './billing-scope';

export type BillingAccountStatus = 'active' | 'suspended' | 'closed';

export interface BillingAccount extends ScopedBillingRecord {
  profileId?: string;
  name: string;
  status: BillingAccountStatus;
}

export interface CreateBillingAccountDto {
  tenantId: string;
  appScope: string;
  profileId?: string;
  name: string;
}
