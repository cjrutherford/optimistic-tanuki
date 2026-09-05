import { LemonSqueezyAdapter } from './lemon-squeezy.adapter';

/**
 * The spec beside this one covers checkout and webhook handling. These drive
 * the catalog lookups, whose branches decide which store's credentials a given
 * app scope resolves to — getting that wrong would route a charge to the wrong
 * merchant account.
 */
describe('LemonSqueezyAdapter catalog', () => {
  const defaultConfig = { apiKey: 'default-key', storeId: 'default-store' };
  const hubConfig = { apiKey: 'hub-key', storeId: 'hub-store' };
  const storeConfig = { apiKey: 'store-key', storeId: 'store-store' };

  const adapter = new LemonSqueezyAdapter({
    default: defaultConfig,
    stores: { 'local-hub': hubConfig, store: storeConfig },
  });

  describe('listCatalogStores', () => {
    it('returns just the matching store for a known scope', () => {
      expect(adapter.listCatalogStores('local-hub')).toEqual([
        { appScope: 'local-hub', config: hubConfig },
      ]);
    });

    it('returns nothing for a scope the catalog does not carry', () => {
      expect(adapter.listCatalogStores('nonsense')).toEqual([]);
    });

    it.each([
      ['no scope is given', undefined],
      ['the scope is explicitly default', 'default'],
    ])('lists the default plus every store when %s', (_case, scope) => {
      const listed = adapter.listCatalogStores(scope);

      expect(listed).toEqual([
        { appScope: 'default', config: defaultConfig },
        { appScope: 'local-hub', config: hubConfig },
        { appScope: 'store', config: storeConfig },
      ]);
    });
  });

  describe('getStoreConfig', () => {
    it('resolves a scope that has its own store', () => {
      expect(adapter.getStoreConfig('local-hub')).toBe(hubConfig);
    });

    it.each([
      ['an unknown scope', 'nonsense'],
      ['an empty scope', ''],
    ])('falls back to the default config for %s', (_case, scope) => {
      expect(adapter.getStoreConfig(scope)).toBe(defaultConfig);
    });
  });
});
