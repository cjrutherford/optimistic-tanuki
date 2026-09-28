import {
  AmazonBusinessAdapter,
  AmazonBusinessApiError,
  type AmazonBusinessHttpResponse,
  type AmazonBusinessHttpTransport,
} from './amazon-business.adapter';

const credentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  refreshToken: 'test-refresh-token',
  userEmail: 'buyer@example.com',
};

function response(status: number, value: unknown): AmazonBusinessHttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  };
}

describe('AmazonBusinessAdapter', () => {
  it('fails closed without all account credentials and makes no request', async () => {
    const transport = jest.fn<
      ReturnType<AmazonBusinessHttpTransport>,
      Parameters<AmazonBusinessHttpTransport>
    >();
    const adapter = new AmazonBusinessAdapter({
      credentials: { clientId: credentials.clientId },
      transport,
    });

    await expect(
      adapter.searchProducts({
        keywords: 'workstation',
        productRegion: 'US',
        locale: 'en-US',
      })
    ).rejects.toThrow(/not configured/);
    expect(transport).not.toHaveBeenCalled();
  });

  it('uses LWA refresh credentials and documented Product Search fields, then normalizes offers', async () => {
    const urls: string[] = [];
    const requests: Parameters<AmazonBusinessHttpTransport>[1][] = [];
    const transport: AmazonBusinessHttpTransport = async (url, init) => {
      urls.push(url);
      requests.push(init);
      if (url === 'https://api.amazon.com/auth/o2/token') {
        return response(200, {
          access_token: 'test-access-token',
          expires_in: 3600,
          token_type: 'bearer',
        });
      }
      return response(200, {
        products: [
          {
            asin: 'B012345678',
            title: 'Business workstation',
            url: 'https://www.amazon.com/dp/B012345678',
            includedDataTypes: {
              OFFERS: [
                {
                  offerId: 'opaque-offer-id',
                  availability: 'In Stock.',
                  quantityInStock: 7,
                  price: { value: { amount: 1299.99, currencyCode: 'USD' } },
                },
              ],
            },
          },
        ],
      });
    };
    const adapter = new AmazonBusinessAdapter({
      credentials,
      transport,
      now: () => Date.parse('2026-09-27T12:00:00Z'),
      sleep: async () => undefined,
    });

    const result = await adapter.searchProducts({
      keywords: '  workstation  ',
      productRegion: 'US',
      locale: 'en-US',
      shippingPostalCode: '10001',
      pageSize: 99,
    });

    expect(urls[0]).toBe('https://api.amazon.com/auth/o2/token');
    expect(requests[0].method).toBe('POST');
    expect(requests[0].headers['content-type']).toBe(
      'application/x-www-form-urlencoded;charset=UTF-8'
    );
    expect(requests[0].body).toContain('grant_type=refresh_token');
    expect(requests[0].body).toContain('client_secret=test-client-secret');

    const searchUrl = new URL(urls[1]);
    expect(searchUrl.origin).toBe('https://na.business-api.amazon.com');
    expect(searchUrl.pathname).toBe('/products/2020-08-26/products');
    expect(searchUrl.searchParams.get('keywords')).toBe('workstation');
    expect(searchUrl.searchParams.get('productRegion')).toBe('US');
    expect(searchUrl.searchParams.get('locale')).toBe('en-US');
    expect(searchUrl.searchParams.get('facets')).toBe('OFFERS');
    expect(searchUrl.searchParams.get('inclusionsForOffers')).toBe(
      'offerId,price,availability'
    );
    expect(searchUrl.searchParams.get('availability')).toBe('InStockOnly');
    expect(searchUrl.searchParams.get('pageSize')).toBe('24');
    expect(searchUrl.searchParams.get('shippingPostalCode')).toBe('10001');
    expect(requests[1].headers['x-amz-access-token']).toBe('test-access-token');
    expect(requests[1].headers['x-amz-user-email']).toBe('buyer@example.com');
    expect(result).toEqual([
      {
        vendor: 'Amazon Business',
        sourceId: 'opaque-offer-id',
        sourceSku: 'opaque-offer-id',
        productName: 'Business workstation',
        sourceUrl: 'https://www.amazon.com/dp/B012345678',
        amount: 1299.99,
        currency: 'USD',
        availability: 'in_stock',
        observedAt: new Date('2026-09-27T12:00:00Z'),
      },
    ]);
  });

  it('reuses a refreshed access token until its expiry window', async () => {
    let currentTime = Date.parse('2026-09-27T12:00:00Z');
    const urls: string[] = [];
    const transport: AmazonBusinessHttpTransport = async (url) => {
      urls.push(url);
      if (url === 'https://api.amazon.com/auth/o2/token') {
        return response(200, {
          access_token: `token-${urls.length}`,
          expires_in: 3600,
        });
      }
      return response(200, { products: [] });
    };
    const adapter = new AmazonBusinessAdapter({
      credentials,
      transport,
      now: () => currentTime,
      sleep: async () => undefined,
    });
    const search = { keywords: 'memory', productRegion: 'US', locale: 'en-US' };

    await adapter.searchProducts(search);
    currentTime += 60_000;
    await adapter.searchProducts(search);
    expect(
      urls.filter((url) => url === 'https://api.amazon.com/auth/o2/token')
    ).toHaveLength(1);
    expect(
      urls.filter((url) => url.includes('/products/2020-08-26/products'))
    ).toHaveLength(2);
  });

  it('uses the in-stock search filter when availability text is a shipping estimate and skips incomplete offers', async () => {
    const transport: AmazonBusinessHttpTransport = async (url) =>
      url === 'https://api.amazon.com/auth/o2/token'
        ? response(200, { access_token: 'token', expires_in: 3600 })
        : response(200, {
            products: [
              {
                asin: 'B012345678',
                title: 'A product',
                includedDataTypes: {
                  OFFERS: [
                    {
                      offerId: 'available-offer',
                      availability: 'Ships in 3 weeks',
                      price: { value: { amount: 20, currencyCode: 'USD' } },
                    },
                    { offerId: 'unpriced-offer', availability: 'In Stock.' },
                    {
                      availability: 'In Stock.',
                      price: { value: { amount: 25, currencyCode: 'USD' } },
                    },
                  ],
                },
              },
            ],
          });
    const adapter = new AmazonBusinessAdapter({
      credentials,
      transport,
      sleep: async () => undefined,
    });

    const result = await adapter.searchProducts({
      keywords: 'adapter',
      productRegion: 'US',
      locale: 'en-US',
    });

    expect(result).toHaveLength(1);
    expect(result[0].availability).toBe('in_stock');
    expect(result[0].amount).toBe(20);
  });

  it('does not retry rate-limit or authorization responses and exposes status only', async () => {
    const transport: AmazonBusinessHttpTransport = jest
      .fn<
        ReturnType<AmazonBusinessHttpTransport>,
        Parameters<AmazonBusinessHttpTransport>
      >()
      .mockResolvedValueOnce(
        response(200, { access_token: 'token', expires_in: 3600 })
      )
      .mockResolvedValueOnce(
        response(429, { message: 'contains no surfaced detail' })
      );
    const adapter = new AmazonBusinessAdapter({
      credentials,
      transport,
      sleep: async () => undefined,
    });

    await expect(
      adapter.searchProducts({
        keywords: 'adapter',
        productRegion: 'US',
        locale: 'en-US',
      })
    ).rejects.toMatchObject<Partial<AmazonBusinessApiError>>({ status: 429 });
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
