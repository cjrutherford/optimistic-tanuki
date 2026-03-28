import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import type { StripeConnectAppConfig, StripeConnectConfig } from '../../config';

export interface StripeMarketplacePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  publishableKey: string;
}

export interface StripeConnectedAccountLinkResult {
  accountId: string;
  onboardingUrl: string;
  expiresAt: Date | null;
}

export interface CreateMarketplacePaymentIntentInput {
  appScope?: string;
  amountCents: number;
  currency: string;
  paymentId: string;
  classifiedId: string;
  buyerId: string;
  sellerId?: string;
  offerId?: string;
  applicationFeeAmountCents?: number;
}

export interface CreateConnectedAccountLinkInput {
  appScope?: string;
  sellerId: string;
  email?: string;
  accountId?: string;
}

export interface CreateMarketplaceTransferInput {
  appScope?: string;
  amountCents: number;
  currency: string;
  destinationAccountId: string;
  paymentId: string;
  paymentIntentId: string;
  sourceTransactionId?: string;
  sellerId: string;
  classifiedId: string;
}

export interface RefundMarketplacePaymentInput {
  appScope?: string;
  paymentIntentId?: string;
  chargeId?: string;
  amountCents?: number;
  reason?: Stripe.RefundCreateParams.Reason;
  metadata?: Record<string, string>;
}

export interface ReverseMarketplaceTransferInput {
  appScope?: string;
  transferId: string;
  amountCents?: number;
  metadata?: Record<string, string>;
}

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private readonly config: StripeConnectConfig;
  private readonly stripeClients = new Map<string, Stripe>();

  constructor(private readonly configService: ConfigService) {
    this.config = (this.configService.get('stripeConnect') as
      | StripeConnectConfig
      | undefined) || {
      default: {
        secretKey: '',
        publishableKey: '',
        webhookSecret: '',
        connectReturnUrl: '',
        connectRefreshUrl: '',
      },
      apps: {},
    };
  }

  private getConfigForAppScope(appScope?: string): StripeConnectAppConfig {
    const resolvedAppScope = appScope?.trim();

    if (resolvedAppScope && this.config.apps[resolvedAppScope]) {
      return this.config.apps[resolvedAppScope];
    }

    return this.config.default;
  }

  isConfigured(appScope?: string): boolean {
    const config = this.getConfigForAppScope(appScope);
    return Boolean(config.secretKey && config.publishableKey);
  }

  getPublishableKey(appScope?: string): string {
    return this.getConfigForAppScope(appScope).publishableKey || '';
  }

  private getClient(appScope?: string): Stripe {
    const config = this.getConfigForAppScope(appScope);

    if (!config.secretKey) {
      throw new Error('Stripe secret key is not configured');
    }

    if (!this.stripeClients.has(config.secretKey)) {
      this.stripeClients.set(config.secretKey, new Stripe(config.secretKey));
    }

    return this.stripeClients.get(config.secretKey)!;
  }

  private getConnectUrls(appScope?: string): {
    returnUrl: string;
    refreshUrl: string;
  } {
    const config = this.getConfigForAppScope(appScope);

    if (!config.connectReturnUrl || !config.connectRefreshUrl) {
      throw new Error(
        'Stripe Connect return and refresh URLs are not configured'
      );
    }

    return {
      returnUrl: config.connectReturnUrl,
      refreshUrl: config.connectRefreshUrl,
    };
  }

  async createMarketplacePaymentIntent(
    input: CreateMarketplacePaymentIntentInput
  ): Promise<StripeMarketplacePaymentIntentResult> {
    if (!this.isConfigured(input.appScope)) {
      throw new Error('Stripe Connect is not configured');
    }

    const config = this.getConfigForAppScope(input.appScope);

    const paymentIntent = await this.getClient(
      input.appScope
    ).paymentIntents.create({
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      payment_method_types: ['card'],
      capture_method: 'automatic',
      metadata: {
        appScope: input.appScope || '',
        paymentId: input.paymentId,
        classifiedId: input.classifiedId,
        buyerId: input.buyerId,
        sellerId: input.sellerId || '',
        offerId: input.offerId || '',
        applicationFeeAmountCents: String(input.applicationFeeAmountCents || 0),
      },
      transfer_group: `classified-payment-${input.paymentId}`,
    });

    if (!paymentIntent.client_secret) {
      this.logger.error(
        `Stripe PaymentIntent ${paymentIntent.id} was created without a client secret`
      );
      throw new Error(
        'Stripe did not return a client secret for the payment intent'
      );
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey: config.publishableKey,
    };
  }

  async getMarketplacePaymentIntent(
    paymentIntentId: string,
    appScope?: string
  ): Promise<Stripe.PaymentIntent> {
    if (!this.isConfigured(appScope)) {
      throw new Error('Stripe Connect is not configured');
    }

    return this.getClient(appScope).paymentIntents.retrieve(paymentIntentId);
  }

  async createMarketplaceTransfer(
    input: CreateMarketplaceTransferInput
  ): Promise<Stripe.Transfer> {
    if (!this.isConfigured(input.appScope)) {
      throw new Error('Stripe Connect is not configured');
    }

    return this.getClient(input.appScope).transfers.create(
      {
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        destination: input.destinationAccountId,
        source_transaction: input.sourceTransactionId || undefined,
        transfer_group: `classified-payment-${input.paymentId}`,
        metadata: {
          appScope: input.appScope || '',
          paymentId: input.paymentId,
          paymentIntentId: input.paymentIntentId,
          classifiedId: input.classifiedId,
          sellerId: input.sellerId,
        },
      },
      {
        idempotencyKey: `classified-payment-release-${input.paymentId}`,
      }
    );
  }

  async refundMarketplacePayment(
    input: RefundMarketplacePaymentInput
  ): Promise<Stripe.Refund> {
    if (!this.isConfigured(input.appScope)) {
      throw new Error('Stripe Connect is not configured');
    }

    if (!input.paymentIntentId && !input.chargeId) {
      throw new Error('Stripe refund requires a payment intent or charge id');
    }

    return this.getClient(input.appScope).refunds.create({
      payment_intent: input.paymentIntentId,
      charge: input.chargeId,
      amount: input.amountCents,
      reason: input.reason,
      metadata: input.metadata,
    });
  }

  async reverseMarketplaceTransfer(
    input: ReverseMarketplaceTransferInput
  ): Promise<Stripe.TransferReversal> {
    if (!this.isConfigured(input.appScope)) {
      throw new Error('Stripe Connect is not configured');
    }

    return this.getClient(input.appScope).transfers.createReversal(
      input.transferId,
      {
        amount: input.amountCents,
        metadata: input.metadata,
      },
      {
        idempotencyKey: `classified-payment-refund-${input.transferId}`,
      }
    );
  }

  async createConnectedAccountLink(
    input: CreateConnectedAccountLinkInput
  ): Promise<StripeConnectedAccountLinkResult> {
    if (!this.isConfigured(input.appScope)) {
      throw new Error('Stripe Connect is not configured');
    }

    const client = this.getClient(input.appScope);
    const existingAccount = input.accountId
      ? await client.accounts.retrieve(input.accountId)
      : null;

    if (existingAccount && 'deleted' in existingAccount) {
      throw new Error('Stripe account no longer exists');
    }

    const account = existingAccount
      ? existingAccount
      : await client.accounts.create({
          type: 'express',
          country: 'US',
          email: input.email || undefined,
          business_type: 'individual',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: {
            appScope: input.appScope || '',
            sellerId: input.sellerId,
          },
        });

    const urls = this.getConnectUrls(input.appScope);
    const link = await client.accountLinks.create({
      account: account.id,
      refresh_url: urls.refreshUrl,
      return_url: urls.returnUrl,
      type: 'account_onboarding',
    });

    return {
      accountId: account.id,
      onboardingUrl: link.url,
      expiresAt: link.expires_at ? new Date(link.expires_at * 1000) : null,
    };
  }

  async getConnectedAccount(
    accountId: string,
    appScope?: string
  ): Promise<Stripe.Account> {
    if (!this.isConfigured(appScope)) {
      throw new Error('Stripe Connect is not configured');
    }

    const account = await this.getClient(appScope).accounts.retrieve(accountId);

    if ('deleted' in account) {
      throw new Error('Stripe account no longer exists');
    }

    return account;
  }

  async createDirectPaymentIntent(input: {
    appScope?: string;
    amountCents: number;
    currency: string;
    customerId?: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    customerId: string;
  }> {
    if (!this.isConfigured(input.appScope)) {
      throw new Error('Stripe is not configured');
    }

    const client = this.getClient(input.appScope);

    let customer: Stripe.Customer | undefined;
    if (input.customerId) {
      try {
        customer = (await client.customers.retrieve(
          input.customerId
        )) as Stripe.Customer;
      } catch {
        customer = undefined;
      }
    }

    if (!customer && input.email) {
      customer = await client.customers.create({
        email: input.email,
        name: input.name,
        metadata: input.metadata,
      });
    }

    const paymentIntent = await client.paymentIntents.create({
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      payment_method_types: ['card'],
      capture_method: 'automatic',
      customer: customer?.id,
      metadata: input.metadata,
    });

    if (!paymentIntent.client_secret) {
      throw new Error('Stripe did not return a client secret');
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId: customer?.id || '',
    };
  }

  async confirmDirectPayment(
    paymentIntentId: string,
    appScope?: string
  ): Promise<Stripe.PaymentIntent> {
    if (!this.isConfigured(appScope)) {
      throw new Error('Stripe is not configured');
    }

    return this.getClient(appScope).paymentIntents.retrieve(paymentIntentId);
  }

  async createOrGetCustomer(input: {
    appScope?: string;
    email: string;
    name?: string;
    userId?: string;
  }): Promise<Stripe.Customer> {
    if (!this.isConfigured(input.appScope)) {
      throw new Error('Stripe is not configured');
    }

    const client = this.getClient(input.appScope);

    const existing = await client.customers.list({
      email: input.email,
      limit: 1,
    });

    if (existing.data.length > 0) {
      return existing.data[0];
    }

    return client.customers.create({
      email: input.email,
      name: input.name,
      metadata: {
        userId: input.userId || '',
      },
    });
  }

  async getCustomer(
    customerId: string,
    appScope?: string
  ): Promise<Stripe.Customer> {
    if (!this.isConfigured(appScope)) {
      throw new Error('Stripe is not configured');
    }

    return this.getClient(appScope).customers.retrieve(
      customerId
    ) as Promise<Stripe.Customer>;
  }

  async updateCustomer(
    customerId: string,
    input: { name?: string; email?: string; defaultPaymentMethodId?: string },
    appScope?: string
  ): Promise<Stripe.Customer> {
    if (!this.isConfigured(appScope)) {
      throw new Error('Stripe is not configured');
    }

    const updateData: Stripe.CustomerUpdateParams = {};
    if (input.name) updateData.name = input.name;
    if (input.email) updateData.email = input.email;
    if (input.defaultPaymentMethodId) {
      updateData.invoice_settings = {
        default_payment_method: input.defaultPaymentMethodId,
      };
    }

    return this.getClient(appScope).customers.update(customerId, updateData);
  }

  async listPaymentMethods(
    customerId: string,
    appScope?: string
  ): Promise<Stripe.PaymentMethod[]> {
    if (!this.isConfigured(appScope)) {
      throw new Error('Stripe is not configured');
    }

    const methods = await this.getClient(appScope).paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return methods.data;
  }

  async refundPayment(
    paymentIntentId: string,
    amountCents?: number,
    reason?: Stripe.RefundCreateParams.Reason,
    appScope?: string
  ): Promise<Stripe.Refund> {
    if (!this.isConfigured(appScope)) {
      throw new Error('Stripe is not configured');
    }

    return this.getClient(appScope).refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents,
      reason,
    });
  }
}
