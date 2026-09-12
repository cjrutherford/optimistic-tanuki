import { seedStoreCatalogForTenant } from './seed-trainer-store.mjs';

describe('seedStoreCatalogForTenant', () => {
  it('creates an Emberline workspace-owned catalog and representative products', async () => {
    const requests: Array<{ url: string; options?: RequestInit }> = [];
    const fetchJson = jest.fn(async (url: string, options?: RequestInit) => {
      requests.push({ url, options });
      if (url.includes('/store/catalogs/mine')) {
        return { status: 200, data: [] };
      }
      if (url.includes('/store/catalogs?')) {
        return { status: 201, data: { id: 'catalog-emberline' } };
      }
      if (url.includes('/store/products?catalogId=')) {
        return { status: 200, data: [] };
      }
      return { status: 201, data: { id: `product-${requests.length}` } };
    });

    const result = await seedStoreCatalogForTenant({
      tenant: {
        site: { slug: 'emberline-studio' },
        brand: { businessName: 'Emberline Studio' },
        features: { store: { enabled: true } },
        serviceCatalog: { source: 'store' },
      },
      owner: { token: 'owner-token', profileId: 'owner-profile' },
      workspace: { workspaceId: 'workspace-1', slug: 'emberline-studio' },
      fetchJson,
      logger: { log: jest.fn() },
    });

    expect(result.catalogId).toBe('catalog-emberline');
    expect(result.productNames).toEqual(
      expect.arrayContaining([
        'Emberline Studio Mini Print Set',
        'Original Gouache Landscape',
      ])
    );
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringContaining(
            '/store/catalogs/mine?workspaceSlug=emberline-studio'
          ),
        }),
        expect.objectContaining({
          url: expect.stringContaining(
            '/store/products?catalogId=catalog-emberline'
          ),
        }),
      ])
    );
    const createdProducts = requests.filter((request) =>
      request.url.endsWith('/store/products?workspaceSlug=emberline-studio')
    );
    expect(createdProducts).toHaveLength(5);
    expect(createdProducts[0]?.options?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer owner-token' })
    );
    expect(
      createdProducts.every((request) =>
        String(request.options?.body).includes('catalog-emberline')
      )
    ).toBe(true);
  });

  it('reuses existing catalog and products without creating duplicates', async () => {
    const fetchJson = jest.fn(async (url: string) => {
      if (url.includes('/store/catalogs/mine')) {
        return {
          status: 200,
          data: [
            { id: 'catalog-existing', name: 'Emberline Studio Collection' },
          ],
        };
      }
      if (url.includes('/store/products?')) {
        return {
          status: 200,
          data: [
            {
              name: 'Emberline Studio Mini Print Set',
              catalogId: 'catalog-existing',
            },
            {
              name: 'Emberline Studio Sticker Sheet',
              catalogId: 'catalog-existing',
            },
            {
              name: 'Original Gouache Landscape',
              catalogId: 'catalog-existing',
            },
            {
              name: 'Emberline Commission Planning Session',
              catalogId: 'catalog-existing',
            },
            {
              name: 'Emberline Custom Pet Portrait Commission',
              catalogId: 'catalog-existing',
            },
          ],
        };
      }
      throw new Error(`unexpected request: ${url}`);
    });

    await expect(
      seedStoreCatalogForTenant({
        tenant: {
          site: { slug: 'emberline-studio' },
          brand: { businessName: 'Emberline Studio' },
          features: { store: { enabled: true } },
          serviceCatalog: { source: 'store' },
        },
        owner: { token: 'owner-token', profileId: 'owner-profile' },
        workspace: { workspaceId: 'workspace-1', slug: 'emberline-studio' },
        fetchJson,
        logger: { log: jest.fn() },
      })
    ).resolves.toEqual({
      catalogId: 'catalog-existing',
      productNames: [
        'Emberline Studio Mini Print Set',
        'Emberline Studio Sticker Sheet',
        'Original Gouache Landscape',
        'Emberline Commission Planning Session',
        'Emberline Custom Pet Portrait Commission',
      ],
    });
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});
