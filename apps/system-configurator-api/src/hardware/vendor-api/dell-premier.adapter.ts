import type {
  CreateSupplierOfferDto,
  SupplierOfferAvailability,
} from '@optimistic-tanuki/models';

const DEFAULT_TOKEN_URL =
  'https://dellidentity-corp.dell.com/di/proxy/l7/api/v3/oauth/token';
const DEFAULT_CATALOG_API_BASE_URL =
  'https://apigtwb2c.us.dell.com/PROD/CatalogAPI';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 30_000;
const MIN_CATALOG_REQUEST_INTERVAL_MS = 2_000;

export interface DellPremierCredentials {
  clientId?: string;
  clientSecret?: string;
  /** Dell-provisioned Premier customer/partner identifier used in the route. */
  partnerIdentifier?: string;
  country?: string;
  currency?: string;
}

/**
 * Dell's public Catalog Pull docs do not publish the Catalog Search request
 * model or response schema. Implementations must provide a mapper based on the
 * response contract Dell provisions for the customer's Premier integration.
 */
export type DellPremierCatalogOffer = Omit<
  CreateSupplierOfferDto,
  'vendor' | 'observedAt'
>;

export interface DellPremierHttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type DellPremierHttpTransport = (
  url: string,
  init: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<DellPremierHttpResponse>;

export interface DellPremierAdapterOptions {
  credentials: DellPremierCredentials;
  /** Override for Dell-provisioned environments and deterministic tests. */
  tokenUrl?: string;
  /** Dell documents https://apigtwb2c.us.dell.com/PROD/CatalogAPI. */
  catalogApiBaseUrl?: string;
  transport?: DellPremierHttpTransport;
  /** Required until Dell supplies the customer-specific catalog schema. */
  normalizeCatalog: (payload: unknown) => DellPremierCatalogOffer[];
  timeoutMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export type DellPremierSupplierOffer = Omit<
  CreateSupplierOfferDto,
  'observedAt'
> & {
  observedAt: Date;
};

interface CachedAccessToken {
  value: string;
  expiresAt: number;
}

type RecordValue = Record<string, unknown>;

/**
 * Dell Premier Catalog Pull adapter. It implements the documented OAuth and
 * catalog transport contract, while requiring a partner-provisioned mapper
 * rather than assuming undocumented response fields. Credentials, URLs,
 * transport and mapper are supplied by the integration owner.
 */
export class DellPremierAdapter {
  private readonly transport: DellPremierHttpTransport;
  private readonly tokenUrl: string;
  private readonly catalogApiBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private cachedAccessToken?: CachedAccessToken;
  private tokenRequest?: Promise<string>;
  private lastCatalogRequestAt = 0;
  private rateQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: DellPremierAdapterOptions) {
    this.transport = options.transport ?? defaultTransport;
    this.tokenUrl = validateHttpsUrl(
      options.tokenUrl ?? DEFAULT_TOKEN_URL,
      'token URL'
    );
    this.catalogApiBaseUrl = validateHttpsUrl(
      options.catalogApiBaseUrl ?? DEFAULT_CATALOG_API_BASE_URL,
      'catalog API base URL'
    ).replace(/\/$/, '');
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
        credentials.partnerIdentifier?.trim() &&
        credentials.country?.trim() &&
        /^[A-Za-z]{2}$/.test(credentials.country) &&
        credentials.currency?.trim() &&
        /^[A-Za-z]{3}$/.test(credentials.currency)
    );
  }

  async fetchCatalog(): Promise<DellPremierSupplierOffer[]> {
    this.assertConfigured();
    const credentials = this.options.credentials;
    const token = await this.getAccessToken();
    await this.acquireCatalogRateSlot();

    // Dell's v2 public documentation identifies this route and query string.
    // Dell's generated cURL example uses POST and does not include a body.
    const url = new URL(
      `${this.catalogApiBaseUrl}/Catalog/Search/${encodeURIComponent(
        credentials.partnerIdentifier!.trim()
      )}`
    );
    url.searchParams.set('ctry', credentials.country!.trim().toUpperCase());
    url.searchParams.set('ccy', credentials.currency!.trim().toUpperCase());
    const response = await this.request(url.toString(), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new DellPremierApiError(response.status);

    const offers = this.options.normalizeCatalog(await response.json());
    const observedAt = new Date(this.now());
    return offers.flatMap((offer) => normalizeOffer(offer, observedAt));
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        'Dell Premier Catalog API is not configured: client ID, client secret, partner identifier, country, and currency are required.'
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
      client_id: credentials.clientId!.trim(),
      client_secret: credentials.clientSecret!.trim(),
      grant_type: 'client_credentials',
    }).toString();
    const response = await this.request(this.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok)
      throw new DellPremierApiError(
        response.status,
        'Dell Premier token request failed'
      );

    const payload = asRecord(await response.json());
    if (
      typeof payload.access_token !== 'string' ||
      !payload.access_token.trim()
    ) {
      throw new Error(
        'Dell Premier token response did not include an access token.'
      );
    }
    const rawExpiresIn = payload.expires_in;
    const expiresIn =
      typeof rawExpiresIn === 'number'
        ? rawExpiresIn
        : typeof rawExpiresIn === 'string'
        ? Number(rawExpiresIn)
        : Number.NaN;
    this.cachedAccessToken = {
      value: payload.access_token,
      expiresAt:
        this.now() +
        (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
    };
    return payload.access_token;
  }

  private async request(
    url: string,
    init: Parameters<DellPremierHttpTransport>[1]
  ): Promise<DellPremierHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.transport(url, { ...init, signal: controller.signal });
    } catch {
      // Deliberately omit URLs, headers and response details to keep credentials
      // and bearer tokens out of application error logs.
      throw new Error('Dell Premier API request failed or timed out.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async acquireCatalogRateSlot(): Promise<void> {
    let release!: () => void;
    const previous = this.rateQueue;
    this.rateQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const waitMs =
        this.lastCatalogRequestAt +
        MIN_CATALOG_REQUEST_INTERVAL_MS -
        this.now();
      if (this.lastCatalogRequestAt && waitMs > 0) await this.sleep(waitMs);
      this.lastCatalogRequestAt = this.now();
    } finally {
      release();
    }
  }
}

export class DellPremierApiError extends Error {
  constructor(
    readonly status: number,
    message = `Dell Premier API returned HTTP ${status}.`
  ) {
    super(message);
    this.name = 'DellPremierApiError';
  }
}

function normalizeOffer(
  offer: DellPremierCatalogOffer,
  observedAt: Date
): DellPremierSupplierOffer[] {
  if (!offer || typeof offer !== 'object') return [];
  const {
    sourceId,
    sourceSku,
    productName,
    amount,
    currency,
    availability,
    sourceUrl,
    hardwarePartId,
  } = offer;
  if (
    !nonEmptyText(sourceId, 255) ||
    !nonEmptyText(sourceSku, 255) ||
    !nonEmptyText(productName, 512) ||
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    Math.round(amount * 100) !== amount * 100 ||
    typeof currency !== 'string' ||
    !/^[A-Za-z]{3}$/.test(currency) ||
    !isAvailability(availability) ||
    (sourceUrl !== undefined &&
      sourceUrl !== null &&
      !validHttpUrl(sourceUrl)) ||
    (hardwarePartId !== undefined &&
      hardwarePartId !== null &&
      typeof hardwarePartId !== 'string')
  )
    return [];

  return [
    {
      vendor: 'Dell OEM',
      sourceId,
      sourceSku,
      productName,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(hardwarePartId ? { hardwarePartId } : {}),
      amount,
      currency: currency.toUpperCase(),
      availability,
      observedAt,
    },
  ];
}

function isAvailability(value: unknown): value is SupplierOfferAvailability {
  return (
    value === 'in_stock' ||
    value === 'backorder' ||
    value === 'out_of_stock' ||
    value === 'unknown'
  );
}

function nonEmptyText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function validHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function validateHttpsUrl(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(
      `Dell Premier ${label} must be a valid HTTPS URL without credentials or query parameters.`
    );
  }
}

function asRecord(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

const defaultTransport: DellPremierHttpTransport = async (url, init) => {
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json() as Promise<unknown>,
  };
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
