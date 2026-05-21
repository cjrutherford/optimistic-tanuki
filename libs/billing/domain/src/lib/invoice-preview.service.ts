import {
  InvoiceLine,
  InvoicePreview,
  InvoicePreviewInput,
} from '@optimistic-tanuki/billing-contracts';
import { assertBillingScope } from './billing-scope';

export class InvoicePreviewService {
  preview(input: InvoicePreviewInput): InvoicePreview {
    const scope = assertBillingScope(input);
    const includedQuantity = Math.min(
      input.usageQuantity,
      input.meter.includedQuantity,
    );
    const remainingAfterIncluded = Math.max(
      input.usageQuantity - includedQuantity,
      0,
    );
    const usageBlockQuantity = Math.min(
      remainingAfterIncluded,
      input.usageBlockBalance,
    );
    const overageQuantity = Math.max(
      remainingAfterIncluded - usageBlockQuantity,
      0,
    );

    const lines: InvoiceLine[] = [
      {
        kind: 'subscription',
        description: 'Subscription',
        quantity: 1,
        unitPriceCents: input.subscriptionPriceCents,
        amountCents: input.subscriptionPriceCents,
      },
      {
        kind: 'included-usage',
        description: `Included ${input.meter.name}`,
        quantity: includedQuantity,
        unitPriceCents: 0,
        amountCents: 0,
      },
    ];

    if (usageBlockQuantity > 0) {
      lines.push({
        kind: 'usage-block',
        description: `Prepaid ${input.meter.name}`,
        quantity: usageBlockQuantity,
        unitPriceCents: 0,
        amountCents: 0,
      });
    }

    if (overageQuantity > 0) {
      lines.push({
        kind: 'overage',
        description: `Overage ${input.meter.name}`,
        quantity: overageQuantity,
        unitPriceCents: input.meter.overageUnitPriceCents,
        amountCents: overageQuantity * input.meter.overageUnitPriceCents,
      });
    }

    return {
      ...scope,
      currency: input.currency,
      subtotalCents: lines.reduce((total, line) => total + line.amountCents, 0),
      lines,
    };
  }
}
