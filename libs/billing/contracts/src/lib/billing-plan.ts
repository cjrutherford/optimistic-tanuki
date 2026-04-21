import { ScopedBillingRecord } from './billing-scope';

export type BillingPlanStatus = 'draft' | 'active' | 'archived';

export interface BillingPlan extends ScopedBillingRecord {
  code: string;
  name: string;
  description?: string;
  status: BillingPlanStatus;
}
