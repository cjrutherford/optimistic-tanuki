import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

import { HelcimService } from './helcim.service';

describe('HelcimService', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('reports whether Helcim is configured', () => {
        const configured = new HelcimService({
            get: jest.fn().mockReturnValue({
                apiToken: 'token',
                baseUrl: 'https://api.helcim.com',
                webhookSecret: '',
            }),
        } as unknown as ConfigService);

        const missingToken = new HelcimService({
            get: jest.fn().mockReturnValue({
                apiToken: '',
                baseUrl: 'https://api.helcim.com',
                webhookSecret: '',
            }),
        } as unknown as ConfigService);

        expect(configured.isConfigured()).toBe(true);
        expect(missingToken.isConfigured()).toBe(false);
    });

    it('validates Helcim checkout responses using the secret token hash', () => {
        const service = new HelcimService({
            get: jest.fn().mockReturnValue({
                apiToken: 'token',
                baseUrl: 'https://api.helcim.com',
                webhookSecret: '',
            }),
        } as unknown as ConfigService);

        const payload = {
            transactionId: '12345',
            amount: '25.00',
            currency: 'USD',
        };
        const secretToken = 'secret-token';
        const hash = createHash('sha256')
            .update(`${JSON.stringify(payload)}${secretToken}`)
            .digest('hex');

        expect(
            service.validateCheckoutResponse(
                {
                    hash,
                    data: payload,
                },
                secretToken
            )
        ).toBe(true);
    });

    it('posts refunds to the Helcim refund endpoint', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                transactionId: 'refund-123',
                status: 'APPROVED',
            }),
        });
        global.fetch = fetchMock as typeof fetch;

        const service = new HelcimService({
            get: jest.fn().mockReturnValue({
                apiToken: 'token',
                baseUrl: 'https://api.helcim.com',
                webhookSecret: '',
            }),
        } as unknown as ConfigService);

        const result = await service.refundPayment('txn-123', 25);

        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.helcim.com/v2/payment/refund',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'api-token': 'token',
                    'content-type': 'application/json',
                }),
                body: JSON.stringify({
                    amount: 25,
                    transactionId: 'txn-123',
                    originalTransactionId: 'txn-123',
                }),
            })
        );
        expect(result).toEqual({
            transactionId: 'refund-123',
            status: 'APPROVED',
        });
    });

    it('throws when Helcim explicitly declines a refund', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                status: 'DECLINED',
                responseMessage: 'Refund declined',
            }),
        }) as typeof fetch;

        const service = new HelcimService({
            get: jest.fn().mockReturnValue({
                apiToken: 'token',
                baseUrl: 'https://api.helcim.com',
                webhookSecret: '',
            }),
        } as unknown as ConfigService);

        await expect(service.refundPayment('txn-123', 25)).rejects.toThrow(
            'Refund declined'
        );
    });
});
