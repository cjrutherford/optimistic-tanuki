import { Test, TestingModule } from '@nestjs/testing';
import { InvoicePreviewService } from '@optimistic-tanuki/billing-domain';
import { AppController } from './app.controller';
import { BillingService } from './services/billing.service';
import {
  USAGE_BLOCK_REPOSITORY,
  USAGE_EVENT_REPOSITORY,
} from './services/billing.repositories';
import {
  InMemoryUsageBlockRepository,
  InMemoryUsageEventRepository,
} from './services/in-memory-billing.repositories';
import { UsageBlocksService } from './services/usage-blocks.service';
import { UsageMeteringService } from './services/usage-metering.service';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        BillingService,
        InvoicePreviewService,
        UsageMeteringService,
        UsageBlocksService,
        {
          provide: USAGE_EVENT_REPOSITORY,
          useClass: InMemoryUsageEventRepository,
        },
        {
          provide: USAGE_BLOCK_REPOSITORY,
          useClass: InMemoryUsageBlockRepository,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('previews invoices through the billing service', () => {
    expect(
      controller.previewInvoice({
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
        usageQuantity: 12,
        usageBlockBalance: 0,
      }),
    ).toMatchObject({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      subtotalCents: 1020,
    });
  });
});
