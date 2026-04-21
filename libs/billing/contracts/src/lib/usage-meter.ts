import { ScopedBillingRecord } from './billing-scope';

export interface UsageMeter extends ScopedBillingRecord {
  code: string;
  name: string;
  unit: string;
  includedQuantity: number;
  overageUnitPriceCents: number;
}

export interface InvoicePreviewMeter {
  id: string;
  name: string;
  unit: string;
  includedQuantity: number;
  overageUnitPriceCents: number;
}
