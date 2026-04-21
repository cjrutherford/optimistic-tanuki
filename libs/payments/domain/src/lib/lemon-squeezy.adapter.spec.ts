import { LemonSqueezyAdapter } from './lemon-squeezy.adapter';

describe('LemonSqueezyAdapter', () => {
  const adapter = new LemonSqueezyAdapter({
    default: {
      apiKey: 'default-key',
      storeId: 'default-store',
    },
    stores: {
      'local-hub': {
        apiKey: 'hub-key',
        storeId: 'hub-store',
      },
    },
  });

  it('creates checkout URLs from provider refs and caller custom data', async () => {
    await expect(
      adapter.createCheckoutSession({
        appScope: 'local-hub',
        providerPriceRef: 'variant-123',
        customData: {
          business_page_id: 'page-1',
          tier: 'pro',
        },
      }),
    ).resolves.toEqual({
      provider: 'lemon-squeezy',
      checkoutUrl:
        'https://store.lemonsqueezy.com/checkout/buy/variant-123?checkout[custom][business_page_id]=page-1&checkout[custom][tier]=pro&checkout[custom][app_scope]=local-hub',
      providerReference: 'variant-123',
    });
  });

  it('falls back to the app store id when no provider price ref exists', async () => {
    await expect(
      adapter.createCheckoutSession({
        appScope: 'local-hub',
        customData: {
          donation_id: 'donation-1',
        },
      }),
    ).resolves.toMatchObject({
      checkoutUrl:
        'https://store.lemonsqueezy.com/checkout/buy/hub-store?checkout[custom][donation_id]=donation-1&checkout[custom][app_scope]=local-hub',
      providerReference: 'hub-store',
    });
  });

  it('normalizes webhook payloads into provider-neutral custom data', async () => {
    await expect(
      adapter.processWebhook({
        eventType: 'subscription_created',
        payload: {
          meta: {
            custom_data: {
              community_id: 'community-1',
              app_scope: 'local-hub',
            },
          },
        },
      }),
    ).resolves.toEqual({
      provider: 'lemon-squeezy',
      eventType: 'subscription_created',
      customData: {
        community_id: 'community-1',
        app_scope: 'local-hub',
      },
      rawPayload: {
        meta: {
          custom_data: {
            community_id: 'community-1',
            app_scope: 'local-hub',
          },
        },
      },
    });
  });
});
