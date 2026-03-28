export type HelcimPaymentType = 'purchase' | 'preauth';

export interface HelcimCheckoutLineItem {
    sku?: string;
    description: string;
    quantity: number;
    price: number;
}

export interface HelcimCheckoutCustomerRequest {
    customerCode?: string;
    contactName?: string;
    businessName?: string;
    email?: string;
}

export interface HelcimCheckoutSessionRequest {
    paymentType: HelcimPaymentType;
    amount: number;
    currency: string;
    customerCode?: string;
    invoiceNumber?: string;
    paymentMethod?: 'card' | 'ach';
    customerRequest?: HelcimCheckoutCustomerRequest;
    lineItems?: HelcimCheckoutLineItem[];
    metadata?: Record<string, string>;
}

export interface HelcimCheckoutSessionResponse {
    checkoutToken: string;
    secretToken: string;
}
