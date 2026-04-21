import { InvoicePreviewService } from './invoice-preview.service';

describe('InvoicePreviewService', () => {
  it('applies included usage, usage blocks, and overage in a deterministic preview', () => {
    const service = new InvoicePreviewService();

    const preview = service.preview({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      currency: 'USD',
      subscriptionPriceCents: 2000,
      meter: {
        id: 'api-calls',
        name: 'API calls',
        unit: 'call',
        includedQuantity: 100,
        overageUnitPriceCents: 5,
      },
      usageQuantity: 175,
      usageBlockBalance: 25,
    });

    expect(preview).toEqual({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      currency: 'USD',
      subtotalCents: 2250,
      lines: [
        {
          kind: 'subscription',
          description: 'Subscription',
          quantity: 1,
          unitPriceCents: 2000,
          amountCents: 2000,
        },
        {
          kind: 'included-usage',
          description: 'Included API calls',
          quantity: 100,
          unitPriceCents: 0,
          amountCents: 0,
        },
        {
          kind: 'usage-block',
          description: 'Prepaid API calls',
          quantity: 25,
          unitPriceCents: 0,
          amountCents: 0,
        },
        {
          kind: 'overage',
          description: 'Overage API calls',
          quantity: 50,
          unitPriceCents: 5,
          amountCents: 250,
        },
      ],
    });
  });

  it('does not add overage when included usage and blocks cover consumption', () => {
    const service = new InvoicePreviewService();

    const preview = service.preview({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      currency: 'USD',
      subscriptionPriceCents: 2000,
      meter: {
        id: 'api-calls',
        name: 'API calls',
        unit: 'call',
        includedQuantity: 100,
        overageUnitPriceCents: 5,
      },
      usageQuantity: 110,
      usageBlockBalance: 25,
    });

    expect(preview.subtotalCents).toBe(2000);
    expect(preview.lines.map((line) => line.kind)).toEqual([
      'subscription',
      'included-usage',
      'usage-block',
    ]);
  });
});
