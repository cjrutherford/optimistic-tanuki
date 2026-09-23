import { BadRequestException } from '@nestjs/common';
import { InvoicePreviewService } from '@optimistic-tanuki/billing-domain';
import {
  InMemoryUsageBlockRepository,
  InMemoryUsageEventRepository,
} from './in-memory-billing.repositories';
import { BillingService } from './billing.service';
import { UsageBlocksService } from './usage-blocks.service';
import { UsageMeteringService } from './usage-metering.service';

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(() => {
    const usageMeteringService = new UsageMeteringService(
      new InMemoryUsageEventRepository()
    );
    const usageBlocksService = new UsageBlocksService(
      new InMemoryUsageBlockRepository()
    );

    service = new BillingService(
      new InvoicePreviewService(),
      usageMeteringService,
      usageBlocksService,
      { mint: jest.fn(async () => ({ id: 'inv-1' })) } as never
    );
  });

  it('previews invoices from recorded usage and available block balance', async () => {
    await service.recordUsage({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      meterId: 'api-calls',
      eventKey: 'evt-1',
      quantity: 11,
      occurredAt: new Date('2026-04-10T00:00:00.000Z'),
    });
    await service.recordUsage({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      meterId: 'api-calls',
      eventKey: 'evt-2',
      quantity: 3,
      occurredAt: new Date('2026-04-11T00:00:00.000Z'),
    });
    await service.grantUsageBlock({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      accountId: 'acct-1',
      meterId: 'api-calls',
      quantity: 2,
    });

    await expect(
      service.previewInvoiceForPeriod({
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        accountId: 'acct-1',
        currency: 'USD',
        subscriptionPriceCents: 1000,
        meter: {
          id: 'api-calls',
          name: 'API calls',
          unit: 'call',
          includedQuantity: 10,
          overageUnitPriceCents: 10,
        },
        periodStart: new Date('2026-04-01T00:00:00.000Z'),
        periodEnd: new Date('2026-05-01T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      subtotalCents: 1020,
      lines: [
        { kind: 'subscription', amountCents: 1000 },
        { kind: 'included-usage', quantity: 10 },
        { kind: 'usage-block', quantity: 2 },
        { kind: 'overage', quantity: 2, amountCents: 20 },
      ],
    });
  });

  it('mints a draft invoice row on preview and returns its id (E5)', async () => {
    const mint = jest.fn(async () => ({ id: 'inv-9' }));
    const minting = new BillingService(
      new InvoicePreviewService(),
      new UsageMeteringService(new InMemoryUsageEventRepository()),
      new UsageBlocksService(new InMemoryUsageBlockRepository()),
      { mint } as never
    );

    const preview = await minting.previewInvoice({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      currency: 'USD',
      subscriptionPriceCents: 1000,
      meter: {
        id: 'api-calls',
        name: 'API calls',
        unit: 'call',
        includedQuantity: 10,
        overageUnitPriceCents: 10,
      },
      usageQuantity: 5,
      usageBlockBalance: 0,
    });

    expect(preview.id).toBe('inv-9');
    expect(mint).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        currency: 'USD',
        subtotalCents: 1000,
      })
    );
  });

  it('rejects malformed preview payloads with 400 instead of a TypeError', async () => {
    await expect(
      service.previewInvoice({ currency: 'USD' } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewInvoiceForPeriod({ currency: 'USD' } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
