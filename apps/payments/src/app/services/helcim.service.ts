import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type {
    HelcimCheckoutSessionRequest,
    HelcimCheckoutSessionResponse,
} from '@optimistic-tanuki/payments-domain';
import type { HelcimConfig } from '../../config';

export interface HelcimCheckoutTransactionResponse {
    hash: string;
    data: Record<string, unknown>;
}

export interface HelcimRefundResponse {
    transactionId?: string | number;
    id?: string | number;
    status?: string;
    approved?: boolean;
    amount?: number | string;
    responseMessage?: string;
    [key: string]: unknown;
}

@Injectable()
export class HelcimService {
    private readonly logger = new Logger(HelcimService.name);
    private readonly config: HelcimConfig;

    constructor(private readonly configService: ConfigService) {
        this.config =
            (this.configService.get('helcim') as HelcimConfig | undefined) || {
                apiToken: '',
                baseUrl: 'https://api.helcim.com',
                webhookSecret: '',
            };
    }

    isConfigured(): boolean {
        return Boolean(this.config.apiToken && this.config.baseUrl);
    }

    async initializeCheckoutSession(
        request: HelcimCheckoutSessionRequest
    ): Promise<HelcimCheckoutSessionResponse> {
        if (!this.config.apiToken) {
            throw new Error('Helcim API token is not configured');
        }

        const response = await fetch(`${this.config.baseUrl}/v2/helcim-pay/initialize`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'api-token': this.config.apiToken,
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            this.logger.error(
                `Helcim checkout initialization failed: ${response.status} ${response.statusText} ${errorBody}`
            );
            throw new Error(
                `Failed to initialize Helcim checkout session: ${response.status} ${response.statusText}`
            );
        }

        return (await response.json()) as HelcimCheckoutSessionResponse;
    }

    async refundPayment(
        transactionId: string,
        amount: number
    ): Promise<HelcimRefundResponse> {
        if (!this.config.apiToken) {
            throw new Error('Helcim API token is not configured');
        }

        const response = await fetch(`${this.config.baseUrl}/v2/payment/refund`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'api-token': this.config.apiToken,
            },
            body: JSON.stringify({
                amount,
                transactionId,
                originalTransactionId: transactionId,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            this.logger.error(
                `Helcim refund failed: ${response.status} ${response.statusText} ${errorBody}`
            );
            throw new Error(
                `Failed to refund Helcim payment: ${response.status} ${response.statusText}`
            );
        }

        const refundResponse = (await response.json()) as HelcimRefundResponse;
        const normalizedStatus = String(refundResponse.status || '').trim().toLowerCase();

        if (refundResponse.approved === false) {
            throw new Error(
                refundResponse.responseMessage || 'Helcim refund was not approved'
            );
        }

        if (normalizedStatus && ['failed', 'declined', 'error', 'voided'].includes(normalizedStatus)) {
            throw new Error(
                refundResponse.responseMessage || `Helcim refund failed with status ${refundResponse.status}`
            );
        }

        if (!refundResponse.transactionId && !refundResponse.id) {
            this.logger.warn(
                `Helcim refund response for ${transactionId} did not include a transaction identifier: ${JSON.stringify(refundResponse)}`
            );
        }

        return refundResponse;
    }

    validateCheckoutResponse(
        response: HelcimCheckoutTransactionResponse,
        secretToken: string
    ): boolean {
        const normalizedPayload = JSON.stringify(response.data);
        const localHash = createHash('sha256')
            .update(`${normalizedPayload}${secretToken}`)
            .digest('hex');

        return localHash === response.hash;
    }
}
