import { ConfigService } from '@nestjs/config';

import { StripeConnectService } from './stripe-connect.service';

describe('StripeConnectService', () => {
  it('reports whether Stripe Connect is configured', () => {
    const configured = new StripeConnectService({
      get: jest.fn().mockReturnValue({
        default: {
          secretKey: '',
          publishableKey: '',
          webhookSecret: '',
        },
        apps: {
          'local-hub': {
            secretKey: 'sk_test_123',
            publishableKey: 'pk_test_123',
            webhookSecret: '',
          },
        },
      }),
    } as unknown as ConfigService);

    const missingSecret = new StripeConnectService({
      get: jest.fn().mockReturnValue({
        default: {
          secretKey: '',
          publishableKey: '',
          webhookSecret: '',
        },
        apps: {},
      }),
    } as unknown as ConfigService);

    expect(configured.isConfigured('local-hub')).toBe(true);
    expect(missingSecret.isConfigured()).toBe(false);
  });

  it('creates marketplace payment intents using the Stripe client', async () => {
    const service = new StripeConnectService({
      get: jest.fn().mockReturnValue({
        default: {
          secretKey: '',
          publishableKey: '',
          webhookSecret: '',
        },
        apps: {
          'local-hub': {
            secretKey: 'sk_test_123',
            publishableKey: 'pk_test_123',
            webhookSecret: '',
          },
        },
      }),
    } as unknown as ConfigService);

    const create = jest.fn().mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_secret_123',
    });
    (service as unknown as {
      stripeClients: Map<string, { paymentIntents: { create: jest.Mock } }>;
    }).stripeClients.set('sk_test_123', {
      paymentIntents: {
        create,
      },
    });

    const result = await service.createMarketplacePaymentIntent({
      appScope: 'local-hub',
      amountCents: 4250,
      currency: 'USD',
      paymentId: 'payment-123',
      classifiedId: 'classified-123',
      buyerId: 'buyer-123',
      sellerId: 'seller-123',
      applicationFeeAmountCents: 450,
    });

    expect(result).toEqual({
      clientSecret: 'pi_secret_123',
      paymentIntentId: 'pi_123',
      publishableKey: 'pk_test_123',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ['card'],
        metadata: expect.objectContaining({
          appScope: 'local-hub',
        }),
      })
    );
  });

  it('creates marketplace transfers using the seller connected account', async () => {
    const service = new StripeConnectService({
      get: jest.fn().mockReturnValue({
        default: {
          secretKey: '',
          publishableKey: '',
          webhookSecret: '',
        },
        apps: {
          'local-hub': {
            secretKey: 'sk_test_123',
            publishableKey: 'pk_test_123',
            webhookSecret: '',
          },
        },
      }),
    } as unknown as ConfigService);

    const createTransfer = jest.fn().mockResolvedValue({ id: 'tr_123' });
    (service as unknown as {
      stripeClients: Map<string, { transfers: { create: jest.Mock } }>;
    }).stripeClients.set('sk_test_123', {
      transfers: {
        create: createTransfer,
      },
    });

    const result = await service.createMarketplaceTransfer({
      appScope: 'local-hub',
      amountCents: 3800,
      currency: 'USD',
      destinationAccountId: 'acct_123',
      paymentId: 'payment-123',
      paymentIntentId: 'pi_123',
      sourceTransactionId: 'ch_123',
      sellerId: 'seller-123',
      classifiedId: 'classified-123',
    });

    expect(result).toEqual({ id: 'tr_123' });
    expect(createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3800,
        currency: 'usd',
        destination: 'acct_123',
        source_transaction: 'ch_123',
        transfer_group: 'classified-payment-payment-123',
        metadata: expect.objectContaining({
          paymentId: 'payment-123',
          paymentIntentId: 'pi_123',
          sellerId: 'seller-123',
        }),
      }),
      {
        idempotencyKey: 'classified-payment-release-payment-123',
      }
    );
  });

  it('refunds marketplace payments and reverses transfers', async () => {
    const service = new StripeConnectService({
      get: jest.fn().mockReturnValue({
        default: {
          secretKey: '',
          publishableKey: '',
          webhookSecret: '',
        },
        apps: {
          'local-hub': {
            secretKey: 'sk_test_123',
            publishableKey: 'pk_test_123',
            webhookSecret: '',
          },
        },
      }),
    } as unknown as ConfigService);

    const createRefund = jest.fn().mockResolvedValue({ id: 're_123' });
    const createReversal = jest.fn().mockResolvedValue({ id: 'trr_123' });
    (service as unknown as {
      stripeClients: Map<
        string,
        {
          refunds: { create: jest.Mock };
          transfers: { createReversal: jest.Mock };
        }
      >;
    }).stripeClients.set('sk_test_123', {
      refunds: {
        create: createRefund,
      },
      transfers: {
        createReversal,
      },
    });

    const refund = await service.refundMarketplacePayment({
      appScope: 'local-hub',
      paymentIntentId: 'pi_123',
      chargeId: 'ch_123',
      amountCents: 4200,
      metadata: { paymentId: 'payment-123' },
    });
    const reversal = await service.reverseMarketplaceTransfer({
      appScope: 'local-hub',
      transferId: 'tr_123',
      amountCents: 3800,
      metadata: { paymentId: 'payment-123' },
    });

    expect(refund).toEqual({ id: 're_123' });
    expect(reversal).toEqual({ id: 'trr_123' });
    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: 'pi_123',
        charge: 'ch_123',
        amount: 4200,
        metadata: expect.objectContaining({ paymentId: 'payment-123' }),
      })
    );
    expect(createReversal).toHaveBeenCalledWith(
      'tr_123',
      {
        amount: 3800,
        metadata: {
          paymentId: 'payment-123',
        },
      },
      {
        idempotencyKey: 'classified-payment-refund-tr_123',
      }
    );
  });

  it('creates seller onboarding links using scoped Stripe config', async () => {
    const service = new StripeConnectService({
      get: jest.fn().mockReturnValue({
        default: {
          secretKey: '',
          publishableKey: '',
          webhookSecret: '',
          connectReturnUrl: '',
          connectRefreshUrl: '',
        },
        apps: {
          'local-hub': {
            secretKey: 'sk_test_123',
            publishableKey: 'pk_test_123',
            webhookSecret: '',
            connectReturnUrl: 'https://local-hub.test/account/payments/stripe/return',
            connectRefreshUrl:
              'https://local-hub.test/account/payments/stripe/refresh',
          },
        },
      }),
    } as unknown as ConfigService);

    const createAccount = jest.fn().mockResolvedValue({ id: 'acct_123' });
    const createAccountLink = jest.fn().mockResolvedValue({
      url: 'https://connect.stripe.test/onboarding/acct_123',
      expires_at: 1735689600,
    });

    (service as unknown as {
      stripeClients: Map<
        string,
        {
          accounts: { create: jest.Mock; retrieve: jest.Mock };
          accountLinks: { create: jest.Mock };
        }
      >;
    }).stripeClients.set('sk_test_123', {
      accounts: {
        create: createAccount,
        retrieve: jest.fn(),
      },
      accountLinks: {
        create: createAccountLink,
      },
    });

    const result = await service.createConnectedAccountLink({
      appScope: 'local-hub',
      sellerId: 'seller-123',
      email: 'seller@example.com',
    });

    expect(result).toEqual({
      accountId: 'acct_123',
      onboardingUrl: 'https://connect.stripe.test/onboarding/acct_123',
      expiresAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'express',
        email: 'seller@example.com',
        metadata: expect.objectContaining({
          appScope: 'local-hub',
          sellerId: 'seller-123',
        }),
      })
    );
    expect(createAccountLink).toHaveBeenCalledWith({
      account: 'acct_123',
      refresh_url: 'https://local-hub.test/account/payments/stripe/refresh',
      return_url: 'https://local-hub.test/account/payments/stripe/return',
      type: 'account_onboarding',
    });
  });
});