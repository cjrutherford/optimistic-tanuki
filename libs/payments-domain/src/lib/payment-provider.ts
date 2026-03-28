export type PaymentProvider = 'helcim' | 'lemon-squeezy' | 'stripe-connect';

export type PaymentFlow =
    | 'donations'
    | 'classifieds'
    | 'business'
    | 'sponsorship';

export type PaymentFlowProviders = Record<PaymentFlow, PaymentProvider>;

export type PaymentProcessorMode = 'embedded-checkout' | 'hosted-checkout' | 'direct-api';

export interface PaymentProcessorCapabilitySet {
    supportsEmbeddedCheckout: boolean;
    supportsHostedCheckout: boolean;
    supportsSavedPaymentMethods: boolean;
    supportsRecurringBilling: boolean;
    supportsRefunds: boolean;
    supportsPayouts: boolean;
}

export const HELCIM_CAPABILITIES: PaymentProcessorCapabilitySet = {
    supportsEmbeddedCheckout: true,
    supportsHostedCheckout: true,
    supportsSavedPaymentMethods: true,
    supportsRecurringBilling: true,
    supportsRefunds: true,
    supportsPayouts: true,
};

export const STRIPE_CONNECT_CAPABILITIES: PaymentProcessorCapabilitySet = {
    supportsEmbeddedCheckout: true,
    supportsHostedCheckout: false,
    supportsSavedPaymentMethods: true,
    supportsRecurringBilling: true,
    supportsRefunds: true,
    supportsPayouts: true,
};
