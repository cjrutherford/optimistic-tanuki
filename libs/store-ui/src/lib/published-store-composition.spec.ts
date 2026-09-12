import { resolveStorePublishedComposition } from './published-store-composition';

describe('Store published composition', () => {
  it('resolves the shared published policy for public catalog content', () => {
    expect(resolveStorePublishedComposition()).toEqual(
      expect.objectContaining({
        kind: 'capability',
        capabilityId: 'store.catalog',
        placement: 'public-content',
        resourceRef: { type: 'store-catalog', id: 'catalog-north-star' },
      })
    );
  });
});
