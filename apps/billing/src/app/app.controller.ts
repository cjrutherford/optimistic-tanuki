import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BillingCommands } from '@optimistic-tanuki/constants';
import { InvoicePreviewInput } from '@optimistic-tanuki/billing-contracts';
import { BillingService } from './services/billing.service';

@Controller()
export class AppController {
  constructor(private readonly billingService: BillingService) {}

  @MessagePattern({ cmd: BillingCommands.PREVIEW_INVOICE })
  previewInvoice(@Payload() payload: InvoicePreviewInput) {
    return this.billingService.previewInvoice(payload);
  }
}
