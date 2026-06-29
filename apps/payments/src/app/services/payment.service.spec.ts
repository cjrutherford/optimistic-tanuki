import {
  BillingProviderAdapter,
  CreateCheckoutInput,
  ProviderWebhookResult,
  ProcessWebhookInput,
} from '@optimistic-tanuki/payments-domain';
import { BillingReconciliationService } from './billing-reconciliation.service';
import { PaymentService } from './payment.service';

class RecordingProviderAdapter implements BillingProviderAdapter {
  checkoutInputs: CreateCheckoutInput[] = [];
  webhookInputs: ProcessWebhookInput[] = [];

  async createCheckoutSession(input: CreateCheckoutInput) {
    this.checkoutInputs.push(input);

    return {
      provider: 'lemon-squeezy' as const,
      checkoutUrl: `provider-checkout:${input.providerPriceRef ?? 'fallback'}`,
      providerReference: input.providerPriceRef ?? 'fallback',
    };
  }

  async processWebhook(input: ProcessWebhookInput) {
    this.webhookInputs.push(input);

    return {
      provider: 'lemon-squeezy' as const,
      eventType: input.eventType,
      customData: {
        community_id: 'community-1',
      },
      rawPayload: input.payload,
    };
  }

  listCatalogStores() {
    return [];
  }
}

class RecordingBillingReconciliationService
  implements Pick<BillingReconciliationService, 'publishProviderEvent'>
{
  events: ProviderWebhookResult[] = [];

  async publishProviderEvent(event: ProviderWebhookResult): Promise<void> {
    this.events.push(event);
  }
}

function repository<T extends object>(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    create: jest.fn((input: T) => input),
    save: jest.fn(async (input: T) => ({ id: 'saved-id', ...input })),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

function createService(providerAdapter = new RecordingProviderAdapter()) {
  const billingReconciliationService =
    new RecordingBillingReconciliationService();
  const donationRepository = repository();
  const businessPageRepository = repository({
    findOne: jest.fn(async () => null),
    save: jest.fn(async (input: object) => ({
      id: 'business-page-1',
      ...input,
    })),
  });
  const productRepository = repository({
    findOne: jest.fn(async () => ({
      lemonSqueezyVariantId: 'variant-pro',
    })),
  });

  const service = new PaymentService(
    donationRepository as never,
    repository() as never,
    repository() as never,
    repository() as never,
    businessPageRepository as never,
    repository() as never,
    repository() as never,
    productRepository as never,
    providerAdapter,
    billingReconciliationService as never
  );

  return {
    service,
    providerAdapter,
    billingReconciliationService,
  };
}

describe('PaymentService provider adapter boundary', () => {
  it('delegates donation checkout URL creation to the configured provider', async () => {
    const { service, providerAdapter } = createService();

    await expect(
      service.createDonationCheckout(
        'user-1',
        'profile-1',
        25,
        false,
        'local-hub'
      )
    ).resolves.toEqual({
      checkoutUrl: 'provider-checkout:fallback',
      donationId: 'saved-id',
    });

    expect(providerAdapter.checkoutInputs).toEqual([
      {
        appScope: 'local-hub',
        customData: {
          donation_id: 'saved-id',
          user_id: 'user-1',
          profile_id: 'profile-1',
        },
      },
    ]);
  });

  it('uses provider product mappings when creating business checkouts', async () => {
    const { service, providerAdapter } = createService();

    await expect(
      service.createBusinessCheckout(
        'user-1',
        'community-1',
        'pro',
        'local-hub'
      )
    ).resolves.toEqual({
      checkoutUrl: 'provider-checkout:variant-pro',
      businessPageId: 'business-page-1',
    });

    expect(providerAdapter.checkoutInputs).toEqual([
      {
        appScope: 'local-hub',
        providerPriceRef: 'variant-pro',
        customData: {
          business_page_id: 'business-page-1',
          community_id: 'community-1',
          user_id: 'user-1',
          tier: 'pro',
        },
      },
    ]);
  });

  it('publishes normalized provider webhooks to the billing reconciliation seam', async () => {
    const { service, billingReconciliationService } = createService();

    await expect(
      service.processWebhook('subscription_created', {
        meta: {
          custom_data: {
            community_id: 'community-1',
          },
        },
      })
    ).resolves.toEqual({ received: true });

    expect(billingReconciliationService.events).toEqual([
      {
        provider: 'lemon-squeezy',
        eventType: 'subscription_created',
        customData: {
          community_id: 'community-1',
        },
        rawPayload: {
          meta: {
            custom_data: {
              community_id: 'community-1',
            },
          },
        },
      },
    ]);
  });

  it('lists active business pages for locality discovery', async () => {
    const activeBusinesses = [
      {
        id: 'business-1',
        communityId: 'community-1',
        subscriptionStatus: 'active',
        anchorLat: 32.08,
        anchorLng: -81.09,
      },
    ];
    const businessPageRepository = repository({
      find: jest.fn(async () => activeBusinesses),
    });
    const service = new PaymentService(
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
      businessPageRepository as never,
      repository() as never,
      repository() as never,
      repository() as never,
      new RecordingProviderAdapter(),
      new RecordingBillingReconciliationService() as never
    );

    await expect(service.listActiveBusinessPages()).resolves.toEqual(
      activeBusinesses
    );

    expect(businessPageRepository.find).toHaveBeenCalledWith({
      where: { subscriptionStatus: 'active' },
      order: { isFeatured: 'DESC', createdAt: 'ASC' },
    });
  });

  it('lists owner business pages in created order', async () => {
    const ownerBusinessPages = [
      { id: 'business-1', ownerId: 'user-1' },
      { id: 'business-2', ownerId: 'user-1' },
    ];
    const businessPageRepository = repository({
      find: jest.fn(async () => ownerBusinessPages),
    });
    const service = new PaymentService(
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
      businessPageRepository as never,
      repository() as never,
      repository() as never,
      repository() as never,
      new RecordingProviderAdapter(),
      new RecordingBillingReconciliationService() as never
    );

    await expect(service.getOwnerBusinessPages('user-1')).resolves.toEqual(
      ownerBusinessPages
    );

    expect(businessPageRepository.find).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      order: { createdAt: 'ASC' },
    });
  });

  it('updates an owner business page by id', async () => {
    const existingPage = {
      id: 'business-1',
      ownerId: 'user-1',
      name: 'North Star Advisory',
      anchorLat: null,
      anchorLng: null,
    };
    const businessPageRepository = repository({
      findOne: jest.fn(async () => existingPage),
      save: jest.fn(async (input: object) => input),
    });
    const service = new PaymentService(
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
      businessPageRepository as never,
      repository() as never,
      repository() as never,
      repository() as never,
      new RecordingProviderAdapter(),
      new RecordingBillingReconciliationService() as never
    );

    await expect(
      service.updateOwnerBusinessPage('user-1', 'business-1', {
        anchorLat: 32.0809,
        anchorLng: -81.0912,
      })
    ).resolves.toEqual({
      success: true,
      businessPage: {
        ...existingPage,
        anchorLat: 32.0809,
        anchorLng: -81.0912,
      },
    });

    expect(businessPageRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'business-1', ownerId: 'user-1' },
    });
  });
});
