import {
  BillingProviderAdapter,
  CreateCheckoutInput,
  CreateCheckoutResult,
  ProcessWebhookInput,
  ProviderCatalogStore,
  ProviderStoreCatalog,
  ProviderStoreConfig,
  ProviderWebhookResult,
} from './provider-adapter';

export class LemonSqueezyAdapter implements BillingProviderAdapter {
  constructor(private readonly catalog: ProviderStoreCatalog) {}

  createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const storeConfig = this.getStoreConfig(input.appScope);
    const providerReference = input.providerPriceRef || storeConfig.storeId;
    const customData = {
      ...input.customData,
      app_scope: input.appScope,
    };
    const query = Object.entries(customData)
      .map(
        ([key, value]) =>
          `checkout[custom][${key}]=${encodeURIComponent(String(value))}`,
      )
      .join('&');

    return Promise.resolve({
      provider: 'lemon-squeezy',
      checkoutUrl: `https://store.lemonsqueezy.com/checkout/buy/${providerReference}?${query}`,
      providerReference,
    });
  }

  processWebhook(input: ProcessWebhookInput): Promise<ProviderWebhookResult> {
    const meta = (input.payload['meta'] as Record<string, unknown>) ?? {};
    const customData =
      this.toStringRecord(meta['custom_data']) ??
      this.toStringRecord(meta['customData']) ??
      {};

    return Promise.resolve({
      provider: 'lemon-squeezy',
      eventType: input.eventType,
      customData,
      rawPayload: input.payload,
    });
  }

  listCatalogStores(appScope?: string): ProviderCatalogStore[] {
    if (appScope && this.catalog.stores[appScope]) {
      return [{ appScope, config: this.catalog.stores[appScope] }];
    }

    if (appScope && appScope !== 'default') {
      return [];
    }

    return [
      { appScope: 'default', config: this.catalog.default },
      ...Object.entries(this.catalog.stores).map(([scope, config]) => ({
        appScope: scope,
        config,
      })),
    ];
  }

  getStoreConfig(appScope: string): ProviderStoreConfig {
    if (appScope && this.catalog.stores[appScope]) {
      return this.catalog.stores[appScope];
    }

    return this.catalog.default;
  }

  private toStringRecord(
    input: unknown,
  ): Record<string, string> | undefined {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [
        key,
        String(value),
      ]),
    );
  }
}
