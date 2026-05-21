import { Injectable } from '@nestjs/common';
import {
  BatchRecordUsageDto,
  ConsumeUsageBlockDto,
  ConsumeUsageBlockResult,
  GrantUsageBlockDto,
  GrantUsageBlockResult,
  InvoicePreview,
  InvoicePreviewInput,
  PeriodInvoicePreviewInput,
  RecordUsageDto,
  RecordUsageResult,
  UsageSummary,
  UsageSummaryRequest,
} from '@optimistic-tanuki/billing-contracts';
import { InvoicePreviewService } from '@optimistic-tanuki/billing-domain';
import { UsageBlocksService } from './usage-blocks.service';
import { UsageMeteringService } from './usage-metering.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly invoicePreviewService: InvoicePreviewService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly usageBlocksService: UsageBlocksService,
  ) {}

  recordUsage(input: RecordUsageDto): Promise<RecordUsageResult> {
    return this.usageMeteringService.recordUsage(input);
  }

  batchRecordUsage(input: BatchRecordUsageDto): Promise<RecordUsageResult[]> {
    return this.usageMeteringService.batchRecordUsage(input);
  }

  getUsageSummary(input: UsageSummaryRequest): Promise<UsageSummary> {
    return this.usageMeteringService.getUsageSummary(input);
  }

  grantUsageBlock(input: GrantUsageBlockDto): Promise<GrantUsageBlockResult> {
    return this.usageBlocksService.grantUsageBlock(input);
  }

  consumeUsageBlock(
    input: ConsumeUsageBlockDto,
  ): Promise<ConsumeUsageBlockResult> {
    return this.usageBlocksService.consumeUsageBlock(input);
  }

  previewInvoice(input: InvoicePreviewInput): InvoicePreview {
    return this.invoicePreviewService.preview(input);
  }

  async previewInvoiceForPeriod(
    input: PeriodInvoicePreviewInput,
  ): Promise<InvoicePreview> {
    const [usageSummary, usageBlockBalance] = await Promise.all([
      this.usageMeteringService.getUsageSummary({
        tenantId: input.tenantId,
        appScope: input.appScope,
        meterId: input.meter.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      }),
      this.usageBlocksService.getAvailableBalance({
        tenantId: input.tenantId,
        appScope: input.appScope,
        accountId: input.accountId,
        meterId: input.meter.id,
        at: input.periodEnd,
      }),
    ]);

    return this.invoicePreviewService.preview({
      tenantId: input.tenantId,
      appScope: input.appScope,
      currency: input.currency,
      subscriptionPriceCents: input.subscriptionPriceCents,
      meter: input.meter,
      usageQuantity: usageSummary.quantity,
      usageBlockBalance,
    });
  }
}
