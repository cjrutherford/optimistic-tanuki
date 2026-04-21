import { Injectable } from '@nestjs/common';
import {
  InvoicePreview,
  InvoicePreviewInput,
} from '@optimistic-tanuki/billing-contracts';
import { InvoicePreviewService } from '@optimistic-tanuki/billing-domain';

@Injectable()
export class BillingService {
  constructor(private readonly invoicePreviewService: InvoicePreviewService) {}

  previewInvoice(input: InvoicePreviewInput): InvoicePreview {
    return this.invoicePreviewService.preview(input);
  }
}
