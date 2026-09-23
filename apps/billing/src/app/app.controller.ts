import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  BatchRecordUsageDto,
  BillingSubscription,
  BillingSubscriptionRefDto,
  ConsumeUsageBlockDto,
  CreateBillingSubscriptionDto,
  CreateSubscriptionFromProductDto,
  GrantUsageBlockDto,
  InvoicePreviewInput,
  PeriodInvoicePreviewInput,
  RecordUsageDto,
  UsageSummaryRequest,
} from '@optimistic-tanuki/billing-contracts';
import { BillingCommands } from '@optimistic-tanuki/constants';
import { BillingService } from './services/billing.service';
import { BillingSubscriptionsService } from './services/billing-subscriptions.service';

@Controller()
export class AppController {
  constructor(
    private readonly billingService: BillingService,
    private readonly subscriptionsService: BillingSubscriptionsService
  ) {}

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
    @Payload() payload: InvoicePreviewInput | PeriodInvoicePreviewInput
  ) {
    // Union design metatype is Object, so the global ValidationPipe skips
    // this param; BillingService asserts the shape explicitly (400-class
    // guard) before the domain code dereferences `meter`.
    if ('periodStart' in payload) {
      return this.billingService.previewInvoiceForPeriod(payload);
    }

    return this.billingService.previewInvoice(payload);
  }

  @MessagePattern({ cmd: BillingCommands.SUBSCRIPTION_CREATE })
  createSubscription(@Payload() payload: CreateBillingSubscriptionDto) {
    return this.subscriptionsService.create(payload);
  }

  @MessagePattern({ cmd: BillingCommands.SUBSCRIPTION_CREATE_FROM_PRODUCT })
  createSubscriptionFromProduct(
    @Payload() payload: CreateSubscriptionFromProductDto
  ) {
    return this.subscriptionsService.createFromProduct(payload);
  }

  @MessagePattern({ cmd: BillingCommands.SUBSCRIPTION_CANCEL })
  cancelSubscription(@Payload() payload: BillingSubscriptionRefDto) {
    return this.subscriptionsService.cancel(payload.id);
  }

  @MessagePattern({ cmd: BillingCommands.SUBSCRIPTION_GET })
  getSubscription(@Payload() payload: BillingSubscriptionRefDto) {
    return this.subscriptionsService.get(payload.id);
  }
}
