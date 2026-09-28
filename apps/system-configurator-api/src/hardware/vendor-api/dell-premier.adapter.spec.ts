import {
  DellPremierAdapter,
  type DellPremierHttpResponse,
  type DellPremierHttpTransport,
} from './dell-premier.adapter';

const configured = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  partnerIdentifier: 'HAI-PREMIER',
  country: 'US',
  currency: 'USD',
};

function response(status: number, value: unknown): DellPremierHttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  };
}

describe('DellPremierAdapter', () => {
  it('fails closed unless a complete Premier integration is configured', async () => {
    const transport = jest.fn<
      ReturnType<DellPremierHttpTransport>,
      Parameters<DellPremierHttpTransport>
    >();
    const adapter = new DellPremierAdapter({
      credentials: { clientId: configured.clientId },
      transport,
      normalizeCatalog: () => [],
    });

    await expect(adapter.fetchCatalog()).rejects.toThrow(/not configured/);
    expect(transport).not.toHaveBeenCalled();
  });

  it('uses Dell OAuth and the documented Catalog Search route, then normalizes with an injected partner mapper', async () => {
    const urls: string[] = [];
    const requests: Parameters<DellPremierHttpTransport>[1][] = [];
    const transport: DellPremierHttpTransport = async (url, init) => {
      urls.push(url);
      requests.push(init);
      if (
        url ===
        'https://dellidentity-corp.dell.com/di/proxy/l7/api/v3/oauth/token'
      ) {
        return response(200, {
          access_token: 'test-access-token',
          expires_in: '3600',
          token_type: 'Bearer',
        });
      }
      return response(200, {
        partnerPayload: 'Dell schema is awaiting enablement and examples',
      });
    };
    const adapter = new DellPremierAdapter({
      credentials: configured,
      transport,
      now: () => Date.parse('2026-09-27T12:00:00Z'),
      sleep: async () => undefined,
      normalizeCatalog: (payload) => {
        expect(payload).toEqual({
          partnerPayload: 'Dell schema is awaiting enablement and examples',
        });
        return [
          {
            sourceId: 'dell-config-1',
            sourceSku: 'SKU-123',
            productName: 'Business workstation',
            amount: 1299.99,
            currency: 'USD',
            availability: 'in_stock',
            sourceUrl: 'https://www.dell.com/product/sku-123',
          },
        ];
      },
    });

    const offers = await adapter.fetchCatalog();

    expect(urls[0]).toBe(
      'https://dellidentity-corp.dell.com/di/proxy/l7/api/v3/oauth/token'
    );
    expect(requests[0].method).toBe('POST');
    expect(requests[0].headers['content-type']).toBe(
      'application/x-www-form-urlencoded'
    );
    expect(requests[0].body).toContain('grant_type=client_credentials');
    expect(requests[0].body).toContain('client_secret=test-client-secret');

    const catalogUrl = new URL(urls[1]);
    expect(catalogUrl.origin).toBe('https://apigtwb2c.us.dell.com');
    expect(catalogUrl.pathname).toBe(
      '/PROD/CatalogAPI/Catalog/Search/HAI-PREMIER'
    );
    expect(catalogUrl.searchParams.get('ctry')).toBe('US');
    expect(catalogUrl.searchParams.get('ccy')).toBe('USD');
    expect(requests[1].method).toBe('POST');
    expect(requests[1].headers.authorization).toBe('Bearer test-access-token');
    expect(requests[1].headers.accept).toBe('application/json');
    expect(offers).toEqual([
      {
        vendor: 'Dell OEM',
        sourceId: 'dell-config-1',
        sourceSku: 'SKU-123',
        productName: 'Business workstation',
        sourceUrl: 'https://www.dell.com/product/sku-123',
        amount: 1299.99,
        currency: 'USD',
        availability: 'in_stock',
        observedAt: new Date('2026-09-27T12:00:00Z'),
      },
    ]);
  });

  it('caches Dell bearer tokens until the expiry safety window', async () => {
    let currentTime = Date.parse('2026-09-27T12:00:00Z');
    const urls: string[] = [];
    const transport: DellPremierHttpTransport = async (url) => {
      urls.push(url);
      return url.includes('/oauth/token')
        ? response(200, {
            access_token: `token-${urls.length}`,
            expires_in: '3600',
          })
        : response(200, {});
    };
    const adapter = new DellPremierAdapter({
      credentials: configured,
      transport,
      now: () => currentTime,
      sleep: async () => undefined,
      normalizeCatalog: () => [],
    });

    await adapter.fetchCatalog();
    currentTime += 60_000;
    await adapter.fetchCatalog();

    expect(urls.filter((url) => url.includes('/oauth/token'))).toHaveLength(1);
    expect(urls.filter((url) => url.includes('/Catalog/Search/'))).toHaveLength(
      2
    );
  });

  it('does not expose Dell response bodies in API errors', async () => {
    const transport: DellPremierHttpTransport = jest
      .fn<
        ReturnType<DellPremierHttpTransport>,
        Parameters<DellPremierHttpTransport>
      >()
      .mockResolvedValueOnce(
        response(200, { access_token: 'token', expires_in: '3600' })
      )
      .mockResolvedValueOnce(
        response(403, { message: 'private partner diagnostics' })
      );
    const adapter = new DellPremierAdapter({
      credentials: configured,
      transport,
      sleep: async () => undefined,
      normalizeCatalog: () => [],
    });

    await expect(adapter.fetchCatalog()).rejects.toThrow(
      'Dell Premier API returned HTTP 403.'
    );
  });
});
