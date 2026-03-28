import type { PaymentProvider } from './payment-provider';

export interface ExternalPaymentReference {
    provider: PaymentProvider;
    externalCustomerId?: string;
    externalPaymentMethodId?: string;
    externalTransactionId?: string;
    externalOrderId?: string;
    externalSubscriptionId?: string;
    externalInvoiceId?: string;
    externalPlanId?: string;
}
