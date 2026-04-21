import { BillingScope, ScopedBillingRecord } from './billing-scope';

export interface UsageEvent extends ScopedBillingRecord {
  meterId: string;
  eventKey: string;
  quantity: number;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

export interface RecordUsageDto extends BillingScope {
  meterId: string;
  eventKey: string;
  quantity: number;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}
