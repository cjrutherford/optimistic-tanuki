import { resolvePublishedCapabilityPolicy } from '@optimistic-tanuki/configurable-plugin-contracts';

/** Shared-policy composition for a published Store catalog. */
export function resolveStorePublishedComposition() {
  return resolvePublishedCapabilityPolicy('store.catalog', 'public-content');
}
