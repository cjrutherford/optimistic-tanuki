import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
import { INVOICE_REPOSITORY, InvoiceRepository } from './billing.repositories';

@Injectable()
export class BillingService {
  constructor(
    private readonly invoicePreviewService: InvoicePreviewService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly usageBlocksService: UsageBlocksService,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepository
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
    input: ConsumeUsageBlockDto
  ): Promise<ConsumeUsageBlockResult> {
    return this.usageBlocksService.consumeUsageBlock(input);
  }

  async previewInvoice(
    input: InvoicePreviewInput
  ): Promise<InvoicePreview & { id: string }> {
    assertPreviewInput(input);
    return this.mintPreview(this.invoicePreviewService.preview(input), input);
  }

  async previewInvoiceForPeriod(
    input: PeriodInvoicePreviewInput
  ): Promise<InvoicePreview & { id: string }> {
    assertPeriodPreviewInput(input);
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

    return this.mintPreview(
      this.invoicePreviewService.preview({
        tenantId: input.tenantId,
        appScope: input.appScope,
        currency: input.currency,
        subscriptionPriceCents: input.subscriptionPriceCents,
        meter: input.meter,
        usageQuantity: usageSummary.quantity,
        usageBlockBalance,
      }),
      input
    );
  }

  /**
   * E5 mint-on-preview (decided): every preview persists a `draft` invoice
   * row and returns its id alongside the quote. Callers needing a pure
   * what-if computation use `InvoicePreviewService` directly (domain, no I/O).
   */
  private async mintPreview(
    preview: InvoicePreview,
    input: InvoicePreviewInput | PeriodInvoicePreviewInput
  ): Promise<InvoicePreview & { id: string }> {
    const { id } = await this.invoiceRepository.mint({
      tenantId: preview.tenantId,
      appScope: preview.appScope,
      accountId:
        'accountId' in input && input.accountId ? input.accountId : undefined,
      currency: preview.currency,
      subtotalCents: preview.subtotalCents,
      lines: preview.lines,
    });

    return { ...preview, id };
  }
}

/**
 * The gateway preview route takes a union body (`InvoicePreviewInput |
 * PeriodInvoicePreviewInput`), whose design-time metatype is `Object` — so
 * the gateway ValidationPipe cannot validate it and malformed payloads
 * reach this service. Reject them here with a 400 (which the gateway maps
 * back to BadRequest) instead of throwing a TypeError (500) on `meter`.
 * Full DTO validation on this microservice is O16's global ValidationPipe.
 */
function assertPreviewInput(input: InvoicePreviewInput): void {
  if (
    !input ||
    typeof input.tenantId !== 'string' ||
    typeof input.appScope !== 'string' ||
    typeof input.currency !== 'string' ||
    typeof input.subscriptionPriceCents !== 'number' ||
    typeof input.usageQuantity !== 'number' ||
    typeof input.usageBlockBalance !== 'number' ||
    !input.meter ||
    typeof input.meter.id !== 'string'
  ) {
    throw new BadRequestException('Invalid invoice preview payload');
  }
}

function assertPeriodPreviewInput(input: PeriodInvoicePreviewInput): void {
  if (
    !input ||
    typeof input.tenantId !== 'string' ||
    typeof input.appScope !== 'string' ||
    typeof input.accountId !== 'string' ||
    typeof input.currency !== 'string' ||
    typeof input.subscriptionPriceCents !== 'number' ||
    !input.meter ||
    typeof input.meter.id !== 'string' ||
    !input.periodStart ||
    !input.periodEnd
  ) {
    throw new BadRequestException('Invalid period invoice preview payload');
  }
}
