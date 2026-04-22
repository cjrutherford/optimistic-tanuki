import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  BatchRecordUsageDto,
  ConsumeUsageBlockDto,
  GrantUsageBlockDto,
  InvoicePreviewInput,
  PeriodInvoicePreviewInput,
  RecordUsageDto,
  UsageSummaryRequest,
} from '@optimistic-tanuki/billing-contracts';
import { BillingCommands } from '@optimistic-tanuki/constants';
import { BillingService } from './services/billing.service';

@Controller()
export class AppController {
  constructor(private readonly billingService: BillingService) {}

  @MessagePattern({ cmd: BillingCommands.RECORD_USAGE })
  recordUsage(@Payload() payload: RecordUsageDto) {
    return this.billingService.recordUsage(payload);
  }

  @MessagePattern({ cmd: BillingCommands.BATCH_RECORD_USAGE })
  batchRecordUsage(@Payload() payload: BatchRecordUsageDto) {
    return this.billingService.batchRecordUsage(payload);
  }

  @MessagePattern({ cmd: BillingCommands.GET_USAGE_SUMMARY })
  getUsageSummary(@Payload() payload: UsageSummaryRequest) {
    return this.billingService.getUsageSummary(payload);
  }

  @MessagePattern({ cmd: BillingCommands.GRANT_USAGE_BLOCK })
  grantUsageBlock(@Payload() payload: GrantUsageBlockDto) {
    return this.billingService.grantUsageBlock(payload);
  }

  @MessagePattern({ cmd: BillingCommands.CONSUME_USAGE_BLOCK })
  consumeUsageBlock(@Payload() payload: ConsumeUsageBlockDto) {
    return this.billingService.consumeUsageBlock(payload);
  }

  @MessagePattern({ cmd: BillingCommands.PREVIEW_INVOICE })
  previewInvoice(
    @Payload() payload: InvoicePreviewInput | PeriodInvoicePreviewInput,
  ) {
    if ('periodStart' in payload) {
      return this.billingService.previewInvoiceForPeriod(payload);
    }

    return this.billingService.previewInvoice(payload);
  }
}
