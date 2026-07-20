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
    delete: jest.fn(async () => ({ affected: 0 })),
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
  const campaignRepository = repository();
  const campaignCreativeRepository = repository();
  const campaignTargetPlacementRepository = repository();

  const service = new PaymentService(
    donationRepository as never,
    repository() as never,
    repository() as never,
    repository() as never,
    businessPageRepository as never,
    repository() as never,
    productRepository as never,
    providerAdapter,
    billingReconciliationService as never,
    campaignRepository as never,
    campaignCreativeRepository as never,
    campaignTargetPlacementRepository as never
  );

  return {
    service,
    providerAdapter,
    billingReconciliationService,
    businessPageRepository,
    campaignRepository,
    campaignCreativeRepository,
    campaignTargetPlacementRepository,
  };
}

describe('PaymentService provider adapter boundary', () => {
  it('rejects a community mid-roll target when creating a campaign', async () => {
    const { service } = createService();

    await expect(
      service.createAdvertisingCampaign('user-1', {
        businessPageId: 'business-page-1',
        name: 'Neighborhood launch',
        startsAt: new Date('2026-07-10T00:00:00.000Z'),
        endsAt: new Date('2026-08-10T00:00:00.000Z'),
        targetPlacements: [
          {
            targetType: 'community',
            targetId: 'community-1',
            placementType: 'mid-roll',
          },
        ],
        creatives: [],
      })
    ).rejects.toThrow('Community targets only support on-page placement');
  });

  it('persists a placement-specific media URL when creating a campaign', async () => {
    const { service, campaignCreativeRepository, businessPageRepository } =
      createService();
    businessPageRepository.findOne.mockResolvedValue({
      id: 'business-page-1',
      ownerId: 'user-1',
    });

    await service.createAdvertisingCampaign('user-1', {
      businessPageId: 'business-page-1',
      name: 'Neighborhood launch',
      startsAt: new Date('2026-07-10T00:00:00.000Z'),
      endsAt: new Date('2026-08-10T00:00:00.000Z'),
      targetPlacements: [
        {
          targetType: 'channel',
          targetId: 'channel-1',
          placementType: 'pre-roll',
        },
      ],
      creatives: [
        {
          placementType: 'pre-roll',
          mediaUrl: 'https://ads.test/launch.mp4',
        } as never,
      ],
    });

    expect(campaignCreativeRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        placementType: 'pre-roll',
        mediaUrl: 'https://ads.test/launch.mp4',
      }),
    ]);
  });

  it.each(['http://ads.test/launch.mp4', '/launch.mp4', 'ads.test/launch.mp4'])(
    'rejects a non-absolute HTTPS media URL on create: %s',
    async (mediaUrl) => {
      const { service } = createService();

      await expect(
        service.createAdvertisingCampaign('user-1', {
          businessPageId: 'business-page-1',
          name: 'Neighborhood launch',
          startsAt: new Date('2026-07-10T00:00:00.000Z'),
          endsAt: new Date('2026-08-10T00:00:00.000Z'),
          targetPlacements: [
            {
              targetType: 'channel',
              targetId: 'channel-1',
              placementType: 'pre-roll',
            },
          ],
          creatives: [{ placementType: 'pre-roll', mediaUrl } as never],
        })
      ).rejects.toThrow('Creative mediaUrl must be an absolute HTTPS URL');
    }
  );

  it('rejects a non-absolute HTTPS media URL on update', async () => {
    const { service, campaignRepository, businessPageRepository } =
      createService();
    campaignRepository.findOne.mockResolvedValue({
      id: 'campaign-1',
      userId: 'user-1',
    });
    businessPageRepository.findOne.mockResolvedValue({
      id: 'business-page-1',
      ownerId: 'user-1',
    });

    await expect(
      service.updateAdvertisingCampaign('user-1', 'campaign-1', {
        businessPageId: 'business-page-1',
        name: 'Neighborhood launch',
        startsAt: new Date('2026-07-10T00:00:00.000Z'),
        endsAt: new Date('2026-08-10T00:00:00.000Z'),
        targetPlacements: [
          {
            targetType: 'channel',
            targetId: 'channel-1',
            placementType: 'pre-roll',
          },
        ],
        creatives: [
          {
            placementType: 'pre-roll',
            mediaUrl: 'http://ads.test/launch.mp4',
          } as never,
        ],
      })
    ).rejects.toThrow('Creative mediaUrl must be an absolute HTTPS URL');
  });

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

  it('returns only active, dated, directly targeted playback campaigns with matching creatives', async () => {
    const {
      service,
      campaignRepository,
      campaignCreativeRepository,
      campaignTargetPlacementRepository,
    } = createService();
    const now = new Date('2026-07-12T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    campaignTargetPlacementRepository.find.mockResolvedValue([
      {
        campaignId: 'campaign-1',
        targetType: 'channel',
        targetId: 'channel-1',
        placementType: 'pre-roll',
      },
      {
        campaignId: 'campaign-2',
        targetType: 'community',
        targetId: 'community-1',
        placementType: 'mid-roll',
      },
      {
        campaignId: 'campaign-3',
        targetType: 'channel',
        targetId: 'channel-1',
        placementType: 'pre-roll',
      },
    ]);
    campaignRepository.find.mockResolvedValue([
      {
        id: 'campaign-1',
        businessPageId: 'business-1',
        name: 'Local launch',
        status: 'active',
        budget: 100,
        startsAt: new Date('2026-07-01T00:00:00.000Z'),
        endsAt: new Date('2026-07-31T00:00:00.000Z'),
      },
      {
        id: 'campaign-3',
        businessPageId: 'business-3',
        name: 'Expired launch',
        status: 'active',
        budget: 900,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);
    campaignCreativeRepository.find.mockResolvedValue([
      {
        campaignId: 'campaign-1',
        placementType: 'pre-roll',
        imageUrl: 'https://ads.test/local-launch.mp4',
      },
      {
        campaignId: 'campaign-3',
        placementType: 'pre-roll',
        imageUrl: 'https://ads.test/expired.mp4',
      },
    ]);

    await expect(
      service.getEligiblePlaybackCampaigns({
        channelId: 'channel-1',
        communityId: 'community-1',
        placementType: 'pre-roll',
      })
    ).resolves.toEqual([
      expect.objectContaining({
        campaignId: 'campaign-1',
        targetType: 'channel',
        targetId: 'channel-1',
        placementType: 'pre-roll',
        mediaUrl: 'https://ads.test/local-launch.mp4',
        localityMatch: 'channel-anchor',
      }),
    ]);
    jest.useRealTimers();
  });

  it('normalizes new and legacy media URLs and excludes unusable creatives', async () => {
    const {
      service,
      campaignRepository,
      campaignCreativeRepository,
      campaignTargetPlacementRepository,
    } = createService();
    jest.useFakeTimers().setSystemTime(new Date('2026-07-12T12:00:00.000Z'));
    campaignTargetPlacementRepository.find.mockResolvedValue([
      {
        campaignId: 'new',
        targetType: 'channel',
        targetId: 'channel-1',
        placementType: 'pre-roll',
      },
      {
        campaignId: 'legacy',
        targetType: 'channel',
        targetId: 'channel-1',
        placementType: 'pre-roll',
      },
      {
        campaignId: 'invalid',
        targetType: 'channel',
        targetId: 'channel-1',
        placementType: 'pre-roll',
      },
    ]);
    campaignRepository.find.mockResolvedValue([
      ...['new', 'legacy', 'invalid'].map((id) => ({
        id,
        businessPageId: `business-${id}`,
        name: id,
        status: 'active',
        startsAt: new Date('2026-07-01T00:00:00.000Z'),
        endsAt: new Date('2026-07-31T00:00:00.000Z'),
      })),
    ]);
    campaignCreativeRepository.find.mockResolvedValue([
      {
        campaignId: 'new',
        placementType: 'pre-roll',
        mediaUrl: 'https://ads.test/new.mp4',
        imageUrl: null,
      },
      {
        campaignId: 'legacy',
        placementType: 'pre-roll',
        mediaUrl: null,
        imageUrl: 'https://ads.test/legacy.mp4',
      },
      {
        campaignId: 'invalid',
        placementType: 'pre-roll',
        mediaUrl: 'http://ads.test/invalid.mp4',
        imageUrl: null,
      },
    ]);

    await expect(
      service.getEligiblePlaybackCampaigns({
        channelId: 'channel-1',
        placementType: 'pre-roll',
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campaignId: 'new',
          mediaUrl: 'https://ads.test/new.mp4',
        }),
        expect.objectContaining({
          campaignId: 'legacy',
          mediaUrl: 'https://ads.test/legacy.mp4',
        }),
      ])
    );
    const result = await service.getEligiblePlaybackCampaigns({
      channelId: 'channel-1',
      placementType: 'pre-roll',
    });
    expect(result).toHaveLength(2);
    jest.useRealTimers();
  });

  it('normalizes legacy image URLs for owner campaign reads', async () => {
    const {
      service,
      campaignRepository,
      campaignCreativeRepository,
      campaignTargetPlacementRepository,
    } = createService();
    campaignRepository.find.mockResolvedValue([
      { id: 'campaign-1', userId: 'user-1' },
    ]);
    campaignCreativeRepository.find.mockResolvedValue([
      {
        campaignId: 'campaign-1',
        placementType: 'on-page',
        mediaUrl: null,
        imageUrl: 'https://ads.test/legacy.jpg',
      },
    ]);
    campaignTargetPlacementRepository.find.mockResolvedValue([]);

    await expect(
      service.getOwnerAdvertisingCampaigns('user-1')
    ).resolves.toEqual([
      expect.objectContaining({
        creatives: [
          expect.objectContaining({
            mediaUrl: 'https://ads.test/legacy.jpg',
            imageUrl: 'https://ads.test/legacy.jpg',
          }),
        ],
      }),
    ]);
  });

  it('requires usable HTTPS media for on-page eligibility', async () => {
    const {
      service,
      campaignRepository,
      campaignCreativeRepository,
      campaignTargetPlacementRepository,
    } = createService();
    jest.useFakeTimers().setSystemTime(new Date('2026-07-12T12:00:00.000Z'));
    campaignTargetPlacementRepository.find.mockResolvedValue([
      {
        campaignId: 'invalid',
        targetType: 'community',
        targetId: 'community-1',
        placementType: 'on-page',
      },
    ]);
    campaignRepository.find.mockResolvedValue([
      {
        id: 'invalid',
        status: 'active',
        startsAt: new Date('2026-07-01T00:00:00.000Z'),
        endsAt: new Date('2026-07-31T00:00:00.000Z'),
      },
    ]);
    campaignCreativeRepository.find.mockResolvedValue([
      {
        campaignId: 'invalid',
        placementType: 'on-page',
        imageUrl: 'http://ads.test/invalid.jpg',
      },
    ]);

    await expect(
      service.getEligibleOnPageCampaigns({ communityId: 'community-1' })
    ).resolves.toEqual([]);
    jest.useRealTimers();
  });
});
