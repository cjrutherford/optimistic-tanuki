export type BillingProvider = 'lemon-squeezy';

export type ProviderCheckoutCustomData = Record<
  string,
  string | number | boolean
>;

export interface CreateCheckoutInput {
  appScope: string;
  providerPriceRef?: string | null;
  customData: ProviderCheckoutCustomData;
}

export interface CreateCheckoutResult {
  provider: BillingProvider;
  checkoutUrl: string;
  providerReference: string;
}

export interface ProcessWebhookInput {
  eventType: string;
  payload: Record<string, unknown>;
}

export interface ProviderWebhookResult {
  provider: BillingProvider;
  eventType: string;
  customData: Record<string, string>;
  rawPayload: Record<string, unknown>;
}

export interface ProviderStoreConfig {
  apiKey: string;
  storeId: string;
}

export interface ProviderStoreCatalog {
  default: ProviderStoreConfig;
  stores: Record<string, ProviderStoreConfig>;
}

export interface ProviderCatalogStore {
  appScope: string;
  config: ProviderStoreConfig;
}

export interface BillingProviderAdapter {
  createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult>;
  processWebhook(input: ProcessWebhookInput): Promise<ProviderWebhookResult>;
  listCatalogStores(appScope?: string): ProviderCatalogStore[];
}
