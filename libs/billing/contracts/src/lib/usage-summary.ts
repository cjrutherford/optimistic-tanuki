import { BillingScope } from './billing-scope';

export interface UsageSummary extends BillingScope {
  meterId: string;
  periodStart: Date;
  periodEnd: Date;
  quantity: number;
}
