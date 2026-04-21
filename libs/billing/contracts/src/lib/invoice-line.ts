export type InvoiceLineKind =
  | 'subscription'
  | 'included-usage'
  | 'usage-block'
  | 'overage';

export interface InvoiceLine {
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
}
