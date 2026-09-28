import {
  type CreateSupplierOfferDto,
  type SupplierOfferAvailability,
} from '@optimistic-tanuki/models';

const TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const PRODUCT_SEARCH_PATH = '/products/2020-08-26/products';
const MIN_API_REQUEST_INTERVAL_MS = 2_000; // Amazon's documented default is 0.5 rps.
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_PAGE_SIZE = 24;

export interface AmazonBusinessCredentials {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  /** Amazon Business user account that has consented to this app. */
  userEmail?: string;
}

export interface AmazonBusinessSearchOptions {
  keywords: string;
  productRegion: string;
  locale: string;
  shippingRegion?: string;
  shippingPostalCode?: string;
  pageSize?: number;
  pageNumber?: number;
}

export type AmazonBusinessSupplierOffer = Omit<
  CreateSupplierOfferDto,
  'observedAt'
> & {
  observedAt: Date;
};

export interface AmazonBusinessHttpResponse {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
}

export type AmazonBusinessHttpTransport = (
  url: string,
  init: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<AmazonBusinessHttpResponse>;

export interface AmazonBusinessAdapterOptions {
  credentials: AmazonBusinessCredentials;
  transport?: AmazonBusinessHttpTransport;
  apiBaseUrl?: string;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

type RecordValue = Record<string, unknown>;

interface CachedAccessToken {
  value: string;
  expiresAt: number;
}

/**
 * Amazon Business Product Search connector. Credentials and transport are
 * supplied by the owner so tests and deployments never need embedded secrets.
 * No request is made unless all four account values are configured.
 */
export class AmazonBusinessAdapter {
  private readonly transport: AmazonBusinessHttpTransport;
  private readonly configuredApiBaseUrl?: string;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private cachedAccessToken?: CachedAccessToken;
  private tokenRequest?: Promise<string>;
  private lastApiRequestAt = 0;
  private rateQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: AmazonBusinessAdapterOptions) {
    this.transport = options.transport ?? defaultTransport;
    this.configuredApiBaseUrl = options.apiBaseUrl
      ? validateApiBaseUrl(options.apiBaseUrl)
      : undefined;
    this.timeoutMs = Math.min(
      MAX_TIMEOUT_MS,
      Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    );
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? delay;
  }

  isConfigured(): boolean {
    const credentials = this.options.credentials;
    return Boolean(
      credentials.clientId?.trim() &&
        credentials.clientSecret?.trim() &&
        credentials.refreshToken?.trim() &&
        credentials.userEmail?.trim() &&
        isValidEmail(credentials.userEmail)
    );
  }

  async searchProducts(
    options: AmazonBusinessSearchOptions
  ): Promise<AmazonBusinessSupplierOffer[]> {
    this.assertConfigured();
    validateSearchOptions(options);

    const token = await this.getAccessToken();
    await this.acquireApiRateSlot();

    const query = new URLSearchParams({
      keywords: options.keywords.trim(),
      productRegion: options.productRegion,
      locale: options.locale,
      facets: 'OFFERS',
      inclusionsForOffers: 'offerId,price,availability',
      availability: 'InStockOnly',
      pageSize: String(
        Math.min(MAX_PAGE_SIZE, Math.max(1, options.pageSize ?? MAX_PAGE_SIZE))
      ),
      pageNumber: String(Math.min(13, Math.max(0, options.pageNumber ?? 0))),
    });
    if (options.shippingRegion)
      query.set('shippingRegion', options.shippingRegion);
    if (options.shippingPostalCode)
      query.set('shippingPostalCode', options.shippingPostalCode);

    const apiBaseUrl =
      this.configuredApiBaseUrl ??
      apiBaseUrlForProductRegion(options.productRegion);
    const response = await this.request(
      `${apiBaseUrl}${PRODUCT_SEARCH_PATH}?${query}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-amz-access-token': token,
          'x-amz-user-email': this.options.credentials.userEmail!.trim(),
        },
      }
    );
    if (!response.ok) {
      // Do not include the response body, request URL, or headers in errors.
      throw new AmazonBusinessApiError(response.status);
    }

    const payload = asRecord(await response.json());
    const products = Array.isArray(payload.products) ? payload.products : [];
    const observedAt = new Date(this.now());
    return products.flatMap((value) => normalizeProduct(value, observedAt));
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        'Amazon Business API is not configured: client ID, client secret, refresh token, and consenting user email are required.'
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    const current = this.cachedAccessToken;
    if (current && current.expiresAt - 60_000 > this.now())
      return current.value;
    if (this.tokenRequest) return this.tokenRequest;

    this.tokenRequest = this.refreshAccessToken();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }

  private async refreshAccessToken(): Promise<string> {
    const credentials = this.options.credentials;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken!.trim(),
      client_id: credentials.clientId!.trim(),
      client_secret: credentials.clientSecret!.trim(),
    }).toString();
    const response = await this.request(TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body,
    });
    if (!response.ok) {
      throw new AmazonBusinessApiError(
        response.status,
        'Amazon Business token refresh failed'
      );
    }

    const payload = asRecord(await response.json());
    if (
      typeof payload.access_token !== 'string' ||
      !payload.access_token.trim()
    ) {
      throw new Error(
        'Amazon Business token response did not include an access token.'
      );
    }
    const expiresIn =
      typeof payload.expires_in === 'number' &&
      Number.isFinite(payload.expires_in)
        ? Math.max(1, payload.expires_in)
        : 3600;
    this.cachedAccessToken = {
      value: payload.access_token,
      expiresAt: this.now() + expiresIn * 1000,
    };
    return payload.access_token;
  }

  private async request(
    url: string,
    init: Parameters<AmazonBusinessHttpTransport>[1]
  ): Promise<AmazonBusinessHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.transport(url, { ...init, signal: controller.signal });
    } catch {
      throw new Error('Amazon Business API request failed or timed out.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async acquireApiRateSlot(): Promise<void> {
    let release!: () => void;
    const previous = this.rateQueue;
    this.rateQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const waitMs =
        this.lastApiRequestAt + MIN_API_REQUEST_INTERVAL_MS - this.now();
      if (this.lastApiRequestAt && waitMs > 0) await this.sleep(waitMs);
      this.lastApiRequestAt = this.now();
    } finally {
      release();
    }
  }
}

export class AmazonBusinessApiError extends Error {
  constructor(
    readonly status: number,
    message = `Amazon Business API returned HTTP ${status}.`
  ) {
    super(message);
    this.name = 'AmazonBusinessApiError';
  }
}

function normalizeProduct(
  value: unknown,
  observedAt: Date
): AmazonBusinessSupplierOffer[] {
  const product = asRecord(value);
  const asin = text(product.asin);
  const productName = text(product.title);
  if (!asin || !productName) return [];
  const data = asRecord(product.includedDataTypes);
  const offers = Array.isArray(data.OFFERS) ? data.OFFERS : [];

  return offers.flatMap((value) => {
    const offer = asRecord(value);
    const offerId = text(offer.offerId);
    const price = asRecord(offer.price);
    const money = asRecord(price.value);
    const amount = typeof money.amount === 'number' ? money.amount : Number.NaN;
    const currency = text(money.currencyCode);
    if (
      !offerId ||
      offerId.length > 255 ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !currency
    ) {
      return [];
    }

    return [
      {
        vendor: 'Amazon Business',
        sourceId: offerId,
        sourceSku: offerId,
        productName,
        ...(validHttpUrl(product.url) ? { sourceUrl: product.url } : {}),
        amount: roundCurrency(amount),
        currency: currency.toUpperCase(),
        // Search is explicitly constrained to Amazon's documented InStockOnly
        // filter. Honor a returned unavailable status if present; otherwise the
        // API filter is the evidence for in-stock status.
        availability: normalizeAvailability(offer),
        observedAt,
      },
    ];
  });
}

function normalizeAvailability(offer: RecordValue): SupplierOfferAvailability {
  const stock = offer.quantityInStock;
  if (typeof stock === 'number' && Number.isFinite(stock)) {
    return stock > 0 ? 'in_stock' : 'out_of_stock';
  }
  const availability = text(offer.availability)?.toLowerCase() ?? '';
  if (/\bin stock\b|available now/.test(availability)) return 'in_stock';
  if (/out of stock|currently unavailable|unavailable/.test(availability))
    return 'out_of_stock';
  return 'in_stock'; // caller uses the documented InStockOnly search filter.
}

function validateSearchOptions(options: AmazonBusinessSearchOptions): void {
  if (!options.keywords.trim() || options.keywords.length > 200) {
    throw new Error(
      'Amazon Business search keywords must contain 1 to 200 characters.'
    );
  }
  const supportedRegions = new Set([
    'US',
    'CA',
    'MX',
    'UK',
    'DE',
    'FR',
    'IT',
    'ES',
    'IN',
    'JP',
    'AU',
  ]);
  if (!supportedRegions.has(options.productRegion)) {
    throw new Error(
      'Amazon Business productRegion must be an official marketplace code.'
    );
  }
  if (!/^[a-zA-Z]{2,3}[-_][a-zA-Z]{2,3}$/.test(options.locale)) {
    throw new Error(
      'Amazon Business locale must be a language and region tag.'
    );
  }
  if (options.shippingPostalCode && options.shippingPostalCode.length > 32) {
    throw new Error('Amazon Business shipping postal code is too long.');
  }
  if (
    options.pageNumber !== undefined &&
    (!Number.isInteger(options.pageNumber) ||
      options.pageNumber < 0 ||
      options.pageNumber > 13)
  ) {
    throw new Error('Amazon Business pageNumber must be between 0 and 13.');
  }
}

function validateApiBaseUrl(value: string): string {
  const url = new URL(value);
  const allowedHosts = new Set([
    'api.business.amazon.com',
    'na.business-api.amazon.com',
    'eu.business-api.amazon.com',
    'fe.business-api.amazon.com',
  ]);
  if (
    url.protocol !== 'https:' ||
    !allowedHosts.has(url.hostname) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Amazon Business API base URL must be an official HTTPS API host.'
    );
  }
  return url.origin;
}

function apiBaseUrlForProductRegion(productRegion: string): string {
  const northAmerica = new Set(['US', 'CA', 'MX']);
  const europe = new Set(['UK', 'DE', 'FR', 'IT', 'ES', 'IN']);
  const farEast = new Set(['JP', 'AU']);
  if (northAmerica.has(productRegion))
    return 'https://na.business-api.amazon.com';
  if (europe.has(productRegion)) return 'https://eu.business-api.amazon.com';
  if (farEast.has(productRegion)) return 'https://fe.business-api.amazon.com';
  // validateSearchOptions normally rejects this first; keep URL selection closed too.
  throw new Error(
    'Amazon Business productRegion is not a supported marketplace.'
  );
}

function asRecord(value: unknown): RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function validHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isValidEmail(value: string | undefined): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const defaultTransport: AmazonBusinessHttpTransport = async (url, init) => {
  const response = await fetch(url, init);
  return response;
};
