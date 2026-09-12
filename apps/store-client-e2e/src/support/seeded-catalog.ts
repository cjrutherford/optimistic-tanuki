/**
 * The catalog store-seed creates. Public product reads require a catalogId, so
 * the catalog page shows nothing unless it is opened with one. Keep this id in
 * step with SEEDED_CATALOG in apps/store/src/seed-store.ts.
 */
export const SEEDED_CATALOG_ID = '5e5d0c47-4a1b-4c8e-9f2a-3b7d6c1e0a01';

export const SEEDED_CATALOG_PATH = `/catalog?catalogId=${SEEDED_CATALOG_ID}`;

/**
 * Matches the product list request whatever its query string. A URL glob
 * ending in /api/store/products must match the whole URL, so it stopped matching once
 * the catalog page began sending `?catalogId=` — mocks silently never fired.
 */
export const isProductsRequest = (url: URL): boolean =>
  url.pathname === '/api/store/products';
