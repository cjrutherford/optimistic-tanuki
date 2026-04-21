import { BillingScope, ScopedBillingRecord } from './billing-scope';
import { InvoiceLine } from './invoice-line';
import { InvoicePreviewMeter } from './usage-meter';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

export interface Invoice extends ScopedBillingRecord {
  accountId: string;
  status: InvoiceStatus;
  currency: string;
  subtotalCents: number;
  lines: InvoiceLine[];
}

export interface InvoicePreviewInput extends BillingScope {
  currency: string;
  subscriptionPriceCents: number;
  meter: InvoicePreviewMeter;
  usageQuantity: number;
  usageBlockBalance: number;
}

export interface InvoicePreview extends BillingScope {
  currency: string;
  subtotalCents: number;
  lines: InvoiceLine[];
}
