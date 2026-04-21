import { Injectable, Logger } from '@nestjs/common';
import { ProviderWebhookResult } from '@optimistic-tanuki/payments-domain';

@Injectable()
export class BillingReconciliationService {
  private readonly logger = new Logger(BillingReconciliationService.name);

  async publishProviderEvent(event: ProviderWebhookResult): Promise<void> {
    this.logger.log(
      `Billing reconciliation event queued: provider=${event.provider}, event=${event.eventType}`,
    );
  }
}
